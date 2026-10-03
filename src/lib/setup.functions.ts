import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

const code = z.string().trim().min(2).max(20).regex(/^[A-Z0-9_-]+$/, "Codes use capital letters, numbers, - or _");
const name = z.string().trim().min(2, "Names need at least 2 characters").max(120);
const status = z.enum(["active", "onboarding", "inactive", "suspended"]);
const ADMIN_ROLES = ["hospital_admin", "rcm_head", "cfo", "finance_head"] as const;

function friendly(msg: string) {
  if (msg.includes("duplicate key")) return "That code is already in use. Please choose another.";
  if (msg.includes("row-level security") || msg.includes("permission")) return "You do not have permission to make this change.";
  return "We could not save this change. Please check the details and try again.";
}

async function assertCanManageUsers(ctx: Ctx, hospitalId: string) {
  const [{ data: sa }, { data: perm }, { data: access }] = await Promise.all([
    ctx.supabase.rpc("is_super_admin", { _user_id: ctx.userId }),
    ctx.supabase.rpc("has_permission", { _user_id: ctx.userId, _module: "users", _action: "ASSIGN" }),
    ctx.supabase.rpc("can_access_hospital", { _user_id: ctx.userId, _hospital_id: hospitalId }),
  ]);
  if (!sa && !(perm && access)) throw new Error("You do not have permission to manage admins for this hospital.");
}

async function updateRow(ctx: Ctx, table: string, id: string, values: Record<string, unknown>) {
  const { data, error } = await ctx.supabase
    .from(table)
    .update({ ...values, updated_by: ctx.userId })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(friendly(error.message));
  if (!data?.length) throw new Error("You do not have permission to make this change.");
  return { ok: true };
}

/* ------------------------------------------------------------- structure */

export const updateHospitalGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), name, code, headquarters_city: z.string().max(80), status }).parse(i))
  .handler(({ context, data }) => {
    const { id, ...v } = data;
    return updateRow(context, "hospital_groups", id, { ...v, headquarters_city: v.headquarters_city || null });
  });

export const updateHospital = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(), name, code, city: z.string().max(80), state: z.string().max(80),
      bed_count: z.number().int().min(0).max(20000).nullable(), status,
      hospital_group_id: z.string().uuid().nullable(), go_live_date: z.string().nullable(),
    }).parse(i))
  .handler(({ context, data }) => {
    const { id, ...v } = data;
    return updateRow(context, "hospitals", id, {
      ...v, city: v.city || null, state: v.state || null, go_live_date: v.go_live_date || null,
    });
  });

export const updateBranch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), name, code, city: z.string().max(80), state: z.string().max(80), status }).parse(i))
  .handler(({ context, data }) => {
    const { id, ...v } = data;
    return updateRow(context, "branches", id, { ...v, city: v.city || null, state: v.state || null });
  });

export const updateDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(), name, code, dept_type: z.enum(["clinical", "rcm", "finance", "support"]),
      branch_id: z.string().uuid().nullable(), status,
    }).parse(i))
  .handler(({ context, data }) => {
    const { id, ...v } = data;
    return updateRow(context, "departments", id, v);
  });

/* ---------------------------------------------------------------- admins */

export const listHospitalAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { hospitalId: string }) => i)
  .handler(async ({ context, data }) => {
    const { data: rows } = await context.supabase
      .from("user_roles")
      .select("id, user_id, roles(key, name)")
      .eq("hospital_id", data.hospitalId);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const { data: profiles } = ids.length
      ? await context.supabase.from("profiles").select("id, full_name, email, status").in("id", ids)
      : { data: [] as { id: string; full_name: string; email: string | null; status: string }[] };
    return (rows ?? []).map((r) => {
      const role = r.roles as unknown as { key: string; name: string } | null;
      const p = (profiles ?? []).find((x) => x.id === r.user_id);
      return {
        userRoleId: r.id, userId: r.user_id, roleKey: role?.key ?? "", roleName: role?.name ?? "—",
        full_name: p?.full_name ?? "—", email: p?.email ?? null, status: p?.status ?? "active",
      };
    });
  });

export const updateAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      hospitalId: z.string().uuid(), userRoleId: z.string().uuid(), userId: z.string().uuid(),
      full_name: name, roleKey: z.enum(ADMIN_ROLES), status: z.enum(["active", "inactive", "on_leave"]),
    }).parse(i))
  .handler(async ({ context, data }) => {
    await assertCanManageUsers(context, data.hospitalId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: role } = await supabaseAdmin.from("roles").select("id").eq("key", data.roleKey).single();
    const { error: e1 } = await supabaseAdmin.from("user_roles").update({ role_id: role!.id })
      .eq("id", data.userRoleId).eq("hospital_id", data.hospitalId);
    if (e1) throw new Error(e1.message.includes("duplicate") ? "This person already has that role here." : "We could not change the role.");
    const { error: e2 } = await supabaseAdmin.from("profiles")
      .update({ full_name: data.full_name, status: data.status, updated_by: context.userId }).eq("id", data.userId);
    if (e2) throw new Error("We could not update this person.");
    await supabaseAdmin.from("admin_invitations").update({ role_key: data.roleKey, full_name: data.full_name })
      .eq("user_id", data.userId).eq("hospital_id", data.hospitalId).neq("status", "revoked");
    return { ok: true };
  });

export const removeAdminAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ hospitalId: z.string().uuid(), userId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await assertCanManageUsers(context, data.hospitalId);
    if (data.userId === context.userId) throw new Error("You cannot remove your own access.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("hospital_id", data.hospitalId);
    await supabaseAdmin.from("user_scopes").delete().eq("user_id", data.userId).eq("hospital_id", data.hospitalId);
    return { ok: true };
  });

export const addHospitalAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      hospitalId: z.string().uuid(), full_name: name,
      email: z.string().trim().toLowerCase().email("Enter a valid email"),
      roleKey: z.enum(ADMIN_ROLES), redirectTo: z.string().url(),
    }).parse(i))
  .handler(async ({ context, data }) => {
    await assertCanManageUsers(context, data.hospitalId);
    const { data: h } = await context.supabase.from("hospitals").select("organization_id").eq("id", data.hospitalId).single();
    if (!h) throw new Error("This hospital is not available to you.");
    const { inviteHospitalAdmin } = await import("./invite.server");
    const r = await inviteHospitalAdmin({
      organizationId: h.organization_id, hospitalId: data.hospitalId, email: data.email,
      fullName: data.full_name, roleKey: data.roleKey, invitedBy: context.userId, redirectTo: data.redirectTo,
    });
    if (!r.ok) throw new Error(r.reason);
    return { ok: true };
  });

/* ---------------------------------------------------------- team members */

export const inviteTeamMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      hospitalId: z.string().uuid(),
      redirectTo: z.string().url(),
      people: z.array(z.object({
        full_name: name,
        email: z.string().trim().toLowerCase().email("Enter a valid email").max(255),
        roleKey: z.string().trim().min(2).max(60),
      })).min(1, "Add at least one person").max(200, "Invite up to 200 people at a time"),
    }).parse(i))
  .handler(async ({ context, data }) => {
    await assertCanManageUsers(context, data.hospitalId);
    const { data: h } = await context.supabase.from("hospitals").select("organization_id").eq("id", data.hospitalId).single();
    if (!h) throw new Error("This hospital is not available to you.");
    const { data: roles } = await context.supabase.from("roles").select("key, role_level")
      .in("role_level", ["hospital", "branch", "team"]);
    const allowed = new Set((roles ?? []).map((r: { key: string }) => r.key));
    const { inviteHospitalAdmin } = await import("./invite.server");
    const results: { email: string; ok: boolean; reason?: string }[] = [];
    for (const p of data.people) {
      if (!allowed.has(p.roleKey)) { results.push({ email: p.email, ok: false, reason: `${p.email}: that role cannot be given to hospital staff.` }); continue; }
      const r = await inviteHospitalAdmin({
        organizationId: h.organization_id, hospitalId: data.hospitalId, email: p.email,
        fullName: p.full_name, roleKey: p.roleKey, invitedBy: context.userId, redirectTo: data.redirectTo,
      });
      results.push(r.ok ? { email: p.email, ok: true } : { email: p.email, ok: false, reason: r.reason });
    }
    return results;
  });

/* ----------------------------------------------------------- invitations */

export const listInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { status?: string }) => i)
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("admin_invitations")
      .select("id, hospital_id, user_id, email, full_name, role_key, status, send_count, last_sent_at, accepted_at, revoked_at, created_at, hospitals(name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error("You do not have permission to view invitations.");

    // Refresh status: a pending invite becomes accepted once the person has signed in.
    const pending = (rows ?? []).filter((r) => r.status === "pending" && r.user_id).slice(0, 50);
    if (pending.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await Promise.all(pending.map(async (r) => {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(r.user_id!);
        if (u.user?.last_sign_in_at) {
          await supabaseAdmin.from("admin_invitations")
            .update({ status: "accepted", accepted_at: u.user.last_sign_in_at }).eq("id", r.id);
          r.status = "accepted";
          r.accepted_at = u.user.last_sign_in_at;
        }
      }));
    }
    return (rows ?? []).map((r) => ({
      ...r,
      hospital_name: (r.hospitals as unknown as { name: string } | null)?.name ?? "—",
    }));
  });

async function loadInvite(ctx: Ctx, id: string) {
  // RLS-scoped read proves the caller can see this invitation.
  const { data } = await ctx.supabase.from("admin_invitations")
    .select("id, hospital_id, user_id, email, full_name, status").eq("id", id).maybeSingle();
  if (!data) throw new Error("This invitation is not available to you.");
  await assertCanManageUsers(ctx, data.hospital_id);
  return data as { id: string; hospital_id: string; user_id: string | null; email: string; full_name: string; status: string };
}

export const resendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), redirectTo: z.string().url() }).parse(i))
  .handler(async ({ context, data }) => {
    const inv = await loadInvite(context, data.id);
    if (inv.status !== "pending") throw new Error("Only pending invitations can be resent.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (inv.user_id) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(inv.user_id);
      if (u.user?.last_sign_in_at) {
        await supabaseAdmin.from("admin_invitations").update({ status: "accepted", accepted_at: u.user.last_sign_in_at }).eq("id", inv.id);
        throw new Error("This person has already accepted and signed in.");
      }
    }
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(inv.email, {
      data: { full_name: inv.full_name }, redirectTo: data.redirectTo,
    });
    if (error) {
      const wait = /seconds|rate/i.test(error.message);
      throw new Error(wait ? "An invitation was sent very recently. Please wait a minute and try again." : "The invitation email could not be sent.");
    }
    const { data: cur } = await supabaseAdmin.from("admin_invitations").select("send_count").eq("id", inv.id).single();
    await supabaseAdmin.from("admin_invitations")
      .update({ send_count: (cur?.send_count ?? 1) + 1, last_sent_at: new Date().toISOString() }).eq("id", inv.id);
    return { ok: true };
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const inv = await loadInvite(context, data.id);
    if (inv.status !== "pending") throw new Error("Only pending invitations can be revoked. Remove access from the hospital page instead.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (inv.user_id) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", inv.user_id).eq("hospital_id", inv.hospital_id);
      await supabaseAdmin.from("user_scopes").delete().eq("user_id", inv.user_id).eq("hospital_id", inv.hospital_id);
      // If the invitee never signed in and has no other access, remove the unused account entirely.
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(inv.user_id);
      const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("user_id", inv.user_id);
      if (u.user && !u.user.last_sign_in_at && !count) {
        await supabaseAdmin.auth.admin.deleteUser(inv.user_id);
        await supabaseAdmin.from("user_scopes").delete().eq("user_id", inv.user_id);
        await supabaseAdmin.from("profiles").delete().eq("id", inv.user_id);
      }
    }
    await supabaseAdmin.from("admin_invitations")
      .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by: context.userId }).eq("id", inv.id);
    return { ok: true };
  });
