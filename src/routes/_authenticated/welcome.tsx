import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Lock } from "lucide-react";
import { PageHeader } from "@/components/rcm/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createWelcomeStructure, getWelcomeData, saveWelcome } from "@/lib/access.functions";
import { describeAccess, isPageLocked } from "@/lib/access";
import { sessionQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/welcome")({
  loader: ({ context }) => context.queryClient.ensureQueryData(sessionQuery),
  head: () => ({
    meta: [
      { title: "Your setup — RCM Buddy" },
      { name: "description", content: "Set up your profile, department, team and work queue, and see what your role can do." },
      { property: "og:title", content: "Your setup — RCM Buddy" },
      { property: "og:description", content: "Guided setup for new hospital staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Welcome,
});

const STEPS = ["About you", "Where you work", "Your team", "Your role & queue"];
const NONE = "__none";

function Welcome() {
  const { data: session } = useSuspenseQuery(sessionQuery);
  const fetchData = useServerFn(getWelcomeData);
  const create = useServerFn(createWelcomeStructure);
  const save = useServerFn(saveWelcome);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const wd = useQuery({ queryKey: ["welcome-data"], queryFn: () => fetchData() });

  const p = session.profile;
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState(p?.full_name ?? "");
  const [phone, setPhone] = useState(p?.phone ?? "");
  const [jobTitle, setJobTitle] = useState(p?.job_title ?? "");
  const [hospitalId, setHospitalId] = useState(session.hospitals[0]?.id ?? "");
  const [departmentId, setDepartmentId] = useState<string>(p?.department_id ?? NONE);
  const [teamId, setTeamId] = useState<string>(NONE);
  const [newDept, setNewDept] = useState("");
  const [newDeptType, setNewDeptType] = useState<"clinical" | "rcm" | "finance" | "support">("rcm");
  const [newTeam, setNewTeam] = useState("");
  const [busy, setBusy] = useState(false);

  const d = wd.data;
  const depts = (d?.departments ?? []).filter((x) => x.hospital_id === hospitalId);
  const teams = (d?.teams ?? []).filter((x) => x.hospital_id === hospitalId);
  const myTeams = (d?.teams ?? []).filter((t) => d?.myTeamIds.includes(t.id));
  const access = describeAccess(session.permissions, session.isSuperAdmin);

  async function addStructure(kind: "department" | "team") {
    const name = kind === "department" ? newDept : newTeam;
    if (name.trim().length < 2) { toast.error("Enter a name with at least 2 characters."); return; }
    setBusy(true);
    try {
      const r = await create({ data: { kind, hospitalId, name, deptType: newDeptType,
        departmentId: departmentId === NONE ? null : departmentId } });
      await wd.refetch();
      if (kind === "department") { setDepartmentId(r.id); setNewDept(""); } else { setTeamId(r.id); setNewTeam(""); }
      toast.success(`${kind === "department" ? "Department" : "Team"} created.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not create."); }
    finally { setBusy(false); }
  }

  async function persist(finish: boolean) {
    setBusy(true);
    try {
      await save({ data: { full_name: fullName, phone, job_title: jobTitle,
        departmentId: departmentId === NONE ? null : departmentId, teamId: teamId === NONE ? null : teamId, finish } });
      await qc.invalidateQueries({ queryKey: ["session"] });
      if (finish) {
        toast.success("You're all set.");
        navigate({ to: isPageLocked("/work-queue", session) ? "/dashboard" : "/work-queue" });
      }
      return true;
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save."); return false; }
    finally { setBusy(false); }
  }

  async function next() {
    if (step === 0 && fullName.trim().length < 2) { toast.error("Enter your full name."); return; }
    if (step < 3 && (await persist(false))) setStep(step + 1);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Welcome${p?.full_name ? `, ${p.full_name.split(" ")[0]}` : ""}`}
        description="Four quick steps to get your desk ready. You can come back here any time from your name in the side menu." />

      <ol className="mb-5 grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={() => i < step && setStep(i)}
              className={cn("flex w-full items-center gap-2 rounded border px-2 py-2 text-left text-[12px]",
                i === step ? "border-primary bg-primary/5 font-medium" : "border-border bg-card text-muted-foreground")}>
              <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                i < step ? "bg-positive text-primary-foreground" : i === step ? "bg-primary text-primary-foreground" : "bg-muted")}>
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>{s}
            </button>
          </li>
        ))}
      </ol>

      <section className="rounded-lg border border-border bg-card p-5">
        {step === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} /></div>
            <div className="space-y-1.5"><Label>Mobile number</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98xxxxxxx" maxLength={20} /></div>
            <div className="space-y-1.5"><Label>Job title</Label><Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. AR Executive" maxLength={80} /></div>
          </div>
        ) : null}

        {step === 1 ? (
          session.hospitals.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">You don't have access to a hospital yet. Ask your hospital admin to add you, then come back.</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5"><Label>Hospital</Label>
                <Select value={hospitalId} onValueChange={(v) => { setHospitalId(v); setDepartmentId(NONE); setTeamId(NONE); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{session.hospitals.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1.5"><Label>Your department</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not decided yet</SelectItem>
                    {depts.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {wd.isLoading ? <p className="text-[12px] text-muted-foreground">Loading departments…</p>
                  : !depts.length ? <p className="text-[12px] text-muted-foreground">No departments have been set up for this hospital yet.</p> : null}
              </div>
              {d?.canCreateDepartment ? (
                <div className="rounded border border-dashed border-border p-3">
                  <p className="mb-2 text-[12px] font-medium">Missing your department? Create it</p>
                  <div className="flex flex-wrap gap-2">
                    <Input className="h-9 max-w-xs" value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="e.g. Cashless Desk" maxLength={120} />
                    <Select value={newDeptType} onValueChange={(v) => setNewDeptType(v as typeof newDeptType)}>
                      <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>{["rcm", "finance", "clinical", "support"].map((t) => <SelectItem key={t} value={t} className="capitalize">{t.toUpperCase() === "RCM" ? "RCM" : t}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => addStructure("department")}>Create</Button>
                  </div>
                </div>
              ) : <p className="text-[12px] text-muted-foreground">Your hospital admin or RCM head adds new departments.</p>}
            </div>
          )
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            {myTeams.length ? <p className="text-[13px]">You're already in: <span className="font-medium">{myTeams.map((t) => t.name).join(", ")}</span></p> : null}
            <div className="space-y-1.5"><Label>Join a team</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Skip for now</SelectItem>
                  {teams.filter((t) => !d?.myTeamIds.includes(t.id)).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {!teams.length && !wd.isLoading ? <p className="text-[12px] text-muted-foreground">No teams in this hospital yet.</p> : null}
            </div>
            {d?.canCreateTeam ? (
              <div className="rounded border border-dashed border-border p-3">
                <p className="mb-2 text-[12px] font-medium">Start a new team (you'll be its manager)</p>
                <div className="flex flex-wrap gap-2">
                  <Input className="h-9 max-w-xs" value={newTeam} onChange={(e) => setNewTeam(e.target.value)} placeholder="e.g. AR Team – Star Health" maxLength={120} />
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => addStructure("team")}>Create</Button>
                </div>
              </div>
            ) : <p className="text-[12px] text-muted-foreground">Your manager creates teams.</p>}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4 text-[13px]">
            <p>Your role: <span className="font-medium">{session.roles.map((r) => r.name).join(", ") || "No role yet — ask your admin"}</span></p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded border border-border p-3"><p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Claims</p>{access.claims}</div>
              <div className="rounded border border-border p-3"><p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Work queue</p>{access.queue}</div>
            </div>
            <div className="rounded border border-border p-3">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Pages locked for your role</p>
              {access.locked.length
                ? <ul className="flex flex-wrap gap-1.5">{access.locked.map((l) => <li key={l} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[12px]"><Lock className="h-3 w-3" />{l}</li>)}</ul>
                : <p>None — you can open every page.</p>}
            </div>
            <div className="rounded border border-border bg-muted/30 p-3">
              <p className="mb-1 font-medium">How your work queue works</p>
              <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                <li><b>My Work</b> shows tasks assigned to you, sorted by due date.</li>
                <li><b>Due Today</b> and <b>Overdue</b> are where to start each morning.</li>
                <li>Tasks are created automatically from claims — discharge, queries, payer follow-ups and short payments.</li>
              </ul>
            </div>
          </div>
        ) : null}
      </section>

      <div className="mt-4 flex justify-between">
        <Button variant="outline" disabled={step === 0 || busy} onClick={() => setStep(step - 1)}>Back</Button>
        {step < 3
          ? <Button disabled={busy} onClick={next}>{busy ? "Saving…" : "Continue"}</Button>
          : <Button disabled={busy} onClick={() => persist(true)}>{busy ? "Saving…" : "Finish & open my work queue"}</Button>}
      </div>
    </div>
  );
}
