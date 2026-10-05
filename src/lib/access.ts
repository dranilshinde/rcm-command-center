// Client-safe helpers describing which page needs which permission.

export const PAGE_MODULE: Record<string, string> = {
  "/dashboard": "dashboard",
  "/work-queue": "work_queue",
  "/claims": "claims",
  "/admissions": "claims",
  "/preauth": "preauth",
  "/patients": "patients",
  "/imports": "claims",
  "/queries": "queries",
  "/followups": "followups",
  "/escalations": "tasks",
  "/ar": "ar",
  "/settlements": "settlements",
  "/reconciliation": "reconciliation",
  "/denials": "denials",
  "/hospital-groups": "hospitals",
  "/hospitals": "hospitals",
  "/onboarding": "hospitals",
  "/payers": "payers",
  "/users": "users",
  "/team-members": "users",
  "/invitations": "users",
  "/sla-rules": "settings",
  "/master-data": "master_data",
  "/audit": "audit",
  "/settings": "settings",
};

export function moduleForPath(pathname: string): string | null {
  const hit = Object.keys(PAGE_MODULE).find((p) => pathname === p || pathname.startsWith(`${p}/`));
  return hit ? PAGE_MODULE[hit] ?? null : null;
}

export function isPageLocked(path: string, s: { isSuperAdmin: boolean; permissions: string[] }) {
  if (s.isSuperAdmin) return false;
  const m = moduleForPath(path);
  return !!m && !s.permissions.includes(`${m}.VIEW`);
}

export const PAGE_LABEL: Record<string, string> = {
  dashboard: "Dashboard", work_queue: "Work Queue", claims: "Claims, Admissions & Import", preauth: "Pre-Authorisation",
  patients: "Patients", queries: "Payer Queries", followups: "Payer Follow-ups", tasks: "Escalations",
  ar: "AR Management", settlements: "Settlements", reconciliation: "Reconciliation", denials: "Denials & Recovery",
  hospitals: "Hospitals & Onboarding", payers: "Payers & TPAs", users: "Users & Team Members",
  settings: "Settings & SLA Rules", master_data: "Master Data", audit: "Audit Log",
};

/** Plain-language summary of what a set of permissions allows. */
export function describeAccess(perms: string[], isSuperAdmin: boolean) {
  const has = (k: string) => isSuperAdmin || perms.includes(k);
  const claims = has("claims.EDIT")
    ? "You can edit any claim in the hospitals you have access to."
    : has("claims.VIEW") ? "You can view claims but not edit them." : "You cannot open claims.";
  const queue = has("work_queue.ASSIGN") || has("tasks.ASSIGN")
    ? has("work_queue.REASSIGN") || has("tasks.REASSIGN")
      ? "You can assign and reassign work queue items to your team."
      : "You can assign unassigned work queue items, but not take work away from someone."
    : "You work on items assigned to you; a manager assigns the queue.";
  const locked = Object.entries(PAGE_LABEL).filter(([m]) => !has(`${m}.VIEW`)).map(([, l]) => l);
  return { claims, queue, locked };
}
