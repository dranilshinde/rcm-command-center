import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader, StatCard } from "@/components/rcm/app-shell";
import { Chip, DataTable, Pager, errMsg, fmtDate, td, tr } from "@/components/rcm/claims-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { inr } from "@/lib/claims-domain";
import { DENIAL_CATEGORIES, listDenials, updateDenial } from "@/lib/revenue.functions";

const denialsQuery = (p: { kind?: string; status?: string; category?: string; page: number }) =>
  queryOptions({ queryKey: ["denials", p], queryFn: () => listDenials({ data: p }) });

export const Route = createFileRoute("/_authenticated/denials")({
  head: () => ({
    meta: [
      { title: "Denials & Recovery — RCM Buddy" },
      { name: "description", content: "Denied and short-paid claims by category, with Pareto analysis, appeals and recovery tracking." },
      { property: "og:title", content: "Denials & Recovery — RCM Buddy" },
      { property: "og:description", content: "Denial Pareto, appeals and recovered money." },
    ],
  }),
  component: Denials,
});

const STATUS_LABEL: Record<string, string> = { open: "Open", appealed: "Appealed", recovered: "Recovered", partially_recovered: "Partly recovered", written_off: "Written off" };
const STATUS_CHIP: Record<string, string> = { open: "open", appealed: "in_progress", recovered: "completed", partially_recovered: "short_paid", written_off: "cancelled" };

function Denials() {
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("active");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const p = { kind: kind === "all" ? undefined : kind, status: status === "all" ? undefined : status, category: category === "all" ? undefined : category, page };
  const { data, error, isFetching } = useQuery({ ...denialsQuery(p as any), placeholderData: (x) => x });
  if (error) return <EmptyState title="Could not load denials" description={(error as Error).message} />;
  const s = data?.stats;
  const maxP = Math.max(1, ...(data?.pareto ?? []).map((c) => c.amount));

  return (
    <div>
      <PageHeader title="Denials & Recovery" description="Every denied or short-paid claim opens a recovery record automatically. Categorise it, appeal, and record what you get back." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Money at stake" value={inr(s?.atStake)} tone={s?.atStake ? "risk" : "default"} hint={`${s?.active ?? 0} open or appealed`} />
        <StatCard label="Recovered" value={inr(s?.recovered)} tone="positive" />
        <StatCard label="Written off" value={inr(s?.writtenOff)} />
        <StatCard label="Denials / short payments" value={`${s?.denials ?? 0} / ${s?.shortPayments ?? 0}`} />
      </div>
      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Recovery list</TabsTrigger>
          <TabsTrigger value="pareto">Pareto by category</TabsTrigger>
          <TabsTrigger value="payers">By payer</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Sel value={kind} onChange={(v) => { setKind(v); setPage(1); }} items={{ all: "Denials & short payments", denial: "Denials", short_payment: "Short payments" }} />
            <Sel value={status} onChange={(v) => { setStatus(v); setPage(1); }} items={{ active: "Open or appealed", all: "Any status", ...STATUS_LABEL }} />
            <Sel value={category} onChange={(v) => { setCategory(v); setPage(1); }} items={{ all: "All categories", ...DENIAL_CATEGORIES }} />
            <span className="tnum text-[12px] text-muted-foreground">{isFetching ? "Loading…" : `${data?.total ?? 0} records`}</span>
          </div>
          {!data?.rows.length ? <EmptyState title="No denials match" description="Claims marked denied or short paid show up here." /> : (
            <DataTable head={["Claim", "Patient", "Payer", "Type", "Category", "At stake", "Recovered", "Status", "Opened", ""]}>
              {data.rows.map((d: any) => (
                <tr key={d.id} className={tr}>
                  <td className={td}><Link to="/claims/$claimId" params={{ claimId: d.claim_id }} className="tnum text-primary hover:underline">{d.claims?.claim_code}</Link></td>
                  <td className={td}>{d.claims?.patients?.full_name}</td>
                  <td className={`${td} max-w-36 truncate text-muted-foreground`}>{d.claims?.admissions?.tpas?.name ?? d.claims?.admissions?.insurers?.name ?? "—"}</td>
                  <td className={td}>{d.kind === "denial" ? "Denial" : "Short payment"}</td>
                  <td className={td}>{DENIAL_CATEGORIES[d.category] ?? d.category}</td>
                  <td className={`${td} tnum`}>{inr(d.amount)}</td>
                  <td className={`${td} tnum`}>{inr(d.recovered_amount)}</td>
                  <td className={td}><Chip value={STATUS_CHIP[d.status] ?? "open"} label={STATUS_LABEL[d.status] ?? d.status} /></td>
                  <td className={`${td} tnum`}>{fmtDate(d.created_at)}</td>
                  <td className={`${td} text-right`}><DenialDialog d={d} /></td>
                </tr>
              ))}
            </DataTable>
          )}
          <Pager page={page} total={data?.total ?? 0} pageSize={data?.pageSize ?? 25} onPage={setPage} />
        </TabsContent>
        <TabsContent value="pareto" className="mt-3">
          {!data?.pareto.length ? <EmptyState title="No denials yet" /> : (
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="mb-3 text-[12px] text-muted-foreground">Categories ranked by money at stake. Fixing the categories up to ~80% cumulative removes most losses.</p>
              {data.pareto.map((c) => (
                <div key={c.category} className="mb-2 grid grid-cols-[150px_1fr_170px_60px] items-center gap-3 text-[13px]">
                  <span>{DENIAL_CATEGORIES[c.category] ?? c.category}</span>
                  <div className="h-3 rounded bg-muted"><div className="h-3 rounded bg-risk" style={{ width: `${(c.amount / maxP) * 100}%` }} /></div>
                  <span className="tnum text-right">{inr(c.amount)} · {c.count}</span>
                  <span className="tnum text-right text-muted-foreground">{c.cumulativePct.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="payers" className="mt-3">
          {!data?.byPayer.length ? <EmptyState title="No denials yet" /> : (
            <DataTable head={["Payer", "Records", "Money at stake"]}>
              {data.byPayer.map((p) => <tr key={p.payer} className={tr}><td className={`${td} font-medium`}>{p.payer}</td><td className={`${td} tnum`}>{p.count}</td><td className={`${td} tnum`}>{inr(p.amount)}</td></tr>)}
            </DataTable>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Sel({ value, onChange, items }: { value: string; onChange: (v: string) => void; items: Record<string, string> }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-auto min-w-40 text-[13px]"><SelectValue /></SelectTrigger>
      <SelectContent>{Object.entries(items).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function DenialDialog({ d }: { d: any }) {
  const qc = useQueryClient();
  const save = useServerFn(updateDenial);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const init = () => ({ category: d.category, reason: d.reason ?? "", status: d.status, appeal: d.appeal_submitted_at ?? "", recovered: String(d.recovered_amount ?? 0), note: d.resolution_note ?? "" });
  const [f, setF] = useState(init);
  async function go() {
    setBusy(true);
    try {
      await save({ data: { id: d.id, category: f.category, reason: f.reason || null, status: f.status as any, appeal_submitted_at: f.appeal || null, recovered_amount: Number(f.recovered || 0), resolution_note: f.note || null } });
      toast.success("Saved");
      ["denials", "tasks"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setOpen(false);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setF(init()); }}>
      <DialogTrigger asChild><Button size="sm" variant="outline">Update</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{d.kind === "denial" ? "Denial" : "Short payment"} — {d.claims?.claim_code} · {inr(d.amount)}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Category</Label>
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(DENIAL_CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label>Status</Label>
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="col-span-2"><Label>Payer's reason</Label><Textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
          <div><Label>Appeal submitted on</Label><Input type="date" value={f.appeal} onChange={(e) => setF({ ...f, appeal: e.target.value })} /></div>
          <div><Label>Recovered so far (₹)</Label><Input inputMode="decimal" value={f.recovered} onChange={(e) => setF({ ...f, recovered: e.target.value })} /></div>
          <div className="col-span-2"><Label>Resolution note</Label><Textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Required when writing off" /></div>
          <p className="col-span-2 text-[12px] text-muted-foreground">Marking “Appealed” adds an appeal follow-up task due in 15 days. Recovered or written off closes the recovery task.</p>
        </div>
        <DialogFooter><Button onClick={go} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
