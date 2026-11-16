import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const code = z.string().trim().min(2, "Codes need at least 2 characters").max(20).regex(/^[A-Z0-9_-]+$/, "Codes use capital letters, numbers, - or _");
const name = z.string().trim().min(2, "Names need at least 2 characters").max(120);

const schema = z.object({
  organizationId: z.string().uuid(),
  group: z.union([
    z.object({ mode: z.literal("existing"), id: z.string().uuid() }),
    z.object({ mode: z.literal("new"), name, code, headquarters_city: z.string().max(80) }),
  ]),
  hospitals: z.array(z.object({
    key: z.string(),
    name, code,
    city: z.string().max(80), state: z.string().max(80),
    bed_count: z.number().int().min(0).max(20000).nullable(),
    branches: z.array(z.object({ key: z.string(), name, code, city: z.string().max(80) })).max(50),
    departments: z.array(z.object({
      name, code,
      dept_type: z.enum(["clinical", "rcm", "finance", "support"]),
      branchKey: z.string().nullable(),
    })).max(100),
    admins: z.array(z.object({
      full_name: name,
      email: z.string().trim().toLowerCase().email("Enter a valid email"),
      roleKey: z.enum(["hospital_admin", "rcm_head", "cfo", "finance_head"]),
    })).max(20),
  })).min(1, "Add at least one hospital").max(20),
  redirectTo: z.string().url(),
});

export type OnboardingInput = z.infer<typeof schema>;
export type OnboardingResult = {
  groupId: string | null;
  hospitals: { name: string; id: string | null; branches: number; departments: number; admins: number }[];
  problems: string[];
};

function friendly(msg: string, what: string) {
  if (msg.includes("duplicate key")) return `${what}: that code is already in use.`;
  if (msg.includes("row-level security")) return `${what}: you do not have permission.`;
  return `${what}: could not be saved.`;
}

export const runOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ context, data }): Promise<OnboardingResult> => {
    const sb = context.supabase;
    const uid = context.userId;

    const [{ data: isSa }, { data: canCreate }] = await Promise.all([
      sb.rpc("is_super_admin", { _user_id: uid }),
      sb.rpc("has_permission", { _user_id: uid, _module: "hospitals", _action: "CREATE" }),
    ]);
    if (!isSa && !canCreate) throw new Error("You do not have permission to onboard hospitals.");

    const problems: string[] = [];
    const orgId = data.organizationId;
    let groupId: string | null = null;

    if (data.group.mode === "existing") {
      groupId = data.group.id;
    } else {
      const { data: g, error } = await sb.from("hospital_groups").insert({
        organization_id: orgId, name: data.group.name, code: data.group.code,
        headquarters_city: data.group.headquarters_city || null, created_by: uid, updated_by: uid,
      }).select("id").single();
      if (error) throw new Error(friendly(error.message, `Group ${data.group.name}`));
      groupId = g.id;
    }

    const results: OnboardingResult["hospitals"] = [];
    const { data: roles } = await sb.from("roles").select("id, key");
    const roleId = (k: string) => roles?.find((r) => r.key === k)?.id;

    for (const h of data.hospitals) {
      const { data: hosp, error } = await sb.from("hospitals").insert({
        organization_id: orgId, hospital_group_id: groupId, name: h.name, code: h.code,
        city: h.city || null, state: h.state || null, bed_count: h.bed_count,
        status: "onboarding", created_by: uid, updated_by: uid,
      }).select("id").single();
      if (error) { problems.push(friendly(error.message, `Hospital ${h.name}`)); results.push({ name: h.name, id: null, branches: 0, departments: 0, admins: 0 }); continue; }

      const branchIds = new Map<string, string>();
      for (const b of h.branches) {
        const { data: br, error: e } = await sb.from("branches").insert({
          organization_id: orgId, hospital_id: hosp.id, name: b.name, code: b.code,
          city: b.city || null, state: h.state || null, created_by: uid, updated_by: uid,
        }).select("id").single();
        if (e) problems.push(friendly(e.message, `Branch ${b.name}`)); else branchIds.set(b.key, br.id);
      }

      let deptCount = 0;
      for (const d of h.departments) {
        const { error: e } = await sb.from("departments").insert({
          organization_id: orgId, hospital_id: hosp.id,
          branch_id: d.branchKey ? branchIds.get(d.branchKey) ?? null : null,
          name: d.name, code: d.code, dept_type: d.dept_type, created_by: uid, updated_by: uid,
        });
        if (e) problems.push(friendly(e.message, `Department ${d.name}`)); else deptCount++;
      }

      let adminCount = 0;
      if (h.admins.length) {
        const { inviteHospitalAdmin } = await import("./invite.server");
        for (const a of h.admins) {
          const r = await inviteHospitalAdmin({
            organizationId: orgId, hospitalId: hosp.id, email: a.email, fullName: a.full_name,
            roleKey: a.roleKey, invitedBy: uid, redirectTo: data.redirectTo,
          });
          if (r.ok) adminCount++; else problems.push(r.reason);
        }
      }

      // tick the matching go-live checklist steps
      const done = ["hospital_details"];
      if (branchIds.size) done.push("branches");
      if (deptCount) done.push("departments");
      if (adminCount) done.push("users");
      const { data: cl } = await sb.from("onboarding_checklists").insert({ organization_id: orgId, hospital_id: hosp.id }).select("id").single();
      if (cl) {
        await sb.from("onboarding_steps").insert(STEPS.map((s, i) => ({
          checklist_id: cl.id, organization_id: orgId, hospital_id: hosp.id, step_key: s[0], title: s[1], sort_order: i + 1,
          status: done.includes(s[0]) ? "completed" : "pending",
          completed_at: done.includes(s[0]) ? new Date().toISOString() : null,
          completed_by: done.includes(s[0]) ? uid : null,
        })));
      }

      results.push({ name: h.name, id: hosp.id, branches: branchIds.size, departments: deptCount, admins: adminCount });
    }

    return { groupId, hospitals: results, problems };
  });

const STEPS: [string, string][] = [
  ["hospital_details", "Hospital details captured"], ["branches", "Branches created"],
  ["departments", "Departments created"], ["teams", "Teams created"], ["payers", "Payers mapped"],
  ["tpas", "TPAs mapped"], ["spocs", "TPA contacts captured"],
  ["users", "Users created and roles assigned"], ["historical_claims", "Historical claims imported"],
  ["sla", "SLA rules configured"], ["workflows", "Workflows configured"],
  ["escalation", "Escalation matrix configured"], ["go_live", "Go live"],
];
