import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { EmptyState, PageHeader, StatCard } from "@/components/rcm/app-shell";
import { Chip, DataTable, Pager, fmtDate, td, tr } from "@/components/rcm/claims-ui";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inr } from "@/lib/claims-domain";
import { getArOverview } from "@/lib/revenue.functions";
import { cn } from "@/lib/utils";

const arQuery = (p: { bucket?: number; payer?: string; page?: number }) =>
  queryOptions({ queryKey: ["ar", p], queryFn: () => getArOverview({ data: p }) });

export const Route = createFileRoute("/_authenticated/ar")({
  head: () => ({
    meta: [
      { title: "AR Management — RCM Buddy" },
      { name: "description", content: "Accounts receivable ageing by bucket, payer and hospital, drillable to every claim." },
      { property: "og:title", content: "AR Management — RCM Buddy" },
      { property: "og:description", content: "Where your money is stuck, by age and payer." },
    ],
  }),
  component: Ar,
});

function Ar() {
  const [bucket, setBucket] = useState<number | undefined>();
  const [payer, setPayer] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const { data, error, isFetching } = useQuery({ ...arQuery({ bucket, payer, page }), placeholderData: (p) => p });
  if (error) return <EmptyState title="Could not load AR" description={(error as Error).message} />;
  const max = Math.max(1, ...(data?.buckets ?? []).map((b) => b.amount));
  const filter = (b?: number, p?: string) => { setBucket(b); setPayer(p); setPage(1); };

  return (
    <div>
      <PageHeader title="AR Management" description="Money owed by payers on submitted and approved claims, aged from document submission. Click a bucket or payer to see the claims." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total AR" value={inr(data?.total)} hint={`${data?.count ?? 0} claims`} />
        <StatCard label="Over 90 days" value={inr(data?.over90)} tone={data?.over90 ? "risk" : "default"} hint={data?.total ? `${(((data.over90 ?? 0) / data.total) * 100).toFixed(1)}% of AR` : "—"} />
        <StatCard label="Weighted age" value={`${Math.round(data?.avgAgeDays ?? 0)} days`} />
        <StatCard label="Payers owing" value={data?.byPayer.length ?? 0} />
      </div>

      <div className="mb-4 rounded-lg border border-border bg-card p-4">
        <p className="mb-3 text-[12px] text-muted-foreground">Ageing buckets (days)</p>
        <div className="grid grid-cols-8 items-end gap-2">
          {(data?.buckets ?? []).map((b, i) => (
            <button key={b.label} onClick={() => filter(bucket === i ? undefined : i, payer)} className={cn("flex flex-col items-center gap-1 rounded p-1 text-[11px] hover:bg-muted/50", bucket === i && "bg-muted")}>
              <span className="tnum font-medium">{inr(b.amount)}</span>
              <div className="flex h-28 w-full items-end"><div className={cn("w-full rounded-t", i >= 5 ? "bg-risk" : i >= 3 ? "bg-warning" : "bg-primary")} style={{ height: `${Math.max(2, (b.amount / max) * 100)}%` }} /></div>
              <span className="tnum text-muted-foreground">{b.label}</span>
              <span className="tnum text-muted-foreground">{b.claims} claims</span>
            </button>
          ))}
        </div>
      </div>

      <Tabs defaultValue="claims">
        <TabsList>
          <TabsTrigger value="claims">Claims</TabsTrigger>
          <TabsTrigger value="payers">By payer</TabsTrigger>
          <TabsTrigger value="hospitals">By hospital</TabsTrigger>
        </TabsList>
        <TabsContent value="claims" className="mt-3">
          <div className="mb-2 flex items-center gap-2 text-[12px] text-muted-foreground">
            <span className="tnum">{isFetching ? "Loading…" : `${data?.listTotal ?? 0} claims`}</span>
            {bucket !== undefined || payer ? <Button size="sm" variant="ghost" onClick={() => filter()}>Clear filter{bucket !== undefined ? ` · ${data?.buckets[bucket]?.label} d` : ""}{payer ? ` · ${payer}` : ""}</Button> : null}
          </div>
          {!data?.rows.length ? <EmptyState title="No money outstanding here" description="Claims appear once submitted, until fully settled." /> : (
            <DataTable head={["Claim", "Patient", "Payer", "Hospital", "Status", "Outstanding", "Age (days)", "Next follow-up", "Owner"]}>
              {data.rows.map((c: any) => (
                <tr key={c.id} className={tr}>
                  <td className={td}><Link to="/claims/$claimId" params={{ claimId: c.id }} className="tnum text-primary hover:underline">{c.claim_code}</Link>{c.escalation_level ? <span className="ml-1"><Chip value="escalated" label={`L${c.escalation_level}`} /></span> : null}</td>
                  <td className={td}>{c.patients?.full_name}</td>
                  <td className={`${td} max-w-40 truncate text-muted-foreground`}>{c.payer}</td>
                  <td className={`${td} text-muted-foreground`}>{c.hospitals?.name}</td>
                  <td className={td}><Chip value={c.status} /></td>
                  <td className={`${td} tnum`}>{inr(c.outstanding)}</td>
                  <td className={cn(td, "tnum", c.age > 90 && "font-semibold text-risk")}>{c.age}</td>
                  <td className={`${td} tnum`}>{c.next_followup_at ? fmtDate(c.next_followup_at) : "—"}</td>
                  <td className={`${td} text-muted-foreground`}>{c.profiles?.full_name ?? "Unassigned"}</td>
                </tr>
              ))}
            </DataTable>
          )}
          <Pager page={page} total={data?.listTotal ?? 0} pageSize={data?.pageSize ?? 25} onPage={setPage} />
        </TabsContent>
        <TabsContent value="payers" className="mt-3">
          {!data?.byPayer.length ? <EmptyState title="No payer owes money" /> : (
            <DataTable head={["Payer", "Claims", "Outstanding", "Over 90 days", "Oldest (days)"]}>
              {data.byPayer.map((p) => (
                <tr key={p.payer} className={cn(tr, "cursor-pointer")} onClick={() => filter(bucket, p.payer)}>
                  <td className={`${td} font-medium text-primary`}>{p.payer}</td>
                  <td className={`${td} tnum`}>{p.claims}</td>
                  <td className={`${td} tnum`}>{inr(p.amount)}</td>
                  <td className={cn(td, "tnum", p.over90 > 0 && "text-risk")}>{inr(p.over90)}</td>
                  <td className={`${td} tnum`}>{p.oldest}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </TabsContent>
        <TabsContent value="hospitals" className="mt-3">
          {!data?.byHospital.length ? <EmptyState title="No outstanding AR" /> : (
            <DataTable head={["Hospital", "Claims", "Outstanding", "Over 90 days"]}>
              {data.byHospital.map((h) => (
                <tr key={h.hospital} className={tr}>
                  <td className={`${td} font-medium`}>{h.hospital}</td>
                  <td className={`${td} tnum`}>{h.claims}</td>
                  <td className={`${td} tnum`}>{inr(h.amount)}</td>
                  <td className={cn(td, "tnum", h.over90 > 0 && "text-risk")}>{inr(h.over90)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
