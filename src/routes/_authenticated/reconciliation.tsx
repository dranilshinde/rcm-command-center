import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { EmptyState, PageHeader, StatCard } from "@/components/rcm/app-shell";
import { Chip, DataTable, Pager, errMsg, fmtDate, td, tr } from "@/components/rcm/claims-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inr } from "@/lib/claims-domain";
import { hospitalsQuery } from "@/lib/queries";
import { importReceipts, listReceipts, matchCandidates, matchReceipt, runAutoMatch, setReceiptStatus } from "@/lib/revenue.functions";
import { cn } from "@/lib/utils";

const receiptsQuery = (p: { status?: string | undefined; page: number }) =>
  queryOptions({ queryKey: ["receipts", p], queryFn: () => listReceipts({ data: p }) });

export const Route = createFileRoute("/_authenticated/reconciliation")({
  head: () => ({
    meta: [
      { title: "Reconciliation — RCM Buddy" },
      { name: "description", content: "Match bank credits to claims automatically by UTR, or manually, and see every unmatched rupee." },
      { property: "og:title", content: "Reconciliation — RCM Buddy" },
      { property: "og:description", content: "Bank receipts matched to claims." },
    ],
  }),
  component: Reconciliation,
});

const LABEL: Record<string, string> = { unmatched: "Unmatched", matched: "Matched", partially_matched: "Partly matched", short_paid: "Short paid", overpaid: "Overpaid", duplicate: "Duplicate" };
const CHIP: Record<string, string> = { unmatched: "open", matched: "completed", partially_matched: "in_progress", short_paid: "short_paid", overpaid: "high", duplicate: "cancelled" };

function Reconciliation() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("unmatched");
  const [page, setPage] = useState(1);
  const { data, error, isFetching } = useQuery({ ...receiptsQuery({ status: status === "all" ? undefined : status, page }), placeholderData: (p) => p });
  const auto = useServerFn(runAutoMatch);
  const refresh = () => ["receipts", "settlements", "claims", "claim", "ar", "denials"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  if (error) return <EmptyState title="Could not load reconciliation" description={(error as Error).message} />;
  const s = data?.summary ?? {};
  const g = (k: string) => s[k] ?? { count: 0, amount: 0 };

  return (
    <div>
      <PageHeader title="Reconciliation" description="Upload bank statement credits. Receipts whose UTR matches a recorded payment are matched automatically; match the rest to a claim, which records the payment and settles it."
        actions={<div className="flex gap-2"><Button size="sm" variant="outline" onClick={async () => { try { const r = await auto(); toast.success(`${r.matched} matched, ${r.duplicates} duplicates`); refresh(); } catch (e) { toast.error(errMsg(e)); } }}>Run auto-match</Button><UploadDialog onDone={refresh} /></div>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Unmatched" value={inr(g("unmatched").amount)} hint={`${g("unmatched").count} receipts`} tone={g("unmatched").count ? "warning" : "default"} />
        <StatCard label="Matched" value={inr(g("matched").amount)} hint={`${g("matched").count} receipts`} tone="positive" />
        <StatCard label="Short / overpaid" value={`${g("short_paid").count} / ${g("overpaid").count}`} />
        <StatCard label="Duplicates" value={g("duplicate").count} />
      </div>
      <Tabs value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
        <TabsList>
          {["unmatched", "matched", "short_paid", "overpaid", "duplicate", "all"].map((k) => <TabsTrigger key={k} value={k}>{k === "all" ? "All" : LABEL[k]}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      <p className="tnum my-2 text-[12px] text-muted-foreground">{isFetching ? "Loading…" : `${data?.total ?? 0} receipts`}</p>
      {!data?.rows.length ? <EmptyState title="No receipts here" description="Upload a bank statement (Excel or CSV) with date, amount and UTR columns." /> : (
        <DataTable head={["Date", "Amount", "UTR", "Payer / narration", "Hospital", "Claim", "Variance", "Status", ""]}>
          {data.rows.map((r: any) => (
            <tr key={r.id} className={tr}>
              <td className={`${td} tnum`}>{fmtDate(r.receipt_date)}</td>
              <td className={`${td} tnum`}>{inr(r.amount)}</td>
              <td className={`${td} tnum`}>{r.utr_number ?? "—"}</td>
              <td className={`${td} max-w-56 truncate text-muted-foreground`}>{[r.payer_name, r.narration].filter(Boolean).join(" · ") || "—"}</td>
              <td className={`${td} text-muted-foreground`}>{r.hospitals?.name}</td>
              <td className={td}>{r.claim_id ? <Link to="/claims/$claimId" params={{ claimId: r.claim_id }} className="tnum text-primary hover:underline">{r.claims?.claim_code}</Link> : "—"}</td>
              <td className={cn(td, "tnum", r.variance < -1 && "text-risk")}>{r.variance != null ? inr(r.variance) : "—"}</td>
              <td className={td}><Chip value={CHIP[r.match_status] ?? "open"} label={`${LABEL[r.match_status]}${r.match_method === "auto_utr" ? " · auto" : ""}`} /></td>
              <td className={`${td} text-right`}><RowActions r={r} onDone={refresh} /></td>
            </tr>
          ))}
        </DataTable>
      )}
      <Pager page={page} total={data?.total ?? 0} pageSize={data?.pageSize ?? 25} onPage={setPage} />
    </div>
  );
}

function RowActions({ r, onDone }: { r: any; onDone: () => void }) {
  const set = useServerFn(setReceiptStatus);
  const act = async (action: "unmatch" | "duplicate") => {
    try { await set({ data: { receiptId: r.id, action } }); toast.success(action === "unmatch" ? "Unmatched — any payment already recorded stays on the claim" : "Marked duplicate"); onDone(); } catch (e) { toast.error(errMsg(e)); }
  };
  if (r.match_status === "unmatched") return <div className="flex justify-end gap-1"><MatchDialog r={r} onDone={onDone} /><Button size="sm" variant="ghost" onClick={() => act("duplicate")}>Duplicate</Button></div>;
  return <Button size="sm" variant="ghost" onClick={() => act("unmatch")}>Unmatch</Button>;
}

function MatchDialog({ r, onDone }: { r: any; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tds, setTds] = useState("0");
  const [busy, setBusy] = useState(false);
  const cand = useServerFn(matchCandidates);
  const match = useServerFn(matchReceipt);
  const { data, isFetching } = useQuery({ queryKey: ["match-cand", r.id, search], queryFn: () => cand({ data: { receiptId: r.id, search } }), enabled: open });
  async function pick(claimId: string) {
    setBusy(true);
    try {
      const res = await match({ data: { receiptId: r.id, claimId, tds_amount: Number(tds || 0) } });
      toast.success(`${LABEL[res.status]} — claim is now ${res.claimStatus.replace("_", " ")}${Math.abs(res.variance) >= 1 ? ` (variance ${inr(res.variance)})` : ""}`);
      setOpen(false); onDone();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline">Match</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Match {inr(r.amount)} received {fmtDate(r.receipt_date)}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-[1fr_160px] gap-3">
          <div><Label>Search claim ID or payer claim number</Label><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Closest amounts are shown first" /></div>
          <div><Label>TDS deducted (₹)</Label><Input inputMode="decimal" value={tds} onChange={(e) => setTds(e.target.value)} /></div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {isFetching && !data ? <p className="text-[12px] text-muted-foreground">Loading…</p> : !data?.length ? <EmptyState title="No approved claims with money outstanding" /> : (
            <DataTable head={["Claim", "Patient", "Payer", "Outstanding", "Difference", ""]}>
              {data.map((c: any) => (
                <tr key={c.id} className={tr}>
                  <td className={`${td} tnum`}>{c.claim_code}<p className="text-[11px] text-muted-foreground">{c.external_claim_no}</p></td>
                  <td className={td}>{c.patients?.full_name}</td>
                  <td className={`${td} max-w-32 truncate text-muted-foreground`}>{c.payer}</td>
                  <td className={`${td} tnum`}>{inr(c.outstanding)}</td>
                  <td className={cn(td, "tnum", c.diff < 1 && "text-positive")}>{inr(c.diff)}</td>
                  <td className={`${td} text-right`}><Button size="sm" disabled={busy} onClick={() => pick(c.id)}>Match</Button></td>
                </tr>
              ))}
            </DataTable>
          )}
        </div>
        <p className="text-[12px] text-muted-foreground">Matching records this receipt as a payment on the claim. If it covers less than what is owed, the claim becomes short paid and a recovery record opens.</p>
      </DialogContent>
    </Dialog>
  );
}

const pick = (row: Record<string, unknown>, keys: string[]) => {
  for (const [k, v] of Object.entries(row)) if (keys.some((x) => k.toLowerCase().replace(/[^a-z]/g, "").includes(x))) return v;
  return null;
};
const toIso = (v: unknown) => {
  if (v instanceof Date && !isNaN(v.getTime())) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/); if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return null;
};

function UploadDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [hospitalId, setHospitalId] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [bad, setBad] = useState<string[]>([]);
  const [file, setFile] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: hosp } = useQuery({ ...hospitalsQuery({ page: 1 }), enabled: open });
  const imp = useServerFn(importReceipts);

  async function read(f: File) {
    const wb = XLSX.read(await f.arrayBuffer(), { cellDates: true });
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]!]!, { defval: null, raw: true });
    const ok: any[] = [], errs: string[] = [];
    raw.forEach((r, i) => {
      const date = toIso(pick(r, ["date", "valuedate", "txndate"]));
      const amtRaw = pick(r, ["credit", "deposit", "amount"]);
      const amount = Number(String(amtRaw ?? "").replace(/[,₹\s]/g, ""));
      if (!date || !(amount > 0)) { if (amtRaw !== null || date) errs.push(`Row ${i + 2}: needs a valid date and a credit amount`); return; }
      ok.push({ receipt_date: date, amount, utr_number: pick(r, ["utr", "reference", "refno", "chequeno"])?.toString().trim() || null, payer_name: pick(r, ["payer", "party", "remitter"])?.toString() || null, narration: pick(r, ["narration", "description", "particular", "remark"])?.toString().slice(0, 500) || null });
    });
    setRows(ok); setBad(errs); setFile(f.name);
  }
  async function go() {
    if (!hospitalId) { toast.error("Choose the hospital this bank account belongs to."); return; }
    setBusy(true);
    try {
      const r = await imp({ data: { hospitalId, fileName: file, rows } });
      toast.success(`${r.inserted} receipts added · ${r.matched} auto-matched · ${r.duplicates} duplicates`);
      setOpen(false); setRows([]); setBad([]); onDone();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm">Upload bank statement</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Upload bank statement</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Hospital</Label>
            <Select value={hospitalId} onValueChange={setHospitalId}><SelectTrigger><SelectValue placeholder="Choose hospital" /></SelectTrigger>
              <SelectContent>{(hosp?.rows ?? []).map((h: any) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label>Excel or CSV file</Label><Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} /></div>
          <p className="text-[12px] text-muted-foreground">Columns are detected by name: date, credit/amount, UTR/reference, payer/remitter, narration. Debit-only rows are skipped.</p>
          {file ? <p className="text-[13px]"><b className="tnum">{rows.length}</b> credits ready{bad.length ? <>, <span className="text-risk">{bad.length} rows skipped</span></> : null}</p> : null}
          {bad.length ? <div className="max-h-28 overflow-y-auto text-[12px] text-risk">{bad.slice(0, 20).map((b) => <p key={b}>{b}</p>)}</div> : null}
        </div>
        <DialogFooter><Button onClick={go} disabled={busy || !rows.length}>{busy ? "Importing…" : `Import ${rows.length} receipts`}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
