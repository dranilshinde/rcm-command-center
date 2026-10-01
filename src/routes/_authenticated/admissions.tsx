import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/rcm/app-shell";
import { Chip, DataTable, Pager, errMsg, fmtDate, td, todayIso, tr } from "@/components/rcm/claims-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createAdmission, createPreauth, dischargeAdmission } from "@/lib/claims.functions";
import { admissionsQuery } from "@/lib/claims-queries";
import { payersQuery, sessionQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admissions")({
  head: () => ({
    meta: [
      { title: "Admissions & Discharge — RCM Buddy" },
      { name: "description", content: "Insured in-patient admissions, pre-auth requests and discharges that start the claim." },
      { property: "og:title", content: "Admissions & Discharge — RCM Buddy" },
      { property: "og:description", content: "Admissions, pre-auth and discharge for cashless patients." },
    ],
  }),
  component: Admissions,
});

function Admissions() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const { data, isFetching, error } = useQuery({ ...admissionsQuery({ search, status, page }), placeholderData: (p) => p });
  const rows = data?.rows ?? [];
  return (
    <div>
      <PageHeader
        title="Admissions & Discharge"
        description="Discharging a patient creates the claim automatically and adds a “prepare claim” task to the work queue."
        actions={<NewAdmissionDialog />}
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input className="h-9 max-w-xs" placeholder="Search IP number" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="admitted">Admitted</SelectItem>
            <SelectItem value="discharged">Discharged</SelectItem>
          </SelectContent>
        </Select>
        <span className="tnum text-[12px] text-muted-foreground">{isFetching ? "Loading…" : `${data?.total ?? 0} admissions`}</span>
      </div>
      {error ? <EmptyState title="Could not load admissions" description={(error as Error).message} /> :
        rows.length === 0 ? <EmptyState title="No admissions yet" description="Add an admission, or import your claims sheet." action={<NewAdmissionDialog />} /> : (
          <DataTable head={["IP no.", "Patient", "Hospital", "Payer", "Admitted", "Discharged", "Pre-auth", "Status", "Claim", ""]}>
            {rows.map((a) => {
              const claim = a.claims?.[0];
              const pa = a.preauths?.[a.preauths.length - 1];
              return (
                <tr key={a.id} className={tr}>
                  <td className={`${td} tnum font-medium`}>{a.ip_number ?? "—"}</td>
                  <td className={td}>{a.patients?.full_name}</td>
                  <td className={`${td} text-muted-foreground`}>{a.hospitals?.name}</td>
                  <td className={`${td} text-muted-foreground`}>{a.tpas?.name ?? a.insurers?.name ?? "—"}</td>
                  <td className={`${td} tnum`}>{fmtDate(a.admission_date)}</td>
                  <td className={`${td} tnum`}>{fmtDate(a.discharge_date)}</td>
                  <td className={td}>{pa ? <Chip value={pa.status} /> : <span className="text-muted-foreground">—</span>}</td>
                  <td className={td}><Chip value={a.status} /></td>
                  <td className={td}>{claim ? <Link to="/claims/$claimId" params={{ claimId: claim.id }} className="tnum text-primary hover:underline">{claim.claim_code}</Link> : "—"}</td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    <PreauthDialog admissionId={a.id} />
                    {a.status === "admitted" ? <DischargeDialog admissionId={a.id} admissionDate={a.admission_date} /> : null}
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      <Pager page={page} total={data?.total ?? 0} pageSize={data?.pageSize ?? 25} onPage={setPage} />
    </div>
  );
}

function NewAdmissionDialog() {
  const { data: session } = useSuspenseQuery(sessionQuery);
  const { data: payers } = useQuery(payersQuery);
  const qc = useQueryClient();
  const create = useServerFn(createAdmission);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    hospitalId: session.hospitals[0]?.id ?? "", full_name: "", uhid: "", phone: "", ip_number: "",
    admission_date: todayIso(), treating_doctor: "", diagnosis: "", treatment: "",
    insurer_id: "", tpa_id: "", policy_number: "", policy_type: "Base Policy", member_id: "",
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit() {
    if (!f.hospitalId) { toast.error("Choose a hospital."); return; }
    if (f.full_name.trim().length < 2) { toast.error("Enter the patient's name."); return; }
    setBusy(true);
    try {
      await create({ data: {
        hospitalId: f.hospitalId,
        patient: { full_name: f.full_name, uhid: f.uhid || null, phone: f.phone || null },
        ip_number: f.ip_number || null, admission_date: f.admission_date, treating_doctor: f.treating_doctor || null,
        diagnosis: f.diagnosis || null, treatment: f.treatment || null, insurer_id: f.insurer_id || null, tpa_id: f.tpa_id || null,
        policy_number: f.policy_number || null, policy_type: f.policy_type || null, member_id: f.member_id || null,
      } });
      toast.success("Admission added");
      qc.invalidateQueries({ queryKey: ["admissions"] });
      qc.invalidateQueries({ queryKey: ["patients"] });
      setOpen(false);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm">New admission</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>New admission</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Hospital</Label>
            <Select value={f.hospitalId} onValueChange={(v) => setF({ ...f, hospitalId: v })}>
              <SelectTrigger><SelectValue placeholder="Choose hospital" /></SelectTrigger>
              <SelectContent>{session.hospitals.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Patient name</Label><Input value={f.full_name} onChange={set("full_name")} /></div>
          <div><Label>UHID</Label><Input value={f.uhid} onChange={set("uhid")} /></div>
          <div><Label>Phone</Label><Input value={f.phone} onChange={set("phone")} /></div>
          <div><Label>IP number</Label><Input value={f.ip_number} onChange={set("ip_number")} /></div>
          <div><Label>Admission date</Label><Input type="date" value={f.admission_date} onChange={set("admission_date")} /></div>
          <div><Label>Treating doctor</Label><Input value={f.treating_doctor} onChange={set("treating_doctor")} /></div>
          <div><Label>Diagnosis</Label><Input value={f.diagnosis} onChange={set("diagnosis")} /></div>
          <div><Label>Treatment</Label><Input value={f.treatment} onChange={set("treatment")} /></div>
          <div><Label>Insurer</Label>
            <Select value={f.insurer_id || "none"} onValueChange={(v) => setF({ ...f, insurer_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">Not set</SelectItem>{(payers?.insurers ?? []).map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>TPA</Label>
            <Select value={f.tpa_id || "none"} onValueChange={(v) => setF({ ...f, tpa_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">Not set / direct</SelectItem>{(payers?.tpas ?? []).map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Policy number</Label><Input value={f.policy_number} onChange={set("policy_number")} /></div>
          <div><Label>Member / customer ID</Label><Input value={f.member_id} onChange={set("member_id")} /></div>
          <div><Label>Policy type</Label>
            <Select value={f.policy_type} onValueChange={(v) => setF({ ...f, policy_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Base Policy">Base</SelectItem><SelectItem value="TOP-UP Policy">Top-up</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Add admission"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DischargeDialog({ admissionId, admissionDate }: { admissionId: string; admissionDate: string }) {
  const qc = useQueryClient();
  const discharge = useServerFn(dischargeAdmission);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (date < admissionDate) { toast.error("Discharge date cannot be before admission."); return; }
    setBusy(true);
    try {
      await discharge({ data: { admissionId, discharge_date: date, claimed_amount: Number(amount) || 0 } });
      toast.success("Discharged — claim created and added to the work queue");
      ["admissions", "claims", "tasks", "claim-stats"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setOpen(false);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline" className="ml-1 h-7">Discharge</Button></DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Discharge patient</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Discharge date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label>Final bill / claimed amount (₹)</Label><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <p className="text-[12px] text-muted-foreground">A claim with a new RCM ID is created as a draft.</p>
        </div>
        <DialogFooter><Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Discharge and create claim"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreauthDialog({ admissionId }: { admissionId: string }) {
  const qc = useQueryClient();
  const create = useServerFn(createPreauth);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"initial" | "enhancement" | "final">("initial");
  const [amount, setAmount] = useState("");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!(Number(amount) > 0)) { toast.error("Enter the requested amount."); return; }
    setBusy(true);
    try {
      await create({ data: { admissionId, kind, requested_amount: Number(amount), reference_no: ref || null } });
      toast.success("Pre-auth request recorded");
      qc.invalidateQueries({ queryKey: ["admissions"] });
      qc.invalidateQueries({ queryKey: ["preauths"] });
      setOpen(false);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="ghost" className="h-7">Pre-auth</Button></DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Record pre-auth request</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="initial">Initial</SelectItem><SelectItem value="enhancement">Enhancement</SelectItem><SelectItem value="final">Final</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Requested amount (₹)</Label><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div><Label>Payer reference no.</Label><Input value={ref} onChange={(e) => setRef(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save request"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
