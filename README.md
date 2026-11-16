# RCM Buddy

Multi-hospital SaaS for Indian hospitals that manages the **post-discharge insurance claims and settlement cycle**:
discharge handover → claim preparation → submission → queries → processing & follow-up → settlement & deductions → denials & disputes → reconciliation & closure.

Out of scope: admission, eligibility, pre-authorisation, in-patient billing, discharge planning.

## Stack
TanStack Start + React, Lovable Cloud (Postgres with row-level security). Server logic in `src/lib/*.functions.ts`.

## Key rules
- Shared definitions (statuses, task types, categories, ageing buckets, outstanding amount) live in `src/lib/rcm-definitions.ts`.
- Outstanding = approved − settled − TDS, never below zero (`claim_outstanding()` in SQL).
- Money movements touching several tables run in one database function (`reconcile_receipt`, `save_denial_outcome`).
- The follow-up engine (`run_rcm_engine`) runs hourly at minute 17.

## Tests
`bunx vitest run`
