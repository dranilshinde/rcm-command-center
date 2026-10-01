import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/rcm/app-shell";
import { Chip, DataTable, Pager, errMsg, fmtDate, td, tr } from "@/components/rcm/claims-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { decidePreauth } from "@/lib/claims.functions";
import { inr } from "@/lib/claims-domain";
import { preauthsQuery } from "@/lib/claims-queries";

export const Route = createFileRoute("/_authenticated/preauth")({
  head: () => ({
    meta: [
      { title: "Pre-Authorisation — RCM Buddy" },
      { name: "description", content: "Track cashless pre-auth requests, queries, approvals and rejections." },
      { property: "og:title", content: "Pre-Authorisation — RCM Buddy" },
      { property: "og:description", content: "Cashless pre-auth tracking for your hospitals." },
    ],
  }),
  component: Preauths,
});

function Preauths() {
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const { data, isFetching, error } = useQuery({ ...preauthsQuery({ status, page }), placeholderData: (p) => p });
  const rows = data?.rows ?? [];
  return (
    <div>
      <PageHeader title="Pre-Authorisation" description="Requests are raised from an admission. Record the payer's decision here." />
      <div className="mb-3 flex items-center gap-2">
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem><SelectItem value="requested">Requested</SelectItem>
            <SelectItem value="query">Query</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <span className="tnum text-[12px] text-muted-foreground">{isFetching ? "Loading…" : `${data?.total ?? 0} requests`}</span>
      </div>
      {error ? <EmptyState title="Could not load pre-auths" description={(error as Error).message} /> :
        rows.length === 0 ? <EmptyState title="No pre-auth requests" description="Open Admissions and use “Pre-auth” on a patient to record a request." /> : (
          <DataTable head={["Patient", "IP no.", "Hospital", "Payer", "Type", "Requested", "Approved", "Raised", "Status", ""]}>
            {rows.map((p) => (
              <tr key={p.id} className={tr}>
                <td className={`${td} font-medium`}>{p.admissions?.patients?.full_name}</td>
                <td className={`${td} tnum`}>{p.admissions?.ip_number ?? "—"}</td>
                <td className={`${td} text-muted-foreground`}>{p.admissions?.hospitals?.name}</td>
                <td className={`${td} text-muted-foreground`}>{p.admissions?.tpas?.name ?? p.admissions?.insurers?.name ?? "—"}</td>
                <td className={`${td} capitalize`}>{p.kind}</td>
                <td className={`${td} tnum`}>{inr(p.requested_amount)}</td>
                <td className={`${td} tnum`}>{p.approved_amount != null ? inr(p.approved_amount) : "—"}</td>
                <td className={`${td} tnum text-muted-foreground`}>{fmtDate(p.requested_at)}</td>
                <td className={td}><Chip value={p.status} /></td>
                <td className={`${td} text-right`}><DecideDialog p={p} /></td>
              </tr>
            ))}
          </DataTable>
        )}
      <Pager page={page} total={data?.total ?? 0} pageSize={data?.pageSize ?? 25} onPage={setPage} />
    </div>
  );
}

function DecideDialog({ p }: { p: { id: string; status: string; approved_amount: number | null; requested_amount: number; remarks: string | null } }) {
  const qc = useQueryClient();
  const decide = useServerFn(decidePreauth);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(p.status as "requested" | "query" | "approved" | "rejected");
  const [amount, setAmount] = useState(String(p.approved_amount ?? p.requested_amount));
  const [remarks, setRemarks] = useState(p.remarks ?? "");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      await decide({ data: { preauthId: p.id, status, approved_amount: status === "approved" ? Number(amount) : null, remarks: remarks || null } });
      toast.success("Pre-auth updated");
      ["preauths", "admissions", "claims"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setOpen(false);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline" className="h-7">Update</Button></DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Payer decision</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="requested">Requested</SelectItem><SelectItem value="query">Query raised</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent>
            </Select>
          </div>
          {status === "approved" ? <div><Label>Approved amount (₹)</Label><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></div> : null}
          <div><Label>Remarks</Label><Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
