import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { EmptyState, PageHeader, StatCard, StatusChip } from "@/components/rcm/app-shell";
import { Chip, DataTable, fmtDate, td, tr } from "@/components/rcm/claims-ui";
import { OUTCOME_LABEL } from "@/components/rcm/followup-dialog";
import { CHANNEL_LABEL, LEVEL_LABEL, PayerDialog, SpocDialog } from "@/components/rcm/payer-editors";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inr } from "@/lib/claims-domain";
import { getPayer360 } from "@/lib/payers.functions";
import { hospitalsQuery, payersQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

const payer360Query = (kind: "insurer" | "tpa", id: string) =>
  queryOptions({ queryKey: ["payer360", kind, id], queryFn: () => getPayer360({ data: { kind, id } }) });

export const Route = createFileRoute("/_authenticated/payers/$kind/$payerId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(payer360Query(params.kind === "tpa" ? "tpa" : "insurer", params.payerId)),
  head: () => ({
    meta: [
      { title: "Payer 360 — RCM Buddy" },
      { name: "description", content: "Money pending, ageing, behaviour, contacts and rules for one payer." },
      { property: "og:title", content: "Payer 360 — RCM Buddy" },
      { property: "og:description", content: "Everything about one insurer or TPA in one place." },
    ],
  }),
  errorComponent: ({ error }) => <EmptyState title="Could not load this payer" description={(error as Error).message} />,
  notFoundComponent: () => <EmptyState title="Payer not found" />,
  component: Payer360,
});

const pct = (n: number | null) => (n == null ? "—" : `${n.toFixed(1)}%`);
const hrs = (h: number) => (h >= 48 ? `${Math.round(h / 24)} days` : `${Math.round(h)} h`);

function Payer360() {
  const { kind: k, payerId } = Route.useParams();
  const kind = k === "tpa" ? "tpa" : "insurer";
  const { data } = useSuspenseQuery(payer360Query(kind, payerId));
  const { data: dir } = useQuery(payersQuery);
  const { data: hosp } = useQuery(hospitalsQuery({ page: 1 }));
  const hospitals = (hosp?.rows ?? []).map((h: any) => ({ id: h.id, name: h.name }));
  const p = data.payer, kp = data.kpis;
  const slow = p.target_payment_days && kp.avgDaysToPay != null && kp.avgDaysToPay > p.target_payment_days;
  const maxAging = Math.max(1, ...data.aging.map((a) => a.amount));
  const activeSpocs = data.spocs.filter((s) => s.status === "active");
  const missing = [1, 2, 3].filter((l) => !activeSpocs.some((s) => s.escalation_level === l));

  return (
    <div>
      <Link to="/payers" className="mb-2 inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" /> Payers & TPAs</Link>
      <PageHeader
        title={p.name}
        description={`${kind === "tpa" ? "TPA" : "Insurer"} · ${p.payer_code ?? p.tpa_code} · prefers ${CHANNEL_LABEL[p.preferred_channel] ?? "email"}${p.support_phone ? ` · ${p.support_phone}` : ""}${p.support_email ? ` · ${p.support_email}` : ""}`}
        actions={<div className="flex items-center gap-2"><StatusChip status={p.status} /><PayerDialog kind={kind} payer={p} trigger={<Button size="sm" variant="outline">Edit payer</Button>} /></div>}
      />

      {(missing.length > 0 || slow || kp.openQueries > 0) && (
        <div className="mb-4 space-y-1 rounded-lg border border-warning/40 bg-warning/5 p-3 text-[13px]">
          <p className="font-medium">Needs attention</p>
          {missing.length > 0 && <p>No active {missing.map((l) => `L${l}`).join(", ")} contact — follow-up tasks {missing.includes(1) ? "won't name anyone to call" : "can't route escalations to a senior person"}. Add contacts below.</p>}
          {slow && <p>Paying in {Math.round(kp.avgDaysToPay!)} days on average against a target of {p.target_payment_days}.</p>}
          {kp.openQueries > 0 && <p>{kp.openQueries} payer {kp.openQueries === 1 ? "query is" : "queries are"} open.</p>}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Money pending" value={inr(kp.pendingAmt)} hint={`${kp.openClaims} open claims`} />
        <StatCard label="Collection rate" value={pct(kp.collectionRate)} hint={`${inr(kp.settledAmt)} of ${inr(kp.submittedAmt)}`} />
        <StatCard label="Avg days to pay" value={kp.avgDaysToPay == null ? "—" : Math.round(kp.avgDaysToPay)} tone={slow ? "risk" : "default"} hint={p.target_payment_days ? `Target ${p.target_payment_days}` : "No target set"} />
        <StatCard label="Denial rate" value={pct(kp.denialRate)} />
        <StatCard label="Query rate" value={pct(kp.queryRate)} hint={kp.avgQueryReplyHrs != null ? `We reply in ${hrs(kp.avgQueryReplyHrs)}` : "No replies yet"} />
        <StatCard label="Short paid" value={inr(kp.shortPaid)} />
        <StatCard label="Escalated claims" value={kp.escalated} tone={kp.escalated ? "risk" : "default"} />
        <StatCard label="Commitments kept" value={pct(kp.commitmentsKeptPct)} />
      </div>

      <Tabs defaultValue="claims">
        <TabsList>
          <TabsTrigger value="claims">Open claims</TabsTrigger>
          <TabsTrigger value="aging">Ageing</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({data.spocs.length})</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups</TabsTrigger>
          <TabsTrigger value="commitments">Commitments</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="notes">Relationship</TabsTrigger>
        </TabsList>

        <TabsContent value="claims" className="mt-3">
          {!data.openClaims.length ? <EmptyState title="No open claims with this payer" /> : (
            <DataTable head={["Claim", "Patient", "Hospital", "Status", "Pending", "Submitted", "Next follow-up"]}>
              {data.openClaims.map((c: any) => (
                <tr key={c.id} className={tr}>
                  <td className={td}><Link to="/claims/$claimId" params={{ claimId: c.id }} className="tnum text-primary hover:underline">{c.claim_code}</Link>{c.escalation_level ? <span className="ml-1"><Chip value="escalated" label={`L${c.escalation_level}`} /></span> : null}</td>
                  <td className={td}>{c.patients?.full_name}</td>
                  <td className={`${td} text-muted-foreground`}>{c.hospitals?.name}</td>
                  <td className={td}><Chip value={c.status} /></td>
                  <td className={`${td} tnum`}>{inr(c.pending)}</td>
                  <td className={`${td} tnum`}>{fmtDate(c.document_submitted_at ?? c.claim_date)}</td>
                  <td className={`${td} tnum`}>{c.next_followup_at ? fmtDate(c.next_followup_at) : "—"}</td>
                </tr>
              ))}
            </DataTable>
          )}
          {data.openClaims.length === 50 && <p className="mt-2 text-[12px] text-muted-foreground">Showing the 50 largest. See all in Claims.</p>}
        </TabsContent>

        <TabsContent value="aging" className="mt-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="mb-3 text-[12px] text-muted-foreground">Pending money by days since submission</p>
            {data.aging.map((a) => (
              <div key={a.label} className="mb-2 grid grid-cols-[80px_1fr_140px] items-center gap-3 text-[13px]">
                <span className="tnum text-muted-foreground">{a.label} d</span>
                <div className="h-3 rounded bg-muted"><div className={cn("h-3 rounded", a.label.match(/^(91|181|366)/) ? "bg-risk" : "bg-primary")} style={{ width: `${(a.amount / maxAging) * 100}%` }} /></div>
                <span className="tnum text-right">{inr(a.amount)} · {a.claims}</span>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="mt-3">
          <div className="mb-2 flex justify-end">{dir && <SpocDialog insurers={dir.insurers} tpas={dir.tpas} hospitals={hospitals} fixed={{ kind, id: payerId }} />}</div>
          {!data.spocs.length ? <EmptyState title="No contacts yet" description="Add the L1 person your team calls, plus supervisors for escalations." /> : (
            <DataTable head={["Level", "Name", "Designation", "Phone", "Email", "Hospital", "Status", ""]}>
              {data.spocs.map((s: any) => (
                <tr key={s.id} className={tr}>
                  <td className={td}>{LEVEL_LABEL[s.escalation_level] ?? s.escalation_level}</td>
                  <td className={`${td} font-medium`}>{s.name}</td>
                  <td className={`${td} text-muted-foreground`}>{s.designation ?? "—"}</td>
                  <td className={`${td} tnum`}>{s.phone ?? "—"}</td>
                  <td className={`${td} text-muted-foreground`}>{s.email ?? "—"}</td>
                  <td className={`${td} text-muted-foreground`}>{s.hospitals?.name ?? "All hospitals"}</td>
                  <td className={td}><StatusChip status={s.status} /></td>
                  <td className={`${td} text-right`}>{dir && <SpocDialog spoc={s} insurers={dir.insurers} tpas={dir.tpas} hospitals={hospitals} trigger={<Button size="sm" variant="ghost">Edit</Button>} />}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </TabsContent>

        <TabsContent value="followups" className="mt-3">
          {!data.followups.length ? <EmptyState title="No follow-ups logged with this payer" /> : (
            <DataTable head={["When", "Claim", "Channel", "Spoke to", "Outcome", "By"]}>
              {data.followups.map((f: any) => (
                <tr key={f.id} className={tr}>
                  <td className={`${td} tnum`}>{fmtDate(f.created_at)}</td>
                  <td className={td}><Link to="/claims/$claimId" params={{ claimId: f.claim_id }} className="tnum text-primary hover:underline">{f.claims?.claim_code}</Link></td>
                  <td className={td}>{CHANNEL_LABEL[f.channel] ?? f.channel}</td>
                  <td className={`${td} text-muted-foreground`}>{f.contact_name ?? "—"}</td>
                  <td className={td}>{OUTCOME_LABEL[f.outcome] ?? f.outcome}</td>
                  <td className={`${td} text-muted-foreground`}>{f.author_name ?? "—"}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </TabsContent>

        <TabsContent value="commitments" className="mt-3">
          {!data.commitments.length ? <EmptyState title="No payment commitments from this payer" /> : (
            <DataTable head={["Committed date", "Claim", "Amount", "Contact", "Result"]}>
              {data.commitments.map((c: any) => (
                <tr key={c.id} className={tr}>
                  <td className={`${td} tnum`}>{fmtDate(c.commitment_date)}</td>
                  <td className={td}><Link to="/claims/$claimId" params={{ claimId: c.claim_id }} className="tnum text-primary hover:underline">{c.claims?.claim_code}</Link></td>
                  <td className={`${td} tnum`}>{c.commitment_amount != null ? inr(c.commitment_amount) : "—"}</td>
                  <td className={`${td} text-muted-foreground`}>{c.contact_name ?? "—"}</td>
                  <td className={td}><Chip value={c.state === "kept" ? "completed" : c.state === "missed" ? "denied" : c.state === "late" ? "short_paid" : "waiting"} label={{ kept: "Kept", missed: "Missed", late: "Paid late", upcoming: "Upcoming" }[c.state as string] ?? "—"} /></td>
                </tr>
              ))}
            </DataTable>
          )}
        </TabsContent>

        <TabsContent value="rules" className="mt-3 space-y-3">
          <p className="text-[13px] text-muted-foreground">Rules written for this payer override hospital and organisation defaults. Anything not listed here uses the default. <Link to="/sla-rules" className="text-primary hover:underline">Manage rules</Link></p>
          {!data.rules.sla.length && !data.rules.reminders.length ? <EmptyState title="Using default rules" description="Add a payer-specific SLA or reminder rule if this payer behaves differently." /> : (
            <DataTable head={["Type", "Rule", "Threshold", "Active"]}>
              {data.rules.sla.map((r: any) => <tr key={r.id} className={tr}><td className={td}>SLA</td><td className={td}>{r.process.replace(/_/g, " ")}</td><td className={`${td} tnum`}>{hrs(r.target_hours)}</td><td className={td}>{r.is_active ? "Yes" : "No"}</td></tr>)}
              {data.rules.reminders.map((r: any) => <tr key={r.id} className={tr}><td className={td}>Reminder</td><td className={td}>{r.name}</td><td className={`${td} tnum`}>{hrs(r.threshold_hours)}</td><td className={td}>{r.is_active ? "Yes" : "No"}</td></tr>)}
            </DataTable>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-3">
          <div className="rounded-lg border border-border bg-card p-4 text-[13px]">
            <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Escalation email</p>
            <p className="mb-3">{p.escalation_email ?? "—"}</p>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Portal</p>
            <p className="mb-3">{p.portal_url ? <a href={p.portal_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{p.portal_url}</a> : "—"}</p>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Notes</p>
            <p className="whitespace-pre-wrap">{p.relationship_notes || "No notes yet. Use Edit payer to record agreements and what works."}</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
