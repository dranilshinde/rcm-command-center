import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACTIVE_TASK_STATUSES } from "./claims-domain";

const PAGE = 25;
const AR_STATUSES = ["submitted", "query", "query_replied", "approved", "short_paid"];
export const AR_BUCKETS = [[0, 7], [8, 15], [16, 30], [31, 60], [61, 90], [91, 180], [181, 365], [366, 100000]] as const;
export const bucketLabel = (i: number) => (i === 7 ? "365+" : `${AR_BUCKETS[i]![0]}-${AR_BUCKETS[i]![1]}`);

const no = (msg: string) => (msg.includes("row-level security") || msg.includes("permission denied") ? "You do not have permission to do this." : "We could not save this. Please check the details and try again.");
const payerOf = (c: any) => c.admissions?.tpas?.name ?? c.admissions?.insurers?.name ?? "No payer";
const outstanding = (c: any) => Math.max(Number(c.approved_amount || c.claimed_amount) - Number(c.settled_amount) - Number(c.tds_amount ?? 0), 0);
const ageDays = (c: any) => Math.max(0, Math.floor((Date.now() - new Date(c.document_submitted_at ?? c.claim_date).getTime()) / 864e5));
const bucketOf = (d: number) => AR_BUCKETS.findIndex(([a, b]) => d >= a && d <= b);

/* ====================================================================== AR */

export const getArOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bucket?: number; payer?: string; page?: number }) => d)
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase.from("claims")
      .select("id, claim_code, status, claim_date, document_submitted_at, claimed_amount, approved_amount, settled_amount, tds_amount, escalation_level, next_followup_at, hospitals(name), patients(full_name), admissions(insurers(name), tpas(name)), profiles:assigned_to(full_name)")
      .is("deleted_at", null).in("status", AR_STATUSES).limit(20000);
    if (error) throw new Error("You do not have permission to view AR.");
    const claims = (rows ?? []).map((c: any) => ({ ...c, outstanding: outstanding(c), age: ageDays(c), payer: payerOf(c) })).filter((c) => c.outstanding > 0);
    const buckets = AR_BUCKETS.map((_, i) => ({ label: bucketLabel(i), claims: 0, amount: 0 }));
    const payers = new Map<string, { payer: string; claims: number; amount: number; over90: number; oldest: number }>();
    const hospitals = new Map<string, { hospital: string; claims: number; amount: number; over90: number }>();
    for (const c of claims) {
      const b = buckets[bucketOf(c.age)]!; b.claims++; b.amount += c.outstanding;
      const p = payers.get(c.payer) ?? { payer: c.payer, claims: 0, amount: 0, over90: 0, oldest: 0 };
      p.claims++; p.amount += c.outstanding; if (c.age > 90) p.over90 += c.outstanding; p.oldest = Math.max(p.oldest, c.age); payers.set(c.payer, p);
      const hn = c.hospitals?.name ?? "—";
      const h = hospitals.get(hn) ?? { hospital: hn, claims: 0, amount: 0, over90: 0 };
      h.claims++; h.amount += c.outstanding; if (c.age > 90) h.over90 += c.outstanding; hospitals.set(hn, h);
    }
    let list = claims;
    if (data.bucket !== undefined && data.bucket >= 0) list = list.filter((c) => bucketOf(c.age) === data.bucket);
    if (data.payer) list = list.filter((c) => c.payer === data.payer);
    list.sort((a, b) => b.age - a.age || b.outstanding - a.outstanding);
    const page = Math.max(1, data.page ?? 1);
    const total = claims.reduce((s, c) => s + c.outstanding, 0);
    const weighted = total ? claims.reduce((s, c) => s + c.outstanding * c.age, 0) / total : 0;
    return {
      total, count: claims.length, avgAgeDays: weighted,
      over90: claims.filter((c) => c.age > 90).reduce((s, c) => s + c.outstanding, 0),
      buckets, byPayer: [...payers.values()].sort((a, b) => b.amount - a.amount), byHospital: [...hospitals.values()].sort((a, b) => b.amount - a.amount),
      rows: list.slice((page - 1) * PAGE, page * PAGE), listTotal: list.length, pageSize: PAGE,
    };
  });

/* ============================================================= settlements */

export const listSettlements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { view: string; page?: number }) => d)
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const page = Math.max(1, data.page ?? 1);
    const status = data.view === "awaiting" ? ["approved"] : data.view === "short" ? ["short_paid"] : data.view === "settled" ? ["settled", "closed"] : ["approved", "short_paid", "settled"];
    const { data: rows, count, error } = await sb.from("claims")
      .select("id, claim_code, status, approved_amount, claimed_amount, copay, settled_amount, tds_amount, payment_date, reconciled, hospitals(name), patients(full_name), admissions(insurers(name), tpas(name)), claim_payments(id, amount, tds_amount, utr_number, payment_date)", { count: "exact" })
      .is("deleted_at", null).in("status", status).order("updated_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
    if (error) throw new Error("You do not have permission to view settlements.");
    const { data: all } = await sb.from("claims").select("status, approved_amount, settled_amount, tds_amount").is("deleted_at", null).in("status", ["approved", "short_paid", "settled", "closed"]).limit(20000);
    const sum = (f: (c: any) => number) => (all ?? []).reduce((s, c) => s + f(c), 0);
    const expected = sum((c) => Number(c.approved_amount));
    const received = sum((c) => Number(c.settled_amount) + Number(c.tds_amount));
    return {
      rows: (rows ?? []).map((c: any) => {
        const exp = Number(c.approved_amount), rec = Number(c.settled_amount) + Number(c.tds_amount);
        return { ...c, expected: exp, received: rec, variance: rec - exp, payer: payerOf(c) };
      }),
      total: count ?? 0, pageSize: PAGE,
      totals: { expected, received, variance: received - expected, awaiting: sum((c) => (c.status === "approved" ? Number(c.approved_amount) - Number(c.settled_amount) : 0)) },
    };
  });

/* ================================================================ denials */

export const DENIAL_CATEGORIES: Record<string, string> = {
  documentation: "Documentation", eligibility: "Eligibility", authorization: "Authorisation", coding: "Coding",
  billing: "Billing", tariff: "Tariff", medical_necessity: "Medical necessity", policy_exclusion: "Policy exclusion",
  timely_filing: "Timely filing", duplicate: "Duplicate", administrative: "Administrative", other: "Other",
};

export const listDenials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind?: string; status?: string; category?: string; page?: number }) => d)
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const page = Math.max(1, data.page ?? 1);
    let q = sb.from("denials")
      .select("id, kind, category, reason, amount, status, appeal_submitted_at, recovered_amount, resolution_note, created_at, claim_id, claims(claim_code, status, patients(full_name), admissions(insurers(name), tpas(name))), hospitals(name), profiles:owner_id(full_name)", { count: "exact" })
      .order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
    if (data.kind) q = q.eq("kind", data.kind);
    if (data.category) q = q.eq("category", data.category);
    if (data.status === "active") q = q.in("status", ["open", "appealed"]);
    else if (data.status) q = q.eq("status", data.status);
    const { data: rows, count, error } = await q;
    if (error) throw new Error("You do not have permission to view denials.");
    const { data: all } = await sb.from("denials").select("kind, category, amount, status, recovered_amount, claims(admissions(insurers(name), tpas(name)))").limit(20000);
    const list = (all ?? []) as any[];
    const cats = new Map<string, { category: string; count: number; amount: number }>();
    const payers = new Map<string, { payer: string; count: number; amount: number }>();
    for (const d of list) {
      const c = cats.get(d.category) ?? { category: d.category, count: 0, amount: 0 }; c.count++; c.amount += Number(d.amount); cats.set(d.category, c);
      const pn = payerOf(d.claims ?? {});
      const p = payers.get(pn) ?? { payer: pn, count: 0, amount: 0 }; p.count++; p.amount += Number(d.amount); payers.set(pn, p);
    }
    const pareto = [...cats.values()].sort((a, b) => b.amount - a.amount);
    const grand = pareto.reduce((s, c) => s + c.amount, 0);
    let run = 0;
    const active = list.filter((d) => ["open", "appealed"].includes(d.status));
    return {
      rows: (rows ?? []) as any[], total: count ?? 0, pageSize: PAGE,
      pareto: pareto.map((c) => { run += c.amount; return { ...c, cumulativePct: grand ? (run / grand) * 100 : 0 }; }),
      byPayer: [...payers.values()].sort((a, b) => b.amount - a.amount).slice(0, 10),
      stats: {
        atStake: active.reduce((s, d) => s + Number(d.amount) - Number(d.recovered_amount), 0),
        active: active.length,
        recovered: list.reduce((s, d) => s + Number(d.recovered_amount), 0),
        writtenOff: list.filter((d) => d.status === "written_off").reduce((s, d) => s + Number(d.amount) - Number(d.recovered_amount), 0),
        denials: list.filter((d) => d.kind === "denial").length,
        shortPayments: list.filter((d) => d.kind === "short_payment").length,
      },
    };
  });

export const updateDenial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    category: z.enum(Object.keys(DENIAL_CATEGORIES) as [string, ...string[]]),
    reason: z.string().max(2000).nullable().optional(),
    status: z.enum(["open", "appealed", "recovered", "partially_recovered", "written_off"]),
    appeal_submitted_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    recovered_amount: z.number().min(0).max(1e9),
    resolution_note: z.string().max(2000).nullable().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: cur } = await sb.from("denials").select("id, amount, claim_id, organization_id, hospital_id, kind").eq("id", data.id).maybeSingle();
    if (!cur) throw new Error("Record not found.");
    if (data.recovered_amount > Number(cur.amount) + 1) throw new Error("Recovered amount cannot be more than the amount at stake.");
    if (data.status === "appealed" && !data.appeal_submitted_at) throw new Error("Enter the date the appeal was submitted.");
    if (data.status === "written_off" && !data.resolution_note?.trim()) throw new Error("Give a reason for writing this off.");
    const closed = ["recovered", "written_off"].includes(data.status);
    const { error } = await sb.from("denials").update({
      category: data.category, reason: data.reason ?? null, status: data.status, appeal_submitted_at: data.appeal_submitted_at ?? null,
      recovered_amount: data.recovered_amount, resolution_note: data.resolution_note ?? null,
      closed_at: closed ? new Date().toISOString() : null, updated_by: context.userId,
    }).eq("id", data.id);
    if (error) throw new Error(no(error.message));
    if (closed) {
      await sb.from("tasks").update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("claim_id", cur.claim_id).eq("task_type", cur.kind === "short_payment" ? "short_payment" : "denial_review").in("status", ACTIVE_TASK_STATUSES);
    } else if (data.status === "appealed") {
      const { count } = await sb.from("tasks").select("id", { count: "exact", head: true }).eq("claim_id", cur.claim_id).eq("task_type", "appeal_followup").in("status", ACTIVE_TASK_STATUSES);
      if (!count) await sb.from("tasks").insert({
        organization_id: cur.organization_id, hospital_id: cur.hospital_id, claim_id: cur.claim_id, entity_id: cur.claim_id,
        title: "Follow up on appeal", task_type: "appeal_followup", priority: "high", amount_at_stake: Number(cur.amount) - data.recovered_amount,
        due_at: new Date(Date.now() + 15 * 864e5).toISOString(), created_by: context.userId,
      });
    }
    return { ok: true };
  });

/* ========================================================= reconciliation */

const receiptRow = z.object({
  receipt_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be a valid date"),
  amount: z.number().positive("Amount must be more than zero").max(1e10),
  utr_number: z.string().trim().max(100).nullable().optional(),
  payer_name: z.string().trim().max(200).nullable().optional(),
  narration: z.string().trim().max(500).nullable().optional(),
});

export const importReceipts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ hospitalId: z.string().uuid(), fileName: z.string().max(200), rows: z.array(receiptRow).min(1).max(5000) }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: h } = await sb.from("hospitals").select("id, organization_id").eq("id", data.hospitalId).maybeSingle();
    if (!h) throw new Error("Hospital not found.");
    const { error } = await sb.from("bank_receipts").insert(data.rows.map((r) => ({
      ...r, utr_number: r.utr_number || null, payer_name: r.payer_name || null, narration: r.narration || null,
      organization_id: h.organization_id, hospital_id: h.id, source_file: data.fileName, created_by: context.userId,
    })));
    if (error) throw new Error(no(error.message));
    const res = await autoMatch(sb, context.userId, h.id);
    return { inserted: data.rows.length, ...res };
  });

/** Auto-matching: duplicate UTR → duplicate; UTR equals a recorded payment → matched/short/overpaid. */
async function autoMatch(sb: any, userId: string, hospitalId?: string) {
  let q = sb.from("bank_receipts").select("id, hospital_id, amount, utr_number").eq("match_status", "unmatched").limit(5000);
  if (hospitalId) q = q.eq("hospital_id", hospitalId);
  const { data: open } = await q;
  let matched = 0, duplicates = 0;
  for (const r of (open ?? []) as any[]) {
    if (!r.utr_number) continue;
    const { data: other } = await sb.from("bank_receipts").select("id").eq("utr_number", r.utr_number).neq("id", r.id).neq("match_status", "duplicate").lt("created_at", new Date().toISOString()).limit(1);
    const { data: pay } = await sb.from("claim_payments").select("id, claim_id, amount").eq("hospital_id", r.hospital_id).eq("utr_number", r.utr_number).limit(1).maybeSingle();
    if (other?.length && (await sb.from("bank_receipts").select("id").eq("id", other[0].id).neq("match_status", "unmatched").maybeSingle()).data) {
      await sb.from("bank_receipts").update({ match_status: "duplicate", match_method: "auto_utr", matched_at: new Date().toISOString(), updated_by: userId }).eq("id", r.id);
      duplicates++; continue;
    }
    if (!pay) continue;
    const v = Number(r.amount) - Number(pay.amount);
    await sb.from("bank_receipts").update({
      match_status: Math.abs(v) < 1 ? "matched" : v < 0 ? "short_paid" : "overpaid", match_method: "auto_utr",
      claim_id: pay.claim_id, claim_payment_id: pay.id, variance: v, matched_by: userId, matched_at: new Date().toISOString(), updated_by: userId,
    }).eq("id", r.id);
    await sb.from("claims").update({ reconciled: true }).eq("id", pay.claim_id);
    matched++;
  }
  return { matched, duplicates };
}

export const runAutoMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => autoMatch(context.supabase, context.userId));

export const listReceipts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; page?: number }) => d)
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const page = Math.max(1, data.page ?? 1);
    let q = sb.from("bank_receipts")
      .select("id, receipt_date, amount, utr_number, payer_name, narration, match_status, match_method, variance, claim_id, hospital_id, claims(claim_code, patients(full_name)), hospitals(name)", { count: "exact" })
      .order("receipt_date", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
    if (data.status) q = q.eq("match_status", data.status);
    const { data: rows, count, error } = await q;
    if (error) throw new Error("You do not have permission to view reconciliation.");
    const { data: all } = await sb.from("bank_receipts").select("match_status, amount").limit(50000);
    const summary: Record<string, { count: number; amount: number }> = {};
    for (const r of (all ?? []) as any[]) {
      const s = (summary[r.match_status] ??= { count: 0, amount: 0 }); s.count++; s.amount += Number(r.amount);
    }
    return { rows: (rows ?? []) as any[], total: count ?? 0, pageSize: PAGE, summary };
  });

/** Candidate claims for a receipt: same hospital, approved/short paid, outstanding close to the receipt amount. */
export const matchCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { receiptId: string; search?: string }) => d)
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: r } = await sb.from("bank_receipts").select("hospital_id, amount, payer_name").eq("id", data.receiptId).maybeSingle();
    if (!r) throw new Error("Receipt not found.");
    let q = sb.from("claims").select("id, claim_code, external_claim_no, status, approved_amount, claimed_amount, settled_amount, tds_amount, patients(full_name), admissions(insurers(name), tpas(name))")
      .eq("hospital_id", r.hospital_id).is("deleted_at", null).in("status", ["approved", "short_paid", "settled"]).limit(300);
    if (data.search?.trim()) q = q.or(`claim_code.ilike.%${data.search.trim()}%,external_claim_no.ilike.%${data.search.trim()}%`);
    const { data: cs } = await q;
    return ((cs ?? []) as any[]).map((c) => ({ ...c, outstanding: outstanding(c), payer: payerOf(c), diff: Math.abs(outstanding(c) - Number(r.amount)) }))
      .filter((c) => c.outstanding > 0 || data.search).sort((a, b) => a.diff - b.diff).slice(0, 15);
  });

export const matchReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ receiptId: z.string().uuid(), claimId: z.string().uuid(), tds_amount: z.number().min(0).max(1e9) }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: r } = await sb.from("bank_receipts").select("*").eq("id", data.receiptId).maybeSingle();
    if (!r) throw new Error("Receipt not found.");
    if (r.match_status !== "unmatched") throw new Error("This receipt is already reconciled. Unmatch it first.");
    const { data: c } = await sb.from("claims").select("id, organization_id, hospital_id, status, approved_amount, settled_amount, tds_amount").eq("id", data.claimId).maybeSingle();
    if (!c || c.hospital_id !== r.hospital_id) throw new Error("Pick a claim from the same hospital.");
    if (!["approved", "short_paid", "settled"].includes(c.status)) throw new Error("Only approved claims can receive money.");
    const before = Math.max(Number(c.approved_amount) - Number(c.settled_amount) - Number(c.tds_amount), 0);
    const { data: pay, error } = await sb.from("claim_payments").insert({
      organization_id: c.organization_id, hospital_id: c.hospital_id, claim_id: c.id, amount: r.amount, tds_amount: data.tds_amount,
      utr_number: r.utr_number, payment_date: r.receipt_date, created_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(no(error.message));
    const { data: pays } = await sb.from("claim_payments").select("amount, tds_amount").eq("claim_id", c.id);
    const settled = (pays ?? []).reduce((s, p) => s + Number(p.amount), 0);
    const tds = (pays ?? []).reduce((s, p) => s + Number(p.tds_amount), 0);
    const short = Number(c.approved_amount) - settled - tds;
    const to = short > 0.5 ? "short_paid" : "settled";
    await sb.from("claims").update({ settled_amount: settled, tds_amount: tds, short_payment: Math.max(short, 0), payment_date: r.receipt_date, status: to, reconciled: true, last_status_at: new Date().toISOString(), updated_by: context.userId }).eq("id", c.id);
    if (to !== c.status) await sb.from("claim_status_history").insert({
      organization_id: c.organization_id, hospital_id: c.hospital_id, claim_id: c.id, from_status: c.status, to_status: to,
      note: `Bank receipt ₹${Number(r.amount).toLocaleString("en-IN")} reconciled${r.utr_number ? ` (UTR ${r.utr_number})` : ""}`, actor_id: context.userId,
    });
    await sb.from("tasks").update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("claim_id", c.id).in("task_type", ["payment_followup", "payer_followup", "commitment_missed"]).in("status", ACTIVE_TASK_STATUSES);
    const v = Number(r.amount) + data.tds_amount - before;
    const status = Math.abs(v) < 1 ? "matched" : v < 0 ? "short_paid" : "overpaid";
    await sb.from("bank_receipts").update({ match_status: status, match_method: "manual", claim_id: c.id, claim_payment_id: pay.id, variance: v, matched_by: context.userId, matched_at: new Date().toISOString(), updated_by: context.userId }).eq("id", r.id);
    return { status, variance: v, claimStatus: to };
  });

export const setReceiptStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ receiptId: z.string().uuid(), action: z.enum(["unmatch", "duplicate"]) }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const patch = data.action === "duplicate"
      ? { match_status: "duplicate", match_method: "manual", matched_by: context.userId, matched_at: new Date().toISOString() }
      : { match_status: "unmatched", match_method: null, claim_id: null, claim_payment_id: null, variance: null, matched_by: null, matched_at: null };
    const { error } = await sb.from("bank_receipts").update({ ...patch, updated_by: context.userId }).eq("id", data.receiptId);
    if (error) throw new Error(no(error.message));
    return { ok: true };
  });
