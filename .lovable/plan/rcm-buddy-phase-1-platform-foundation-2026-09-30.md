# RCM Buddy — Phase 1: Platform Foundation

Goal of this phase: a secure, multi-tenant foundation that later phases (claims, payers, AR, analytics) can be built on without rework. Nothing fake — every screen shown works against real data.

## What you will be able to do after Phase 1

- Sign in with email and password. Your first account becomes the platform Super Admin.
- See the RCM Buddy admin console: hospital groups, hospitals, branches, departments, teams, users.
- Create and edit the whole organisation hierarchy, invite users, and give them roles.
- Control who can do what, per hospital and branch, with a permissions screen.
- Walk a hospital through a step-by-step onboarding checklist with progress tracking.
- Open the main app shell with the full sidebar and a dashboard showing real counts from your data.
- Manage master data lists (payers, TPAs, departments, claim statuses, denial reasons, and similar).
- See notifications and a full audit trail of important changes.

Sections of the sidebar that belong to later phases are shown as clearly labelled "coming in a later phase" placeholders, never as dead buttons.

## Scope boundary

In this phase: identity, tenancy, hierarchy, roles and permissions, audit, navigation shell, dashboard shell, super admin console, onboarding framework, master-data framework, notification framework.

Not in this phase: claims, pre-auth, work queue, AR, denials, payments, reconciliation, analytics. The database is designed so these slot in without restructuring.

## Data and sample content

A small realistic Indian sample set is loaded: 2 hospital groups, 4 hospitals, 6 branches, departments, a few teams, a set of insurers and TPAs, and master-data lists. No patient data in this phase, and never any real patient information.

## Design

Before building screens, I will show you three visual directions for the enterprise command-centre look (dense, professional, desktop-first) and build the one you pick.

## Technical section

Backend: Lovable Cloud (Postgres + auth). Email/password sign-in enabled; first signup is promoted to super admin, later accounts are created by admins.

Schema (Phase 1 tables, all with created_at/updated_at/created_by/updated_by and soft delete where relevant):
`organizations`, `hospital_groups`, `hospitals`, `branches`, `departments`, `teams`, `team_members`, `profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`, `user_scopes`, `insurers`, `tpas`, `tpa_spocs`, `master_lists`, `master_list_items`, `onboarding_checklists`, `onboarding_steps`, `notifications`, `audit_logs`, `settings`.

Tenancy: every tenant-owned row carries `organization_id` plus the narrowest applicable of `hospital_group_id` / `hospital_id` / `branch_id`. Access is decided by `user_scopes` (a user is scoped to a group, a hospital, or a branch) joined with `user_roles`.

Security: RLS on every table. Role checks go through security-definer functions (`has_role`, `has_permission`, `can_access_hospital`, `can_access_branch`) to avoid recursive policies. Roles are never stored on the profile row. Explicit GRANTs accompany every table. No tenant filtering relies on frontend code.

RBAC: actions are VIEW/CREATE/EDIT/DELETE/ASSIGN/REASSIGN/APPROVE/EXPORT/IMPORT/ESCALATE/CLOSE/REOPEN/CONFIGURE against module keys; role-permission pairs are rows, so roles stay configurable per organisation.

Audit: a generic trigger writes old/new values, actor, tenant keys, module and record id to `audit_logs`. Ordinary users have no write path to that table.

App structure: TanStack Start routes. Public `/` landing plus `/auth`; everything else under `_authenticated/`. Reads go through `createServerFn` with `requireSupabaseAuth`; lists are server-paginated and server-filtered from the start. Indexes on all tenant keys and status/date columns.

Performance: pagination and server-side filter/sort everywhere, no unbounded selects, indexes designed for the claim volumes of later phases.

## Phase 1 report

On completion I will give you a short report covering the schema, tenant and permission model, screens built, security checks run (including a cross-tenant access test), and the recommended next step into Phase 2.
