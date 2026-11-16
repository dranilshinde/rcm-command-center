import { outstandingAmount } from "./rcm-definitions";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACTIVE_TASK_STATUSES } from "./claims-domain";

const PAGE = 25;

function friendly(message: string, label = "record") {
  if (message.includes("row-level security") || message.includes("permission denied"))
    return "You do not have permission to do this.";
  if (message.includes("duplicate key")) return `That ${label} already exists.`;
  return `We could not save this ${label}. Please check the details and try again.`;
}

/* ================================================================= queries */

export const listQueries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { view: string; page?: number }) => d)
  .handler(async ({ context, data }) => {
    const page = Math.max(1, data.page ?? 1);
    const now = new Date().toISOString();
    let q = context.supabase.from("claim_queries")
      .select("id, category, query_text, raised_at, due_at, status, reply_text, replied_at, claim_id, claims(claim_code, claimed_amount, patients(full_name), admissions(insurers(name), tpas(name)), profiles:assigned_to(full_name)), hospitals(name)", { count: "exact" })
      .order("due_at", { ascending: true })
      .range((page - 1) * PAGE, page * PAGE - 1);
    if (data.view === "open") q = q.eq("status", "open");
    if (data.view === "overdue") q = q.eq("status", "open").lt("due_at", now);
    if (data.view === "replied") q = q.eq("status", "replied");
    const { data: rows, count, error } = await q;
    if (error) throw new Error("You do not have permission to view payer queries.");
    const [open, overdue] = await Promise.all([
      context.supabase.from("claim_queries").select("id", { count: "exact", head: true }).eq("status", "open"),
      context.supabase.from("claim_queries").select("id", { count: "exact", head: true }).eq("status", "open").lt("due_at", now),
    ]);
    return { rows: (rows ?? []) as any[], total: count ?? 0, pageSize: PAGE, counts: { open: open.count ?? 0, overdue: overdue.count ?? 0 } };
  });

/* =============================================================== follow-ups */

const followupSchema = z.object({
  claimId: z.string().uuid(),
  channel: z.enum(["call", "email", "portal", "visit", "whatsapp"]),
  contact_name: z.string().trim().max(200).nullable().optional(),
  spoc_id: z.string().uuid().nullable().optional(),
  outcome: z.enum(["in_process", "payment_committed", "documents_requested", "under_query", "no_response", "approved", "rejected", "other"]),
  notes: z.string().max(2000).nullable().optional(),
  commitment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  commitment_amount: z.number().min(0).max(1e9).nullable().optional(),
  next_followup_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const logFollowup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => followupSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    if (data.outcome === "payment_committed" && !data.commitment_date) throw new Error("Enter the date the payer committed to pay.");
    const { data: c } = await sb.from("claims").select("id, claim_code, organization_id, hospital_id, branch_id, assigned_to, approved_amount, claimed_amount").eq("id", data.claimId).maybeSingle();
    if (!c) throw new Error("Claim not found.");
    const { data: me } = await sb.from("profiles").select("full_name").eq("id", context.userId).maybeSingle();
    const next = data.next_followup_at ? new Date(`${data.next_followup_at}T10:00:00+05:30`).toISOString()
      : data.commitment_date ? new Date(`${data.commitment_date}T18:00:00+05:30`).toISOString() : null;
    const { error } = await sb.from("claim_followups").insert({
      organization_id: c.organization_id, hospital_id: c.hospital_id, claim_id: c.id, channel: data.channel,
      contact_name: data.contact_name || null, spoc_id: data.spoc_id ?? null, outcome: data.outcome, notes: data.notes || null,
      commitment_date: data.commitment_date ?? null, commitment_amount: data.commitment_amount ?? null,
      next_followup_at: next, author_name: me?.full_name ?? null, created_by: context.userId,
    });
    if (error) throw new Error(friendly(error.message, "follow-up"));
    await sb.from("tasks").update({ status: "completed", completed_at: new Date().toISOString(), updated_by: context.userId })
      .eq("claim_id", c.id).in("task_type", ["payer_followup", "commitment_missed"]).in("status", ACTIVE_TASK_STATUSES);
    if (next) {
      await sb.from("tasks").insert({
        organization_id: c.organization_id, hospital_id: c.hospital_id, branch_id: c.branch_id, claim_id: c.id, entity_id: c.id,
        title: data.commitment_date ? `Check payment committed for ${data.commitment_date} — ${c.claim_code}` : `Next payer follow-up — ${c.claim_code}`,
        task_type: "payer_followup", status: "waiting", assigned_to: c.assigned_to ?? context.userId, due_at: next,
        amount_at_stake: Number(data.commitment_amount ?? c.approved_amount ?? c.claimed_amount), created_by: context.userId,
      });
    }
    await sb.from("claims").update({ next_followup_at: next, updated_by: context.userId }).eq("id", c.id);
    return { ok: true };
  });

export const getFollowupCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { page?: number }) => d)
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const page = Math.max(1, data.page ?? 1);
    const pendingStatuses = ["submitted", "query", "query_replied", "approved", "short_paid"];
    const { data: rows, count, error } = await sb.from("claims")
      .select("id, claim_code, status, claimed_amount, approved_amount, settled_amount, tds_amount, last_status_at, document_submitted_at, next_followup_at, sla_due_at, escalation_level, hospitals(name), patients(full_name), admissions(insurers(name), tpas(name)), profiles:assigned_to(full_name), claim_followups(created_at, outcome, commitment_date)", { count: "exact" })
      .is("deleted_at", null).in("status", pendingStatuses)
      .order("next_followup_at", { ascending: true, nullsFirst: true })
      .order("last_status_at", { ascending: true })
      .range((page - 1) * PAGE, page * PAGE - 1);
    if (error) throw new Error("You do not have permission to view payer follow-ups.");

    const today = new Date().toISOString().slice(0, 10);
    const { data: commits } = await sb.from("claim_followups")
      .select("id, commitment_date, commitment_amount, contact_name, claim_id, claims(claim_code, status, settled_amount, patients(full_name), admissions(insurers(name), tpas(name)))")
      .not("commitment_date", "is", null).gte("commitment_date", new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10))
      .order("commitment_date").limit(200);

    // payer exposure, paged to keep memory bounded
    const byPayer = new Map<string, { payer: string; claims: number; pending: number; oldestDays: number }>();
    for (let from = 0; from < 20000; from += 1000) {
      const { data: chunk } = await sb.from("claims")
        .select("claimed_amount, approved_amount, settled_amount, tds_amount, document_submitted_at, created_at, admissions(insurers(name), tpas(name))")
        .is("deleted_at", null).in("status", pendingStatuses).range(from, from + 999);
      for (const c of (chunk ?? []) as any[]) {
        const payer = c.admissions?.tpas?.name ?? c.admissions?.insurers?.name ?? "Payer not set";
        const e = byPayer.get(payer) ?? { payer, claims: 0, pending: 0, oldestDays: 0 };
        e.claims++;
        e.pending += outstandingAmount(c);
        const age = Math.floor((Date.now() - new Date(c.document_submitted_at ?? c.created_at).getTime()) / 864e5);
        e.oldestDays = Math.max(e.oldestDays, age);
        byPayer.set(payer, e);
      }
      if (!chunk || chunk.length < 1000) break;
    }
    return {
      rows: (rows ?? []) as any[], total: count ?? 0, pageSize: PAGE,
      commitments: ((commits ?? []) as any[])
        .filter((f) => !["settled", "closed"].includes(f.claims?.status))
        .map((f) => ({ ...f, missed: f.commitment_date < today })),
      byPayer: Array.from(byPayer.values()).sort((a, b) => b.pending - a.pending),
    };
  });

/* ============================================================== escalations */

export const listEscalations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status: string; page?: number }) => d)
  .handler(async ({ context, data }) => {
    const page = Math.max(1, data.page ?? 1);
    let q = context.supabase.from("escalations")
      .select("id, level, reason, notified_roles, status, resolution_note, created_at, resolved_at, claim_id, task_id, hospitals(name), claims(claim_code, claimed_amount, approved_amount, patients(full_name), admissions(insurers(name), tpas(name)))", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE, page * PAGE - 1);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, count, error } = await q;
    if (error) throw new Error("You do not have permission to view escalations.");
    return { rows: (rows ?? []) as any[], total: count ?? 0, pageSize: PAGE };
  });

export const resolveEscalation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), note: z.string().trim().min(3).max(1000) }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("escalations").update({
      status: "resolved", resolution_note: data.note, resolved_at: new Date().toISOString(), resolved_by: context.userId,
    }).eq("id", data.id);
    if (error) throw new Error(friendly(error.message, "escalation"));
    return { ok: true };
  });

/* ==================================================================== rules */

export const listRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [sla, rem, run] = await Promise.all([
      sb.from("sla_rules").select("*, hospitals(name), insurers(name), tpas(name)").order("process").order("created_at"),
      sb.from("reminder_rules").select("*, hospitals(name), insurers(name), tpas(name)").order("rule_key").order("created_at"),
      sb.from("engine_runs").select("started_at, finished_at, stats").order("started_at", { ascending: false }).limit(1),
    ]);
    return { sla: (sla.data ?? []) as any[], reminders: (rem.data ?? []) as any[], lastRun: run.data?.[0] ?? null };
  });

const scope = {
  hospital_id: z.string().uuid().nullable(),
  insurer_id: z.string().uuid().nullable(),
  tpa_id: z.string().uuid().nullable(),
};

async function orgFor(sb: any, userId: string, hospitalId: string | null) {
  if (hospitalId) {
    const { data } = await sb.from("hospitals").select("organization_id").eq("id", hospitalId).maybeSingle();
    if (!data) throw new Error("You do not have access to this hospital.");
    return data.organization_id as string;
  }
  const { data } = await sb.from("profiles").select("organization_id").eq("id", userId).maybeSingle();
  if (data?.organization_id) return data.organization_id as string;
  const { data: h } = await sb.from("hospitals").select("organization_id").limit(1).maybeSingle();
  if (!h) throw new Error("Add a hospital before creating rules.");
  return h.organization_id as string;
}

export const saveSlaRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().nullable(), process: z.enum(["query_response", "submission", "payment", "settlement"]),
    target_hours: z.number().int().min(1).max(24 * 365), description: z.string().max(300).nullable(), ...scope,
  }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { id, ...rest } = data;
    if (id) {
      const { error } = await sb.from("sla_rules").update({ target_hours: rest.target_hours, description: rest.description, updated_by: context.userId }).eq("id", id);
      if (error) throw new Error(friendly(error.message, "SLA rule"));
    } else {
      const organization_id = await orgFor(sb, context.userId, rest.hospital_id);
      const { error } = await sb.from("sla_rules").insert({ ...rest, organization_id, created_by: context.userId });
      if (error) throw new Error(friendly(error.message, "SLA rule"));
    }
    return { ok: true };
  });

export const saveReminderRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().nullable(),
    rule_key: z.enum(["payer_followup", "no_response", "commitment_missed", "sla_breach", "escalate_l1", "escalate_l2", "escalate_l3", "escalate_l4", "escalate_l5", "escalate_l6"]),
    name: z.string().trim().min(3).max(200), threshold_hours: z.number().int().min(0).max(24 * 730),
    notify_roles: z.array(z.string().max(50)).max(10), ...scope,
  }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { id, ...rest } = data;
    const level = rest.rule_key.startsWith("escalate_l") ? Number(rest.rule_key.slice(-1)) : rest.rule_key === "sla_breach" ? 1 : 0;
    if (id) {
      const { error } = await sb.from("reminder_rules").update({ name: rest.name, threshold_hours: rest.threshold_hours, notify_roles: rest.notify_roles, updated_by: context.userId }).eq("id", id);
      if (error) throw new Error(friendly(error.message, "rule"));
    } else {
      const organization_id = await orgFor(sb, context.userId, rest.hospital_id);
      const { error } = await sb.from("reminder_rules").insert({ ...rest, escalation_level: level, organization_id, created_by: context.userId });
      if (error) throw new Error(friendly(error.message, "rule"));
    }
    return { ok: true };
  });

export const toggleRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ kind: z.enum(["sla", "reminder"]), id: z.string().uuid(), is_active: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const table = data.kind === "sla" ? "sla_rules" : "reminder_rules";
    const { error, count } = await context.supabase.from(table).update({ is_active: data.is_active, updated_by: context.userId }, { count: "exact" }).eq("id", data.id);
    if (error || !count) throw new Error("You do not have permission to change this rule. Platform defaults can only be changed by the platform admin — add an override instead.");
    return { ok: true };
  });

export const runEngineNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [{ data: sa }, { data: perm }] = await Promise.all([
      sb.rpc("is_super_admin", { _user_id: context.userId }),
      sb.rpc("has_permission", { _user_id: context.userId, _module: "followups", _action: "CONFIGURE" }),
    ]);
    if (!sa && !perm) throw new Error("You do not have permission to run the follow-up engine.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("run_rcm_engine");
    if (error) { console.error("run_rcm_engine", error); throw new Error("The follow-up check failed. Please try again."); }
    return data as Record<string, number>;
  });
