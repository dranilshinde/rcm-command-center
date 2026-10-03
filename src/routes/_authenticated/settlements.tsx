import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { EmptyState, PageHeader, StatCard } from "@/components/rcm/app-shell";
import { Chip, DataTable, Pager, fmtDate, td, tr } from "@/components/rcm/claims-ui";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inr } from "@/lib/claims-domain";
import { listSettlements } from "@/lib/revenue.functions";
import { cn } from "@/lib/utils";

const settlementsQuery = (p: { view: string; page: number }) =>
  queryOptions({ queryKey: ["settlements", p], queryFn: () => listSettlements({ data: p }) });

export const Route = createFileRoute("/_authenticated/settlements")({
  head: () => ({
    meta: [
      { title: "Settlements — RCM Buddy" },
      { name: "description", content: "Expected vs received vs variance for every approved claim, with payments and UTRs." },
      { property: "og:title", content: "Settlements — RCM Buddy" },
      { property: "og:description", content: "Expected, received and variance per claim." },
    ],
  }),
  component: Settlements,
});

function Settlements() {
  const [view, setView] = useState("all");
  const [page, setPage] = useState(1);
  const { data, error, isFetching } = useQuery({ ...settlementsQuery({ view, page }), placeholderData: (p) => p });
  if (error) return <EmptyState title="Could not load settlements" description={(error as Error).message} />;
  const t = data?.totals;
  return (
    <div>
      <PageHeader title="Settlements" description="Expected = approved amount. Received = money credited plus TDS deducted. Record payments on the claim, or reconcile bank receipts to create them." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Expected" value={inr(t?.expected)} />
        <StatCard label="Received (incl. TDS)" value={inr(t?.received)} />
        <StatCard label="Variance" value={inr(t?.variance)} tone={(t?.variance ?? 0) < -1 ? "risk" : "default"} />
        <StatCard label="Approved, awaiting money" value={inr(t?.awaiting)} tone={t?.awaiting ? "warning" : "default"} />
      </div>
      <Tabs value={view} onValueChange={(v) => { setView(v); setPage(1); }}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="awaiting">Awaiting payment</TabsTrigger>
          <TabsTrigger value="short">Short paid</TabsTrigger>
          <TabsTrigger value="settled">Settled</TabsTrigger>
        </TabsList>
      </Tabs>
      <p className="tnum my-2 text-[12px] text-muted-foreground">{isFetching ? "Loading…" : `${data?.total ?? 0} claims`}</p>
      {!data?.rows.length ? <EmptyState title="Nothing here" description="Approved claims appear here until the money is in." /> : (
        <DataTable head={["Claim", "Patient", "Payer", "Status", "Expected", "Received", "Variance", "Payments", "Reconciled"]}>
          {data.rows.map((c: any) => (
            <tr key={c.id} className={tr}>
              <td className={td}><Link to="/claims/$claimId" params={{ claimId: c.id }} className="tnum text-primary hover:underline">{c.claim_code}</Link></td>
              <td className={td}>{c.patients?.full_name}</td>
              <td className={`${td} max-w-40 truncate text-muted-foreground`}>{c.payer}</td>
              <td className={td}><Chip value={c.status} /></td>
              <td className={`${td} tnum`}>{inr(c.expected)}</td>
              <td className={`${td} tnum`}>{inr(c.received)}</td>
              <td className={cn(td, "tnum", c.variance < -1 && "font-semibold text-risk", c.variance > 1 && "text-warning")}>{inr(c.variance)}</td>
              <td className={`${td} text-[12px]`}>{c.claim_payments?.length ? c.claim_payments.map((p: any) => <p key={p.id} className="tnum">{inr(p.amount)} · {fmtDate(p.payment_date)}{p.utr_number ? ` · ${p.utr_number}` : ""}</p>) : <span className="text-muted-foreground">None</span>}</td>
              <td className={td}>{c.reconciled ? <Chip value="completed" label="Yes" /> : <Chip value="waiting" label="No" />}</td>
            </tr>
          ))}
        </DataTable>
      )}
      <Pager page={page} total={data?.total ?? 0} pageSize={data?.pageSize ?? 25} onPage={setPage} />
    </div>
  );
}
