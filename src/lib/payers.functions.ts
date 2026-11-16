import { AGEING_BUCKETS, outstandingAmount } from "./rcm-definitions";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function friendly(message: string, label: string) {
  if (message.includes("row-level security") || message.includes("permission denied")) return "You do not have permission to do this.";
  if (message.includes("duplicate key")) return `That ${label} code already exists.`;
  return `We could not save this ${label}. Please check the details and try again.`;
}

async function myOrg(sb: any, userId: string): Promise<string> {
  const { data: p } = await sb.from("profiles").select("organization_id").eq("id", userId).maybeSingle();
  if (p?.organization_id) return p.organization_id;
  const { data: o } = await sb.from("organizations").select("id").is("deleted_at", null).order("created_at").limit(1).maybeSingle();
  if (!o) throw new Error("No organisation found for your account.");
  return o.id;
}

const opt = z.string().trim().max(300).nullable().optional().transform((v) => (v ? v : null));

const payerSchema = z.object({
  kind: z.enum(["insurer", "tpa"]),
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Enter the payer name").max(200),
  code: z.string().trim().min(2, "Enter a short code").max(40),
  insurer_type: z.string().trim().max(40).optional(),
  portal_url: opt, support_email: opt, support_phone: opt, escalation_email: opt, relationship_notes: z.string().max(4000).nullable().optional(),
  preferred_channel: z.enum(["email", "call", "portal", "visit", "whatsapp"]),
  target_payment_days: z.number().int().min(1).max(365).nullable().optional(),
  status: z.enum(["active", "inactive"]),
});

export const savePayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => payerSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const common = {
      name: data.name, portal_url: data.portal_url, support_email: data.support_email, support_phone: data.support_phone,
      escalation_email: data.escalation_email, relationship_notes: data.relationship_notes ?? null,
      preferred_channel: data.preferred_channel, target_payment_days: data.target_payment_days ?? null, status: data.status,
      updated_by: context.userId,
    };
    const table = data.kind === "insurer" ? "insurers" : "tpas";
    const row: any = data.kind === "insurer"
      ? { ...common, payer_code: data.code.toUpperCase(), insurer_type: data.insurer_type || "private" }
      : { ...common, tpa_code: data.code.toUpperCase() };
    const res = data.id
      ? await sb.from(table).update(row).eq("id", data.id).select("id").maybeSingle()
      : await sb.from(table).insert({ ...row, organization_id: await myOrg(sb, context.userId), created_by: context.userId }).select("id").maybeSingle();
    if (res.error || !res.data) throw new Error(friendly(res.error?.message ?? "permission denied", data.kind === "insurer" ? "insurer" : "TPA"));
    return { id: res.data.id as string };
  });

const spocSchema = z.object({
  id: z.string().uuid().optional(),
  tpa_id: z.string().uuid().nullable().optional(),
  insurer_id: z.string().uuid().nullable().optional(),
  hospital_id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(2, "Enter the contact's name").max(200),
  designation: opt, email: z.string().trim().email("Enter a valid email").nullable().optional().or(z.literal("").transform(() => null)),
  phone: opt, location: opt,
  escalation_level: z.number().int().min(1).max(3),
  status: z.enum(["active", "inactive"]),
});

export const saveSpoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => spocSchema.parse(d))
  .handler(async ({ context, data }) => {
    if (!data.tpa_id && !data.insurer_id) throw new Error("Link the contact to a TPA or an insurer.");
    const sb = context.supabase;
    const row = {
      tpa_id: data.tpa_id ?? null, insurer_id: data.tpa_id ? null : data.insurer_id ?? null, hospital_id: data.hospital_id ?? null,
      name: data.name, designation: data.designation, email: data.email ?? null, phone: data.phone, location: data.location,
      escalation_level: data.escalation_level, status: data.status, updated_by: context.userId,
    };
    const res = data.id
      ? await sb.from("tpa_spocs").update(row).eq("id", data.id).select("id").maybeSingle()
      : await sb.from("tpa_spocs").insert({ ...row, organization_id: await myOrg(sb, context.userId), created_by: context.userId }).select("id").maybeSingle();
    if (res.error || !res.data) throw new Error(friendly(res.error?.message ?? "permission denied", "contact"));
    return { id: res.data.id as string };
  });

const BUCKETS = AGEING_BUCKETS;
const OPEN = new Set(["submitted", "query", "query_replied", "approved", "short_paid"]);

export const getPayer360 = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: "insurer" | "tpa"; id: string }) => z.object({ kind: z.enum(["insurer", "tpa"]), id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const col = data.kind === "insurer" ? "insurer_id" : "tpa_id";
    const { data: payer } = await (data.kind === "insurer"
      ? sb.from("insurers").select("*").eq("id", data.id).maybeSingle()
      : sb.from("tpas").select("*").eq("id", data.id).maybeSingle());
    if (!payer) throw new Error("Payer not found.");

    const [{ data: claims }, { data: spocs }, { data: sla }, { data: rem }] = await Promise.all([
      sb.from("claims").select(`id, claim_code, status, claim_date, document_submitted_at, payment_date, claimed_amount, approved_amount, settled_amount, tds_amount, short_payment, escalation_level, next_followup_at, hospitals(name), patients(full_name), admissions!inner(${col})`)
        .eq(`admissions.${col}`, data.id).is("deleted_at", null).order("claim_date", { ascending: false }).limit(5000),
      sb.from("tpa_spocs").select("id, name, designation, email, phone, location, escalation_level, status, hospital_id, tpa_id, insurer_id, hospitals(name)").eq(col, data.id).order("escalation_level"),
      sb.from("sla_rules").select("id, process, target_hours, is_active, hospital_id").eq(col, data.id),
      sb.from("reminder_rules").select("id, rule_key, name, threshold_hours, is_active, hospital_id").eq(col, data.id),
    ]);
    const list = (claims ?? []) as any[];
    const ids = list.map((c) => c.id);
    const [{ data: queries }, { data: fus }] = ids.length
      ? await Promise.all([
          sb.from("claim_queries").select("id, status, raised_at, replied_at, category").in("claim_id", ids.slice(0, 1000)),
          sb.from("claim_followups").select("id, claim_id, channel, outcome, contact_name, commitment_date, commitment_amount, created_at, author_name, claims(claim_code, status, payment_date)").in("claim_id", ids.slice(0, 1000)).order("created_at", { ascending: false }).limit(500),
        ])
      : [{ data: [] as any[] }, { data: [] as any[] }];

    const now = Date.now();
    const pendingOf = (c: any) => outstandingAmount(c);
    const submitted = list.filter((c) => c.status !== "draft" && c.status !== "ready");
    const settledList = list.filter((c) => ["settled", "short_paid", "closed"].includes(c.status));
    const open = list.filter((c) => OPEN.has(c.status));
    const aging = BUCKETS.map(([a, b]) => ({ label: b === Infinity ? "180+" : `${a}-${b}`, claims: 0, amount: 0 }));
    for (const c of open) {
      const from = c.document_submitted_at ?? c.claim_date;
      const d = Math.max(0, Math.floor((now - new Date(from).getTime()) / 864e5));
      const i = BUCKETS.findIndex(([a, b]) => d >= a && d <= b);
      aging[i]!.claims++; aging[i]!.amount += pendingOf(c);
    }
    const tat = settledList.filter((c) => c.payment_date && (c.document_submitted_at ?? c.claim_date))
      .map((c) => (new Date(c.payment_date).getTime() - new Date(c.document_submitted_at ?? c.claim_date).getTime()) / 864e5);
    const sum = (a: any[], f: (c: any) => number) => a.reduce((s, c) => s + f(c), 0);
    const submittedAmt = sum(submitted, (c) => Number(c.claimed_amount));
    const settledAmt = sum(list, (c) => Number(c.settled_amount));
    const commitments = (fus ?? []).filter((f: any) => f.commitment_date).map((f: any) => {
      const due = new Date(f.commitment_date).getTime() < now;
      const paid = ["settled", "short_paid", "closed"].includes(f.claims?.status);
      const kept = paid && f.claims?.payment_date && f.claims.payment_date <= f.commitment_date;
      return { ...f, state: kept ? "kept" : paid ? "late" : due ? "missed" : "upcoming" };
    });
    const decided = commitments.filter((c: any) => c.state !== "upcoming");
    const qList = (queries ?? []) as any[];
    const qReplied = qList.filter((q) => q.replied_at);

    return {
      kind: data.kind,
      payer: payer as any,
      spocs: (spocs ?? []) as any[],
      rules: { sla: sla ?? [], reminders: rem ?? [] },
      kpis: {
        claims: list.length,
        submittedAmt, settledAmt,
        pendingAmt: sum(open, pendingOf),
        openClaims: open.length,
        collectionRate: submittedAmt ? (settledAmt / submittedAmt) * 100 : null,
        denialRate: submitted.length ? (list.filter((c) => c.status === "denied").length / submitted.length) * 100 : null,
        queryRate: submitted.length ? (new Set(qList.map((q) => q.id)).size / submitted.length) * 100 : null,
        openQueries: qList.filter((q) => q.status === "open").length,
        avgQueryReplyHrs: qReplied.length ? sum(qReplied, (q) => (new Date(q.replied_at).getTime() - new Date(q.raised_at).getTime()) / 36e5) / qReplied.length : null,
        avgDaysToPay: tat.length ? tat.reduce((a, b) => a + b, 0) / tat.length : null,
        shortPaid: sum(list, (c) => Number(c.short_payment ?? 0)),
        escalated: open.filter((c) => c.escalation_level > 0).length,
        commitmentsKeptPct: decided.length ? (decided.filter((c: any) => c.state === "kept").length / decided.length) * 100 : null,
      },
      aging,
      openClaims: open.sort((a, b) => pendingOf(b) - pendingOf(a)).slice(0, 50).map((c) => ({ ...c, pending: pendingOf(c) })),
      followups: (fus ?? []).slice(0, 30) as any[],
      commitments: commitments.slice(0, 50),
    };
  });
