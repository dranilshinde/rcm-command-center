import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/rcm/app-shell";
import { Chip, DataTable, Pager, errMsg, fmtDate, td, tr } from "@/components/rcm/claims-ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateTasks } from "@/lib/claims.functions";
import { inr } from "@/lib/claims-domain";
import { assigneesQuery, tasksQuery } from "@/lib/claims-queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/work-queue")({
  head: () => ({
    meta: [
      { title: "Work Queue — RCM Buddy" },
      { name: "description", content: "What needs to be done today: claim tasks by owner, due date, priority and value." },
      { property: "og:title", content: "Work Queue — RCM Buddy" },
      { property: "og:description", content: "Claim tasks by owner, due date, priority and value." },
    ],
  }),
  component: WorkQueue,
});

const VIEWS: { key: string; label: string; count?: "mine" | "unassigned" | "overdue" | "due_today" }[] = [
  { key: "mine", label: "My work", count: "mine" },
  { key: "team", label: "Team work" },
  { key: "unassigned", label: "Unassigned", count: "unassigned" },
  { key: "due_today", label: "Due today", count: "due_today" },
  { key: "overdue", label: "Overdue", count: "overdue" },
  { key: "high_priority", label: "High priority" },
  { key: "high_value", label: "High value (₹1L+)" },
  { key: "query", label: "Query pending" },
  { key: "followup", label: "Payer follow-ups" },
  { key: "escalated", label: "Escalated" },
  { key: "completed", label: "Completed" },
];

function WorkQueue() {
  const [view, setView] = useState("mine");
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<string[]>([]);
  const { data, isFetching, error } = useQuery({ ...tasksQuery({ view, page }), placeholderData: (p) => p });
  const rows = data?.rows ?? [];
  const now = Date.now();

  return (
    <div>
      <PageHeader title="Work Queue" description="Tasks are created automatically from claims and your SLA and reminder rules: discharge handover, payer queries, quiet claims, missed commitments, denials and short payments." />
      <div className="mb-3 flex flex-wrap gap-1">
        {VIEWS.map((v) => (
          <button key={v.key} onClick={() => { setView(v.key); setPage(1); setSel([]); }}
            className={cn("rounded-md border px-2.5 py-1 text-[12px]", view === v.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted")}>
            {v.label}{v.count && data ? <span className="tnum ml-1 opacity-75">{data.counts[v.count]}</span> : null}
          </button>
        ))}
        <span className="tnum ml-2 self-center text-[12px] text-muted-foreground">{isFetching ? "Loading…" : `${data?.total ?? 0} tasks`}</span>
      </div>
      {sel.length ? <BulkBar ids={sel} onDone={() => setSel([])} /> : null}
      {error ? <EmptyState title="Could not load the work queue" description={(error as Error).message} /> :
        rows.length === 0 ? <EmptyState title="Nothing here" description="No tasks in this view. Tasks appear when patients are discharged or claims need follow-up." /> : (
          <DataTable head={[
            <Checkbox key="a" checked={sel.length === rows.length} onCheckedChange={(v) => setSel(v ? rows.map((r) => r.id) : [])} aria-label="Select all" />,
            "Task", "Claim", "Hospital", "At stake", "Due", "Priority", "Status", "Owner",
          ]}>
            {rows.map((t) => {
              const overdue = t.due_at && new Date(t.due_at).getTime() < now && !["completed", "cancelled"].includes(t.status);
              return (
                <tr key={t.id} className={tr}>
                  <td className={td}><Checkbox checked={sel.includes(t.id)} onCheckedChange={(v) => setSel(v ? [...sel, t.id] : sel.filter((x) => x !== t.id))} aria-label="Select task" /></td>
                  <td className={`${td} font-medium`}>{t.title}{t.description ? <p className="max-w-md truncate text-[12px] font-normal text-muted-foreground">{t.description}</p> : null}</td>
                  <td className={td}>{t.claim_id ? <Link to="/claims/$claimId" params={{ claimId: t.claim_id }} className="tnum text-primary hover:underline">{t.claims?.claim_code}</Link> : "—"}</td>
                  <td className={`${td} text-muted-foreground`}>{t.hospitals?.name}</td>
                  <td className={`${td} tnum`}>{inr(t.amount_at_stake)}</td>
                  <td className={cn(td, "tnum", overdue && "font-semibold text-risk")}>{fmtDate(t.due_at)}{overdue ? " · overdue" : ""}</td>
                  <td className={td}><Chip value={t.priority} /></td>
                  <td className={td}><Chip value={t.status} />{t.escalation_level ? <span className="ml-1"><Chip value="escalated" label={`L${t.escalation_level}`} /></span> : null}</td>
                  <td className={`${td} text-muted-foreground`}>{t.profiles?.full_name ?? "Unassigned"}</td>
                </tr>
              );
            })}
          </DataTable>
        )}
      <Pager page={page} total={data?.total ?? 0} pageSize={data?.pageSize ?? 25} onPage={(p) => { setPage(p); setSel([]); }} />
    </div>
  );
}

function BulkBar({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const { data: people } = useQuery(assigneesQuery());
  const qc = useQueryClient();
  const update = useServerFn(updateTasks);
  async function apply(patch: { status?: "open" | "in_progress" | "waiting" | "completed" | "cancelled" | "escalated"; assignTo?: string | null }) {
    try {
      const r = await update({ data: { taskIds: ids, ...patch } });
      toast.success(`${r.updated} task${r.updated === 1 ? "" : "s"} updated`);
      qc.invalidateQueries({ queryKey: ["tasks"] }); onDone();
    } catch (e) { toast.error(errMsg(e)); }
  }
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[13px]">
      <span className="font-medium">{ids.length} selected</span>
      <Select onValueChange={(v) => apply({ assignTo: v === "none" ? null : v })}>
        <SelectTrigger className="h-8 w-48"><SelectValue placeholder="Assign to…" /></SelectTrigger>
        <SelectContent><SelectItem value="none">Unassign</SelectItem>{(people ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
      </Select>
      <Button size="sm" variant="outline" onClick={() => apply({ status: "in_progress" })}>Start</Button>
      <Button size="sm" variant="outline" onClick={() => apply({ status: "waiting" })}>Waiting</Button>
      <Button size="sm" variant="outline" onClick={() => apply({ status: "escalated" })}>Escalate</Button>
      <Button size="sm" onClick={() => apply({ status: "completed" })}>Complete</Button>
      <Button size="sm" variant="ghost" onClick={() => apply({ status: "cancelled" })}>Cancel task</Button>
      <Button size="sm" variant="ghost" onClick={onDone}>Clear</Button>
    </div>
  );
}
