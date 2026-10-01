# RCM Buddy — Phase 2: Claims Core

Built around your spreadsheet format (43 columns: case ref, hospital/Rohini ID, patient, IP number, member ID, admission/discharge dates, TPA, insurer, policy, claim numbers, claimed/approved/copay/shortfall/discount/patient-paid/settled/TDS amounts, UTR, status, IHX submission date, treatment, diagnosis, policy type, courier details).

## What you will be able to do

- **Patients** — searchable list per hospital, with UHID, contact, member ID, policies. Duplicates matched by UHID or member ID + name.
- **Admissions** — IP number, admission date, treating doctor, department, treatment/diagnosis, payer (insurer + TPA), policy number and type (Base / Top-up).
- **Pre-auth** — request, approved amount, enhancements, status (requested / query / approved / rejected), with "Preauth Request Rejected" from your sheet mapped correctly.
- **Discharge** — marking a patient discharged automatically creates the claim and a "prepare claim" task.
- **Claims** — list with server-side filters (hospital, branch, payer, TPA, status, dates) and a claim page with:
  - Unique ID `RCM-2026-000001`, plus your TPA claim number, initial claim number and case ref ID.
  - Money panel: claimed, approved, copay, shortfall, discount, patient paid, settled, TDS, and auto-calculated short payment (approved − settled − TDS).
  - Visual timeline of every status change, notes and payment/UTR details, courier dispatch details.
  - Actions: submit, record query, reply to query, approve, deny, record payment, mark short paid, reopen, close, assign, add note.
- **Claim readiness score** — 0–100 from real checks (policy, IP number, dates, pre-auth approved, diagnosis, documents submitted, amounts). 90+ READY, 75–89 REVIEW, under 75 NOT READY, with the list of what is missing.
- **Work queue** — My Work, Team, Unassigned, Due Today, Overdue, High Value, Query Pending, with bulk assign. Tasks: Open / In Progress / Waiting / Completed / Cancelled / Escalated.
- **Excel import** — upload your exact sheet; the app checks every row first (missing fields, unknown hospital, bad dates, duplicate claim numbers), shows an error report you can download, then imports. Creates patients, admissions, claims and payment records in one go. Every upload is saved as an import job.
- **Dashboard** gains real claim counts and money totals (claimed, approved, settled, short paid, open).

## Status mapping from your sheet

Fully Paid – Letter Reconciled → Settled (reconciled) · Short Paid – Letter Reconciled → Short Paid · Claim Settled → Settled · Claim Denied → Denied · Preauth Request Rejected → Pre-auth Rejected. Unknown statuses are flagged in the pre-import check, not guessed.

## Note on patient data

Your sheet contains real patient names and phone numbers. Uploading your own hospital data is fine — it stays inside your hospital's access rules. Built-in demo data will stay fully made-up, and I will not load your file as sample data.

## Not in this phase

Payer follow-up reminders, SLA engine, denial analytics, AR aging, reconciliation, document file uploads (claim shows submission dates now; file storage comes with Phase 3).

## Technical section

New tables (all with organization_id, hospital_id, branch_id, audit trigger, RLS via can_access_hospital/has_permission, explicit GRANTs, indexes on tenant keys/status/dates):
`patients`, `patient_policies`, `admissions`, `preauths`, `claims` (claim_code from a global sequence → RCM-YYYY-NNNNNN, external_claim_no, initial_claim_no, case_ref_id, money columns, status, readiness_score), `claim_status_history`, `claim_payments` (UTR, date, receipt, TDS), `claim_couriers`, `claim_notes`, `tasks` (entity_type/id, assignee, team, due_at, priority, status), `import_jobs`, `import_job_rows`.
Hospital matched by name or Rohini ID (add `rohini_id` to hospitals); TPA/insurer by name with alias table fallback.
Discharge → claim creation and readiness recompute done in server functions; status history written on every transition. Claim status master list seeded (configurable later). Excel parsed client-side with SheetJS, validated + inserted server-side in batches. New modules added to permissions (claims, patients, admissions, preauth, tasks, imports). Lists server-paginated.
