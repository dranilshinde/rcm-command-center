import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader, StatCard, StatusChip } from "@/components/rcm/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { hospitalDetailQuery, sessionQuery } from "@/lib/queries";
import { createBranch, createDepartment, createTeam, setOnboardingStepStatus } from "@/lib/rcm.functions";

export const Route = createFileRoute("/_authenticated/hospitals/$hospitalId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(hospitalDetailQuery(params.hospitalId)),
  head: () => ({
    meta: [
      { title: "Hospital setup — RCM Buddy" },
      { name: "description", content: "Branches, departments, teams and onboarding progress for a hospital." },
      { property: "og:title", content: "Hospital setup — RCM Buddy" },
      { property: "og:description", content: "Branches, departments, teams and onboarding progress." },
    ],
  }),
  component: HospitalDetail,
  errorComponent: ({ error }) => (
    <EmptyState title="This hospital is not available" description={error.message} />
  ),
  notFoundComponent: () => <EmptyState title="Hospital not found" />,
});

function HospitalDetail() {
  const { hospitalId } = Route.useParams();
  const { data } = useSuspenseQuery(hospitalDetailQuery(hospitalId));
  const { data: session } = useSuspenseQuery(sessionQuery);
  const canEdit = session.isSuperAdmin || session.permissions.includes("hospitals.EDIT");
  const canEditMaster = session.isSuperAdmin || session.permissions.includes("master_data.EDIT");
  const canEditTeams = session.isSuperAdmin || session.permissions.includes("teams.EDIT");
  const qc = useQueryClient();
  const { hospital, branches, departments, teams, steps } = data;

  const done = steps.filter((s) => s.status === "completed").length;
  const progress = steps.length ? Math.round((done / steps.length) * 100) : 0;
  const setStep = useServerFn(setOnboardingStepStatus);

  async function toggleStep(stepId: string, current: string) {
    try {
      await setStep({ data: { stepId, status: current === "completed" ? "pending" : "completed" } });
      qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "We could not update the checklist.");
    }
  }

  return (
    <div>
      <div className="mb-2 text-[12px] text-muted-foreground">
        <Link to="/hospitals" className="hover:underline">Hospitals</Link> / {hospital.name}
      </div>
      <PageHeader
        title={hospital.name}
        description={`${hospital.group_name} · ${hospital.city ?? "—"}, ${hospital.state ?? "—"} · code ${hospital.code}`}
        actions={<StatusChip status={hospital.status} />}
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Branches" value={branches.length} />
        <StatCard label="Departments" value={departments.length} />
        <StatCard label="Teams" value={teams.length} />
        <StatCard label="Onboarding" value={`${progress}%`} tone={progress === 100 ? "positive" : "warning"} hint={`${done} of ${steps.length} steps`} />
      </section>

      <Tabs defaultValue="branches" className="mt-6">
        <TabsList>
          <TabsTrigger value="branches">Branches</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
        </TabsList>

        <TabsContent value="branches" className="mt-4">
          <div className="mb-3 flex justify-end">
            {canEdit ? (
              <CreateDialog
                title="New branch"
                fields={[
                  { key: "name", label: "Branch name" },
                  { key: "code", label: "Branch code", upper: true },
                  { key: "city", label: "City" },
                  { key: "state", label: "State" },
                ]}
                onSubmit={async (values) => {
                  const create = createBranch;
                  await create({
                    data: {
                      organization_id: hospital.organization_id,
                      hospital_id: hospital.id,
                      name: values.name,
                      code: values.code,
                      city: values.city,
                      state: values.state,
                    },
                  });
                }}
              />
            ) : null}
          </div>
          {branches.length === 0 ? (
            <EmptyState title="No branches yet" description="Add the first campus or unit for this hospital." />
          ) : (
            <SimpleTable
              head={["Branch", "Code", "City", "State", "Status"]}
              rows={branches.map((b) => [b.name, b.code, b.city ?? "—", b.state ?? "—", <StatusChip key={b.id} status={b.status} />])}
            />
          )}
        </TabsContent>

        <TabsContent value="departments" className="mt-4">
          <div className="mb-3 flex justify-end">
            {canEditMaster ? (
              <CreateDialog
                title="New department"
                fields={[
                  { key: "name", label: "Department name" },
                  { key: "code", label: "Department code", upper: true },
                  { key: "branch_id", label: "Branch", options: branches.map((b) => ({ value: b.id, label: b.name })) },
                  {
                    key: "dept_type",
                    label: "Type",
                    options: [
                      { value: "clinical", label: "Clinical" },
                      { value: "rcm", label: "RCM" },
                      { value: "finance", label: "Finance" },
                      { value: "support", label: "Support" },
                    ],
                  },
                ]}
                onSubmit={async (values) => {
                  await createDepartment({
                    data: {
                      organization_id: hospital.organization_id,
                      hospital_id: hospital.id,
                      branch_id: values.branch_id || null,
                      name: values.name,
                      code: values.code,
                      dept_type: values.dept_type || "clinical",
                    },
                  });
                }}
              />
            ) : null}
          </div>
          {departments.length === 0 ? (
            <EmptyState title="No departments yet" />
          ) : (
            <SimpleTable
              head={["Department", "Code", "Type", "Branch", "Status"]}
              rows={departments.map((d) => [
                d.name,
                d.code,
                d.dept_type,
                branches.find((b) => b.id === d.branch_id)?.name ?? "Hospital-wide",
                <StatusChip key={d.id} status={d.status} />,
              ])}
            />
          )}
        </TabsContent>

        <TabsContent value="teams" className="mt-4">
          <div className="mb-3 flex justify-end">
            {canEditTeams ? (
              <CreateDialog
                title="New team"
                fields={[
                  { key: "name", label: "Team name" },
                  { key: "code", label: "Team code", upper: true },
                  { key: "branch_id", label: "Branch", options: branches.map((b) => ({ value: b.id, label: b.name })) },
                  { key: "department_id", label: "Department", options: departments.map((d) => ({ value: d.id, label: d.name })) },
                ]}
                onSubmit={async (values) => {
                  await createTeam({
                    data: {
                      organization_id: hospital.organization_id,
                      hospital_id: hospital.id,
                      branch_id: values.branch_id || null,
                      department_id: values.department_id || null,
                      name: values.name,
                      code: values.code,
                    },
                  });
                }}
              />
            ) : null}
          </div>
          {teams.length === 0 ? (
            <EmptyState title="No teams yet" description="Teams group the executives who work claims and follow-ups." />
          ) : (
            <SimpleTable
              head={["Team", "Code", "Branch", "Department", "Status"]}
              rows={teams.map((t) => [
                t.name,
                t.code,
                branches.find((b) => b.id === t.branch_id)?.name ?? "—",
                departments.find((d) => d.id === t.department_id)?.name ?? "—",
                <StatusChip key={t.id} status={t.status} />,
              ])}
            />
          )}
        </TabsContent>

        <TabsContent value="onboarding" className="mt-4">
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border p-4">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-medium">Go-live checklist</span>
                <span className="tnum text-muted-foreground">{done} of {steps.length} complete</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded bg-muted">
                <div className="h-full rounded bg-primary" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <ul className="divide-y divide-border">
              {steps.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                  <input
                    type="checkbox"
                    checked={s.status === "completed"}
                    disabled={!canEdit}
                    onChange={() => toggleStep(s.id, s.status)}
                    className="h-4 w-4 accent-[var(--primary)]"
                    aria-label={s.title}
                  />
                  <span className={s.status === "completed" ? "text-muted-foreground line-through" : ""}>{s.title}</span>
                  <span className="ml-auto"><StatusChip status={s.status} /></span>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            {head.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
              {r.map((cell, j) => (
                <td key={j} className={j === 0 ? "px-3 py-2 font-medium" : "px-3 py-2 text-muted-foreground"}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Field = { key: string; label: string; upper?: boolean; options?: { value: string; label: string }[] };

function CreateDialog({
  title,
  fields,
  onSubmit,
}: {
  title: string;
  fields: Field[];
  onSubmit: (values: Record<string, string>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const qc = useQueryClient();

  async function submit() {
    if (!values.name || !values.code) {
      toast.error("Name and code are required.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(values);
      toast.success(`${title.replace("New ", "")} created.`);
      setValues({});
      setOpen(false);
      qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "We could not save this record.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm">{title}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label>{f.label}</Label>
              {f.options ? (
                <Select value={values[f.key] ?? ""} onValueChange={(v) => setValues({ ...values, [f.key]: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {f.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={values[f.key] ?? ""}
                  onChange={(e) =>
                    setValues({ ...values, [f.key]: f.upper ? e.target.value.toUpperCase() : e.target.value })
                  }
                />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
