// Single source of truth for post-discharge RCM definitions. Import from here; never redefine.

export const CLAIM_STATUSES = [
  "draft", "ready", "submitted", "resubmitted", "under_processing", "query", "query_replied", "approved",
  "partially_rejected", "denied", "appealed", "short_paid", "settled", "closed",
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const CLAIM_STATUS_LABEL: Record<string, string> = {
  draft: "Draft", ready: "Ready to submit", submitted: "Submitted", resubmitted: "Resubmitted",
  under_processing: "Under processing", query: "Query raised", query_replied: "Query replied", approved: "Approved",
  partially_rejected: "Partially rejected", denied: "Denied", appealed: "Appealed", short_paid: "Short paid",
  settled: "Settled", closed: "Closed",
};

/** Claims still with the payer and owed money (used by AR, follow-ups, payer 360). */
export const RECEIVABLE_STATUSES = ["submitted", "resubmitted", "under_processing", "query", "query_replied", "approved", "short_paid", "appealed"];

export const TASK_TYPES: Record<string, string> = {
  prepare_claim: "Prepare claim", query: "Reply to query", payer_followup: "Payer follow-up", payment_followup: "Payment follow-up",
  commitment_missed: "Missed payment promise", short_payment: "Recover short payment", denial: "Review denial",
  appeal_followup: "Follow up appeal",
};

export const QUERY_CATEGORIES: Record<string, string> = {
  documentation: "Documentation", eligibility: "Eligibility", authorization: "Authorisation", coding: "Coding",
  billing: "Billing", tariff: "Tariff", medical_necessity: "Medical necessity", policy_exclusion: "Policy exclusion",
  other: "Other",
};

export const DENIAL_CATEGORIES: Record<string, string> = {
  ...QUERY_CATEGORIES, timely_filing: "Timely filing", duplicate: "Duplicate", administrative: "Administrative", other: "Other",
};

/** Ageing buckets in days: 0-30, 31-60, 61-90, 91-180, above 180. */
export const AGEING_BUCKETS = [[0, 30], [31, 60], [61, 90], [91, 180], [181, Infinity]] as const;
export const ageingLabel = (i: number) => (i === AGEING_BUCKETS.length - 1 ? "180+" : `${AGEING_BUCKETS[i]![0]}-${AGEING_BUCKETS[i]![1]}`);
export const ageingBucket = (days: number) => AGEING_BUCKETS.findIndex(([a, b]) => days >= a && days <= b);

/** Outstanding = payer-approved − settled − TDS, never below zero. Same rule as SQL claim_outstanding(). */
export const outstandingAmount = (c: { approved_amount?: number | string | null; settled_amount?: number | string | null; tds_amount?: number | string | null }) =>
  Math.max(Number(c.approved_amount ?? 0) - Number(c.settled_amount ?? 0) - Number(c.tds_amount ?? 0), 0);

export const inr = (n: number | null | undefined) => "₹" + Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
export const indianDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const x = typeof d === "string" ? new Date(d.length === 10 ? d + "T00:00:00" : d) : d;
  return isNaN(x.getTime()) ? "—" : `${String(x.getDate()).padStart(2, "0")}-${String(x.getMonth() + 1).padStart(2, "0")}-${x.getFullYear()}`;
};

export const READINESS_WARN_BELOW = 75;
