import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ACTIONS, ACTIVE_TASK_STATUSES, OPEN_CLAIM_STATUSES, SHEET_STATUS_MAP,
  computeReadiness, normaliseStatus, type ClaimAction, type ImportRow,
} from "./claims-domain";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
type Sb = SupabaseClient<Database>;

const PAGE = 25;

function friendly(message: string, label = "record") {
  if (message.includes("duplicate key")) return `That ${label} already exists in this hospital.`;
  if (message.includes("row-level security") || message.includes("permission denied"))
    return "You do not have permission to do this for this hospital.";
  return `We could not save this ${label}. Please check the details and try again.`;
}

async function actorName(sb: Sb, userId: string) {
  const { data } = await sb.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  return (data?.full_name as string | undefined) ?? "Unknown user";
}

async function hospitalOrg(sb: Sb, hospitalId: string) {
  const { data } = await sb.from("hospitals").select("organization_id").eq("id", hospitalId).maybeSingle();
  if (!data) throw new Error("You do not have access to this hospital.");
  return data.organization_id as string;
}

/** Hours allowed for a process, using the most specific SLA rule (TPA > insurer > hospital > org > platform). */
async function slaHours(sb: Sb, process: string, hospitalId: string, admissionId: string | null, fallback: number) {
  let ins: string | null = null, tpa: string | null = null;
  if (admissionId) {
    const { data } = await sb.from("admissions").select("insurer_id, tpa_id").eq("id", admissionId).maybeSingle();
    ins = data?.insurer_id ?? null; tpa = data?.tpa_id ?? null;
  }
  const { data } = await sb.rpc("sla_hours", { _process: process, _hosp: hospitalId, _ins: ins as string, _tpa: tpa as string, _default: fallback });
  return typeof data === "number" ? data : fallback;
}
const inHours = (h: number) => new Date(Date.now() + h * 3600e3).toISOString();

/** Recomputes and stores the readiness score of a claim from its admission and pre-auths. */
async function refreshReadiness(sb: Sb, claimId: string) {
  const { data: c } = await sb
    .from("claims")
    .select("id, claimed_amount, approved_amount, document_submitted_at, admission_id, admissions(ip_number, discharge_date, diagnosis, treatment, policy_number, member_id, insurer_id, tpa_id)")
    .eq("id", claimId)
    .maybeSingle();
  if (!c) return;
  const a = c.admissions as unknown as { policy_number: string | null; member_id: string | null; ip_number: string | null; discharge_date: string | null; diagnosis: string | null; treatment: string | null; insurer_id: string | null; tpa_id: string | null } | null;
  const { count } = await sb.from("preauths").select("id", { count: "exact", head: true })
    .eq("admission_id", c.admission_id).eq("status", "approved");
  const r = computeReadiness({
    policy_number: a?.policy_number, member_id: a?.member_id, ip_number: a?.ip_number,
    discharge_date: a?.discharge_date, diagnosis: a?.diagnosis, treatment: a?.treatment,
    has_payer: !!(a?.insurer_id || a?.tpa_id),
    preauth_approved: (count ?? 0) > 0 || Number(c.approved_amount) > 0,
    claimed_amount: Number(c.claimed_amount),
    document_submitted_at: c.document_submitted_at,
  });
  await sb.from("claims").update({ readiness_score: r.score, readiness_gaps: r.gaps }).eq("id", claimId);
}

/* ================================================================ patients */

export const listPatients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string; hospitalId?: string; page?: number }) => d)
  .handler(async ({ context, data }) => {
    const page = Math.max(1, data.page ?? 1);
    let q = context.supabase
      .from("patients")
      .select("id, uhid, full_name, phone, member_id, gender, hospital_id, created_at, hospitals(name), admissions(count)", { count: "exact" })
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE, page * PAGE - 1);
    if (data.hospitalId) q = q.eq("hospital_id", data.hospitalId);
    if (data.search) {
      const s = data.search.replace(/[%,()]/g, "");
      q = q.or(`full_name.ilike.%${s}%,uhid.ilike.%${s}%,member_id.ilike.%${s}%,phone.ilike.%${s}%`);
    }
    const { data: rows, count, error } = await q;
    if (error) throw new Error("You do not have permission to view patients.");
    return {
      rows: (rows ?? []).map((p: any) => ({
        ...p, hospital_name: p.hospitals?.name ?? "—", admission_count: p.admissions?.[0]?.count ?? 0,
      })),
      total: count ?? 0, pageSize: PAGE,
    };
  });

/* ============================================================== admissions */

export const listAdmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string; status?: string; hospitalId?: string; page?: number }) => d)
  .handler(async ({ context, data }) => {
    const page = Math.max(1, data.page ?? 1);
    let q = context.supabase
      .from("admissions")
      .select("id, ip_number, admission_date, discharge_date, status, treatment, diagnosis, policy_number, policy_type, hospital_id, patients(full_name, uhid), hospitals(name), insurers(name), tpas(name), claims(id, claim_code, status), preauths(status, approved_amount)", { count: "exact" })
      .is("deleted_at", null)
      .order("admission_date", { ascending: false })
      .range((page - 1) * PAGE, page * PAGE - 1);
    if (data.hospitalId) q = q.eq("hospital_id", data.hospitalId);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.search) q = q.ilike("ip_number", `%${data.search.replace(/[%,()]/g, "")}%`);
    const { data: rows, count, error } = await q;
    if (error) throw new Error("You do not have permission to view admissions.");
    return { rows: (rows ?? []) as any[], total: count ?? 0, pageSize: PAGE };
  });

const admissionSchema = z.object({
  hospitalId: z.string().uuid(),
  branchId: z.string().uuid().nullable().optional(),
  patientId: z.string().uuid().nullable().optional(),
  patient: z.object({
    full_name: z.string().trim().min(2).max(200),
    uhid: z.string().trim().max(60).nullable().optional(),
    phone: z.string().trim().max(20).nullable().optional(),
    gender: z.string().max(20).nullable().optional(),
  }).optional(),
  ip_number: z.string().trim().max(60).nullable().optional(),
  admission_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  treating_doctor: z.string().max(200).nullable().optional(),
  treatment: z.string().max(500).nullable().optional(),
  diagnosis: z.string().max(500).nullable().optional(),
  insurer_id: z.string().uuid().nullable().optional(),
  tpa_id: z.string().uuid().nullable().optional(),
  policy_number: z.string().max(100).nullable().optional(),
  policy_type: z.string().max(40).nullable().optional(),
  member_id: z.string().max(100).nullable().optional(),
  policy_holder_name: z.string().max(200).nullable().optional(),
});

export const createAdmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => admissionSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const org = await hospitalOrg(sb, data.hospitalId);
    let patientId = data.patientId ?? null;
    if (!patientId) {
      if (!data.patient) throw new Error("Choose an existing patient or enter the patient's name.");
      if (data.patient.uhid) {
        const { data: ex } = await sb.from("patients").select("id").eq("hospital_id", data.hospitalId).eq("uhid", data.patient.uhid).maybeSingle();
        patientId = ex?.id ?? null;
      }
      if (!patientId) {
        const { data: p, error } = await sb.from("patients").insert({
          organization_id: org, hospital_id: data.hospitalId, full_name: data.patient.full_name,
          uhid: data.patient.uhid || null, phone: data.patient.phone || null, gender: data.patient.gender || null,
          member_id: data.member_id || null, created_by: context.userId,
        }).select("id").single();
        if (error) throw new Error(friendly(error.message, "patient"));
        patientId = p.id;
      }
    }
    const { data: adm, error } = await sb.from("admissions").insert({
      organization_id: org, hospital_id: data.hospitalId, branch_id: data.branchId ?? null, patient_id: patientId!,
      ip_number: data.ip_number || null, admission_date: data.admission_date,
      treating_doctor: data.treating_doctor || null, treatment: data.treatment || null, diagnosis: data.diagnosis || null,
      insurer_id: data.insurer_id ?? null, tpa_id: data.tpa_id ?? null, policy_number: data.policy_number || null,
      policy_type: data.policy_type || null, member_id: data.member_id || null,
      policy_holder_name: data.policy_holder_name || null, created_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(friendly(error.message, "in-patient number"));
    return { id: adm.id as string };
  });

/** Discharging creates the claim (draft) and a "prepare claim" task. */
export const dischargeAdmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    admissionId: z.string().uuid(),
    discharge_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    claimed_amount: z.number().min(0).max(1e9),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: a, error: ae } = await sb.from("admissions")
      .select("id, organization_id, hospital_id, branch_id, patient_id, admission_date, status, claims(id)")
      .eq("id", data.admissionId).maybeSingle();
    if (ae || !a) throw new Error("Admission not found.");
    if (data.discharge_date < a.admission_date) throw new Error("Discharge date cannot be before the admission date.");
    const { error } = await sb.from("admissions").update({ status: "discharged", discharge_date: data.discharge_date, updated_by: context.userId }).eq("id", a.id);
    if (error) throw new Error(friendly(error.message, "admission"));
    const existing = (a.claims as { id: string }[] | null)?.[0];
    if (existing) { await refreshReadiness(sb, existing.id); return { claimId: existing.id, created: false }; }

    const { data: claim, error: ce } = await sb.from("claims").insert({
      organization_id: a.organization_id, hospital_id: a.hospital_id, branch_id: a.branch_id,
      admission_id: a.id, patient_id: a.patient_id, claimed_amount: data.claimed_amount,
      status: "draft", created_by: context.userId,
    }).select("id, claim_code").single();
    if (ce) throw new Error(friendly(ce.message, "claim"));
    const name = await actorName(sb, context.userId);
    await sb.from("claim_status_history").insert({
      organization_id: a.organization_id, hospital_id: a.hospital_id, claim_id: claim.id,
      to_status: "draft", note: "Claim created on discharge", actor_id: context.userId, actor_name: name,
    });
    await sb.from("tasks").insert({
      organization_id: a.organization_id, hospital_id: a.hospital_id, branch_id: a.branch_id,
      claim_id: claim.id, entity_id: claim.id, title: `Prepare claim ${claim.claim_code}`,
      task_type: "prepare_claim", due_at: inHours(await slaHours(sb, "submission", a.hospital_id, a.id, 72)),
      amount_at_stake: data.claimed_amount, created_by: context.userId,
    });
    await refreshReadiness(sb, claim.id);
    return { claimId: claim.id as string, created: true };
  });

/* ================================================================ pre-auth */

export const listPreauths = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; page?: number }) => d)
  .handler(async ({ context, data }) => {
    const page = Math.max(1, data.page ?? 1);
    let q = context.supabase.from("preauths")
      .select("id, reference_no, kind, requested_amount, approved_amount, status, requested_at, decided_at, remarks, admission_id, admissions(ip_number, patients(full_name), hospitals(name), insurers(name), tpas(name))", { count: "exact" })
      .order("requested_at", { ascending: false })
      .range((page - 1) * PAGE, page * PAGE - 1);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, count, error } = await q;
    if (error) throw new Error("You do not have permission to view pre-authorisations.");
    return { rows: (rows ?? []) as any[], total: count ?? 0, pageSize: PAGE };
  });

export const createPreauth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    admissionId: z.string().uuid(), kind: z.enum(["initial", "enhancement", "final"]),
    requested_amount: z.number().min(0).max(1e9), reference_no: z.string().max(100).nullable().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: a } = await sb.from("admissions").select("organization_id, hospital_id, branch_id, ip_number, patients(full_name)").eq("id", data.admissionId).maybeSingle();
    if (!a) throw new Error("Admission not found.");
    const { data: pa, error } = await sb.from("preauths").insert({
      organization_id: a.organization_id, hospital_id: a.hospital_id, admission_id: data.admissionId,
      kind: data.kind, requested_amount: data.requested_amount, reference_no: data.reference_no || null,
      created_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(friendly(error.message, "pre-auth"));
    const pname = (a.patients as unknown as { full_name: string } | null)?.full_name ?? "patient";
    await sb.from("tasks").insert({
      organization_id: a.organization_id, hospital_id: a.hospital_id, branch_id: a.branch_id,
      entity_type: "preauth", entity_id: pa.id, title: `Pre-auth decision pending — ${pname}${a.ip_number ? ` (IP ${a.ip_number})` : ""}`,
      task_type: "preauth", priority: "high", amount_at_stake: data.requested_amount,
      due_at: inHours(await slaHours(sb, "preauth", a.hospital_id, data.admissionId, 4)), created_by: context.userId,
    });
    return { ok: true };
  });

export const decidePreauth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    preauthId: z.string().uuid(), status: z.enum(["requested", "query", "approved", "rejected"]),
    approved_amount: z.number().min(0).max(1e9).nullable().optional(), remarks: z.string().max(1000).nullable().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    if (data.status === "approved" && !data.approved_amount) throw new Error("Enter the approved amount.");
    const { data: p, error } = await sb.from("preauths").update({
      status: data.status, approved_amount: data.status === "approved" ? (data.approved_amount ?? null) : null,
      remarks: data.remarks || null, decided_at: ["approved", "rejected"].includes(data.status) ? new Date().toISOString() : null,
      updated_by: context.userId,
    }).eq("id", data.preauthId).select("admission_id").single();
    if (error) throw new Error(friendly(error.message, "pre-auth"));
    if (["approved", "rejected"].includes(data.status)) {
      await sb.from("tasks").update({ status: "completed", completed_at: new Date().toISOString(), updated_by: context.userId })
        .eq("entity_type", "preauth").eq("entity_id", data.preauthId).in("status", ACTIVE_TASK_STATUSES);
    }
    const { data: claims } = await sb.from("claims").select("id").eq("admission_id", p.admission_id);
    for (const c of claims ?? []) await refreshReadiness(sb, c.id);
    return { ok: true };
  });

/* ================================================================== claims */

export const listClaims = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string; status?: string; hospitalId?: string; readiness?: string; from?: string; to?: string; page?: number }) => d)
  .handler(async ({ context, data }) => {
    const page = Math.max(1, data.page ?? 1);
    let q = context.supabase.from("claims")
      .select("id, claim_code, external_claim_no, status, reconciled, claim_date, claimed_amount, approved_amount, settled_amount, short_payment, readiness_score, priority, sla_due_at, sla_process, escalation_level, hospital_id, hospitals(name), patients(full_name), admissions(ip_number, insurers(name), tpas(name)), profiles:assigned_to(full_name)", { count: "exact" })
      .is("deleted_at", null)
      .order("claim_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE, page * PAGE - 1);
    if (data.hospitalId) q = q.eq("hospital_id", data.hospitalId);
    if (data.status === "open") q = q.in("status", OPEN_CLAIM_STATUSES);
    else if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.readiness === "ready") q = q.gte("readiness_score", 90);
    if (data.readiness === "review") q = q.gte("readiness_score", 75).lt("readiness_score", 90);
    if (data.readiness === "not_ready") q = q.lt("readiness_score", 75);
    if (data.readiness === "sla_breached") q = q.lt("sla_due_at", new Date().toISOString()).in("status", OPEN_CLAIM_STATUSES);
    if (data.from) q = q.gte("claim_date", data.from);
    if (data.to) q = q.lte("claim_date", data.to);
    if (data.search) {
      const s = data.search.replace(/[%,()]/g, "");
      q = q.or(`claim_code.ilike.%${s}%,external_claim_no.ilike.%${s}%,case_ref_id.ilike.%${s}%`);
    }
    const { data: rows, count, error } = await q;
    if (error) throw new Error("You do not have permission to view claims.");
    return { rows: (rows ?? []) as any[], total: count ?? 0, pageSize: PAGE };
  });

export const getClaimDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { claimId: string }) => z.object({ claimId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: claim, error } = await sb.from("claims")
      .select("*, hospitals(name, rohini_id), patients(id, full_name, uhid, phone, member_id), admissions(*, insurers(name), tpas(name)), profiles:assigned_to(id, full_name)")
      .eq("id", data.claimId).maybeSingle();
    if (error || !claim) throw new Error("This claim does not exist or you do not have access to it.");
    const [history, notes, payments, couriers, preauths, tasks, queries, followups, escalations] = await Promise.all([
      sb.from("claim_status_history").select("*").eq("claim_id", claim.id).order("created_at"),
      sb.from("claim_notes").select("*").eq("claim_id", claim.id).order("created_at"),
      sb.from("claim_payments").select("*").eq("claim_id", claim.id).order("payment_date"),
      sb.from("claim_couriers").select("*").eq("claim_id", claim.id),
      sb.from("preauths").select("*").eq("admission_id", claim.admission_id).order("requested_at"),
      sb.from("tasks").select("id, title, status, priority, due_at, task_type, profiles:assigned_to(full_name)").eq("claim_id", claim.id).order("created_at", { ascending: false }),
      sb.from("claim_queries").select("*").eq("claim_id", claim.id).order("raised_at", { ascending: false }),
      sb.from("claim_followups").select("*").eq("claim_id", claim.id).order("created_at", { ascending: false }),
      sb.from("escalations").select("*").eq("claim_id", claim.id).order("created_at", { ascending: false }),
    ]);
    return {
      claim: claim as any,
      history: history.data ?? [], notes: notes.data ?? [], payments: payments.data ?? [],
      couriers: couriers.data ?? [], preauths: preauths.data ?? [], tasks: (tasks.data ?? []) as any[],
      queries: queries.data ?? [], followups: followups.data ?? [], escalations: escalations.data ?? [],
    };
  });

export const runClaimAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    claimId: z.string().uuid(),
    action: z.enum(Object.keys(ACTIONS) as [ClaimAction, ...ClaimAction[]]),
    note: z.string().max(2000).nullable().optional(),
    external_claim_no: z.string().max(100).nullable().optional(),
    approved_amount: z.number().min(0).max(1e9).nullable().optional(),
    query_category: z.string().max(40).nullable().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: c } = await sb.from("claims").select("id, claim_code, status, organization_id, hospital_id, branch_id, admission_id, approved_amount, claimed_amount, short_payment, readiness_score, assigned_to").eq("id", data.claimId).maybeSingle();
    if (!c) throw new Error("Claim not found.");
    const def = ACTIONS[data.action];
    if (!def.from.includes(c.status)) throw new Error(`"${def.label}" is not possible while the claim is ${c.status.replace(/_/g, " ")}.`);
    if ((data.action === "record_query" || data.action === "deny") && !data.note?.trim())
      throw new Error("Please describe the query or denial reason.");
    if (data.action === "approve" && !data.approved_amount) throw new Error("Enter the approved amount.");
    if (data.action === "reply_query" && !data.note?.trim()) throw new Error("Write the reply you sent to the payer.");
    const sla: Partial<Record<ClaimAction, [string, number]>> = {
      submit: ["settlement", 1080], record_query: ["query_response", 48], reply_query: ["settlement", 1080], approve: ["payment", 720],
    };
    const slaDef = sla[data.action];
    const slaH = slaDef ? await slaHours(sb, slaDef[0], c.hospital_id, c.admission_id, slaDef[1]) : null;

    const patch: Database["public"]["Tables"]["claims"]["Update"] = { status: def.to, last_status_at: new Date().toISOString(), updated_by: context.userId };
    if (data.action === "submit") {
      patch.document_submitted_at = new Date().toISOString().slice(0, 10);
      if (data.external_claim_no) patch.external_claim_no = data.external_claim_no;
    }
    if (data.action === "approve") patch.approved_amount = data.approved_amount ?? 0;
    if (slaDef && slaH) { patch.sla_process = slaDef[0]; patch.sla_due_at = inHours(slaH); }
    if (["settle", "close", "deny", "mark_short_paid"].includes(data.action)) { patch.sla_process = null; patch.sla_due_at = null; }
    if (data.action === "deny" || data.action === "record_query") patch.insurer_comments = data.note ?? null;
    const { error } = await sb.from("claims").update(patch).eq("id", c.id);
    if (error) throw new Error(friendly(error.message, "claim"));

    const name = await actorName(sb, context.userId);
    await sb.from("claim_status_history").insert({
      organization_id: c.organization_id, hospital_id: c.hospital_id, claim_id: c.id,
      from_status: c.status, to_status: def.to, note: data.note || null, actor_id: context.userId, actor_name: name,
    });

    if (data.action === "record_query") {
      await sb.from("claim_queries").insert({
        organization_id: c.organization_id, hospital_id: c.hospital_id, claim_id: c.id, category: data.query_category || "documentation",
        query_text: data.note!, due_at: inHours(slaH ?? 48), created_by: context.userId,
      });
    }
    if (data.action === "reply_query") {
      await sb.from("claim_queries").update({ status: "replied", reply_text: data.note ?? null, replied_at: new Date().toISOString(), replied_by: context.userId, updated_by: context.userId })
        .eq("claim_id", c.id).eq("status", "open");
    }
    // close tasks that this step resolves, open the next one
    const resolves: Record<string, string[]> = {
      submit: ["prepare_claim"], reply_query: ["query"], settle: ["payment_followup", "short_payment", "commitment_missed"],
      close: ["prepare_claim", "query", "denial", "payment_followup", "short_payment", "commitment_missed"],
    };
    if (resolves[data.action]) {
      await sb.from("tasks").update({ status: "completed", completed_at: new Date().toISOString(), updated_by: context.userId })
        .eq("claim_id", c.id).in("task_type", resolves[data.action]!).in("status", ACTIVE_TASK_STATUSES);
    }
    const next: Partial<Record<ClaimAction, { title: string; type: string; hours: number; priority?: string }>> = {
      record_query: { title: `Reply to payer query — ${c.claim_code}`, type: "query", hours: slaH ?? 48, priority: "high" },
      deny: { title: `Review denial — ${c.claim_code}`, type: "denial", hours: 72, priority: "high" },
      approve: { title: `Follow up payment — ${c.claim_code}`, type: "payment_followup", hours: slaH ?? 720 },
      mark_short_paid: { title: `Recover short payment — ${c.claim_code}`, type: "short_payment", hours: 24 * 7, priority: "high" },
    };
    const n = next[data.action];
    if (n) {
      await sb.from("tasks").insert({
        organization_id: c.organization_id, hospital_id: c.hospital_id, branch_id: c.branch_id,
        claim_id: c.id, entity_id: c.id, title: n.title, task_type: n.type, priority: n.priority ?? "normal",
        description: data.note || null, assigned_to: c.assigned_to,
        due_at: new Date(Date.now() + n.hours * 3600e3).toISOString(),
        amount_at_stake: Number(data.approved_amount ?? c.approved_amount ?? c.claimed_amount), created_by: context.userId,
      });
    }
    await refreshReadiness(sb, c.id);
    return { ok: true };
  });

export const updateClaimDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    claimId: z.string().uuid(),
    claimed_amount: z.number().min(0).max(1e9), copay: z.number().min(0).max(1e9),
    hospital_discount: z.number().min(0).max(1e9), patient_paid: z.number().min(0).max(1e9),
    shortfall_amount: z.number().min(0).max(1e9),
    external_claim_no: z.string().max(100).nullable(), invoice_number: z.string().max(100).nullable(),
    priority: z.enum(["low", "normal", "high", "urgent"]),
    diagnosis: z.string().max(500).nullable(), treatment: z.string().max(500).nullable(),
    policy_number: z.string().max(100).nullable(), member_id: z.string().max(100).nullable(),
    ip_number: z.string().max(60).nullable(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: c, error } = await sb.from("claims").update({
      claimed_amount: data.claimed_amount, copay: data.copay, hospital_discount: data.hospital_discount,
      patient_paid: data.patient_paid, shortfall_amount: data.shortfall_amount,
      external_claim_no: data.external_claim_no || null, invoice_number: data.invoice_number || null,
      priority: data.priority, updated_by: context.userId,
    }).eq("id", data.claimId).select("admission_id").single();
    if (error) throw new Error(friendly(error.message, "claim number"));
    const { error: ae } = await sb.from("admissions").update({
      diagnosis: data.diagnosis || null, treatment: data.treatment || null, policy_number: data.policy_number || null,
      member_id: data.member_id || null, ip_number: data.ip_number || null, updated_by: context.userId,
    }).eq("id", c.admission_id);
    if (ae) throw new Error(friendly(ae.message, "in-patient number"));
    await refreshReadiness(sb, data.claimId);
    return { ok: true };
  });

export const addClaimNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ claimId: z.string().uuid(), body: z.string().trim().min(1).max(2000) }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: c } = await sb.from("claims").select("organization_id, hospital_id").eq("id", data.claimId).maybeSingle();
    if (!c) throw new Error("Claim not found.");
    const { error } = await sb.from("claim_notes").insert({
      organization_id: c.organization_id, hospital_id: c.hospital_id, claim_id: data.claimId,
      body: data.body, author_id: context.userId, author_name: await actorName(sb, context.userId),
    });
    if (error) throw new Error(friendly(error.message, "note"));
    return { ok: true };
  });

export const recordPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    claimId: z.string().uuid(), amount: z.number().positive().max(1e9), tds_amount: z.number().min(0).max(1e9),
    utr_number: z.string().trim().min(3).max(100), payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    receipt_no: z.string().max(100).nullable().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: c } = await sb.from("claims").select("id, organization_id, hospital_id, status, approved_amount").eq("id", data.claimId).maybeSingle();
    if (!c) throw new Error("Claim not found.");
    if (!["approved", "short_paid", "settled"].includes(c.status)) throw new Error("Record the approval before recording a payment.");
    const { error } = await sb.from("claim_payments").insert({
      organization_id: c.organization_id, hospital_id: c.hospital_id, claim_id: c.id, amount: data.amount,
      tds_amount: data.tds_amount, utr_number: data.utr_number, payment_date: data.payment_date,
      receipt_no: data.receipt_no || null, created_by: context.userId,
    });
    if (error) throw new Error(friendly(error.message, "payment"));
    const { data: pays } = await sb.from("claim_payments").select("amount, tds_amount").eq("claim_id", c.id);
    const settled = (pays ?? []).reduce((s, p) => s + Number(p.amount), 0);
    const tds = (pays ?? []).reduce((s, p) => s + Number(p.tds_amount), 0);
    const short = Number(c.approved_amount) - settled - tds;
    const to = short > 0.5 ? "short_paid" : "settled";
    await sb.from("claims").update({ settled_amount: settled, tds_amount: tds, payment_date: data.payment_date, status: to, last_status_at: new Date().toISOString(), updated_by: context.userId }).eq("id", c.id);
    const name = await actorName(sb, context.userId);
    await sb.from("claim_status_history").insert({
      organization_id: c.organization_id, hospital_id: c.hospital_id, claim_id: c.id, from_status: c.status, to_status: to,
      note: `Payment ₹${data.amount.toLocaleString("en-IN")} received (UTR ${data.utr_number})`, actor_id: context.userId, actor_name: name,
    });
    await sb.from("tasks").update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("claim_id", c.id).in("task_type", ["payment_followup", "payer_followup", "commitment_missed"]).in("status", ACTIVE_TASK_STATUSES);
    if (to === "short_paid") {
      const { count } = await sb.from("tasks").select("id", { count: "exact", head: true }).eq("claim_id", c.id).eq("task_type", "short_payment").in("status", ACTIVE_TASK_STATUSES);
      if (!count) await sb.from("tasks").insert({
        organization_id: c.organization_id, hospital_id: c.hospital_id, claim_id: c.id, entity_id: c.id,
        title: "Recover short payment", task_type: "short_payment", priority: "high", amount_at_stake: short,
        due_at: new Date(Date.now() + 7 * 864e5).toISOString(), created_by: context.userId,
      });
    }
    return { status: to, shortPayment: Math.max(short, 0) };
  });

export const listAssignees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { hospitalId?: string }) => d)
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    let q = sb.from("user_roles").select("user_id, hospital_id, profiles(id, full_name, status)");
    if (data.hospitalId) q = q.or(`hospital_id.eq.${data.hospitalId},hospital_id.is.null`);
    const { data: rows } = await q;
    const map = new Map<string, string>();
    for (const r of rows ?? []) {
      const p = r.profiles as unknown as { id: string; full_name: string; status: string } | null;
      if (p && p.status !== "inactive") map.set(p.id, p.full_name);
    }
    return Array.from(map, ([id, full_name]) => ({ id, full_name })).sort((a, b) => a.full_name.localeCompare(b.full_name));
  });

export const assignClaims = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ claimIds: z.array(z.string().uuid()).min(1).max(200), userId: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error, count } = await context.supabase.from("claims").update({ assigned_to: data.userId, updated_by: context.userId }, { count: "exact" }).in("id", data.claimIds);
    if (error) throw new Error(friendly(error.message, "assignment"));
    await context.supabase.from("tasks").update({ assigned_to: data.userId }).in("claim_id", data.claimIds).in("status", ACTIVE_TASK_STATUSES);
    return { updated: count ?? 0 };
  });

/* =================================================================== tasks */

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { view: string; page?: number }) => d)
  .handler(async ({ context, data }) => {
    const page = Math.max(1, data.page ?? 1);
    const now = new Date();
    const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
    let q = context.supabase.from("tasks")
      .select("id, title, description, status, priority, task_type, due_at, amount_at_stake, claim_id, hospital_id, assigned_to, hospitals(name), claims(claim_code, status), profiles:assigned_to(full_name)", { count: "exact" })
      .order("due_at", { ascending: true, nullsFirst: false })
      .range((page - 1) * PAGE, page * PAGE - 1);
    if (data.view === "completed") q = q.in("status", ["completed", "cancelled"]);
    else q = q.in("status", ACTIVE_TASK_STATUSES);
    switch (data.view) {
      case "mine": q = q.eq("assigned_to", context.userId); break;
      case "unassigned": q = q.is("assigned_to", null); break;
      case "due_today": q = q.gte("due_at", now.toISOString()).lte("due_at", endOfDay.toISOString()); break;
      case "overdue": q = q.lt("due_at", now.toISOString()); break;
      case "high_priority": q = q.in("priority", ["high", "urgent"]); break;
      case "high_value": q = q.gte("amount_at_stake", 100000); break;
      case "query": q = q.eq("task_type", "query"); break;
      case "escalated": q = q.eq("status", "escalated"); break;
    }
    const { data: rows, count, error } = await q;
    if (error) throw new Error("You do not have permission to view the work queue.");

    const base = () => context.supabase.from("tasks").select("id", { count: "exact", head: true }).in("status", ACTIVE_TASK_STATUSES);
    const [mine, unassigned, overdue, dueToday] = await Promise.all([
      base().eq("assigned_to", context.userId),
      base().is("assigned_to", null),
      base().lt("due_at", now.toISOString()),
      base().gte("due_at", now.toISOString()).lte("due_at", endOfDay.toISOString()),
    ]);
    return {
      rows: (rows ?? []) as any[], total: count ?? 0, pageSize: PAGE,
      counts: { mine: mine.count ?? 0, unassigned: unassigned.count ?? 0, overdue: overdue.count ?? 0, due_today: dueToday.count ?? 0 },
    };
  });

export const updateTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    taskIds: z.array(z.string().uuid()).min(1).max(200),
    status: z.enum(["open", "in_progress", "waiting", "completed", "cancelled", "escalated"]).optional(),
    assignTo: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const patch: Database["public"]["Tables"]["tasks"]["Update"] = { updated_by: context.userId };
    if (data.status) {
      patch.status = data.status;
      patch.completed_at = data.status === "completed" ? new Date().toISOString() : null;
      if (data.status === "escalated") patch.priority = "urgent";
    }
    if (data.assignTo !== undefined) patch.assigned_to = data.assignTo;
    const { error, count } = await context.supabase.from("tasks").update(patch, { count: "exact" }).in("id", data.taskIds);
    if (error) throw new Error(friendly(error.message, "task"));
    return { updated: count ?? 0 };
  });

/* =================================================================== stats */

export const getClaimStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    // Paged aggregation keeps memory bounded; a DB-side summary view comes with the analytics phase.
    const totals = { count: 0, open: 0, claimed: 0, approved: 0, settled: 0, short: 0, denied: 0, notReady: 0 };
    const byStatus: Record<string, number> = {};
    for (let from = 0; from < 50000; from += 1000) {
      const { data, error } = await sb.from("claims")
        .select("status, claimed_amount, approved_amount, settled_amount, short_payment, readiness_score")
        .is("deleted_at", null).range(from, from + 999);
      if (error) return { totals, byStatus, allowed: false };
      for (const c of data ?? []) {
        totals.count++;
        byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
        if (OPEN_CLAIM_STATUSES.includes(c.status)) { totals.open++; if (c.readiness_score < 75) totals.notReady++; }
        if (c.status === "denied" || c.status === "preauth_rejected") totals.denied++;
        totals.claimed += Number(c.claimed_amount); totals.approved += Number(c.approved_amount);
        totals.settled += Number(c.settled_amount);
        if (c.status === "short_paid") totals.short += Number(c.short_payment);
      }
      if (!data || data.length < 1000) break;
    }
    return { totals, byStatus, allowed: true };
  });

/* ================================================================== import */

const rowSchema = z.object({ row: z.number() }).passthrough();

type RowResult = { row: number; status: "new" | "update" | "error"; errors: string[]; warnings: string[]; label: string };

export const importClaims = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    fileName: z.string().max(255),
    commit: z.boolean(),
    rows: z.array(rowSchema).min(1).max(2000),
    parseErrors: z.record(z.string(), z.array(z.string())).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const rows = data.rows as unknown as ImportRow[];

    const [{ data: hospitals }, { data: insurers }, { data: tpas }] = await Promise.all([
      sb.from("hospitals").select("id, name, rohini_id, organization_id").is("deleted_at", null),
      sb.from("insurers").select("id, name, organization_id").is("deleted_at", null),
      sb.from("tpas").select("id, name, organization_id").is("deleted_at", null),
    ]);
    const norm = (s: string | null) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const findHospital = (r: ImportRow) =>
      (hospitals ?? []).find((h) => r.rohini_id && h.rohini_id && norm(h.rohini_id) === norm(r.rohini_id)) ??
      (hospitals ?? []).find((h) => norm(h.name) === norm(r.hospital_name));
    const findPayer = (list: { id: string; name: string; organization_id: string }[] | null, name: string | null, org: string) => {
      if (!name) return null;
      const n = norm(name);
      return (list ?? []).find((p) => p.organization_id === org && (norm(p.name) === n || n.includes(norm(p.name)) || norm(p.name).includes(n))) ?? null;
    };

    const seen = new Set<string>();
    const results: RowResult[] = [];
    const plans: { r: ImportRow; hospital: NonNullable<ReturnType<typeof findHospital>>; existingId: string | null; mapped: { status: string; reconciled: boolean } }[] = [];

    for (const r of rows) {
      const errors = [...(data.parseErrors?.[String(r.row)] ?? [])];
      const warnings: string[] = [];
      const hospital = findHospital(r);
      if (!r.hospital_name && !r.rohini_id) errors.push("Hospital name is missing");
      else if (!hospital) errors.push(`Hospital "${r.hospital_name ?? r.rohini_id}" is not in your hospitals (add it, or set its Rohini ID)`);
      if (!r.patient_name) errors.push("Patient name is missing");
      if (!r.admission_date) errors.push("Date of admission is missing");
      if (r.admission_date && r.discharge_date && r.discharge_date < r.admission_date) errors.push("Discharge is before admission");
      if (!r.claim_number) errors.push("Claim number is missing");
      const mapped = r.claim_status ? SHEET_STATUS_MAP[normaliseStatus(r.claim_status)] : undefined;
      if (!r.claim_status) errors.push("Claim status is missing");
      else if (!mapped) errors.push(`Unknown claim status "${r.claim_status}"`);
      if (r.settled_amount > r.approved_amount + 1 && r.approved_amount > 0) warnings.push("Settled amount is more than approved amount");
      const key = `${hospital?.id}|${r.claim_number}`;
      if (r.claim_number && seen.has(key)) errors.push("Claim number repeats in this file");
      seen.add(key);
      if (hospital) {
        if (r.insurer_name && !findPayer(insurers, r.insurer_name, hospital.organization_id)) warnings.push(`Insurer "${r.insurer_name}" not in Payers — will be left blank`);
        if (r.tpa_name && !findPayer(tpas, r.tpa_name, hospital.organization_id) && !findPayer(insurers, r.tpa_name, hospital.organization_id)) warnings.push(`TPA "${r.tpa_name}" not in Payers — will be left blank`);
      }
      let existingId: string | null = null;
      if (!errors.length && hospital) {
        const { data: ex } = await sb.from("claims").select("id").eq("hospital_id", hospital.id).eq("external_claim_no", r.claim_number!).maybeSingle();
        existingId = ex?.id ?? null;
      }
      const label = `${r.claim_number ?? "—"} · ${r.patient_name ?? "—"}`;
      results.push({ row: r.row, status: errors.length ? "error" : existingId ? "update" : "new", errors, warnings, label });
      if (!errors.length && hospital && mapped) plans.push({ r, hospital, existingId, mapped });
    }

    const summary = {
      total: rows.length,
      valid: plans.length,
      errors: results.filter((x) => x.status === "error").length,
      newCount: results.filter((x) => x.status === "new").length,
      updateCount: results.filter((x) => x.status === "update").length,
    };
    if (!data.commit) return { committed: false as const, jobId: null, summary, results };
    if (!plans.length) throw new Error("There are no valid rows to import. Fix the errors and upload again.");

    const orgId = plans[0]!.hospital.organization_id;
    const singleHospital = plans.every((p) => p.hospital.id === plans[0]!.hospital.id) ? plans[0]!.hospital.id : null;
    const { data: job, error: je } = await sb.from("import_jobs").insert({
      organization_id: orgId, hospital_id: singleHospital, file_name: data.fileName, status: "running",
      total_rows: summary.total, valid_rows: summary.valid, error_rows: summary.errors, created_by: context.userId,
    }).select("id").single();
    if (je) throw new Error(friendly(je.message, "import job"));

    const name = await actorName(sb, context.userId);
    let created = 0, updated = 0;
    const jobRows: { job_id: string; organization_id: string; row_number: number; status: string; errors: string[]; claim_id: string | null }[] = [];

    for (const { r, hospital, existingId, mapped } of plans) {
      try {
        const org = hospital.organization_id;
        const insurer = findPayer(insurers, r.insurer_name, org);
        const tpa = findPayer(tpas, r.tpa_name, org);
        // patient
        let patientId: string | null = null;
        if (r.uhid) patientId = (await sb.from("patients").select("id").eq("hospital_id", hospital.id).eq("uhid", r.uhid).maybeSingle()).data?.id ?? null;
        if (!patientId && r.member_id) patientId = (await sb.from("patients").select("id").eq("hospital_id", hospital.id).eq("member_id", r.member_id).ilike("full_name", r.patient_name!).maybeSingle()).data?.id ?? null;
        if (!patientId) {
          const { data: p, error } = await sb.from("patients").insert({
            organization_id: org, hospital_id: hospital.id, full_name: r.patient_name!, uhid: r.uhid,
            phone: r.patient_contact?.replace(/\.0$/, "") ?? null, member_id: r.member_id, created_by: context.userId,
          }).select("id").single();
          if (error) throw error;
          patientId = p.id;
        }
        // admission
        const admPatch = {
          organization_id: org, hospital_id: hospital.id, patient_id: patientId!, ip_number: r.ip_number,
          admission_date: r.admission_date!, discharge_date: r.discharge_date, status: r.discharge_date ? "discharged" : "admitted",
          treatment: r.treatment, diagnosis: r.diagnosis, insurer_id: insurer?.id ?? null, tpa_id: tpa?.id ?? null,
          policy_number: r.policy_number, policy_type: r.policy_type, policy_holder_name: r.policy_holder_name,
          employee_code: r.employee_code, member_id: r.member_id,
        };
        let admissionId: string | null = null;
        if (existingId) admissionId = (await sb.from("claims").select("admission_id").eq("id", existingId).single()).data?.admission_id ?? null;
        if (!admissionId && r.ip_number) admissionId = (await sb.from("admissions").select("id").eq("hospital_id", hospital.id).eq("ip_number", r.ip_number).maybeSingle()).data?.id ?? null;
        if (admissionId) {
          const { error } = await sb.from("admissions").update({ ...admPatch, updated_by: context.userId }).eq("id", admissionId);
          if (error) throw error;
        } else {
          const { data: a, error } = await sb.from("admissions").insert({ ...admPatch, created_by: context.userId }).select("id").single();
          if (error) throw error;
          admissionId = a.id;
        }
        if (mapped.status === "preauth_rejected") {
          const { count } = await sb.from("preauths").select("id", { count: "exact", head: true }).eq("admission_id", admissionId!).eq("status", "rejected");
          if (!count) await sb.from("preauths").insert({ organization_id: org, hospital_id: hospital.id, admission_id: admissionId!, status: "rejected", requested_amount: r.claimed_amount, decided_at: new Date().toISOString(), remarks: "Imported", created_by: context.userId });
        }
        // claim
        const claimPatch = {
          organization_id: org, hospital_id: hospital.id, admission_id: admissionId!, patient_id: patientId!,
          external_claim_no: r.claim_number, initial_claim_no: r.initial_claim_number, case_ref_id: r.case_ref_id,
          invoice_number: r.invoice_number, claim_date: r.claim_date ?? r.discharge_date ?? r.admission_date!,
          status: mapped.status, reconciled: mapped.reconciled,
          claimed_amount: r.claimed_amount, approved_amount: r.approved_amount, copay: r.copay,
          shortfall_amount: r.shortfall_amount, hospital_discount: r.hospital_discount, patient_paid: r.patient_paid,
          settled_amount: r.settled_amount, tds_amount: r.tds_amount, document_submitted_at: r.document_submitted_at,
          payment_date: r.payment_date ?? r.utr_date, insurer_comments: r.insurer_comments,
        };
        let claimId = existingId;
        let fromStatus: string | null = null;
        if (claimId) {
          fromStatus = (await sb.from("claims").select("status").eq("id", claimId).single()).data?.status ?? null;
          const { error } = await sb.from("claims").update({ ...claimPatch, updated_by: context.userId }).eq("id", claimId);
          if (error) throw error;
          updated++;
        } else {
          const { data: c, error } = await sb.from("claims").insert({ ...claimPatch, created_by: context.userId }).select("id").single();
          if (error) throw error;
          claimId = c.id; created++;
        }
        if (fromStatus !== mapped.status) {
          await sb.from("claim_status_history").insert({
            organization_id: org, hospital_id: hospital.id, claim_id: claimId!, from_status: fromStatus, to_status: mapped.status,
            note: `Imported from ${data.fileName}${r.claim_status ? ` (“${r.claim_status}”)` : ""}`, actor_id: context.userId, actor_name: name,
          });
        }
        if (r.settled_amount > 0 && r.utr_number) {
          const { count } = await sb.from("claim_payments").select("id", { count: "exact", head: true }).eq("claim_id", claimId!).eq("utr_number", r.utr_number);
          if (!count) await sb.from("claim_payments").insert({
            organization_id: org, hospital_id: hospital.id, claim_id: claimId!, amount: r.settled_amount, tds_amount: r.tds_amount,
            utr_number: r.utr_number, payment_date: r.utr_date ?? r.payment_date, receipt_no: r.receipt_no, created_by: context.userId,
          });
        }
        if (r.courier_agency || r.courier_track_id || r.courier_dispatch_date) {
          await sb.from("claim_couriers").delete().eq("claim_id", claimId!);
          await sb.from("claim_couriers").insert({
            organization_id: org, hospital_id: hospital.id, claim_id: claimId!, agency: r.courier_agency, provider: r.courier_provider,
            destination: r.courier_destination, dispatch_date: r.courier_dispatch_date, sender_name: r.courier_name,
            tracking_id: r.courier_track_id, created_by: context.userId,
          });
        }
        if (mapped.status === "short_paid") {
          const { count } = await sb.from("tasks").select("id", { count: "exact", head: true }).eq("claim_id", claimId!).eq("task_type", "short_payment");
          if (!count) await sb.from("tasks").insert({
            organization_id: org, hospital_id: hospital.id, claim_id: claimId!, entity_id: claimId!, title: `Recover short payment — ${r.claim_number}`,
            task_type: "short_payment", priority: "high", amount_at_stake: Math.max(r.approved_amount - r.settled_amount - r.tds_amount, 0),
            due_at: new Date(Date.now() + 7 * 864e5).toISOString(), created_by: context.userId,
          });
        }
        if (mapped.status === "denied") {
          const { count } = await sb.from("tasks").select("id", { count: "exact", head: true }).eq("claim_id", claimId!).eq("task_type", "denial");
          if (!count) await sb.from("tasks").insert({
            organization_id: org, hospital_id: hospital.id, claim_id: claimId!, entity_id: claimId!, title: `Review denial — ${r.claim_number}`,
            task_type: "denial", priority: "high", amount_at_stake: r.claimed_amount,
            due_at: new Date(Date.now() + 3 * 864e5).toISOString(), created_by: context.userId,
          });
        }
        await refreshReadiness(sb, claimId!);
        jobRows.push({ job_id: job.id, organization_id: orgId, row_number: r.row, status: existingId ? "updated" : "created", errors: [], claim_id: claimId });
      } catch (e) {
        const msg = friendly((e as { message?: string }).message ?? "", "row");
        const res = results.find((x) => x.row === r.row);
        if (res) { res.status = "error"; res.errors.push(msg); }
        jobRows.push({ job_id: job.id, organization_id: orgId, row_number: r.row, status: "failed", errors: [msg], claim_id: null });
      }
    }
    for (const res of results.filter((x) => x.status === "error" && !jobRows.some((j) => j.row_number === x.row)))
      jobRows.push({ job_id: job.id, organization_id: orgId, row_number: res.row, status: "rejected", errors: res.errors, claim_id: null });
    for (let i = 0; i < jobRows.length; i += 500) await sb.from("import_job_rows").insert(jobRows.slice(i, i + 500));

    const failed = jobRows.filter((j) => j.status !== "created" && j.status !== "updated").length;
    await sb.from("import_jobs").update({
      status: failed ? "completed_with_errors" : "completed", created_rows: created, updated_rows: updated,
      error_rows: failed, completed_at: new Date().toISOString(),
    }).eq("id", job.id);
    return { committed: true as const, jobId: job.id as string, summary: { ...summary, created, updated, failed }, results };
  });

export const listImportJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("import_jobs")
      .select("id, file_name, status, total_rows, valid_rows, error_rows, created_rows, updated_rows, created_at, completed_at, hospitals(name)")
      .order("created_at", { ascending: false }).limit(50);
    return (data ?? []) as any[];
  });

export const getImportJobRows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobId: string }) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows } = await context.supabase.from("import_job_rows").select("row_number, status, errors, claim_id").eq("job_id", data.jobId).order("row_number");
    return rows ?? [];
  });
