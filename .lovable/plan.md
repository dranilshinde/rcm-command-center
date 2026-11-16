# Phase A (audit order): fix money defects, remove pre-discharge scope, one shared definition

Following the audit's "act on first" list. Larger new modules (documents, handover import, dashboard/MIS, deductions, appeals) come in later phases, in the audit's order.

## 1. Fix the eight defects
1. **Manual bank matching** leaves the claim unsettled -> matching records the payment and sets Settled / Short paid in one database transaction.
2. **Denial tasks never close** -> closing a recovery record (recovered or written off) closes its open tasks; recovered amount also posts to the claim so AR and Denials agree.
3. **Engine has no schedule** -> add an hourly schedule (at minute 17) as a migration; show "Last run" on the SLA & Rules page.
4. **Dashboard** -> remove "Phase 1 / Coming next" text now; full management dashboard is its own later phase.
5. **Import rejects pending cases** -> deferred to the Handover phase (new import type with its own template).
6. **Readiness can't reach 100 / submit ignores it** -> drop the pre-auth and "documents submitted" points; warn below 75 before submit (hard block comes with the document checklist).
7. **"Team work" tab shows everything** -> filter to tasks of the user's team members.
8. **AI go-live review uses stale facts** -> feed it real rule and claim counts.

## 2. Remove pre-discharge scope (files listed before deletion)
Delete:
- `src/routes/_authenticated/preauth.tsx` and `createPreauth`, `decidePreauth`
- Admissions register page and `createAdmission` (the admissions table stays as the case record)
- Pre-auth work-queue view, pre-auth tasks, 4-hour pre-auth SLA rule, `preauth_rejected` status
- Cashless Manager / Cashless Executive roles, `preauth` and `discharge` permission modules (users holding them are moved to RCM Executive / Manager first)
- Master Data statuses Patient Admitted, Pre-auth Initiated, Pre-auth Approved
- Greyed Command Center and Analytics menu items, "Tariffs uploaded" onboarding step
- Landing copy about "admission to reconciliation" and "Phase 1"; replace the 2,991-line README with a short real one
- Demo organisations/hospitals/payers moved out of migrations into an optional seed file (existing data is not deleted)

The `preauths` table is kept, marked deprecated, so nothing breaks for the live app.

## 3. One shared definition
- New `src/lib/rcm-definitions.ts`: claim statuses (adds Under processing, Partially rejected, Appealed, Resubmitted), task types, query categories, denial categories, ageing buckets 0-30 / 31-60 / 61-90 / 91-180 / 180+.
- Outstanding = payer-approved - settled - TDS, never below zero, as one database function used by AR, Payer Follow-ups and Payer 360.
- INR shown as Indian format, dates DD-MM-YYYY, through one formatter.

## 4. Checks
- Small tests for outstanding amount, ageing buckets and readiness thresholds.
- Browser check: AR, Payer 360 and Follow-ups show the same pending amount for a claim; manual match settles a claim.

## Later phases (audit order)
B Handover import + documents & checklist -> C Submission details + queries per-reply -> D Deduction ledger + appeals -> E Reconciliation split matching -> F Management dashboard/MIS + email alerts -> G Menu regrouped by eight stages, admin pages merged, security gaps.
