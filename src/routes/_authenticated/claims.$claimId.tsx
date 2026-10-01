import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/rcm/app-shell";
import { Chip, ReadinessBadge, errMsg, fmtDate, todayIso } from "@/components/rcm/claims-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { addClaimNote, assignClaims, recordPayment, runClaimAction, updateClaimDetails } from "@/lib/claims.functions";
import { ACTIONS, CLAIM_STATUS_LABEL, inr, type ClaimAction } from "@/lib/claims-domain";
import { assigneesQuery, claimDetailQuery } from "@/lib/claims-queries";

export const Route = createFileRoute("/_authenticated/claims/$claimId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(claimDetailQuery(params.claimId)),
  head: () => ({
    meta: [
      { title: "Claim detail — RCM Buddy" },
      { name: "description", content: "Claim timeline, money, readiness and next actions." },
      { property: "og:title", content: "Claim detail — RCM Buddy" },
      { property: "og:description", content: "Claim timeline, money, readiness and next actions." },
    ],
  }),
  component: ClaimPage,
  errorComponent: ({ error }) => <div className="p-6 text-sm">{error instanceof Error ? error.message : "Could not open this claim."}</div>,
});

function invalidate(qc: ReturnType<typeof useQueryClient>, id: string) {
  ["claims", "tasks", "claim-stats", "admissions"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  qc.invalidateQueries({ queryKey: ["claim", id] });
}

function ClaimPage() {
  const { claimId } = Route.useParams();
  const { data } = useSuspenseQuery(claimDetailQuery(claimId));
  const c = data.claim;
  const a = c.admissions ?? {};
  const [action, setAction] = useState<ClaimAction | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const available = (Object.keys(ACTIONS) as ClaimAction[]).filter((k) => ACTIONS[k].from.includes(c.status));
  const gaps = (c.readiness_gaps ?? []) as { key: string; label: string; weight: number }[];

  const timeline = [
    ...data.history.map((h: any) => ({ at: h.created_at, kind: "status", title: `${h.from_status ? `${CLAIM_STATUS_LABEL[h.from_status] ?? h.from_status} → ` : ""}${CLAIM_STATUS_LABEL[h.to_status] ?? h.to_status}`, body: h.note, who: h.actor_name })),
    ...data.notes.map((n: any) => ({ at: n.created_at, kind: "note", title: "Note", body: n.body, who: n.author_name })),
  ].sort((x, y) => x.at.localeCompare(y.at));

  return (
    <div>
      <div className="mb-2 text-[12px] text-muted-foreground"><Link to="/claims" className="hover:underline">Claims</Link> / {c.claim_code}</div>
      <PageHeader
        title={`${c.claim_code} · ${c.patients?.full_name ?? ""}`}
        description={`${c.hospitals?.name ?? ""} · ${a.tpas?.name ?? a.insurers?.name ?? "Payer not set"}${c.external_claim_no ? ` · Claim no. ${c.external_claim_no}` : ""}`}
        actions={<div className="flex items-center gap-2"><Chip value={c.status} />{c.reconciled ? <Chip value="completed" label="Letter reconciled" /> : null}<ReadinessBadge score={c.readiness_score} /></div>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {available.map((k) => <Button key={k} size="sm" variant={k === "submit" || k === "approve" ? "default" : "outline"} onClick={() => setAction(k)}>{ACTIONS[k].label}</Button>)}
        {["approved", "short_paid", "settled"].includes(c.status) ? <Button size="sm" variant="outline" onClick={() => setPayOpen(true)}>Record payment</Button> : null}
        <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}>Edit details</Button>
        <AssignControl claimId={c.id} hospitalId={c.hospital_id} current={c.profiles?.id ?? null} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section title="Money">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-4">
              <Money label="Claimed" v={c.claimed_amount} />
              <Money label="Approved" v={c.approved_amount} />
              <Money label="Settled" v={c.settled_amount} tone="positive" />
              <Money label="TDS" v={c.tds_amount} />
              <Money label="Copay" v={c.copay} />
              <Money label="Shortfall" v={c.shortfall_amount} />
              <Money label="Hospital discount" v={c.hospital_discount} />
              <Money label="Patient paid" v={c.patient_paid} />
              <Money label="Short payment" v={c.short_payment} tone={Number(c.short_payment) > 0 ? "risk" : undefined} hint="Approved − settled − TDS" />
            </div>
          </Section>

          <Section title="Timeline">
            {timeline.length === 0 ? <p className="text-[13px] text-muted-foreground">No activity yet.</p> : (
              <ol className="relative ml-2 border-l border-border">
                {timeline.map((t, i) => (
                  <li key={i} className="mb-3 ml-4">
                    <span className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ${t.kind === "status" ? "bg-primary" : "bg-muted-foreground/50"}`} />
                    <p className="text-[13px] font-medium">{t.title}</p>
                    {t.body ? <p className="whitespace-pre-wrap text-[13px] text-muted-foreground">{t.body}</p> : null}
                    <p className="text-[11px] text-muted-foreground">{t.who} · {new Date(t.at).toLocaleString("en-IN")}</p>
                  </li>
                ))}
              </ol>
            )}
            <NoteBox claimId={c.id} />
          </Section>

          <Section title="Payments">
            {data.payments.length === 0 ? <p className="text-[13px] text-muted-foreground">No payments recorded.</p> : (
              <table className="w-full text-[13px]"><thead><tr className="text-left text-[11px] uppercase text-muted-foreground"><th className="py-1">Date</th><th>UTR / cheque</th><th>Receipt</th><th className="text-right">Amount</th><th className="text-right">TDS</th></tr></thead>
                <tbody>{data.payments.map((p: any) => <tr key={p.id} className="border-t border-border/60"><td className="tnum py-1.5">{fmtDate(p.payment_date)}</td><td className="tnum">{p.utr_number ?? "—"}</td><td className="tnum">{p.receipt_no ?? "—"}</td><td className="tnum text-right">{inr(p.amount)}</td><td className="tnum text-right">{inr(p.tds_amount)}</td></tr>)}</tbody></table>
            )}
          </Section>

          {data.couriers.length ? (
            <Section title="Courier dispatch">
              {data.couriers.map((k: any) => <Facts key={k.id} items={[["Agency", k.agency], ["Provider", k.provider], ["Destination", k.destination], ["Dispatched", fmtDate(k.dispatch_date)], ["Sender", k.sender_name], ["Tracking ID", k.tracking_id]]} />)}
            </Section>
          ) : null}
        </div>

        <div className="space-y-4">
          <Section title="Readiness">
            <div className="mb-2 flex items-center gap-2"><ReadinessBadge score={c.readiness_score} /></div>
            {gaps.length === 0 ? <p className="text-[13px] text-positive">All checks pass.</p> : (
              <ul className="space-y-1 text-[13px]">{gaps.map((g) => <li key={g.key} className="flex justify-between"><span>Missing: {g.label}</span><span className="tnum text-muted-foreground">−{g.weight}</span></li>)}</ul>
            )}
          </Section>
          <Section title="Open tasks">
            {data.tasks.filter((t) => !["completed", "cancelled"].includes(t.status)).length === 0 ? <p className="text-[13px] text-muted-foreground">Nothing pending.</p> :
              <ul className="space-y-2">{data.tasks.filter((t) => !["completed", "cancelled"].includes(t.status)).map((t) => (
                <li key={t.id} className="text-[13px]"><p className="font-medium">{t.title}</p><p className="text-[11px] text-muted-foreground">Due {fmtDate(t.due_at)} · {t.profiles?.full_name ?? "Unassigned"}</p></li>
              ))}</ul>}
          </Section>
          <Section title="Patient & admission">
            <Facts items={[
              ["UHID", c.patients?.uhid], ["Member ID", a.member_id ?? c.patients?.member_id], ["Phone", c.patients?.phone],
              ["IP number", a.ip_number], ["Admitted", fmtDate(a.admission_date)], ["Discharged", fmtDate(a.discharge_date)],
              ["Diagnosis", a.diagnosis], ["Treatment", a.treatment], ["Policy", a.policy_number], ["Policy type", a.policy_type],
              ["Policy holder", a.policy_holder_name], ["Employee code", a.employee_code],
            ]} />
          </Section>
          <Section title="References">
            <Facts items={[
              ["Case ref ID", c.case_ref_id], ["Initial claim no.", c.initial_claim_no], ["Invoice", c.invoice_number],
              ["Claim date", fmtDate(c.claim_date)], ["Docs submitted", fmtDate(c.document_submitted_at)], ["Payment date", fmtDate(c.payment_date)],
              ["Rohini ID", c.hospitals?.rohini_id], ["Insurer comments", c.insurer_comments],
            ]} />
          </Section>
          {data.preauths.length ? (
            <Section title="Pre-auth">
              {data.preauths.map((p: any) => <div key={p.id} className="flex items-center justify-between text-[13px]"><span className="capitalize">{p.kind} · {inr(p.approved_amount ?? p.requested_amount)}</span><Chip value={p.status} /></div>)}
            </Section>
          ) : null}
        </div>
      </div>

      {action ? <ActionDialog claimId={c.id} action={action} approvedDefault={Number(c.claimed_amount)} onClose={() => setAction(null)} /> : null}
      {payOpen ? <PaymentDialog claimId={c.id} remaining={Math.max(Number(c.approved_amount) - Number(c.settled_amount) - Number(c.tds_amount), 0)} onClose={() => setPayOpen(false)} /> : null}
      {editOpen ? <EditDialog c={c} onClose={() => setEditOpen(false)} /> : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-lg border border-border bg-card p-4"><h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>{children}</section>;
}
function Money({ label, v, tone, hint }: { label: string; v: number; tone?: "positive" | "risk" | undefined; hint?: string }) {
  return <div title={hint}><p className="text-[11px] text-muted-foreground">{label}</p><p className={`tnum text-[15px] font-semibold ${tone === "positive" ? "text-positive" : tone === "risk" ? "text-risk" : ""}`}>{inr(v)}</p></div>;
}
function Facts({ items }: { items: [string, string | null | undefined][] }) {
  return <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">{items.map(([k, v]) => <><dt key={`${k}-k`} className="text-muted-foreground">{k}</dt><dd key={`${k}-v`} className="break-words">{v || "—"}</dd></>)}</dl>;
}

function NoteBox({ claimId }: { claimId: string }) {
  const qc = useQueryClient();
  const add = useServerFn(addClaimNote);
  const [body, setBody] = useState("");
  async function go() {
    if (!body.trim()) return;
    try { await add({ data: { claimId, body } }); setBody(""); qc.invalidateQueries({ queryKey: ["claim", claimId] }); }
    catch (e) { toast.error(errMsg(e)); }
  }
  return <div className="mt-2 flex gap-2"><Input placeholder="Add a note for the team" value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} /><Button size="sm" variant="outline" onClick={go}>Add</Button></div>;
}

function AssignControl({ claimId, hospitalId, current }: { claimId: string; hospitalId: string; current: string | null }) {
  const { data: people } = useQuery(assigneesQuery(hospitalId));
  const qc = useQueryClient();
  const assign = useServerFn(assignClaims);
  return (
    <Select value={current ?? "none"} onValueChange={async (v) => {
      try { await assign({ data: { claimIds: [claimId], userId: v === "none" ? null : v } }); toast.success("Owner updated"); invalidate(qc, claimId); }
      catch (e) { toast.error(errMsg(e)); }
    }}>
      <SelectTrigger className="h-8 w-52"><SelectValue placeholder="Owner" /></SelectTrigger>
      <SelectContent><SelectItem value="none">Unassigned</SelectItem>{(people ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function ActionDialog({ claimId, action, approvedDefault, onClose }: { claimId: string; action: ClaimAction; approvedDefault: number; onClose: () => void }) {
  const qc = useQueryClient();
  const run = useServerFn(runClaimAction);
  const [note, setNote] = useState("");
  const [ext, setExt] = useState("");
  const [amt, setAmt] = useState(String(approvedDefault || ""));
  const [busy, setBusy] = useState(false);
  const needsNote = action === "record_query" || action === "deny";
  async function go() {
    setBusy(true);
    try {
      await run({ data: { claimId, action, note: note || null, external_claim_no: ext || null, approved_amount: action === "approve" ? Number(amt) : null } });
      toast.success(ACTIONS[action].label + " — done"); invalidate(qc, claimId); onClose();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{ACTIONS[action].label}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {action === "submit" ? <div><Label>Payer claim number (optional)</Label><Input value={ext} onChange={(e) => setExt(e.target.value)} /></div> : null}
          {action === "approve" ? <div><Label>Approved amount (₹)</Label><Input inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} /></div> : null}
          <div><Label>{needsNote ? (action === "deny" ? "Denial reason" : "Query from payer") : "Note (optional)"}</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></div>
          {action === "record_query" ? <p className="text-[12px] text-muted-foreground">A “reply to query” task due in 48 hours will be added to the work queue.</p> : null}
        </div>
        <DialogFooter><Button onClick={go} disabled={busy || (needsNote && !note.trim())}>{busy ? "Saving…" : "Confirm"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ claimId, remaining, onClose }: { claimId: string; remaining: number; onClose: () => void }) {
  const qc = useQueryClient();
  const pay = useServerFn(recordPayment);
  const [f, setF] = useState({ amount: String(remaining || ""), tds: "0", utr: "", date: todayIso(), receipt: "" });
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const r = await pay({ data: { claimId, amount: Number(f.amount), tds_amount: Number(f.tds) || 0, utr_number: f.utr, payment_date: f.date, receipt_no: f.receipt || null } });
      toast.success(r.status === "short_paid" ? `Recorded — short by ${inr(r.shortPayment)}, recovery task added` : "Recorded — claim settled");
      invalidate(qc, claimId); onClose();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Amount (₹)</Label><Input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
          <div><Label>TDS (₹)</Label><Input inputMode="decimal" value={f.tds} onChange={(e) => setF({ ...f, tds: e.target.value })} /></div>
          <div className="col-span-2"><Label>Cheque / NEFT / UTR no.</Label><Input value={f.utr} onChange={(e) => setF({ ...f, utr: e.target.value })} /></div>
          <div><Label>Date</Label><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          <div><Label>Receipt no.</Label><Input value={f.receipt} onChange={(e) => setF({ ...f, receipt: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={go} disabled={busy || !(Number(f.amount) > 0) || f.utr.trim().length < 3}>{busy ? "Saving…" : "Save payment"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ c, onClose }: { c: any; onClose: () => void }) {
  const qc = useQueryClient();
  const save = useServerFn(updateClaimDetails);
  const a = c.admissions ?? {};
  const [f, setF] = useState({
    claimed_amount: String(c.claimed_amount), copay: String(c.copay), hospital_discount: String(c.hospital_discount),
    patient_paid: String(c.patient_paid), shortfall_amount: String(c.shortfall_amount),
    external_claim_no: c.external_claim_no ?? "", invoice_number: c.invoice_number ?? "", priority: c.priority as "low" | "normal" | "high" | "urgent",
    diagnosis: a.diagnosis ?? "", treatment: a.treatment ?? "", policy_number: a.policy_number ?? "", member_id: a.member_id ?? "", ip_number: a.ip_number ?? "",
  });
  const [busy, setBusy] = useState(false);
  const field = (k: keyof typeof f, label: string, num?: boolean) => (
    <div><Label>{label}</Label><Input inputMode={num ? "decimal" : undefined} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );
  async function go() {
    setBusy(true);
    try {
      await save({ data: {
        claimId: c.id, claimed_amount: Number(f.claimed_amount) || 0, copay: Number(f.copay) || 0, hospital_discount: Number(f.hospital_discount) || 0,
        patient_paid: Number(f.patient_paid) || 0, shortfall_amount: Number(f.shortfall_amount) || 0,
        external_claim_no: f.external_claim_no || null, invoice_number: f.invoice_number || null, priority: f.priority,
        diagnosis: f.diagnosis || null, treatment: f.treatment || null, policy_number: f.policy_number || null, member_id: f.member_id || null, ip_number: f.ip_number || null,
      } });
      toast.success("Claim updated"); invalidate(qc, c.id); onClose();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Edit claim details</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          {field("claimed_amount", "Claimed (₹)", true)}{field("copay", "Copay (₹)", true)}{field("shortfall_amount", "Shortfall (₹)", true)}
          {field("hospital_discount", "Hospital discount (₹)", true)}{field("patient_paid", "Patient paid (₹)", true)}
          <div><Label>Priority</Label>
            <Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v as typeof f.priority })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent>
            </Select>
          </div>
          {field("external_claim_no", "Payer claim no.")}{field("invoice_number", "Invoice no.")}{field("ip_number", "IP number")}
          {field("policy_number", "Policy number")}{field("member_id", "Member ID")}{field("diagnosis", "Diagnosis")}
          {field("treatment", "Treatment")}
        </div>
        <DialogFooter><Button onClick={go} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
