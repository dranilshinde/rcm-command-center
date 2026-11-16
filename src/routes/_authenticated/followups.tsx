import { outstandingAmount } from "@/lib/rcm-definitions";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { EmptyState, PageHeader, StatCard } from "@/components/rcm/app-shell";
import { Chip, DataTable, Pager, fmtDate, td, tr } from "@/components/rcm/claims-ui";
import { LogFollowupDialog, OUTCOME_LABEL } from "@/components/rcm/followup-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inr } from "@/lib/claims-domain";
import { followupCenterQuery } from "@/lib/claims-queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/followups")({
  head: () => ({
    meta: [
      { title: "Payer Follow-ups — RCM Buddy" },
      { name: "description", content: "Claims waiting on payers, payment commitments and money pending by payer." },
      { property: "og:title", content: "Payer Follow-ups — RCM Buddy" },
      { property: "og:description", content: "Claims waiting on payers and payment commitments." },
    ],
  }),
  component: Followups,
});

const days = (d: string | null) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 864e5) : null);

function Followups() {
  const [page, setPage] = useState(1);
  const { data, isFetching, error } = useQuery({ ...followupCenterQuery({ page }), placeholderData: (p) => p });
  if (error) return <EmptyState title="Could not load follow-ups" description={(error as Error).message} />;
  const rows = data?.rows ?? [];
  const missed = (data?.commitments ?? []).filter((c) => c.missed);
  const pending = (data?.byPayer ?? []).reduce((s, p) => s + p.pending, 0);
  const now = Date.now();

  return (
    <div>
      <PageHeader title="Payer Follow-ups" description="Claims waiting on a payer, oldest and most overdue first. Quiet claims get a follow-up task automatically under your reminder rules." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Claims with payers" value={data?.total ?? 0} />
        <StatCard label="Money pending" value={inr(pending)} />
        <StatCard label="Commitments tracked" value={data?.commitments.length ?? 0} />
        <StatCard label="Missed commitments" value={missed.length} tone={missed.length ? "risk" : "default"} />
      </div>
      <Tabs defaultValue="claims">
        <TabsList>
          <TabsTrigger value="claims">Claims to chase</TabsTrigger>
          <TabsTrigger value="commitments">Commitments</TabsTrigger>
          <TabsTrigger value="payers">By payer</TabsTrigger>
        </TabsList>

        <TabsContent value="claims" className="mt-3">
          <p className="tnum mb-2 text-[12px] text-muted-foreground">{isFetching ? "Loading…" : `${data?.total ?? 0} claims`}</p>
          {rows.length === 0 ? <EmptyState title="Nothing waiting on payers" description="Submitted and approved claims appear here until they are settled." /> : (
            <DataTable head={["Claim", "Patient", "Payer", "Status", "Pending", "Days since submission", "Last follow-up", "Next follow-up", "Owner", ""]}>
              {rows.map((c) => {
                const last = [...(c.claim_followups ?? [])].sort((a: any, b: any) => b.created_at.localeCompare(a.created_at))[0];
                const due = c.next_followup_at && new Date(c.next_followup_at).getTime() < now;
                return (
                  <tr key={c.id} className={tr}>
                    <td className={td}><Link to="/claims/$claimId" params={{ claimId: c.id }} className="tnum text-primary hover:underline">{c.claim_code}</Link>{c.escalation_level ? <span className="ml-1"><Chip value="escalated" label={`L${c.escalation_level}`} /></span> : null}</td>
                    <td className={td}>{c.patients?.full_name}</td>
                    <td className={`${td} max-w-40 truncate text-muted-foreground`}>{c.admissions?.tpas?.name ?? c.admissions?.insurers?.name ?? "—"}</td>
                    <td className={td}><Chip value={c.status} /></td>
                    <td className={`${td} tnum`}>{inr(outstandingAmount(c))}</td>
                    <td className={`${td} tnum`}>{days(c.document_submitted_at) ?? "—"}</td>
                    <td className={`${td} text-[12px]`}>{last ? <>{fmtDate(last.created_at)}<p className="text-muted-foreground">{OUTCOME_LABEL[last.outcome] ?? last.outcome}</p></> : <span className="text-muted-foreground">Never</span>}</td>
                    <td className={cn(td, "tnum", due && "font-semibold text-risk")}>{c.next_followup_at ? fmtDate(c.next_followup_at) : "—"}</td>
                    <td className={`${td} text-muted-foreground`}>{c.profiles?.full_name ?? "Unassigned"}</td>
                    <td className={`${td} text-right`}><LogFollowupDialog claimId={c.id} /></td>
                  </tr>
                );
              })}
            </DataTable>
          )}
          <Pager page={page} total={data?.total ?? 0} pageSize={data?.pageSize ?? 25} onPage={setPage} />
        </TabsContent>

        <TabsContent value="commitments" className="mt-3">
          {!data?.commitments.length ? <EmptyState title="No payment commitments" description="When a payer promises a payment date, log it as a follow-up with “Payment committed”." /> : (
            <DataTable head={["Committed date", "Claim", "Patient", "Payer", "Amount", "Contact", "State"]}>
              {data.commitments.map((f) => (
                <tr key={f.id} className={tr}>
                  <td className={cn(td, "tnum", f.missed && "font-semibold text-risk")}>{fmtDate(f.commitment_date)}</td>
                  <td className={td}><Link to="/claims/$claimId" params={{ claimId: f.claim_id }} className="tnum text-primary hover:underline">{f.claims?.claim_code}</Link></td>
                  <td className={td}>{f.claims?.patients?.full_name}</td>
                  <td className={`${td} text-muted-foreground`}>{f.claims?.admissions?.tpas?.name ?? f.claims?.admissions?.insurers?.name ?? "—"}</td>
                  <td className={`${td} tnum`}>{f.commitment_amount != null ? inr(f.commitment_amount) : "—"}</td>
                  <td className={`${td} text-muted-foreground`}>{f.contact_name ?? "—"}</td>
                  <td className={td}>{f.missed ? <Chip value="denied" label="Missed" /> : <Chip value="waiting" label="Upcoming" />}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </TabsContent>

        <TabsContent value="payers" className="mt-3">
          {!data?.byPayer.length ? <EmptyState title="No pending money with payers" /> : (
            <DataTable head={["Payer", "Claims pending", "Money pending", "Oldest (days)"]}>
              {data.byPayer.map((p) => (
                <tr key={p.payer} className={tr}>
                  <td className={`${td} font-medium`}>{p.payer}</td>
                  <td className={`${td} tnum`}>{p.claims}</td>
                  <td className={`${td} tnum`}>{inr(p.pending)}</td>
                  <td className={cn(td, "tnum", p.oldestDays > 60 && "font-semibold text-risk")}>{p.oldestDays}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
