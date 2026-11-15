# RCM Command Center

RCM BUDDY

Enterprise Multi-Hospital Revenue Cycle Management SaaS Platform

Act as a combined team of:

Senior Healthcare RCM Architect with 20+ years of hospital RCM experience

Indian Hospital Insurance & TPA Expert

Enterprise SaaS Product Architect

Multi-Tenant Database Architect

Healthcare UX/UI Designer

Product Manager

Business Analyst

BI & Analytics Architect

Workflow Automation Architect

Security Architect

QA/Test Engineer

AI Product Architect

I want you to design and build a production-grade SaaS platform called:

RCM BUDDY

RCM Buddy is a complete Revenue Cycle Management operating system for hospitals in India.

It should manage the complete insurance/cashless hospital revenue cycle:

Admission → Pre-Authorization → Discharge → Claim Preparation → Claim Submission → Query Management → Approval → Payment → Settlement → Reconciliation → AR → Follow-up → Denial Management → Recovery → Closure

However, RCM Buddy must NOT be designed merely as a claims database.

It must become a complete:

RCM Operations + Claim Management + Work Management + Payer Management + Communication + Follow-up + AR + Denial Management + Financial Reconciliation + Analytics + AI-ready platform.

1. SCALE & BUSINESS MODEL

Design the application to support:

500+ hospitals

Multiple hospital groups

Multiple hospitals within each group

Multiple branches per hospital

Multiple departments

Thousands to 10,000+ users

Millions of claims

Large document volumes

Hospital-specific workflows

Hospital-specific payers and TPAs

Hospital-specific tariffs

Hospital-specific SLA rules

Hospital-specific roles and permissions

The architecture must be multi-tenant from day one.

Do NOT build a single-hospital application and attempt to convert it later.

2. CORE PRODUCT PHILOSOPHY

When an RCM Manager logs into RCM Buddy, the platform should immediately answer:

WHAT IS HAPPENING?

WHERE IS THE MONEY?

WHAT IS STUCK?

WHAT IS AT RISK?

WHO NEEDS TO ACT?

WHICH PAYER/TPA NEEDS FOLLOW-UP?

WHAT SHOULD MY TEAM DO TODAY?

WHAT REQUIRES ESCALATION?

HOW MUCH MONEY CAN WE RECOVER?

The platform should be action-oriented, not just reporting-oriented.

3. MULTI-TENANT ORGANIZATION STRUCTURE

Create the following hierarchy:

RCM BUDDY PLATFORM
│
├── RCM Buddy Internal Organization
│
├── Hospital Group
│ ├── Hospital
│ │ ├── Branch
│ │ │ ├── Department
│ │ │ ├── Team
│ │ │ └── Users
│ │ └── Branch
│ └── Hospital
│
└── Hospital Group

Every tenant-owned record must have appropriate tenant identifiers.

Use concepts such as:

organization_id
hospital_group_id
hospital_id
branch_id
department_id
team_id
user_id

Strictly enforce data isolation.

Hospital A must never be able to see Hospital B data.

Branch A must not see Branch B unless explicitly authorized.

4. USER TYPES

RCM Buddy Platform Roles

Super Admin

Full platform access.

Can:

Create hospitals

Create hospital groups

Create branches

Create users

Configure workflows

Configure master data

Configure payers

Configure TPAs

Configure tariffs

Configure SLA

Configure escalation rules

Configure permissions

View platform analytics

View hospital performance

Manage subscriptions

View audit logs

RCM Buddy Operations Admin

Can manage assigned hospitals and operational activities.

RCM Buddy Support

Can support hospitals without unnecessary access to sensitive financial information.

5. HOSPITAL ROLES

Support configurable roles:

Hospital Admin

CEO

COO

CFO

Finance Head

Insurance Head

RCM Head

RCM Manager

RCM Executive

Billing Manager

Billing Executive

AR Manager

AR Executive

Denial Manager

Denial Executive

Cashless Manager

Cashless Executive

Medical Records Executive

Auditor

Management Viewer

Permissions must be granular.

Permission actions:

VIEW
CREATE
EDIT
DELETE
ASSIGN
REASSIGN
APPROVE
EXPORT
IMPORT
ESCALATE
CLOSE
REOPEN
CONFIGURE

Permissions should be configurable by:

Organization

Hospital

Branch

Department

Team

Module

Action

6. MAIN NAVIGATION

Create a premium enterprise SaaS sidebar.

COMMAND CENTER

DASHBOARD

WORK QUEUE

CLAIMS

PRE-AUTHORIZATION

DISCHARGE

QUERIES

DENIALS

AR MANAGEMENT

FOLLOW-UPS

PAYERS & TPAs

COMMUNICATION

SETTLEMENTS

RECONCILIATION

TARIFF MANAGEMENT

PATIENTS / ENCOUNTERS

DOCUMENTS

TASKS

TEAM MANAGEMENT

REPORTS

ANALYTICS

MASTER DATA

HOSPITAL MANAGEMENT

ADMINISTRATION

SETTINGS

7. COMMAND CENTER

Create the most important operational screen:

RCM COMMAND CENTER

The Command Center should show four major areas.

MONEY

Total Claim Value

Submitted Value

Approved Value

Settled Value

Outstanding AR

Overdue AR

Potential Revenue Leakage

FLOW

New Claims

Claims Ready for Submission

Submitted Claims

Queries

Approvals

Payment Awaiting

Reconciliation Pending

RISK

Denials

High-value Pending Claims

SLA Breaches

Claims >30 Days

Claims >60 Days

Claims >90 Days

Short Payments

Unresolved Escalations

ACTION

Show:

WHAT NEEDS ATTENTION TODAY?

Examples:

12 claims require follow-up

5 claims have missing documents

8 queries are due today

4 claims have breached SLA

3 high-value claims are >60 days

2 payments need reconciliation

Every item must be clickable and open the relevant filtered work queue.

8. GLOBAL DASHBOARD

KPI cards:

Total Claims

Total Claim Value

Submitted

Approved

Settled

Pending

Denied

AR

Overdue AR

Collection Rate

Net Collection Rate

Denial Rate

Query Rate

Average TAT

Short Payment

Recovery

Filters:

Date

Hospital

Branch

Department

Team

User

Payer

TPA

Claim Type

Claim Status

Allow:

Today
Yesterday
This Week
This Month
Previous Month
Quarter
Custom Range

9. COMPLETE CLAIM LIFECYCLE

Create a configurable claim workflow:

Patient Admitted

Insurance Identified

Pre-auth Initiated

Pre-auth Submitted

Pre-auth Query

Pre-auth Approved

Pre-auth Rejected

Enhancement Requested

Patient Discharged

Claim Preparation

Claim Readiness Check

Claim Ready

Claim Submitted

Claim Accepted

Claim Query

Query Response

Claim Resubmitted

Claim Approved

Payment Awaited

Payment Received

Reconciliation Pending

Reconciled

Short Payment

Denied

Appeal Initiated

Appeal Submitted

Appeal Approved

Appeal Rejected

Recovery

Written Off

Closed

Workflows must be configurable by hospital/payer/claim type.

10. CLAIM MASTER

Create a comprehensive claim record.

Patient

Patient ID

UHID

Name

Age

Gender

Mobile

Address

Insurance ID

Policy Number

Member ID

Encounter

Admission Number

Admission Date

Discharge Date

Length of Stay

Department

Doctor

Diagnosis

Procedure

Room Category

Insurance

Insurer

TPA

Policy

Payer Code

TPA Code

Cashless/Reimbursement

Corporate/Individual

Financial

Gross Bill

Claimed Amount

Approved Amount

Settled Amount

Deduction

Disallowed Amount

Patient Payable

TDS

Other Deduction

Net Receivable

Short Payment

Dates

Admission

Discharge

Submission

Query

Approval

Settlement

Payment

Reconciliation

Closure

11. CLAIM DETAIL PAGE

Create a comprehensive claim detail page.

Header:

CLAIM ID
Patient
Hospital
Branch
Payer
TPA
Claim Amount
Approved Amount
Current Status
Age
Priority

Create a visual lifecycle timeline.

Every milestone should show:

Status

Date

User

Comments

Documents

Action

Actions:

Edit

Assign

Reassign

Submit

Upload Document

Add Query

Add Follow-up

Add Communication

Escalate

Record Payment

Reconcile

Create Appeal

Create Recovery Task

Close

Reopen

12. CLAIM READINESS / CLEAN CLAIM SCORE

Before submission, calculate:

CLAIM READINESS SCORE

Check:

Patient information

Policy information

Authorization

Discharge summary

Final bill

Medical records

Procedure documents

Required signatures

Payer-specific requirements

Example:

92/100

Statuses:

90–100: READY
75–89: REVIEW
Below 75: NOT READY

Show exactly why points were deducted.

Scoring must be configurable.

13. PRE-AUTHORIZATION

Track:

Request

Submitted date

Requested amount

Approved amount

Query

Rejection

Enhancement

Approval TAT

Dashboard:

Pending

Approved

Rejected

Query

Enhancement

Average TAT

14. DISCHARGE MANAGEMENT

When a patient is discharged:

Automatically create the claim workflow.

Capture:

Discharge date

Final bill

Discharge summary

Medical records

Diagnosis

Procedures

Room charges

Pharmacy

Investigation

Doctor charges

Trigger Claim Readiness Check.

15. WORK QUEUE

Create a powerful action-oriented Work Queue.

Tabs:

MY WORK

TEAM WORK

UNASSIGNED

DUE TODAY

OVERDUE

HIGH PRIORITY

SLA RISK

ESCALATED

HIGH VALUE

AR FOLLOW-UP

PAYER FOLLOW-UP

Columns:

Claim
Patient
Payer
TPA
Amount
Status
Age
Last Action
Next Action
Assigned User
Priority
Due Date

Actions:

Assign

Reassign

Bulk Assign

Bulk Reassign

Change Priority

Add Follow-up

Escalate

Complete Task

16. UNIVERSAL TASK ENGINE

Every module must be able to create tasks.

Task fields:

Task ID

Task Type

Claim

Patient

Payer

TPA

Hospital

Branch

Team

Assigned User

Priority

Created Date

Due Date

Status

Escalation

Comments

Completion Date

Task statuses:

Open
In Progress
Waiting
Completed
Cancelled
Escalated

17. PAYER FOLLOW-UP & REMINDER ENGINE

This is a core feature.

Create:

PAYER FOLLOW-UP CENTER

Track:

Payer

TPA

Hospital

Branch

Claim

Claim Amount

Current Status

Last Follow-up

Next Follow-up

Follow-up Owner

SPOC

Commitment Date

Commitment Amount

Communication Method

Response

Next Action

Escalation

Follow-up channels:

Phone

Email

Portal

WhatsApp

Meeting

Letter

Other

18. AUTOMATED REMINDERS

Create a configurable Reminder Engine.

Examples:

If claim is pending >7 days:

Create reminder.

If no response for 48 hours:

Create follow-up.

If commitment date arrives:

Create follow-up.

If claim reaches 30 days:

Escalate.

If claim reaches 60 days:

Senior escalation.

If claim reaches 90 days:

Management escalation.

Reminder rules must be configurable.

19. PAYER SLA ENGINE

Allow SLA by:

Payer

TPA

Hospital

Branch

Claim Type

Process

Example:

Pre-auth: 4 hours
Query Response: 48 hours
Claim Settlement: 30 days
Payment: 45 days

Display:

SLA Due
Time Remaining
SLA Breached

20. PAYER & TPA MANAGEMENT

Create:

PAYER 360

For every payer/TPA show:

Total Claims

Claim Value

Pending

Approved

Settled

Denied

AR

30 AR

60 AR

90 AR

Query Rate

Denial Rate

Settlement TAT

Payment TAT

Short Payment

Collection

Open Escalations

SPOCs

Communication History

Meetings

Commitments

Tariff

Contract

Renewal

Audit history

21. PAYER RELATIONSHIP MANAGEMENT

Treat payers/TPAs as business relationships.

Track:

Relationship Owner

Primary SPOC

Secondary SPOC

Escalation SPOC

Regional Contact

National Contact

Meetings

Reviews

Commitments

Tariff Negotiations

Empanelment

Renewals

Audits

Complaints

Escalations

Create:

PAYER ENGAGEMENT DASHBOARD

22. PAYER COMMUNICATION CENTER

Create a communication log.

Every interaction should record:

Date

Payer

TPA

Hospital

Branch

Contact Person

Communication Type

Subject

Discussion

Commitment

Commitment Date

Next Action

Owner

Attachment

Outcome

Communication types:

Email
Phone
WhatsApp
Meeting
Portal
Letter
Escalation

23. COMMUNICATION TEMPLATES

Create reusable templates for:

Claim Follow-up

Payment Follow-up

Query Response

Missing Document Request

Settlement Reminder

Escalation

Tariff Renewal

Tariff Negotiation

Empanelment

Meeting Request

Audit Coordination

Support dynamic variables:

{{hospital_name}}
{{patient_name}}
{{claim_number}}
{{claim_amount}}
{{payer_name}}
{{tpa_name}}
{{days_pending}}
{{spoc_name}}
{{commitment_date}}

24. COMMUNICATION AUTOMATION

Architecture should support future integrations with:

Email

SMS

WhatsApp

Push notifications

Example workflow:

CLAIM PENDING
↓
SLA ENGINE
↓
REMINDER
↓
EMAIL / TASK
↓
NO RESPONSE
↓
ESCALATION
↓
MANAGER
↓
PAYER SPOC
↓
SENIOR SPOC

Do not fake external integrations if they are not configured.

Build integration-ready architecture.

25. DENIAL MANAGEMENT

Create detailed denial tracking.

Fields:

Claim

Denial Date

Denial Amount

Denial Category

Denial Reason

Root Cause

Responsible Department

Recoverability

Appeal Eligibility

Appeal Date

Appeal Status

Recovery Amount

Write-off

Categories:

Documentation
Eligibility
Authorization
Coding
Billing
Tariff
Medical Necessity
Policy Exclusion
Timely Filing
Duplicate
Administrative
Other

26. DENIAL ANALYTICS

Show:

Denial Count

Denial Rate

Denied Amount

Recoverable Amount

Recovered Amount

Write-off

Recovery Rate

Analyze by:

Payer
TPA
Hospital
Branch
Department
Procedure
Denial Reason
Root Cause
Employee

Create Pareto analysis.

27. AR MANAGEMENT

Create:

AR COMMAND CENTER

Aging buckets:

0–7
8–15
16–30
31–60
61–90
91–180
181–365
365+

KPIs:

Total AR

Current AR

Overdue AR

30

60

90

180

High-risk AR

Recoverable AR

28. AR FOLLOW-UP

Every outstanding claim should have follow-up history.

Record:

Date

Contact

Mode

Discussion

Commitment

Expected Amount

Next Follow-up

Owner

Outcome

Automatically create follow-up tasks.

29. PAYMENT & SETTLEMENT

Record:

Claim

Payment Date

Payment Reference

UTR

Bank

Approved Amount

Expected Amount

Deduction

TDS

Net Payment

Variance

Automatically calculate:

Expected
Received
Variance

30. RECONCILIATION

Support:

Bank statement upload

Payment advice upload

Automatic matching

Manual matching

Unmatched payments

Short payments

Duplicate payments

Overpayments

Statuses:

Matched
Partially Matched
Unmatched
Short Paid
Overpaid
Duplicate

31. SHORT PAYMENT MANAGEMENT

Example:

Claim = ₹5,00,000
Expected = ₹4,50,000
Received = ₹4,00,000

Short Payment = ₹50,000

Automatically calculate.

Allow:

Create Recovery Task
Create Follow-up
Escalate
Close

32. TEAM MANAGEMENT

Create a full:

RCM TEAM MANAGEMENT MODULE

Hierarchy:

Hospital
↓
Branch
↓
Department
↓
Team
↓
Manager
↓
Executives

Manage:

Teams

Managers

Members

Roles

Workload

Productivity

Availability

Backup owners

33. TEAM DASHBOARD

Show:

Team Members

Claims Assigned

Claims Completed

Pending

Overdue

Queries

Follow-ups

Collections

Denials

Recovery

Productivity

TAT

SLA Compliance

34. WORKLOAD BALANCING

Show workload by employee.

Example:

Employee
Claims
Claim Value
Overdue
Tasks
High Priority
Workload

Allow manager to:

Assign

Reassign

Bulk Assign

Balance Workload

Support configurable workload rules.

35. EMPLOYEE PERFORMANCE

Track objective operational metrics:

Claims processed

Claims submitted

Claims closed

Queries resolved

Follow-ups completed

Tasks completed

SLA compliance

Average TAT

AR recovered

Denial recovery

Overdue work

Data accuracy

Show underlying metrics rather than relying only on one composite score.

36. AVAILABILITY & BACKUP

Support:

Active
Inactive
On Leave
Available
Busy

Allow backup assignment.

If a user becomes unavailable, managers should be able to identify and reassign their open work.

37. TEAM DAILY CONTROL ROOM

Create:

TEAM TODAY

Show:

New Work
Pending Work
Completed
Overdue
Due Today
High Priority
SLA Risk
Payer Follow-ups
AR Follow-ups
Escalations

38. TARIFF MANAGEMENT

Create tariff database.

Fields:

Hospital

Branch

Payer

TPA

Procedure

Package

Room Category

Negotiated Rate

Effective Date

Expiry Date

Contract

Support comparison:

Hospital Tariff
vs
Payer Tariff
vs
Negotiated Tariff
vs
Claimed Amount
vs
Approved Amount

Alert before tariff expiry.

39. PAYER MASTER

Maintain:

Insurer

TPA

Payer Code

TPA Code

Contact

Portal

SLA

Submission Rules

Query Rules

Tariff

Escalation Matrix

40. TPA SPOC MANAGEMENT

The same TPA can have different contacts for different hospitals and branches.

Support:

TPA
→ Hospital
→ Branch
→ SPOC

Fields:

Name
Designation
Email
Phone
Location
Escalation Level
Active/Inactive

41. MASTER DATA

Create master management for:

Hospitals
Branches
Departments
Teams
Users
Doctors
Payers
TPAs
SPOCs
Procedures
Packages
Tariffs
Denial Reasons
Query Reasons
Claim Types
Statuses
Task Types
Escalation Rules
SLA Rules

42. IMPORT CENTER

Support:

Excel
CSV

Imports:

Patient

Admission

Claim

Payer

TPA

Tariff

Payment

AR

Before import:

Validate.

Display:

Total Rows
Valid
Invalid
Duplicates
Warnings

Generate downloadable error report.

Never silently import invalid records.

43. DOCUMENT MANAGEMENT

Each claim should have a document repository.

Categories:

ID Proof
Insurance Card
Pre-auth
Discharge Summary
Final Bill
Investigation
Pharmacy
Operative Notes
Consultation
Implants
Consent
Claim Form
Query
Settlement Letter
Payment Advice
Appeal

Support:

Upload
Preview
Download
Versioning
Metadata
Permissions
Audit

44. NOTIFICATION CENTER

Notifications for:

New Claim
Assignment
Query
Task Due
Task Overdue
Payment
Approval
Denial
SLA Breach
AR Threshold
Escalation
Missing Documents
Tariff Expiry
Payer Commitment

45. ESCALATION ENGINE

Create configurable escalation rules.

Examples:

Query >48 hours
Claim >30 days
AR >90 days
No payer response
Commitment missed
High-value claim delayed
Tariff expired

Escalation levels:

Executive
Manager
RCM Head
Hospital Head
CFO
Payer Senior SPOC

Rules must be configurable.

46. SLA ENGINE

SLA can be configured by:

Hospital
Branch
Payer
TPA
Claim Type
Workflow Stage

Track:

SLA Start
SLA Due
Time Remaining
SLA Breached

47. REVENUE LEAKAGE ENGINE

Identify:

Missing claims

Unbilled services

Underbilling

Short payments

Excess deductions

Unresolved denials

Expired tariff

Incorrect tariff

Delayed submission

Missed follow-ups

Unreconciled payments

Show:

Potential Leakage
Recovered
Outstanding

48. RCM HEALTH SCORE

Create:

RCM HEALTH SCORE — 0 TO 100

Components:

Claim Readiness

Submission Efficiency

Approval Rate

Denial Rate

Query Rate

AR Aging

Collection Rate

Settlement TAT

Short Payments

Reconciliation

Team Productivity

SLA Compliance

Weights must be configurable.

Always explain:

WHY THE SCORE CHANGED.

49. EXECUTIVE DASHBOARD

For:

CEO
CFO
COO
Hospital Management

Show only important information:

Revenue
Claims
Collections
AR
Denials
Deductions
Short Payments
Collection Rate
Payer Performance
Team Performance
Revenue Leakage

Allow drill-down:

Group
→ Hospital
→ Branch
→ Department
→ Team
→ User
→ Claim

50. HOSPITAL GROUP DASHBOARD

For hospital groups:

Hospital A
Hospital B
Hospital C

Compare:

Claims
Revenue
AR
Collection
Denial
TAT
Payer Performance
RCM Health Score

51. REPORT CENTER

Create:

Daily Claim Report
Pending Claim Report
Submission Report
Approval Report
Query Report
Denial Report
AR Aging
Payment Report
Settlement Report
Short Payment Report
Payer Performance
TPA Performance
Team Performance
Employee Performance
Branch Performance
Hospital Performance
Collection Report
Revenue Leakage Report
Follow-up Report
Escalation Report
Communication Report

Allow:

Filter
Save
Export Excel
Export CSV
Export PDF

52. ANALYTICS

Create dashboards for:

Claim trends

Collection trends

AR trends

Denial trends

Payer trends

TPA trends

Team trends

Branch trends

Settlement trends

Leakage trends

Every important visualization should be drillable.

53. GLOBAL SEARCH

Search:

Patient
UHID
Claim
Admission
Policy
Member ID
Payer
TPA
Hospital
Branch
SPOC

54. GLOBAL FILTERS

Allow persistent filtering by:

Hospital
Branch
Department
Team
Date
Payer
TPA
Status

Maintain filters while navigating related screens.

55. HOSPITAL ONBOARDING

Create onboarding wizard:

Hospital Details

Branches

Departments

Teams

Payers

TPAs

SPOCs

Tariffs

Users

Historical Claims

SLA

Workflows

Escalation

Go Live

Display onboarding progress.

56. RCM BUDDY SUPER ADMIN

Create separate platform administration console.

Show:

Total Hospitals
Active Hospitals
Users
Claims
Claim Value
AR
Collection
Denial
Usage
RCM Health Score

Hospital table:

Hospital
Branches
Users
Claims
AR
Collection
Health Score
Last Activity
Status

Actions:

View
Manage
Users
Configuration
Analytics
Health
Support

57. AUDIT LOG

Every important action must be logged.

Record:

User
Timestamp
Organization
Hospital
Branch
Action
Module
Record
Old Value
New Value

Track:

Claim edits
Status changes
Payment changes
Tariff changes
User creation
Permission changes
Document deletion
Assignment changes

Audit logs must not be editable by ordinary users.

58. AI-READY ARCHITECTURE

Design APIs and architecture for future AI.

Potential features:

AI Claim Readiness

Identify missing information.

AI Denial Prediction

Predict potential denial.

AI Query Classification

Automatically categorize payer queries.

AI AR Prioritization

Prioritize claims based on:

Amount

Age

Recovery probability

Payer behavior

Deadline

AI Follow-up Assistant

Suggest next action.

AI Denial Root Cause

Identify likely root cause.

AI Revenue Leakage

Identify unusual financial patterns.

Do not create fake AI features.

Build the system so real AI services can be integrated later.

59. DATABASE ARCHITECTURE

Use a normalized relational database.

Core entities:

organizations
hospital_groups
hospitals
branches
departments
teams
users
roles
permissions
user_roles

patients
encounters
admissions

insurers
tpas
tpa_spocs
policies

claims
claim_status_history
claim_documents

preauths
queries
denials
denial_recovery

ar_accounts
ar_followups

tasks
task_comments
task_assignments

payer_communications
payer_meetings
payer_commitments
payer_escalations

payments
payment_allocations
reconciliations
short_payments

tariffs
procedures
packages

sla_rules
workflow_rules
escalation_rules
reminder_rules

notifications
audit_logs

import_jobs
import_errors

saved_reports
settings

subscriptions

Use:

Primary keys
Foreign keys
Unique constraints
Indexes
Created_at
Updated_at
Created_by
Updated_by
Soft delete where appropriate

60. DATA SECURITY

Implement strict tenant isolation.

Use Row Level Security or equivalent security architecture.

Rules:

Hospital users only see authorized hospitals/branches.

Branch users only see authorized branches.

Team members only see permitted work.

Managers can see their teams.

Hospital administrators can see their hospital.

Group administrators can see their group.

RCM Buddy administrators can see assigned hospitals.

Never rely solely on frontend hiding.

Security must be enforced at the backend/database layer.

61. KPI ENGINE

Create a centralized KPI calculation layer.

Examples:

Collection Rate:

Settled Amount / Submitted Amount × 100

Denial Rate:

Denied Claims / Submitted Claims × 100

Query Rate:

Claims With Query / Submitted Claims × 100

Average TAT:

Average(Completion Date - Start Date)

AR Aging:

Current Date - Due Date

Short Payment:

Expected Amount - Received Amount

Use one centralized definition for every KPI.

Do not calculate the same KPI differently across dashboards.

62. FINANCIAL TRACEABILITY

Every financial dashboard number must be drillable.

Example:

₹12.4 Cr AR

Click

→ AR List

→ Claim

→ Settlement

→ Payment

→ Reconciliation

→ Audit Trail

Every major financial number must be traceable back to underlying records.

63. PERFORMANCE

Design for:

500+ hospitals
10,000+ users
Millions of claims
Large document volumes

Use:

Pagination
Lazy Loading
Server-side filtering
Server-side sorting
Database indexes
Caching where appropriate
Background jobs
Async imports
Async report generation

Never load millions of records into the browser.

64. UX/UI

Create a premium enterprise healthcare SaaS experience.

Design characteristics:

Professional

Clean

Modern

Data-rich

Fast

Intuitive

Desktop-first

Responsive

Accessible

Visual inspiration:

Enterprise CRM
Modern fintech dashboard
Healthcare SaaS
Hospital operations software

Avoid:

Excessive gradients

Excessive animations

Oversized cards

Decorative UI without purpose

Consumer-style interfaces

The product should feel like:

A financial and operational command center for hospital RCM.

65. RESPONSIVE DESIGN

Desktop is the primary experience.

Support:

Desktop
Tablet
Mobile

Mobile should prioritize:

Tasks
Notifications
Claim Search
Claim Details
Follow-ups
Approvals
Escalations

66. ERROR HANDLING

Use human-readable messages.

Examples:

"Duplicate claim number detected."

"You do not have permission to perform this action."

"Payment cannot exceed the approved amount."

"Tariff expired on 31-Aug-2026."

"Required document missing."

Never expose raw technical/database errors.

67. EMPTY STATES

Every module must have meaningful empty states.

Examples:

"No pending claims."

"No overdue AR."

"No unresolved payer queries."

"No follow-ups due today."

Include relevant action buttons.

68. DEMO DATA

Create synthetic Indian hospital data.

Generate:

5 hospital groups
10 hospitals
20 branches
100 users
5,000 patients
10,000 claims

Include:

Multiple insurers
Multiple TPAs
Multiple claim statuses
Payments
Denials
AR
Queries
Follow-ups
Communications
Escalations
Tariffs
Teams

Never use real patient information.

69. UNIQUE CLAIM ID

Generate:

RCM-2026-000001

It must be globally unique.

70. IMPORT VALIDATION

Every import should create an Import Job.

Track:

Job ID
Uploaded By
File
Started
Completed
Total Records
Successful
Failed
Warnings

Allow error report download.

71. PRODUCTIVITY PRINCIPLE

Minimize clicks.

Example:

Work Queue
→ Claim
→ Follow-up
→ Complete

should be possible without unnecessary navigation.

Use contextual action menus.

72. CONFIGURATION ENGINE

Do not hard-code:

Statuses

Workflows

SLA

Payer rules

TPA rules

Tariffs

Denial reasons

Query reasons

Escalations

Reminder rules

These should be configurable.

73. PHASED DEVELOPMENT

Build the product in phases.

PHASE 1 — PLATFORM FOUNDATION

Authentication
Multi-tenancy
Organizations
Hospital groups
Hospitals
Branches
Departments
Teams
Users
Roles
Permissions
Database
Navigation
Audit
Basic dashboard

PHASE 2 — CLAIM CORE

Patients
Admissions
Discharge
Pre-auth
Claims
Claim lifecycle
Claim detail
Documents
Claim readiness
Work queue

PHASE 3 — OPERATIONS

Tasks
Queries
Follow-ups
Reminders
SLA
Escalations
Notifications

PHASE 4 — PAYER MANAGEMENT

Payers
TPAs
SPOCs
Payer 360
Communications
Meetings
Commitments
Engagement
Tariffs

PHASE 5 — FINANCIAL RCM

AR
Payments
Settlements
Reconciliation
Short payments
Denials
Recovery
Revenue leakage

PHASE 6 — TEAM MANAGEMENT

Team dashboard
Workload
Assignments
Productivity
Performance
Availability
Backup assignment

PHASE 7 — ENTERPRISE ANALYTICS

Executive dashboard
Hospital group dashboard
Payer analytics
TPA analytics
RCM Health Score
Management reports

PHASE 8 — AI

Claim readiness
Denial prediction
AR prioritization
Query classification
Follow-up recommendations
Revenue leakage detection

74. DEVELOPMENT RULE

Do NOT create fake functionality.

Every visible feature must:

Work completely, OR

Be clearly identified as a future feature.

Do not create buttons that do nothing.

Do not create fake charts disconnected from the database.

Use real database-driven calculations.

75. SELF-AUDIT AFTER EACH PHASE

Before considering a phase complete, test:

FUNCTIONALITY

Does every feature work?

SECURITY

Can users access unauthorized tenant data?

RBAC

Are permissions enforced?

DATABASE

Are relationships correct?

KPI

Are calculations accurate?

UX

Can users understand the workflow?

PERFORMANCE

Will this scale?

EDGE CASES

What happens with:

Duplicate claims
Missing data
Deleted users
Reassigned users
Cancelled claims
Reopened claims
Partial payments
Duplicate payments
Multiple branches
Multiple TPAs
Multiple SPOCs
Expired tariffs
SLA breaches

AUDIT

Can every important change be traced?

Fix problems before moving to the next phase.

76. MOST IMPORTANT ARCHITECTURAL PRINCIPLE

RCM Buddy is NOT:

"An Excel replacement for hospital claims."

It is:

A MULTI-HOSPITAL RCM OPERATING SYSTEM

The core engines are:

CLAIM ENGINE

WORK ENGINE

FOLLOW-UP ENGINE

REMINDER ENGINE

COMMUNICATION ENGINE

PAYER RELATIONSHIP ENGINE

TEAM MANAGEMENT ENGINE

AR ENGINE

DENIAL & RECOVERY ENGINE

SETTLEMENT ENGINE

RECONCILIATION ENGINE

ANALYTICS ENGINE

ESCALATION ENGINE

AI INTELLIGENCE ENGINE

All engines should share a common data model.

77. FINAL USER EXPERIENCE

When a user opens RCM Buddy, the experience should be:

"Tell me what needs to be done."

Not:

"Here is a database of claims."

The system should proactively surface:

WHAT → WHY → WHO → BY WHEN → NEXT ACTION

For example:

Claim RCM-2026-001245
₹8,45,000
MediAssist
43 days pending
Payment not received
Last follow-up: 5 days ago
Payer commitment: 28-Sep-2026
Commitment missed

Recommended Action: Escalate to TPA SPOC

Assigned to: Rahul
Due: Today

This action-oriented design principle should be applied throughout the product.

78. START IMPLEMENTATION

First inspect the current Lovable project and determine what already exists.

Do not unnecessarily rebuild existing working functionality.

Then implement:

PHASE 1 — PLATFORM FOUNDATION

Start with:

Authentication

Multi-tenant architecture

Organization hierarchy

Hospital Groups

Hospitals

Branches

Departments

Teams

Users

Roles

Permissions

Database architecture

Tenant isolation

Audit logging

Main navigation

Dashboard shell

Super Admin console

Hospital onboarding framework

Master-data framework

Notification framework

Before proceeding to Phase 2, verify that the foundation can support:

500+ hospitals, multiple branches, thousands of users and millions of claims.

After completing Phase 1, provide a concise implementation report showing:

Database schema

Entity relationships

Tenant architecture

RBAC architecture

Permission matrix

Screens implemented

Working features

Security controls

Test results

Known limitations

Recommended next step

Do not proceed to later phases until the foundation is stable.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f7f5813e-229d-4b9d-add7-9c061ec854bd).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
