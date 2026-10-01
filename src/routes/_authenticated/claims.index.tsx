import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader, StatCard } from "@/components/rcm/app-shell";
import { Chip, DataTable, Pager, ReadinessBadge, errMsg, fmtDate, td, tr } from "@/components/rcm/claims-ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { assignClaims } from "@/lib/claims.functions";
import { CLAIM_STATUSES, CLAIM_STATUS_LABEL, inr } from "@/lib/claims-domain";
import { assigneesQuery, claimStatsQuery, claimsQuery } from "@/lib/claims-queries";
import { sessionQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/claims/")({
  head: () => ({
    meta: [
      { title: "Claims — RCM Buddy" },
      { name: "description", content: "Every cashless claim with status, money, readiness score and owner." },
      { property: "og:title", content: "Claims — RCM Buddy" },
      { property: "og:description", content: "Cashless claims across your hospitals." },
    ],
  }),
  component: Claims,
});

function Claims() {
  const { data: session } = useSuspenseQuery(sessionQuery);
  const [f, setF] = useState({ search: "", status: "all", readiness: "all", hospitalId: "all", from: "", to: "" });
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<string[]>([]);
  const params = {
    search: f.search, status: f.status, page, from: f.from, to: f.to,
    ...(f.readiness !== "all" ? { readiness: f.readiness } : {}),
    ...(f.hospitalId !== "all" ? { hospitalId: f.hospitalId } : {}),
  };
  const { data, isFetching, error } = useQuery({ ...claimsQuery(params), placeholderData: (p) => p });
  const { data: stats } = useQuery(claimStatsQuery);
  const rows = data?.rows ?? [];
  const upd = (k: keyof typeof f) => (v: string) => { setF({ ...f, [k]: v }); setPage(1); setSel([]); };
  const t = stats?.totals;

  return (
    <div>
      <PageHeader
        title="Claims"
        description="Claims are created on discharge or by importing your claims sheet."
        actions={<Button size="sm" variant="outline" asChild><Link to="/imports">Import claims sheet</Link></Button>}
      />
      {t ? (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatCard label="Open claims" value={t.open} hint={`${t.notReady} not ready`} tone={t.notReady ? "warning" : "default"} />
          <StatCard label="Claimed" value={inr(t.claimed)} hint={`${t.count} claims`} />
          <StatCard label="Approved" value={inr(t.approved)} />
          <StatCard label="Settled" value={inr(t.settled)} tone="positive" />
          <StatCard label="Short paid" value={inr(t.short)} tone={t.short ? "risk" : "default"} hint={`${t.denied} denied / rejected`} />
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input className="h-9 w-60" placeholder="RCM ID, claim no., case ref" value={f.search} onChange={(e) => upd("search")(e.target.value)} />
        <Select value={f.status} onValueChange={upd("status")}>
          <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem><SelectItem value="open">All open</SelectItem>
            {CLAIM_STATUSES.map((s) => <SelectItem key={s} value={s}>{CLAIM_STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={f.readiness} onValueChange={upd("readiness")}>
          <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any readiness</SelectItem><SelectItem value="ready">Ready (90+)</SelectItem>
            <SelectItem value="review">Review (75–89)</SelectItem><SelectItem value="not_ready">Not ready (&lt;75)</SelectItem>
          </SelectContent>
        </Select>
        {session.hospitals.length > 1 ? (
          <Select value={f.hospitalId} onValueChange={upd("hospitalId")}>
            <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All hospitals</SelectItem>{session.hospitals.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
          </Select>
        ) : null}
        <Input type="date" className="h-9 w-36" value={f.from} onChange={(e) => upd("from")(e.target.value)} aria-label="From date" />
        <Input type="date" className="h-9 w-36" value={f.to} onChange={(e) => upd("to")(e.target.value)} aria-label="To date" />
        <span className="tnum text-[12px] text-muted-foreground">{isFetching ? "Loading…" : `${data?.total ?? 0} claims`}</span>
      </div>

      {sel.length ? <BulkAssign ids={sel} onDone={() => setSel([])} /> : null}

      {error ? <EmptyState title="Could not load claims" description={(error as Error).message} /> :
        rows.length === 0 ? <EmptyState title="No claims match" description="Discharge a patient from Admissions or import your claims sheet." /> : (
          <DataTable head={[
            <Checkbox key="all" checked={sel.length === rows.length} onCheckedChange={(v) => setSel(v ? rows.map((r) => r.id) : [])} aria-label="Select all" />,
            "RCM ID", "Claim no.", "Patient", "Hospital", "Payer", "Date", "Claimed", "Approved", "Settled", "Readiness", "Status", "Owner",
          ]}>
            {rows.map((c) => (
              <tr key={c.id} className={tr}>
                <td className={td}><Checkbox checked={sel.includes(c.id)} onCheckedChange={(v) => setSel(v ? [...sel, c.id] : sel.filter((x) => x !== c.id))} aria-label="Select claim" /></td>
                <td className={`${td} tnum font-medium`}><Link to="/claims/$claimId" params={{ claimId: c.id }} className="text-primary hover:underline">{c.claim_code}</Link></td>
                <td className={`${td} tnum text-muted-foreground`}>{c.external_claim_no ?? "—"}</td>
                <td className={td}>{c.patients?.full_name}</td>
                <td className={`${td} text-muted-foreground`}>{c.hospitals?.name}</td>
                <td className={`${td} max-w-40 truncate text-muted-foreground`}>{c.admissions?.tpas?.name ?? c.admissions?.insurers?.name ?? "—"}</td>
                <td className={`${td} tnum`}>{fmtDate(c.claim_date)}</td>
                <td className={`${td} tnum`}>{inr(c.claimed_amount)}</td>
                <td className={`${td} tnum`}>{inr(c.approved_amount)}</td>
                <td className={`${td} tnum`}>{inr(c.settled_amount)}</td>
                <td className={td}><ReadinessBadge score={c.readiness_score} compact /></td>
                <td className={td}><Chip value={c.status} /></td>
                <td className={`${td} text-muted-foreground`}>{c.profiles?.full_name ?? "Unassigned"}</td>
              </tr>
            ))}
          </DataTable>
        )}
      <Pager page={page} total={data?.total ?? 0} pageSize={data?.pageSize ?? 25} onPage={(p) => { setPage(p); setSel([]); }} />
    </div>
  );
}

function BulkAssign({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const { data: people } = useQuery(assigneesQuery());
  const qc = useQueryClient();
  const assign = useServerFn(assignClaims);
  const [who, setWho] = useState("");
  async function go() {
    try {
      const r = await assign({ data: { claimIds: ids, userId: who === "none" ? null : who } });
      toast.success(`${r.updated} claim${r.updated === 1 ? "" : "s"} reassigned`);
      qc.invalidateQueries({ queryKey: ["claims"] }); qc.invalidateQueries({ queryKey: ["tasks"] });
      onDone();
    } catch (e) { toast.error(errMsg(e)); }
  }
  return (
    <div className="mb-3 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[13px]">
      <span className="font-medium">{ids.length} selected</span>
      <Select value={who} onValueChange={setWho}>
        <SelectTrigger className="h-8 w-56"><SelectValue placeholder="Assign to…" /></SelectTrigger>
        <SelectContent><SelectItem value="none">Unassign</SelectItem>{(people ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
      </Select>
      <Button size="sm" disabled={!who} onClick={go}>Assign</Button>
      <Button size="sm" variant="ghost" onClick={onDone}>Clear</Button>
    </div>
  );
}
