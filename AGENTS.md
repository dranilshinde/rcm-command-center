<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Payer contact routing lives in the database (pick_spoc + insert triggers on tasks/escalations) so the hourly engine and manual flows share one rule.

- Denial/short-payment recovery records are opened by a database trigger on claim status so every path (manual, payment, import, reconciliation) creates them.

- Role rules: platform defaults in role_permissions; per-hospital overrides in hospital_role_permissions, resolved inside has_permission/my_permissions so RLS and UI share one rule.
- Locked pages are derived from MODULE.VIEW via src/lib/access.ts PAGE_MODULE; one map drives nav locks and the page lock screen.
- Shared RCM definitions (statuses, task types, categories, ageing buckets, outstanding) live only in src/lib/rcm-definitions.ts, mirrored by SQL claim_outstanding(); one definition prevents pages disagreeing.
- Multi-table money changes (bank match, denial outcome) run in SQL functions reconcile_receipt / save_denial_outcome so they are atomic.
- Hospital mailbox grants are encrypted in server-only app_user_connections and bound to the authorising user, provider and hospital; every operation verifies hospital-admin access before privileged reads, preventing cross-hospital credential reuse.
- Mailbox consent completes through a public no-write return page and an authenticated, expiring, single-use hospital-bound intent; only the signed-in opener exchanges and stores credentials.
- Email intake stores immutable hospital-bound messages, exact-number candidates, pending proposals and private attachment locators; RLS uses hospital-specific claim permissions, reviews stamp the authenticated staff member, and Phase 1 never applies claim changes.
- Incoming emails retain a validated historical connection UUID without a foreign key to credentials so hospital mailbox disconnection does not delete or block email history.
