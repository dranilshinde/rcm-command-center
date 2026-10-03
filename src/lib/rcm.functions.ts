import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ---------------------------------------------------------------- session */

export const bootstrapSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = (context.claims as { email?: string } | null)?.email ?? null;
    const { error } = await supabaseAdmin.rpc("bootstrap_user", {
      _user_id: context.userId,
      _email: email ?? "",
    });
    if (error) throw new Error("We could not finish setting up your account.");
    return { ok: true };
  });

export type SessionContext = {
  userId: string;
  profile: {
    id: string;
    full_name: string;
    email: string | null;
    job_title: string | null;
    status: string;
    availability: string;
    is_platform_user: boolean;
  } | null;
  roles: { key: string; name: string }[];
  permissions: string[];
  isSuperAdmin: boolean;
  hospitals: {
    id: string;
    name: string;
    code: string;
    city: string | null;
    state: string | null;
    status: string;
    hospital_group_id: string | null;
  }[];
  groups: { id: string; name: string; code: string }[];
};

export const getSessionContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SessionContext> => {
    const sb = context.supabase;
    const userId = context.userId;

    const { data: profile } = await sb
      .from("profiles")
      .select("id, full_name, email, job_title, status, availability, is_platform_user")
      .eq("id", userId)
      .maybeSingle();

    const { data: userRoles } = await sb
      .from("user_roles")
      .select("role_id, roles(key, name)")
      .eq("user_id", userId);

    const roleIds = (userRoles ?? []).map((r) => r.role_id);
    const roles = (userRoles ?? [])
      .map((r) => r.roles as unknown as { key: string; name: string } | null)
      .filter((r): r is { key: string; name: string } => !!r);

    let permissions: string[] = [];
    if (roleIds.length) {
      const { data: rp } = await sb
        .from("role_permissions")
        .select("permissions(module, action)")
        .in("role_id", roleIds);
      permissions = Array.from(
        new Set(
          (rp ?? [])
            .map((row) => row.permissions as unknown as { module: string; action: string } | null)
            .filter((p): p is { module: string; action: string } => !!p)
            .map((p) => `${p.module}.${p.action}`),
        ),
      );
    }

    const { data: hospitals } = await sb
      .from("hospitals")
      .select("id, name, code, city, state, status, hospital_group_id")
      .is("deleted_at", null)
      .order("name");

    const { data: groups } = await sb
      .from("hospital_groups")
      .select("id, name, code")
      .is("deleted_at", null)
      .order("name");

    return {
      userId,
      profile: profile ?? null,
      roles,
      permissions,
      isSuperAdmin: roles.some((r) => r.key === "super_admin"),
      hospitals: hospitals ?? [],
      groups: groups ?? [],
    };
  });

/* -------------------------------------------------------------- dashboard */

export const getFoundationStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const count = async (table: string, filter?: (q: any) => any) => {
      let q = sb.from(table as never).select("*", { count: "exact", head: true });
      if (filter) q = filter(q);
      const { count: c } = await q;
      return c ?? 0;
    };

    const [groups, hospitals, activeHospitals, onboarding, branches, departments, teams, users, insurers, tpas, spocs, auditToday] =
      await Promise.all([
        count("hospital_groups"),
        count("hospitals"),
        count("hospitals", (q) => q.eq("status", "active")),
        count("hospitals", (q) => q.eq("status", "onboarding")),
        count("branches"),
        count("departments"),
        count("teams"),
        count("profiles"),
        count("insurers"),
        count("tpas"),
        count("tpa_spocs"),
        count("audit_logs", (q) =>
          q.gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
        ),
      ]);

    const { data: steps } = await sb.from("onboarding_steps").select("status");
    const totalSteps = steps?.length ?? 0;
    const doneSteps = (steps ?? []).filter((s) => s.status === "completed").length;

    return {
      groups,
      hospitals,
      activeHospitals,
      onboarding,
      branches,
      departments,
      teams,
      users,
      insurers,
      tpas,
      spocs,
      auditToday,
      onboardingProgress: totalSteps ? Math.round((doneSteps / totalSteps) * 100) : 0,
    };
  });

/* ----------------------------------------------------------- organisation */

export const listHospitalGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("hospital_groups")
      .select("id, name, code, headquarters_city, status, organization_id, organizations(name)")
      .is("deleted_at", null)
      .order("name");
    if (error) throw new Error("We could not load the hospital groups.");

    const { data: hospitals } = await context.supabase
      .from("hospitals")
      .select("id, hospital_group_id")
      .is("deleted_at", null);

    return (data ?? []).map((g) => ({
      ...g,
      organization_name: (g.organizations as unknown as { name: string } | null)?.name ?? "—",
      hospital_count: (hospitals ?? []).filter((h) => h.hospital_group_id === g.id).length,
    }));
  });

export const listOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("organizations")
      .select("id, name, code, org_type, status")
      .order("name");
    return data ?? [];
  });

export const listHospitals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { search?: string; status?: string; page?: number; pageSize?: number }) => input)
  .handler(async ({ context, data }) => {
    const page = data.page ?? 1;
    const pageSize = Math.min(data.pageSize ?? 25, 100);
    let q = context.supabase
      .from("hospitals")
      .select(
        "id, name, code, city, state, bed_count, status, go_live_date, hospital_group_id, organization_id, hospital_groups(name)",
        { count: "exact" },
      )
      .is("deleted_at", null);
    if (data.search) q = q.or(`name.ilike.%${data.search}%,code.ilike.%${data.search}%,city.ilike.%${data.search}%`);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, count, error } = await q
      .order("name")
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw new Error("We could not load the hospitals.");

    const ids = (rows ?? []).map((r) => r.id);
    const { data: branches } = ids.length
      ? await context.supabase.from("branches").select("id, hospital_id").in("hospital_id", ids)
      : { data: [] as { id: string; hospital_id: string }[] };

    return {
      rows: (rows ?? []).map((h) => ({
        ...h,
        group_name: (h.hospital_groups as unknown as { name: string } | null)?.name ?? "—",
        branch_count: (branches ?? []).filter((b) => b.hospital_id === h.id).length,
      })),
      total: count ?? 0,
      page,
      pageSize,
    };
  });

export const getHospitalDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { hospitalId: string }) => input)
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: hospital, error } = await sb
      .from("hospitals")
      .select("id, name, code, city, state, bed_count, status, go_live_date, organization_id, hospital_group_id, hospital_groups(name)")
      .eq("id", data.hospitalId)
      .maybeSingle();
    if (error || !hospital) throw new Error("This hospital is not available to you.");

    const [{ data: branches }, { data: departments }, { data: teams }, { data: steps }] = await Promise.all([
      sb.from("branches").select("id, name, code, city, state, status").eq("hospital_id", hospital.id).is("deleted_at", null).order("name"),
      sb.from("departments").select("id, name, code, dept_type, branch_id, status").eq("hospital_id", hospital.id).is("deleted_at", null).order("name"),
      sb.from("teams").select("id, name, code, branch_id, department_id, status").eq("hospital_id", hospital.id).is("deleted_at", null).order("name"),
      sb.from("onboarding_steps").select("id, step_key, title, sort_order, status, completed_at").eq("hospital_id", hospital.id).order("sort_order"),
    ]);

    return {
      hospital: {
        ...hospital,
        group_name: (hospital.hospital_groups as unknown as { name: string } | null)?.name ?? "—",
      },
      branches: branches ?? [],
      departments: departments ?? [],
      teams: teams ?? [],
      steps: steps ?? [],
    };
  });

export const createHospital = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    organization_id: string;
    hospital_group_id: string | null;
    name: string;
    code: string;
    city: string;
    state: string;
    bed_count: number | null;
  }) => input)
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("hospitals")
      .insert({ ...data, created_by: context.userId, updated_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(friendly(error.message, "hospital code"));

    const { data: checklist } = await context.supabase
      .from("onboarding_checklists")
      .insert({ organization_id: data.organization_id, hospital_id: row.id })
      .select("id")
      .single();
    if (checklist) {
      const steps = DEFAULT_ONBOARDING_STEPS.map((s, i) => ({
        checklist_id: checklist.id,
        organization_id: data.organization_id,
        hospital_id: row.id,
        step_key: s.key,
        title: s.title,
        sort_order: i + 1,
      }));
      await context.supabase.from("onboarding_steps").insert(steps);
    }
    return { id: row.id };
  });

export const createHospitalGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organization_id: string; name: string; code: string; headquarters_city: string }) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("hospital_groups")
      .insert({ ...data, created_by: context.userId, updated_by: context.userId });
    if (error) throw new Error(friendly(error.message, "group code"));
    return { ok: true };
  });

export const createBranch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organization_id: string; hospital_id: string; name: string; code: string; city: string; state: string }) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("branches")
      .insert({ ...data, created_by: context.userId, updated_by: context.userId });
    if (error) throw new Error(friendly(error.message, "branch code"));
    return { ok: true };
  });

export const createDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    organization_id: string;
    hospital_id: string;
    branch_id: string | null;
    name: string;
    code: string;
    dept_type: string;
  }) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("departments")
      .insert({ ...data, created_by: context.userId, updated_by: context.userId });
    if (error) throw new Error(friendly(error.message, "department code"));
    return { ok: true };
  });

export const createTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    organization_id: string;
    hospital_id: string;
    branch_id: string | null;
    department_id: string | null;
    name: string;
    code: string;
  }) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("teams")
      .insert({ ...data, created_by: context.userId, updated_by: context.userId });
    if (error) throw new Error(friendly(error.message, "team code"));
    return { ok: true };
  });

export const setOnboardingStepStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { stepId: string; status: string }) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("onboarding_steps")
      .update({
        status: data.status,
        completed_at: data.status === "completed" ? new Date().toISOString() : null,
        completed_by: data.status === "completed" ? context.userId : null,
      })
      .eq("id", data.stepId);
    if (error) throw new Error("You do not have permission to update this checklist.");
    return { ok: true };
  });

/* ------------------------------------------------------------------ users */

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data: profiles, error } = await sb
      .from("profiles")
      .select("id, full_name, email, phone, job_title, employee_code, status, availability, is_platform_user, organization_id, last_active_at")
      .order("full_name");
    if (error) throw new Error("You do not have permission to view users.");

    const { data: userRoles } = await sb.from("user_roles").select("user_id, hospital_id, roles(key, name)");
    const { data: scopes } = await sb.from("user_scopes").select("user_id, scope_type, hospital_id, branch_id, hospital_group_id");

    return (profiles ?? []).map((p) => ({
      ...p,
      roles: (userRoles ?? [])
        .filter((r) => r.user_id === p.id)
        .map((r) => (r.roles as unknown as { key: string; name: string } | null)?.name ?? "")
        .filter(Boolean),
      scopes: (scopes ?? []).filter((s) => s.user_id === p.id),
    }));
  });

export const listRolesWithPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [{ data: roles }, { data: permissions }, { data: rp }] = await Promise.all([
      sb.from("roles").select("id, key, name, description, role_level").order("role_level").order("name"),
      sb.from("permissions").select("id, module, action").order("module").order("action"),
      sb.from("role_permissions").select("role_id, permission_id"),
    ]);
    return { roles: roles ?? [], permissions: permissions ?? [], rolePermissions: rp ?? [] };
  });

export const assignUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; roleId: string; hospitalId: string | null }) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("user_roles").insert({
      user_id: data.userId,
      role_id: data.roleId,
      hospital_id: data.hospitalId,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message.includes("duplicate") ? "This user already has that role." : "You do not have permission to assign roles.");
    return { ok: true };
  });

export const grantUserScope = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; scopeType: string; hospitalId?: string | null; branchId?: string | null; groupId?: string | null; organizationId?: string | null }) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("user_scopes").insert({
      user_id: data.userId,
      scope_type: data.scopeType,
      hospital_id: data.hospitalId ?? null,
      branch_id: data.branchId ?? null,
      hospital_group_id: data.groupId ?? null,
      organization_id: data.organizationId ?? null,
      created_by: context.userId,
    });
    if (error) throw new Error("You do not have permission to change access.");
    return { ok: true };
  });

export const updateOwnProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { full_name: string; phone: string; job_title: string; availability: string }) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("profiles").update(data).eq("id", context.userId);
    if (error) throw new Error("We could not save your profile.");
    return { ok: true };
  });

/* ----------------------------------------------------------------- payers */

export const listPayers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [{ data: insurers }, { data: tpas }, { data: spocs }] = await Promise.all([
      sb.from("insurers").select("id, name, payer_code, insurer_type, portal_url, support_email, support_phone, escalation_email, relationship_notes, preferred_channel, target_payment_days, status").is("deleted_at", null).order("name"),
      sb.from("tpas").select("id, name, tpa_code, portal_url, support_email, support_phone, escalation_email, relationship_notes, preferred_channel, target_payment_days, status").is("deleted_at", null).order("name"),
      sb.from("tpa_spocs").select("id, name, designation, email, phone, location, escalation_level, status, tpa_id, insurer_id, hospital_id, tpas(name), insurers(name), hospitals(name)").order("name"),
    ]);
    return {
      insurers: insurers ?? [],
      tpas: tpas ?? [],
      spocs: (spocs ?? []).map((s) => ({
        ...s,
        tpa_name: (s.tpas as unknown as { name: string } | null)?.name ?? (s.insurers as unknown as { name: string } | null)?.name ?? "—",
        hospital_name: (s.hospitals as unknown as { name: string } | null)?.name ?? "All hospitals",
      })),
    };
  });

/* ------------------------------------------------------------ master data */

export const listMasterData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [{ data: lists }, { data: items }] = await Promise.all([
      sb.from("master_lists").select("id, key, name, description").order("name"),
      sb.from("master_list_items").select("id, list_id, code, label, sort_order, is_active").order("sort_order"),
    ]);
    return { lists: lists ?? [], items: items ?? [] };
  });

export const createMasterItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { listId: string; code: string; label: string; sortOrder: number }) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("master_list_items").insert({
      list_id: data.listId,
      code: data.code,
      label: data.label,
      sort_order: data.sortOrder,
      created_by: context.userId,
      updated_by: context.userId,
    });
    if (error) throw new Error("You do not have permission to change master data.");
    return { ok: true };
  });

export const toggleMasterItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { itemId: string; isActive: boolean }) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("master_list_items")
      .update({ is_active: data.isActive, updated_by: context.userId })
      .eq("id", data.itemId);
    if (error) throw new Error("You do not have permission to change master data.");
    return { ok: true };
  });

/* --------------------------------------------------- notifications, audit */

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("notifications")
      .select("id, title, body, category, severity, link_to, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    await context.supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", data.id);
    return { ok: true };
  });

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { page?: number; module?: string }) => input)
  .handler(async ({ context, data }) => {
    const page = data.page ?? 1;
    const pageSize = 30;
    let q = context.supabase
      .from("audit_logs")
      .select("id, actor_name, actor_id, module, action, record_label, record_id, created_at, hospital_id", { count: "exact" });
    if (data.module && data.module !== "all") q = q.eq("module", data.module);
    const { data: rows, count, error } = await q
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw new Error("You do not have permission to view the audit log.");
    return { rows: rows ?? [], total: count ?? 0, page, pageSize };
  });

/* ---------------------------------------------------------------- helpers */

const DEFAULT_ONBOARDING_STEPS = [
  { key: "hospital_details", title: "Hospital details captured" },
  { key: "branches", title: "Branches created" },
  { key: "departments", title: "Departments created" },
  { key: "teams", title: "Teams created" },
  { key: "payers", title: "Payers mapped" },
  { key: "tpas", title: "TPAs mapped" },
  { key: "spocs", title: "TPA contacts captured" },
  { key: "tariffs", title: "Tariffs uploaded" },
  { key: "users", title: "Users created and roles assigned" },
  { key: "historical_claims", title: "Historical claims imported" },
  { key: "sla", title: "SLA rules configured" },
  { key: "workflows", title: "Workflows configured" },
  { key: "escalation", title: "Escalation matrix configured" },
  { key: "go_live", title: "Go live" },
];

function friendly(message: string, label: string) {
  if (message.includes("duplicate key")) return `That ${label} is already in use. Please choose another.`;
  if (message.includes("violates row-level security")) return "You do not have permission to perform this action.";
  return "We could not save this record. Please check the details and try again.";
}

export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; code: string }) => {
    const name = String(input?.name ?? "").trim();
    const code = String(input?.code ?? "").trim().toUpperCase();
    if (name.length < 2 || name.length > 120) throw new Error("Organisation name needs 2 to 120 characters.");
    if (!/^[A-Z0-9_-]{2,20}$/.test(code)) throw new Error("Code uses 2 to 20 capital letters, numbers, - or _.");
    return { name, code };
  })
  .handler(async ({ context, data }) => {
    const { data: sa } = await context.supabase.rpc("is_super_admin", { _user_id: context.userId });
    if (!sa) throw new Error("Only platform super admins can create organisations.");
    const { data: row, error } = await context.supabase
      .from("organizations")
      .insert({ name: data.name, code: data.code, org_type: "customer", status: "active", created_by: context.userId, updated_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(friendly(error.message, "organisation code"));
    return { id: row.id };
  });
