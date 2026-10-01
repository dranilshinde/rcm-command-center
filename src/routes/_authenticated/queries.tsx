import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/rcm/app-shell";
import { Chip, DataTable, Pager, errMsg, fmtDate, td, tr } from "@/components/rcm/claims-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { runClaimAction } from "@/lib/claims.functions";
import { inr } from "@/lib/claims-domain";
import { queriesQuery } from "@/lib/claims-queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/queries")({
  head: () => ({
    meta: [
      { title: "Payer Queries — RCM Buddy" },
      { name: "description", content: "Open payer queries with reply deadlines from your SLA rules." },
      { property: "og:title", content: "Payer Queries — RCM Buddy" },
      { property: "og:description", content: "Payer queries and reply deadlines." },
    ],
  }),
  component: Queries,
});

export const QUERY_CATEGORIES: Record<string, string> = {
  documentation: "Documentation", eligibility: "Eligibility", authorization: "Authorisation", coding: "Coding",
  billing: "Billing", tariff: "Tariff", medical_necessity: "Medical necessity", policy_exclusion: "Policy exclusion",
  other: "Other",
};

function Queries() {
  const [view, setView] = useState("open");
  const [page, setPage] = useState(1);
  const { data, isFetching, error } = useQuery({ ...queriesQuery({ view, page }), placeholderData: (p) => p });
  const rows = data?.rows ?? [];
  const now = Date.now();
  const views = [
    ["open", `Open${data ? ` ${data.counts.open}` : ""}`], ["overdue", `Overdue${data ? ` ${data.counts.overdue}` : ""}`], ["replied", "Replied"], ["all", "All"],
  ];
  return (
    <div>
      <PageHeader title="Payer Queries" description="Recorded from a claim with “Record payer query”. The reply deadline comes from your query-response SLA for that payer." />
      <div className="mb-3 flex flex-wrap gap-1">
        {views.map(([k, l]) => (
          <button key={k} onClick={() => { setView(k!); setPage(1); }} className={cn("rounded-md border px-2.5 py-1 text-[12px]", view === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted")}>{l}</button>
        ))}
        <span className="tnum ml-2 self-center text-[12px] text-muted-foreground">{isFetching ? "Loading…" : `${data?.total ?? 0} queries`}</span>
      </div>
      {error ? <EmptyState title="Could not load queries" description={(error as Error).message} /> :
        rows.length === 0 ? <EmptyState title="No queries here" description="When a payer raises a query, record it on the claim page and it appears here." /> : (
          <DataTable head={["Claim", "Patient", "Payer", "Category", "Query", "Raised", "Reply due", "Status", ""]}>
            {rows.map((q) => {
              const overdue = q.status === "open" && q.due_at && new Date(q.due_at).getTime() < now;
              return (
                <tr key={q.id} className={tr}>
                  <td className={td}><Link to="/claims/$claimId" params={{ claimId: q.claim_id }} className="tnum text-primary hover:underline">{q.claims?.claim_code}</Link><p className="tnum text-[11px] text-muted-foreground">{inr(q.claims?.claimed_amount)}</p></td>
                  <td className={td}>{q.claims?.patients?.full_name}</td>
                  <td className={`${td} text-muted-foreground`}>{q.claims?.admissions?.tpas?.name ?? q.claims?.admissions?.insurers?.name ?? "—"}</td>
                  <td className={td}>{QUERY_CATEGORIES[q.category] ?? q.category}</td>
                  <td className={`${td} max-w-sm`}><p className="line-clamp-2">{q.query_text}</p>{q.reply_text ? <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">Reply: {q.reply_text}</p> : null}</td>
                  <td className={`${td} tnum`}>{fmtDate(q.raised_at)}</td>
                  <td className={cn(td, "tnum", overdue && "font-semibold text-risk")}>{fmtDate(q.due_at)}{overdue ? " · overdue" : ""}</td>
                  <td className={td}><Chip value={q.status === "open" ? "query" : "completed"} label={q.status === "open" ? "Open" : "Replied"} /></td>
                  <td className={`${td} text-right`}>{q.status === "open" ? <ReplyDialog claimId={q.claim_id} /> : null}</td>
                </tr>
              );
            })}
          </DataTable>
        )}
      <Pager page={page} total={data?.total ?? 0} pageSize={data?.pageSize ?? 25} onPage={setPage} />
    </div>
  );
}

function ReplyDialog({ claimId }: { claimId: string }) {
  const qc = useQueryClient();
  const run = useServerFn(runClaimAction);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      await run({ data: { claimId, action: "reply_query", note } });
      toast.success("Reply recorded");
      ["queries", "claims", "tasks", "claim"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setOpen(false);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline" className="h-7">Reply</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Record reply sent to payer</DialogTitle></DialogHeader>
        <Label>Reply</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you sent, and which documents" />
        <DialogFooter><Button onClick={go} disabled={busy || !note.trim()}>{busy ? "Saving…" : "Save reply"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
