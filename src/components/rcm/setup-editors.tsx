import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Pencil, Sparkles, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, StatusChip } from "@/components/rcm/app-shell";
import {
  addHospitalAdmin, listHospitalAdmins, removeAdminAccess, updateAdmin, updateBranch,
  updateDepartment, updateHospital, updateHospitalGroup,
} from "@/lib/setup.functions";
import { analyzeReadiness, type ReadinessReport } from "@/lib/readiness.functions";
import { cn } from "@/lib/utils";

const up = (s: string) => s.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
const errMsg = (e: unknown, fb: string) => (e instanceof Error ? e.message : fb);
export const ADMIN_ROLE_LABEL: Record<string, string> = {
  hospital_admin: "Hospital Admin", rcm_head: "RCM Head", cfo: "CFO", finance_head: "Finance Head",
};
const STATUSES = ["active", "onboarding", "inactive", "suspended"] as const;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function StatusSelect({ value, onChange, options = STATUSES as readonly string[] }: { value: string; onChange: (v: string) => void; options?: readonly string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>{options.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function EditShell({ title, open, onOpenChange, busy, onSave, children }: {
  title: string; open: boolean; onOpenChange: (o: boolean) => void; busy: boolean; onSave: () => void; children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">{children}</div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function useSaver() {
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  async function save(fn: () => Promise<unknown>, done: () => void, ok = "Changes saved.") {
    setBusy(true);
    try { await fn(); toast.success(ok); qc.invalidateQueries(); done(); }
    catch (e) { toast.error(errMsg(e, "We could not save this change.")); }
    finally { setBusy(false); }
  }
  return { busy, save };
}

export function EditIconButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-label={label} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
      <Pencil className="h-3.5 w-3.5" />
    </button>
  );
}

/* ---------------------------------------------------------------- group */

export function EditGroupButton({ group }: { group: { id: string; name: string; code: string; headquarters_city: string | null; status: string } }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: group.name, code: group.code, headquarters_city: group.headquarters_city ?? "", status: group.status });
  const run = useServerFn(updateHospitalGroup);
  const { busy, save } = useSaver();
  return (<>
    <EditIconButton label={`Edit ${group.name}`} onClick={() => setOpen(true)} />
    <EditShell title="Edit hospital group" open={open} onOpenChange={setOpen} busy={busy}
      onSave={() => save(() => run({ data: { id: group.id, ...f, status: f.status as (typeof STATUSES)[number] } }), () => setOpen(false))}>
      <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Code"><Input value={f.code} onChange={(e) => setF({ ...f, code: up(e.target.value) })} /></Field>
      <Field label="Headquarters city"><Input value={f.headquarters_city} onChange={(e) => setF({ ...f, headquarters_city: e.target.value })} /></Field>
      <Field label="Status"><StatusSelect value={f.status} onChange={(v) => setF({ ...f, status: v })} /></Field>
    </EditShell>
  </>);
}

/* ------------------------------------------------------------- hospital */

export function EditHospitalButton({ hospital, groups }: {
  hospital: { id: string; name: string; code: string; city: string | null; state: string | null; bed_count: number | null; status: string; hospital_group_id: string | null; go_live_date: string | null };
  groups: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const init = () => ({
    name: hospital.name, code: hospital.code, city: hospital.city ?? "", state: hospital.state ?? "",
    bed_count: hospital.bed_count?.toString() ?? "", status: hospital.status,
    hospital_group_id: hospital.hospital_group_id ?? "none", go_live_date: hospital.go_live_date ?? "",
  });
  const [f, setF] = useState(init);
  const run = useServerFn(updateHospital);
  const { busy, save } = useSaver();
  return (<>
    <Button size="sm" variant="outline" onClick={() => { setF(init()); setOpen(true); }}><Pencil className="mr-1 h-3.5 w-3.5" />Edit hospital</Button>
    <EditShell title="Edit hospital" open={open} onOpenChange={setOpen} busy={busy}
      onSave={() => save(() => run({ data: {
        id: hospital.id, name: f.name, code: f.code, city: f.city, state: f.state,
        bed_count: f.bed_count ? Number(f.bed_count) : null, status: f.status as (typeof STATUSES)[number],
        hospital_group_id: f.hospital_group_id === "none" ? null : f.hospital_group_id, go_live_date: f.go_live_date || null,
      } }), () => setOpen(false))}>
      <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Code"><Input value={f.code} onChange={(e) => setF({ ...f, code: up(e.target.value) })} /></Field>
      <Field label="City"><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
      <Field label="State"><Input value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} /></Field>
      <Field label="Beds"><Input type="number" min={0} value={f.bed_count} onChange={(e) => setF({ ...f, bed_count: e.target.value })} /></Field>
      <Field label="Planned go-live"><Input type="date" value={f.go_live_date} onChange={(e) => setF({ ...f, go_live_date: e.target.value })} /></Field>
      <Field label="Hospital group">
        <Select value={f.hospital_group_id} onValueChange={(v) => setF({ ...f, hospital_group_id: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No group</SelectItem>
            {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Status"><StatusSelect value={f.status} onChange={(v) => setF({ ...f, status: v })} /></Field>
    </EditShell>
  </>);
}

/* --------------------------------------------------------------- branch */

export function EditBranchButton({ branch }: { branch: { id: string; name: string; code: string; city: string | null; state: string | null; status: string } }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: branch.name, code: branch.code, city: branch.city ?? "", state: branch.state ?? "", status: branch.status });
  const run = useServerFn(updateBranch);
  const { busy, save } = useSaver();
  return (<>
    <EditIconButton label={`Edit ${branch.name}`} onClick={() => setOpen(true)} />
    <EditShell title="Edit branch" open={open} onOpenChange={setOpen} busy={busy}
      onSave={() => save(() => run({ data: { id: branch.id, ...f, status: f.status as (typeof STATUSES)[number] } }), () => setOpen(false))}>
      <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Code"><Input value={f.code} onChange={(e) => setF({ ...f, code: up(e.target.value) })} /></Field>
      <Field label="City"><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
      <Field label="State"><Input value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} /></Field>
      <Field label="Status"><StatusSelect value={f.status} onChange={(v) => setF({ ...f, status: v })} /></Field>
    </EditShell>
  </>);
}

/* ----------------------------------------------------------- department */

export function EditDepartmentButton({ dept, branches }: {
  dept: { id: string; name: string; code: string; dept_type: string; branch_id: string | null; status: string };
  branches: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: dept.name, code: dept.code, dept_type: dept.dept_type, branch_id: dept.branch_id ?? "all", status: dept.status });
  const run = useServerFn(updateDepartment);
  const { busy, save } = useSaver();
  return (<>
    <EditIconButton label={`Edit ${dept.name}`} onClick={() => setOpen(true)} />
    <EditShell title="Edit department" open={open} onOpenChange={setOpen} busy={busy}
      onSave={() => save(() => run({ data: {
        id: dept.id, name: f.name, code: f.code, dept_type: f.dept_type as "clinical" | "rcm" | "finance" | "support",
        branch_id: f.branch_id === "all" ? null : f.branch_id, status: f.status as (typeof STATUSES)[number],
      } }), () => setOpen(false))}>
      <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Code"><Input value={f.code} onChange={(e) => setF({ ...f, code: up(e.target.value) })} /></Field>
      <Field label="Type"><StatusSelect value={f.dept_type} onChange={(v) => setF({ ...f, dept_type: v })} options={["clinical", "rcm", "finance", "support"]} /></Field>
      <Field label="Branch">
        <Select value={f.branch_id} onValueChange={(v) => setF({ ...f, branch_id: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Hospital-wide</SelectItem>
            {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Status"><StatusSelect value={f.status} onChange={(v) => setF({ ...f, status: v })} /></Field>
    </EditShell>
  </>);
}

/* --------------------------------------------------------------- admins */

type AdminRow = { userRoleId: string; userId: string; roleKey: string; roleName: string; full_name: string; email: string | null; status: string };

export function HospitalAdminsPanel({ hospitalId, canManage, selfId }: { hospitalId: string; canManage: boolean; selfId: string }) {
  const list = useServerFn(listHospitalAdmins);
  const { data, isLoading } = useQuery({ queryKey: ["hospital-admins", hospitalId], queryFn: () => list({ data: { hospitalId } }) });
  const [editing, setEditing] = useState<AdminRow | null>(null);
  const [adding, setAdding] = useState(false);
  const remove = useServerFn(removeAdminAccess);
  const qc = useQueryClient();

  async function onRemove(r: AdminRow) {
    if (!confirm(`Remove ${r.full_name}'s access to this hospital?`)) return;
    try { await remove({ data: { hospitalId, userId: r.userId } }); toast.success("Access removed."); qc.invalidateQueries(); }
    catch (e) { toast.error(errMsg(e, "Could not remove access.")); }
  }

  return (
    <div>
      {canManage ? <div className="mb-3 flex justify-end"><Button size="sm" onClick={() => setAdding(true)}><UserPlus className="mr-1 h-4 w-4" />Invite admin</Button></div> : null}
      {isLoading ? <p className="text-[13px] text-muted-foreground">Loading…</p> : !data?.length ? (
        <EmptyState title="No one has a role at this hospital yet" description="Invite a hospital admin so the hospital can manage its own setup." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">Name</th><th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Role</th><th className="px-3 py-2 font-medium">Status</th>
              {canManage ? <th className="px-3 py-2" /> : null}
            </tr></thead>
            <tbody>{data.map((r) => (
              <tr key={r.userRoleId} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2 font-medium">{r.full_name}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.email ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.roleName}</td>
                <td className="px-3 py-2"><StatusChip status={r.status} /></td>
                {canManage ? (
                  <td className="px-3 py-2 text-right">
                    {ADMIN_ROLE_LABEL[r.roleKey] ? <EditIconButton label={`Edit ${r.full_name}`} onClick={() => setEditing(r)} /> : null}
                    {r.userId !== selfId ? (
                      <button onClick={() => onRemove(r)} aria-label={`Remove ${r.full_name}`} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-risk">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {editing ? <EditAdminDialog row={editing} hospitalId={hospitalId} onClose={() => setEditing(null)} /> : null}
      {adding ? <AddAdminDialog hospitalId={hospitalId} onClose={() => setAdding(false)} /> : null}
    </div>
  );
}

function EditAdminDialog({ row, hospitalId, onClose }: { row: AdminRow; hospitalId: string; onClose: () => void }) {
  const [f, setF] = useState({ full_name: row.full_name, roleKey: row.roleKey, status: row.status });
  const run = useServerFn(updateAdmin);
  const { busy, save } = useSaver();
  return (
    <EditShell title="Edit admin user" open onOpenChange={(o) => !o && onClose()} busy={busy}
      onSave={() => save(() => run({ data: {
        hospitalId, userRoleId: row.userRoleId, userId: row.userId, full_name: f.full_name,
        roleKey: f.roleKey as "hospital_admin", status: f.status as "active",
      } }), onClose)}>
      <Field label="Full name"><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
      <Field label="Email"><Input value={row.email ?? ""} disabled /></Field>
      <Field label="Role">
        <Select value={f.roleKey} onValueChange={(v) => setF({ ...f, roleKey: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(ADMIN_ROLE_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Status"><StatusSelect value={f.status} onChange={(v) => setF({ ...f, status: v })} options={["active", "inactive", "on_leave"]} /></Field>
    </EditShell>
  );
}

function AddAdminDialog({ hospitalId, onClose }: { hospitalId: string; onClose: () => void }) {
  const [f, setF] = useState({ full_name: "", email: "", roleKey: "hospital_admin" });
  const run = useServerFn(addHospitalAdmin);
  const { busy, save } = useSaver();
  return (
    <EditShell title="Invite admin user" open onOpenChange={(o) => !o && onClose()} busy={busy}
      onSave={() => save(() => run({ data: {
        hospitalId, full_name: f.full_name, email: f.email, roleKey: f.roleKey as "hospital_admin",
        redirectTo: `${window.location.origin}/auth`,
      } }), onClose, "Invitation sent.")}>
      <Field label="Full name"><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
      <Field label="Work email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      <Field label="Role">
        <Select value={f.roleKey} onValueChange={(v) => setF({ ...f, roleKey: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(ADMIN_ROLE_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
    </EditShell>
  );
}

/* ------------------------------------------------------ go-live review */

export function GoLiveReviewPanel({ hospitalId }: { hospitalId: string }) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ReadinessReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useServerFn(analyzeReadiness);

  async function analyze() {
    setBusy(true); setError(null);
    try { setReport(await run({ data: { hospitalId, notes } })); }
    catch (e) { setError(errMsg(e, "The review could not be completed.")); }
    finally { setBusy(false); }
  }

  const sevClass = { high: "border-risk/40 bg-risk/10 text-risk", medium: "border-warning/50 bg-warning/10 text-warning", low: "border-border bg-muted text-muted-foreground" };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" />AI go-live review</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          The review reads this hospital's current group, branches, departments, teams, admins, invitations and checklist automatically.
          Add anything the platform doesn't know yet — payer contracts, staffing, target go-live date, concerns.
        </p>
        <Textarea className="mt-3 min-h-28" maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. We go live with Star Health and Medi Assist on 1 November. Cashless desk has 3 executives, no AR team yet. Second campus opens in December." />
        <div className="mt-3 flex items-center gap-3">
          <Button onClick={analyze} disabled={busy}>{busy ? "Reviewing setup… this can take up to a minute" : report ? "Run review again" : "Review my setup"}</Button>
          <span className="text-[11px] text-muted-foreground">AI suggestions — check before acting.</span>
        </div>
        {error ? <p className="mt-3 text-[13px] text-risk">{error}</p> : null}
      </div>

      {report ? (
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Readiness</p>
            <p className={cn("tnum mt-1 text-4xl font-semibold", report.readiness_score >= 80 ? "text-positive" : report.readiness_score >= 50 ? "text-warning" : "text-risk")}>
              {report.readiness_score}<span className="text-lg text-muted-foreground">/100</span>
            </p>
            <p className="mt-2 text-[13px] text-muted-foreground">{report.summary}</p>
            <p className="tnum mt-3 text-[11px] text-muted-foreground">Generated {new Date(report.generated_at).toLocaleString("en-IN")}</p>
          </div>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card">
              <h4 className="border-b border-border px-4 py-2.5 text-sm font-semibold">Configuration gaps</h4>
              {report.gaps.length ? (
                <ul className="divide-y divide-border">{report.gaps.map((g, i) => (
                  <li key={i} className="px-4 py-3 text-[13px]">
                    <div className="flex items-center gap-2">
                      <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase", sevClass[g.severity])}>{g.severity}</span>
                      <span className="font-medium">{g.area}</span>
                    </div>
                    <p className="mt-1">{g.issue}</p>
                    <p className="text-muted-foreground">{g.why_it_matters}</p>
                  </li>
                ))}</ul>
              ) : <p className="p-4 text-[13px] text-muted-foreground">No gaps found.</p>}
            </div>
            <div className="rounded-lg border border-border bg-card">
              <h4 className="border-b border-border px-4 py-2.5 text-sm font-semibold">Recommended next steps</h4>
              <ol className="divide-y divide-border">{report.next_steps.map((s, i) => (
                <li key={i} className="flex gap-3 px-4 py-3 text-[13px]">
                  <span className="tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{i + 1}</span>
                  <div>
                    <p className="font-medium">{s.title} <span className="font-normal text-muted-foreground">· {s.owner_role}</span></p>
                    <p className="text-muted-foreground">{s.detail}</p>
                  </div>
                </li>
              ))}</ol>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
