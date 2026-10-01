import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/rcm/app-shell";
import { Chip, DataTable, Pager, errMsg, fmtDate, td, tr } from "@/components/rcm/claims-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ROLE_LABEL, inr } from "@/lib/claims-domain";
import { escalationsQuery } from "@/lib/claims-queries";
import { resolveEscalation } from "@/lib/followups.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/escalations")({
  head: () => ({
    meta: [
      { title: "Escalations — RCM Buddy" },
      { name: "description", content: "Claims escalated by age or SLA breach, who was alerted and how they were resolved." },
      { property: "og:title", content: "Escalations — RCM Buddy" },
      { property: "og:description", content: "Escalated claims and SLA breaches." },
    ],
  }),
  component: Escalations,
});


function Escalations() {
  const [status, setStatus] = useState("open");
  const [page, setPage] = useState(1);
  const { data, isFetching, error } = useQuery({ ...escalationsQuery({ status, page }), placeholderData: (p) => p });
  const rows = data?.rows ?? [];
  return (
    <div>
      <PageHeader title="Escalations" description="Raised automatically by the escalation ladder (30 / 60 / 90 days by default) and SLA breaches. Alerts go to the roles set in your rules." />
      <div className="mb-3 flex gap-1">
        {["open", "resolved", "all"].map((s) => (
          <button key={s} onClick={() => { setStatus(s); setPage(1); }} className={cn("rounded-md border px-2.5 py-1 text-[12px] capitalize", status === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted")}>{s}</button>
        ))}
        <span className="tnum ml-2 self-center text-[12px] text-muted-foreground">{isFetching ? "Loading…" : `${data?.total ?? 0} escalations`}</span>
      </div>
      {error ? <EmptyState title="Could not load escalations" description={(error as Error).message} /> :
        rows.length === 0 ? <EmptyState title="No escalations" description="Nothing has crossed an escalation threshold." /> : (
          <DataTable head={["Level", "Claim", "Patient", "Payer", "At stake", "Reason", "Alerted", "Raised", "Status", ""]}>
            {rows.map((e) => (
              <tr key={e.id} className={tr}>
                <td className={td}><Chip value={e.level >= 3 ? "denied" : e.level === 2 ? "escalated" : "query"} label={`L${e.level}`} /></td>
                <td className={td}>{e.claim_id ? <Link to="/claims/$claimId" params={{ claimId: e.claim_id }} className="tnum text-primary hover:underline">{e.claims?.claim_code}</Link> : "—"}</td>
                <td className={td}>{e.claims?.patients?.full_name ?? "—"}</td>
                <td className={`${td} text-muted-foreground`}>{e.claims?.admissions?.tpas?.name ?? e.claims?.admissions?.insurers?.name ?? "—"}</td>
                <td className={`${td} tnum`}>{inr(Math.max(Number(e.claims?.approved_amount ?? 0), Number(e.claims?.claimed_amount ?? 0)))}</td>
                <td className={`${td} max-w-xs`}>{e.reason}{e.resolution_note ? <p className="text-[12px] text-muted-foreground">Resolved: {e.resolution_note}</p> : null}</td>
                <td className={`${td} text-[12px] text-muted-foreground`}>{(e.notified_roles ?? []).map((r: string) => ROLE_LABEL[r] ?? r).join(", ") || "Owner"}</td>
                <td className={`${td} tnum`}>{fmtDate(e.created_at)}</td>
                <td className={td}><Chip value={e.status === "open" ? "escalated" : "completed"} label={e.status === "open" ? "Open" : "Resolved"} /></td>
                <td className={`${td} text-right`}>{e.status === "open" ? <ResolveDialog id={e.id} /> : null}</td>
              </tr>
            ))}
          </DataTable>
        )}
      <Pager page={page} total={data?.total ?? 0} pageSize={data?.pageSize ?? 25} onPage={setPage} />
    </div>
  );
}

function ResolveDialog({ id }: { id: string }) {
  const qc = useQueryClient();
  const resolve = useServerFn(resolveEscalation);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  async function go() {
    try { await resolve({ data: { id, note } }); toast.success("Escalation resolved"); qc.invalidateQueries({ queryKey: ["escalations"] }); qc.invalidateQueries({ queryKey: ["claim"] }); setOpen(false); }
    catch (e) { toast.error(errMsg(e)); }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline" className="h-7">Resolve</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Resolve escalation</DialogTitle></DialogHeader>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was done — e.g. spoke to TPA senior, payment released" />
        <DialogFooter><Button onClick={go} disabled={note.trim().length < 3}>Resolve</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
