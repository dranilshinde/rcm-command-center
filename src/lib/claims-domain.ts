// Client-safe claim domain rules shared by server functions and pages.

export const CLAIM_STATUSES = [
  "draft", "ready", "submitted", "query", "query_replied", "approved",
  "denied", "preauth_rejected", "short_paid", "settled", "closed",
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const CLAIM_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  ready: "Ready to submit",
  submitted: "Submitted",
  query: "Query raised",
  query_replied: "Query replied",
  approved: "Approved",
  denied: "Denied",
  preauth_rejected: "Pre-auth rejected",
  short_paid: "Short paid",
  settled: "Settled",
  closed: "Closed",
};

export const OPEN_CLAIM_STATUSES = ["draft", "ready", "submitted", "query", "query_replied", "approved"];

export type ClaimAction =
  | "mark_ready" | "submit" | "record_query" | "reply_query" | "approve"
  | "deny" | "mark_short_paid" | "settle" | "close" | "reopen";

export const ACTIONS: Record<ClaimAction, { label: string; from: string[]; to: string }> = {
  mark_ready: { label: "Mark ready", from: ["draft"], to: "ready" },
  submit: { label: "Submit to payer", from: ["draft", "ready"], to: "submitted" },
  record_query: { label: "Record payer query", from: ["submitted", "query_replied", "approved"], to: "query" },
  reply_query: { label: "Reply to query", from: ["query"], to: "query_replied" },
  approve: { label: "Record approval", from: ["submitted", "query_replied"], to: "approved" },
  deny: { label: "Record denial", from: ["submitted", "query", "query_replied"], to: "denied" },
  mark_short_paid: { label: "Mark short paid", from: ["approved", "settled"], to: "short_paid" },
  settle: { label: "Mark settled", from: ["approved", "short_paid"], to: "settled" },
  close: { label: "Close claim", from: ["settled", "short_paid", "denied", "preauth_rejected"], to: "closed" },
  reopen: { label: "Reopen", from: ["closed", "denied", "settled", "short_paid"], to: "submitted" },
};

export const TASK_STATUSES = ["open", "in_progress", "waiting", "completed", "cancelled", "escalated"] as const;
export const ACTIVE_TASK_STATUSES = ["open", "in_progress", "waiting", "escalated"];

/* ------------------------------------------------------------ readiness */

export type ReadinessInput = {
  policy_number: string | null | undefined;
  member_id: string | null | undefined;
  ip_number: string | null | undefined;
  discharge_date: string | null | undefined;
  diagnosis: string | null | undefined;
  treatment: string | null | undefined;
  has_payer: boolean;
  preauth_approved: boolean;
  claimed_amount: number;
  document_submitted_at: string | null | undefined;
};

const CHECKS: { key: string; label: string; weight: number; ok: (r: ReadinessInput) => boolean }[] = [
  { key: "policy", label: "Policy number", weight: 15, ok: (r) => !!r.policy_number?.trim() },
  { key: "payer", label: "Insurer or TPA linked", weight: 10, ok: (r) => r.has_payer },
  { key: "member", label: "Member / customer ID", weight: 5, ok: (r) => !!r.member_id?.trim() },
  { key: "ip", label: "In-patient number", weight: 10, ok: (r) => !!r.ip_number?.trim() },
  { key: "discharge", label: "Discharge date", weight: 10, ok: (r) => !!r.discharge_date },
  { key: "diagnosis", label: "Diagnosis", weight: 10, ok: (r) => !!r.diagnosis?.trim() },
  { key: "treatment", label: "Treatment", weight: 5, ok: (r) => !!r.treatment?.trim() },
  { key: "preauth", label: "Pre-auth approved", weight: 15, ok: (r) => r.preauth_approved },
  { key: "amount", label: "Claimed amount entered", weight: 10, ok: (r) => r.claimed_amount > 0 },
  { key: "documents", label: "Documents submitted", weight: 10, ok: (r) => !!r.document_submitted_at },
];

export function computeReadiness(r: ReadinessInput) {
  let score = 0;
  const gaps: { key: string; label: string; weight: number }[] = [];
  for (const c of CHECKS) {
    if (c.ok(r)) score += c.weight;
    else gaps.push({ key: c.key, label: c.label, weight: c.weight });
  }
  return { score, gaps };
}

export function readinessBand(score: number) {
  if (score >= 90) return { label: "READY", tone: "positive" as const };
  if (score >= 75) return { label: "REVIEW", tone: "warning" as const };
  return { label: "NOT READY", tone: "risk" as const };
}

/* ------------------------------------------------------- spreadsheet map */

export const SHEET_STATUS_MAP: Record<string, { status: string; reconciled: boolean }> = {
  "fully paid - letter reconciled": { status: "settled", reconciled: true },
  "short paid - letter reconciled": { status: "short_paid", reconciled: true },
  "claim settled": { status: "settled", reconciled: false },
  "claim denied": { status: "denied", reconciled: false },
  "preauth request rejected": { status: "preauth_rejected", reconciled: false },
  "claim submitted": { status: "submitted", reconciled: false },
  "query raised": { status: "query", reconciled: false },
  "claim approved": { status: "approved", reconciled: false },
  "short paid": { status: "short_paid", reconciled: false },
  "fully paid": { status: "settled", reconciled: false },
};

export function normaliseStatus(raw: string) {
  return raw.toLowerCase().replace(/[\u2012-\u2015\u2212]/g, "-").replace(/\s+/g, " ").trim();
}

export type ImportRow = {
  row: number;
  case_ref_id: string | null;
  hospital_name: string | null;
  rohini_id: string | null;
  patient_name: string | null;
  patient_contact: string | null;
  ip_number: string | null;
  member_id: string | null;
  admission_date: string | null;
  discharge_date: string | null;
  tpa_name: string | null;
  insurer_name: string | null;
  policy_number: string | null;
  claim_number: string | null;
  initial_claim_number: string | null;
  claim_date: string | null;
  claimed_amount: number;
  approved_amount: number;
  copay: number;
  shortfall_amount: number;
  hospital_discount: number;
  patient_paid: number;
  settled_amount: number;
  tds_amount: number;
  utr_number: string | null;
  utr_date: string | null;
  receipt_no: string | null;
  claim_status: string | null;
  document_submitted_at: string | null;
  payment_date: string | null;
  treatment: string | null;
  diagnosis: string | null;
  policy_type: string | null;
  policy_holder_name: string | null;
  employee_code: string | null;
  insurer_comments: string | null;
  uhid: string | null;
  invoice_number: string | null;
  courier_agency: string | null;
  courier_destination: string | null;
  courier_dispatch_date: string | null;
  courier_name: string | null;
  courier_provider: string | null;
  courier_track_id: string | null;
};

const COLS: Record<string, keyof ImportRow> = {
  "case ref id": "case_ref_id", "hospital name": "hospital_name", "rohiniid": "rohini_id",
  "patient name": "patient_name", "patient contact": "patient_contact", "in patient number": "ip_number",
  "member/customer id": "member_id", "date of admission": "admission_date", "date of discharge": "discharge_date",
  "tpa name": "tpa_name", "insurance company name": "insurer_name", "policy number": "policy_number",
  "claim number": "claim_number", "initial claim number": "initial_claim_number",
  "claim creation date": "claim_date", "claimed amount": "claimed_amount", "approved amount": "approved_amount",
  "copay": "copay", "shortfall amount": "shortfall_amount", "hospital discount": "hospital_discount",
  "patient paid amount": "patient_paid", "settled amount": "settled_amount", "tds amount": "tds_amount",
  "cheque/ neft/ utr no.": "utr_number", "cheque/ neft/ utr date": "utr_date", "receiptno": "receipt_no",
  "claim status": "claim_status", "document submission date (on ihx)": "document_submitted_at",
  "payment update date": "payment_date", "treatment": "treatment", "diagnosis": "diagnosis",
  "policy type (base/top-up)": "policy_type", "policy holder name": "policy_holder_name",
  "employee code": "employee_code", "insurercomments": "insurer_comments", "uhid": "uhid",
  "invoicenumber": "invoice_number", "courier agency": "courier_agency",
  "courier destination": "courier_destination", "courier dispatch date": "courier_dispatch_date",
  "courier name": "courier_name", "courier provider": "courier_provider", "courier trackid": "courier_track_id",
};

export const EXPECTED_COLUMNS = Object.keys(COLS);
const MONEY = new Set<keyof ImportRow>(["claimed_amount", "approved_amount", "copay", "shortfall_amount", "hospital_discount", "patient_paid", "settled_amount", "tds_amount"]);
const DATES = new Set<keyof ImportRow>(["admission_date", "discharge_date", "claim_date", "utr_date", "document_submitted_at", "payment_date", "courier_dispatch_date"]);

function toText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  const s = String(v).trim();
  return s === "" ? null : s;
}

function toDate(v: unknown): string | null | "invalid" {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return "invalid";
    const y = v.getFullYear(), m = String(v.getMonth() + 1).padStart(2, "0"), d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return "invalid";
}

/** Maps one spreadsheet row (header → value) to an ImportRow; returns parse errors. */
export function mapSheetRow(raw: Record<string, unknown>, rowNumber: number) {
  const out: Record<string, unknown> = { row: rowNumber };
  const errors: string[] = [];
  for (const [header, value] of Object.entries(raw)) {
    const key = COLS[header.toLowerCase().replace(/\s+/g, " ").trim()];
    if (!key) continue;
    if (MONEY.has(key)) {
      const n = value === null || value === undefined || value === "" ? 0 : Number(String(value).replace(/,/g, ""));
      if (isNaN(n)) errors.push(`${header} is not a number`);
      out[key] = isNaN(n) ? 0 : n;
    } else if (DATES.has(key)) {
      const d = toDate(value);
      if (d === "invalid") { errors.push(`${header} is not a valid date`); out[key] = null; }
      else out[key] = d;
    } else {
      out[key] = toText(value);
    }
  }
  for (const k of Object.values(COLS)) if (!(k in out)) out[k] = MONEY.has(k) ? 0 : null;
  return { row: out as ImportRow, errors };
}

export const inr = (n: number | null | undefined) =>
  "₹" + Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export const ROLE_LABEL: Record<string, string> = {
  rcm_executive: "RCM executive", rcm_manager: "RCM manager", ar_manager: "AR manager", rcm_head: "RCM head",
  hospital_admin: "Hospital admin", cfo: "CFO", finance_head: "Finance head", cashless_manager: "Cashless manager",
  billing_manager: "Billing manager", denial_manager: "Denial manager",
};

export const QUERY_CATEGORIES: Record<string, string> = {
  documentation: "Documentation", eligibility: "Eligibility", authorization: "Authorisation", coding: "Coding",
  billing: "Billing", tariff: "Tariff", medical_necessity: "Medical necessity", policy_exclusion: "Policy exclusion",
  other: "Other",
};

/* --------------------------------------------------------- payer matching */

const PAYER_NOISE = new Set(["the", "co", "company", "ltd", "limited", "pvt", "private", "inc", "gic", "corporation", "corp", "and"]);
export const payerTokens = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").split(" ").filter((t) => t && !PAYER_NOISE.has(t));
export const payerKey = (s: string | null | undefined) => payerTokens(s).join(" ");

/** Matches a spreadsheet payer name to a payer: exact/alias first, then one name's words contained in the other's. */
export function matchPayer<T extends { name: string; aliases?: string[] | null }>(list: T[], raw: string | null | undefined): { payer: T; exact: boolean } | null {
  const key = payerKey(raw);
  if (!key) return null;
  for (const p of list) if (payerKey(p.name) === key || (p.aliases ?? []).some((a) => payerKey(a) === key)) return { payer: p, exact: true };
  const a = new Set(payerTokens(raw));
  const fit = list.filter((p) => {
    const b = new Set(payerTokens(p.name));
    const [small, big] = a.size <= b.size ? [a, b] : [b, a];
    return small.size >= 2 && [...small].every((t) => big.has(t));
  });
  return fit.length === 1 ? { payer: fit[0]!, exact: false } : null;
}
