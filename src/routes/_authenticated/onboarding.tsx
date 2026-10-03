import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Plus, Trash2 } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/rcm/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { groupsQuery, organizationsQuery, sessionQuery } from "@/lib/queries";
import { NewOrganizationDialog } from "@/components/rcm/new-organization-dialog";
import { runOnboarding, type OnboardingResult } from "@/lib/onboarding.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(groupsQuery),
      context.queryClient.ensureQueryData(organizationsQuery),
    ]),
  head: () => ({
    meta: [
      { title: "Onboard a hospital — RCM Buddy" },
      { name: "description", content: "Guided setup for a hospital group, its hospitals, branches, departments and first admin users." },
      { property: "og:title", content: "Onboard a hospital — RCM Buddy" },
      { property: "og:description", content: "Guided hospital onboarding for RCM Buddy." },
    ],
  }),
  component: Onboarding,
});

type Branch = { key: string; name: string; code: string; city: string };
type Dept = { key: string; name: string; code: string; dept_type: "clinical" | "rcm" | "finance" | "support"; branchKey: string | null };
type Admin = { key: string; full_name: string; email: string; roleKey: "hospital_admin" | "rcm_head" | "cfo" | "finance_head" };
type Hosp = { key: string; name: string; code: string; city: string; state: string; bed_count: string; branches: Branch[]; departments: Dept[]; admins: Admin[] };

const STEPS = ["Group", "Hospitals", "Branches", "Departments", "Admin users", "Review"];
const ROLE_LABEL: Record<Admin["roleKey"], string> = { hospital_admin: "Hospital Admin", rcm_head: "RCM Head", cfo: "CFO", finance_head: "Finance Head" };
const SUGGESTED: Omit<Dept, "key" | "branchKey">[] = [
  { name: "Cashless Desk", code: "CASHLESS", dept_type: "rcm" },
  { name: "Billing", code: "BILLING", dept_type: "rcm" },
  { name: "Accounts Receivable", code: "AR", dept_type: "finance" },
  { name: "Medical Records", code: "MRD", dept_type: "support" },
];
const uid = () => Math.random().toString(36).slice(2, 10);
const up = (s: string) => s.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
const newHosp = (): Hosp => ({ key: uid(), name: "", code: "", city: "", state: "", bed_count: "", branches: [], departments: [], admins: [] });
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

function Onboarding() {
  const { data: session } = useSuspenseQuery(sessionQuery);
  const { data: orgs } = useSuspenseQuery(organizationsQuery);
  const { data: groups } = useSuspenseQuery(groupsQuery);
  const customerOrgs = orgs.filter((o) => o.org_type === "customer");
  const allowed = session.isSuperAdmin || session.permissions.includes("hospitals.CREATE");

  const [step, setStep] = useState(0);
  const [orgId, setOrgId] = useState(customerOrgs[0]?.id ?? "");
  const [groupMode, setGroupMode] = useState<"existing" | "new">("new");
  const [groupId, setGroupId] = useState("");
  const [group, setGroup] = useState({ name: "", code: "", headquarters_city: "" });
  const [hosps, setHosps] = useState<Hosp[]>([newHosp()]);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OnboardingResult | null>(null);
  const run = useServerFn(runOnboarding);
  const qc = useQueryClient();

  if (!allowed) return <EmptyState title="Onboarding is restricted" description="Only platform admins or users allowed to create hospitals can onboard new hospitals." />;

  const patch = (i: number, p: Partial<Hosp>) => setHosps((hs) => hs.map((h, j) => (j === i ? { ...h, ...p } : h)));
  const groupsInOrg = groups.filter((g) => g.organization_id === orgId);

  function errorsFor(s: number): string[] {
    const e: string[] = [];
    if (s === 0) {
      if (!orgId) e.push("Choose the customer organisation.");
      if (groupMode === "existing" && !groupId) e.push("Choose a hospital group.");
      if (groupMode === "new" && (group.name.trim().length < 2 || group.code.length < 2)) e.push("Give the new group a name and code.");
    }
    if (s === 1) {
      hosps.forEach((h, i) => { if (h.name.trim().length < 2 || h.code.length < 2) e.push(`Hospital ${i + 1} needs a name and code.`); });
      const codes = hosps.map((h) => h.code).filter(Boolean);
      if (new Set(codes).size !== codes.length) e.push("Two hospitals share the same code.");
    }
    if (s === 2) hosps.forEach((h) => {
      h.branches.forEach((b) => { if (b.name.trim().length < 2 || b.code.length < 2) e.push(`${h.name}: every branch needs a name and code.`); });
      const c = h.branches.map((b) => b.code); if (new Set(c).size !== c.length) e.push(`${h.name}: two branches share a code.`);
    });
    if (s === 3) hosps.forEach((h) => {
      h.departments.forEach((d) => { if (d.name.trim().length < 2 || d.code.length < 2) e.push(`${h.name}: every department needs a name and code.`); });
      const c = h.departments.map((d) => `${d.branchKey}-${d.code}`); if (new Set(c).size !== c.length) e.push(`${h.name}: duplicate department code.`);
    });
    if (s === 4) hosps.forEach((h) => h.admins.forEach((a) => {
      if (a.full_name.trim().length < 2) e.push(`${h.name}: each admin needs a name.`);
      if (!isEmail(a.email)) e.push(`${h.name}: "${a.email || "blank"}" is not a valid email.`);
    }));
    return Array.from(new Set(e));
  }
  const currentErrors = errorsFor(step);

  async function launch() {
    for (let s = 0; s < 5; s++) if (errorsFor(s).length) { setStep(s); toast.error("Please fix the highlighted step first."); return; }
    setBusy(true);
    try {
      const res = await run({
        data: {
          organizationId: orgId,
          group: groupMode === "existing" ? { mode: "existing", id: groupId } : { mode: "new", ...group },
          hospitals: hosps.map((h) => ({
            key: h.key, name: h.name, code: h.code, city: h.city, state: h.state,
            bed_count: h.bed_count ? Number(h.bed_count) : null,
            branches: h.branches, departments: h.departments,
            admins: h.admins.map(({ full_name, email, roleKey }) => ({ full_name, email, roleKey })),
          })),
          redirectTo: `${window.location.origin}/auth`,
        },
      });
      setResult(res);
      qc.invalidateQueries();
      if (res.problems.length) toast.warning("Onboarding finished with some issues."); else toast.success("Onboarding complete.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message.replace(/^\[.*?\]\s*/, "") : "Onboarding failed.");
    } finally { setBusy(false); }
  }

  if (result) {
    return (
      <div className="max-w-3xl">
        <PageHeader title="Onboarding complete" description="Everything below was saved. Admins receive an email invitation to set their password." />
        <div className="space-y-2">
          {result.hospitals.map((h) => (
            <div key={h.name} className="flex items-center justify-between rounded-lg border border-border bg-card p-4 text-[13px]">
              <div>
                <p className="font-medium">{h.name}</p>
                <p className="tnum text-muted-foreground">{h.branches} branches · {h.departments} departments · {h.admins} admins</p>
              </div>
              {h.id ? <Link to="/hospitals/$hospitalId" params={{ hospitalId: h.id }} className="text-primary hover:underline">Open hospital</Link> : <span className="text-risk">Not created</span>}
            </div>
          ))}
        </div>
        {result.problems.length ? (
          <div className="mt-4 rounded-lg border border-risk/40 bg-risk/5 p-4 text-[13px]">
            <p className="font-medium text-risk">Items that need attention</p>
            <ul className="mt-2 list-disc pl-5 text-muted-foreground">{result.problems.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        ) : null}
        <div className="mt-5 flex gap-2">
          <Button onClick={() => { setResult(null); setStep(0); setHosps([newHosp()]); setGroup({ name: "", code: "", headquarters_city: "" }); }}>Onboard another</Button>
          <Button variant="outline" asChild><Link to="/hospitals">Go to hospitals</Link></Button>
        </div>
      </div>
    );
  }

  const h = hosps[active] ?? hosps[0]!;
  const HospTabs = step >= 2 && step <= 4 && hosps.length > 1 ? (
    <div className="mb-3 flex flex-wrap gap-1">
      {hosps.map((x, i) => (
        <button key={x.key} onClick={() => setActive(i)} className={cn("rounded border px-3 py-1 text-[12px]", i === active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted")}>
          {x.name || `Hospital ${i + 1}`}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div className="max-w-4xl">
      <PageHeader title="Onboard a hospital" description="Set up the group, hospitals, branches, departments and first admins. Nothing is saved until you confirm on the last step." />

      <ol className="mb-5 flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button onClick={() => setStep(i)} className={cn("flex items-center gap-2 rounded-full border px-3 py-1 text-[12px]",
              i === step ? "border-primary bg-primary text-primary-foreground" : i < step ? "border-primary/40 text-primary" : "border-border text-muted-foreground")}>
              <span className="tnum flex h-4 w-4 items-center justify-center rounded-full text-[10px]">{i < step ? <Check className="h-3 w-3" /> : i + 1}</span>
              {s}
            </button>
          </li>
        ))}
      </ol>

      <div className="rounded-lg border border-border bg-card p-5">
        {HospTabs}

        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {session.isSuperAdmin ? (
              <div className="sm:col-span-2"><NewOrganizationDialog onCreated={(id) => { setOrgId(id); setGroupId(""); }} /></div>
            ) : null}
            <Field label="Customer organisation" full>
              <Select value={orgId} onValueChange={(v) => { setOrgId(v); setGroupId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{customerOrgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <div className="flex gap-2 sm:col-span-2">
              <Button variant={groupMode === "new" ? "default" : "outline"} size="sm" onClick={() => setGroupMode("new")}>Create a new group</Button>
              <Button variant={groupMode === "existing" ? "default" : "outline"} size="sm" onClick={() => setGroupMode("existing")} disabled={!groupsInOrg.length}>Use an existing group</Button>
            </div>
            {groupMode === "existing" ? (
              <Field label="Hospital group" full>
                <Select value={groupId} onValueChange={setGroupId}>
                  <SelectTrigger><SelectValue placeholder="Select a group" /></SelectTrigger>
                  <SelectContent>{groupsInOrg.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            ) : (<>
              <Field label="Group name"><Input value={group.name} onChange={(e) => setGroup({ ...group, name: e.target.value })} placeholder="e.g. Sahyadri Health Group" /></Field>
              <Field label="Group code"><Input value={group.code} onChange={(e) => setGroup({ ...group, code: up(e.target.value) })} placeholder="SAHYADRI" /></Field>
              <Field label="Headquarters city"><Input value={group.headquarters_city} onChange={(e) => setGroup({ ...group, headquarters_city: e.target.value })} /></Field>
            </>)}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            {hosps.map((x, i) => (
              <div key={x.key} className="rounded-md border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[13px] font-semibold">Hospital {i + 1}</p>
                  {hosps.length > 1 ? <Button variant="ghost" size="sm" onClick={() => { setHosps(hosps.filter((_, j) => j !== i)); setActive(0); }}><Trash2 className="h-4 w-4" /></Button> : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Name"><Input value={x.name} onChange={(e) => patch(i, { name: e.target.value })} /></Field>
                  <Field label="Code"><Input value={x.code} onChange={(e) => patch(i, { code: up(e.target.value) })} /></Field>
                  <Field label="Beds"><Input type="number" min={0} value={x.bed_count} onChange={(e) => patch(i, { bed_count: e.target.value })} /></Field>
                  <Field label="City"><Input value={x.city} onChange={(e) => patch(i, { city: e.target.value })} /></Field>
                  <Field label="State"><Input value={x.state} onChange={(e) => patch(i, { state: e.target.value })} /></Field>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setHosps([...hosps, newHosp()])}><Plus className="mr-1 h-4 w-4" />Add another hospital</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-[13px] text-muted-foreground">Branches are campuses or units of <b>{h.name || "this hospital"}</b>. Optional — skip if it has a single site.</p>
            {h.branches.map((b, bi) => (
              <div key={b.key} className="grid items-end gap-2 sm:grid-cols-[1fr_140px_1fr_auto]">
                <Field label="Branch name"><Input value={b.name} onChange={(e) => patch(active, { branches: h.branches.map((y, j) => j === bi ? { ...y, name: e.target.value } : y) })} /></Field>
                <Field label="Code"><Input value={b.code} onChange={(e) => patch(active, { branches: h.branches.map((y, j) => j === bi ? { ...y, code: up(e.target.value) } : y) })} /></Field>
                <Field label="City"><Input value={b.city} onChange={(e) => patch(active, { branches: h.branches.map((y, j) => j === bi ? { ...y, city: e.target.value } : y) })} /></Field>
                <Button variant="ghost" size="sm" onClick={() => patch(active, { branches: h.branches.filter((_, j) => j !== bi), departments: h.departments.map((d) => d.branchKey === b.key ? { ...d, branchKey: null } : d) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => patch(active, { branches: [...h.branches, { key: uid(), name: "", code: "", city: h.city }] })}><Plus className="mr-1 h-4 w-4" />Add branch</Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-muted-foreground">Quick add:</span>
              {SUGGESTED.map((s) => {
                const has = h.departments.some((d) => d.code === s.code && d.branchKey === null);
                return <Button key={s.code} size="sm" variant="outline" disabled={has} onClick={() => patch(active, { departments: [...h.departments, { ...s, key: uid(), branchKey: null }] })}>{s.name}</Button>;
              })}
            </div>
            {h.departments.map((d, di) => {
              const set = (p: Partial<Dept>) => patch(active, { departments: h.departments.map((y, j) => j === di ? { ...y, ...p } : y) });
              return (
                <div key={d.key} className="grid items-end gap-2 sm:grid-cols-[1fr_120px_130px_1fr_auto]">
                  <Field label="Department"><Input value={d.name} onChange={(e) => set({ name: e.target.value })} /></Field>
                  <Field label="Code"><Input value={d.code} onChange={(e) => set({ code: up(e.target.value) })} /></Field>
                  <Field label="Type">
                    <Select value={d.dept_type} onValueChange={(v) => set({ dept_type: v as Dept["dept_type"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["clinical", "rcm", "finance", "support"].map((t) => <SelectItem key={t} value={t}>{t === "rcm" ? "RCM" : t[0]!.toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Branch">
                    <Select value={d.branchKey ?? "all"} onValueChange={(v) => set({ branchKey: v === "all" ? null : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Hospital-wide</SelectItem>
                        {h.branches.map((b) => <SelectItem key={b.key} value={b.key}>{b.name || b.code || "Unnamed branch"}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Button variant="ghost" size="sm" onClick={() => patch(active, { departments: h.departments.filter((_, j) => j !== di) })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={() => patch(active, { departments: [...h.departments, { key: uid(), name: "", code: "", dept_type: "clinical", branchKey: null }] })}><Plus className="mr-1 h-4 w-4" />Add department</Button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <p className="text-[13px] text-muted-foreground">These people get access to <b>{h.name || "this hospital"}</b> only. New people receive an email invitation; existing users simply gain access.</p>
            {h.admins.map((a, ai) => {
              const set = (p: Partial<Admin>) => patch(active, { admins: h.admins.map((y, j) => j === ai ? { ...y, ...p } : y) });
              return (
                <div key={a.key} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_170px_auto]">
                  <Field label="Full name"><Input value={a.full_name} onChange={(e) => set({ full_name: e.target.value })} /></Field>
                  <Field label="Work email"><Input type="email" value={a.email} onChange={(e) => set({ email: e.target.value })} /></Field>
                  <Field label="Role">
                    <Select value={a.roleKey} onValueChange={(v) => set({ roleKey: v as Admin["roleKey"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(ROLE_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Button variant="ghost" size="sm" onClick={() => patch(active, { admins: h.admins.filter((_, j) => j !== ai) })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={() => patch(active, { admins: [...h.admins, { key: uid(), full_name: "", email: "", roleKey: "hospital_admin" }] })}><Plus className="mr-1 h-4 w-4" />Add admin user</Button>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4 text-[13px]">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Group</p>
              <p className="font-medium">{groupMode === "new" ? `${group.name} (${group.code}) — new` : groupsInOrg.find((g) => g.id === groupId)?.name}</p>
            </div>
            {hosps.map((x) => (
              <div key={x.key} className="rounded-md border border-border p-4">
                <p className="font-semibold">{x.name} <span className="tnum text-muted-foreground">· {x.code}</span></p>
                <p className="text-muted-foreground">{[x.city, x.state].filter(Boolean).join(", ") || "No location"}{x.bed_count ? ` · ${x.bed_count} beds` : ""}</p>
                <p className="mt-2"><b>Branches:</b> {x.branches.map((b) => b.name).join(", ") || "None"}</p>
                <p><b>Departments:</b> {x.departments.map((d) => d.name).join(", ") || "None"}</p>
                <p><b>Admins:</b> {x.admins.map((a) => `${a.full_name} (${ROLE_LABEL[a.roleKey]})`).join(", ") || "None"}</p>
              </div>
            ))}
            {[0, 1, 2, 3, 4].some((s) => errorsFor(s).length) ? <p className="text-risk">Some steps still have problems — click a step above to fix them.</p> : null}
          </div>
        )}

        {currentErrors.length && step < 5 ? (
          <ul className="mt-4 list-disc pl-5 text-[12px] text-risk">{currentErrors.map((e) => <li key={e}>{e}</li>)}</ul>
        ) : null}

        <div className="mt-6 flex justify-between border-t border-border pt-4">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
          {step < 5
            ? <Button disabled={currentErrors.length > 0} onClick={() => setStep(step + 1)}>Continue</Button>
            : <Button disabled={busy} onClick={launch}>{busy ? "Setting up…" : "Confirm and create"}</Button>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={cn("space-y-1.5", full && "sm:col-span-2")}><Label>{label}</Label>{children}</div>;
}
