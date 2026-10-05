import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STAFF_LEVELS = ["hospital", "branch", "team"];

/* ---------------------------------------------------------- role matrix */

export const getRoleMatrix = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { hospitalId: string | null; roleId: string | null }) => i)
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const [{ data: roles }, { data: permissions }, { data: isSa }] = await Promise.all([
      sb.from("roles").select("id, key, name, description, role_level").order("role_level").order("name"),
      sb.from("permissions").select("id, module, action").order("module"),
      sb.rpc("is_super_admin", { _user_id: context.userId }),
    ]);
    const visible = (roles ?? []).filter((r) => !data.hospitalId || (STAFF_LEVELS.includes(r.role_level) && r.key !== "hospital_admin") || r.key === "hospital_admin");
    const roleId = visible.find((r) => r.id === data.roleId)?.id ?? visible[0]?.id ?? null;
    const { data: defaults } = roleId
      ? await sb.from("role_permissions").select("role_id, permission_id").eq("role_id", roleId)
      : { data: [] as { role_id: string; permission_id: string }[] };
    let overrides: { role_id: string; permission_id: string; allowed: boolean }[] = [];
    let canEdit = !!isSa;
    if (data.hospitalId) {
      const [{ data: o }, { data: adm }] = await Promise.all([
        sb.from("hospital_role_permissions").select("role_id, permission_id, allowed").eq("hospital_id", data.hospitalId).eq("role_id", roleId ?? ""),
        sb.rpc("is_hospital_admin", { _user_id: context.userId, _hospital_id: data.hospitalId }),
      ]);
      overrides = o ?? [];
      canEdit = !!adm;
    }
    return { roles: roles ?? [], roleId, permissions: permissions ?? [], defaults: defaults ?? [], overrides, canEdit };
  });

export const setRolePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    hospitalId: z.string().uuid().nullable(), roleId: z.string().uuid(),
    permissionId: z.string().uuid(), allowed: z.boolean(),
  }).parse(i))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    if (!data.hospitalId) {
      const q = data.allowed
        ? sb.from("role_permissions").insert({ role_id: data.roleId, permission_id: data.permissionId })
        : sb.from("role_permissions").delete().eq("role_id", data.roleId).eq("permission_id", data.permissionId);
      const { error } = await q;
      if (error && !error.message.includes("duplicate")) throw new Error("Only a Super Admin can change the default rules.");
      return { ok: true };
    }
    const { data: h } = await sb.from("hospitals").select("organization_id").eq("id", data.hospitalId).single();
    if (!h) throw new Error("This hospital is not available to you.");
    const { data: role } = await sb.from("roles").select("key, role_level").eq("id", data.roleId).single();
    if (!role || !STAFF_LEVELS.includes(role.role_level) || role.key === "hospital_admin")
      throw new Error("Hospitals can only change rules for staff roles.");
    const { data: def } = await sb.from("role_permissions").select("id").eq("role_id", data.roleId).eq("permission_id", data.permissionId).maybeSingle();
    // Matching the default means no override is needed
    if (!!def === data.allowed) {
      const { error } = await sb.from("hospital_role_permissions").delete()
        .eq("hospital_id", data.hospitalId).eq("role_id", data.roleId).eq("permission_id", data.permissionId);
      if (error) throw new Error("You do not have permission to change this hospital's rules.");
      return { ok: true };
    }
    const { error } = await sb.from("hospital_role_permissions").upsert({
      organization_id: h.organization_id, hospital_id: data.hospitalId, role_id: data.roleId,
      permission_id: data.permissionId, allowed: data.allowed, created_by: context.userId, updated_by: context.userId,
    }, { onConflict: "hospital_id,role_id,permission_id" });
    if (error) throw new Error("You do not have permission to change this hospital's rules.");
    return { ok: true };
  });

export const resetHospitalRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ hospitalId: z.string().uuid(), roleId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("hospital_role_permissions").delete()
      .eq("hospital_id", data.hospitalId).eq("role_id", data.roleId);
    if (error) throw new Error("You do not have permission to change this hospital's rules.");
    return { ok: true };
  });

/* -------------------------------------------------------- staff welcome */

export const getWelcomeData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [{ data: branches }, { data: departments }, { data: teams }, { data: mine }, { data: canDept }, { data: canTeam }] = await Promise.all([
      sb.from("branches").select("id, hospital_id, name").is("deleted_at", null).order("name"),
      sb.from("departments").select("id, hospital_id, branch_id, name, dept_type").is("deleted_at", null).order("name"),
      sb.from("teams").select("id, hospital_id, department_id, name").is("deleted_at", null).order("name"),
      sb.from("team_members").select("team_id").eq("user_id", context.userId),
      sb.rpc("has_permission", { _user_id: context.userId, _module: "master_data", _action: "EDIT" }),
      sb.rpc("has_permission", { _user_id: context.userId, _module: "teams", _action: "EDIT" }),
    ]);
    return {
      branches: branches ?? [], departments: departments ?? [], teams: teams ?? [],
      myTeamIds: (mine ?? []).map((m) => m.team_id),
      canCreateDepartment: !!canDept, canCreateTeam: !!canTeam,
    };
  });

const codeOf = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 16) || "NEW";

export const createWelcomeStructure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    kind: z.enum(["department", "team"]),
    hospitalId: z.string().uuid(),
    name: z.string().trim().min(2, "Names need at least 2 characters").max(120),
    deptType: z.enum(["clinical", "rcm", "finance", "support"]).optional(),
    departmentId: z.string().uuid().nullable().optional(),
  }).parse(i))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: h } = await sb.from("hospitals").select("organization_id").eq("id", data.hospitalId).single();
    if (!h) throw new Error("This hospital is not available to you.");
    const code = `${codeOf(data.name)}-${Math.floor(Math.random() * 900 + 100)}`;
    const base = { organization_id: h.organization_id, hospital_id: data.hospitalId, name: data.name, code, created_by: context.userId, updated_by: context.userId };
    const res = data.kind === "department"
      ? await sb.from("departments").insert({ ...base, dept_type: data.deptType ?? "rcm" }).select("id").single()
      : await sb.from("teams").insert({ ...base, department_id: data.departmentId ?? null, manager_id: context.userId }).select("id").single();
    if (res.error) throw new Error(res.error.message.includes("row-level") ? `Your role cannot create a ${data.kind}. Ask your hospital admin.` : `That ${data.kind} could not be created.`);
    return { id: res.data.id };
  });

export const saveWelcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    full_name: z.string().trim().min(2, "Enter your full name").max(120),
    phone: z.string().trim().max(20).regex(/^[0-9+\s-]*$/, "Phone can only contain numbers, +, - and spaces"),
    job_title: z.string().trim().max(80),
    departmentId: z.string().uuid().nullable(),
    teamId: z.string().uuid().nullable(),
    finish: z.boolean(),
  }).parse(i))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { error } = await sb.from("profiles").update({
      full_name: data.full_name, phone: data.phone || null, job_title: data.job_title || null,
      department_id: data.departmentId, updated_by: context.userId,
      ...(data.finish ? { onboarded_at: new Date().toISOString() } : {}),
    }).eq("id", context.userId);
    if (error) throw new Error("Your details could not be saved.");
    if (data.teamId) {
      const { data: t } = await sb.from("teams").select("organization_id").eq("id", data.teamId).single();
      if (!t) throw new Error("That team is not available to you.");
      const { error: te } = await sb.from("team_members").insert({
        organization_id: t.organization_id, team_id: data.teamId, user_id: context.userId, role_in_team: "member", created_by: context.userId,
      });
      if (te && !te.message.includes("duplicate")) throw new Error("You could not be added to that team.");
    }
    return { ok: true };
  });
