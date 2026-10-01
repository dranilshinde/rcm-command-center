import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CLAIM_STATUS_LABEL, readinessBand } from "@/lib/claims-domain";
import { cn } from "@/lib/utils";

const TONE = {
  positive: "border-positive/40 bg-positive/10 text-positive",
  warning: "border-warning/50 bg-warning/10 text-warning",
  risk: "border-risk/40 bg-risk/10 text-risk",
  muted: "border-border bg-muted text-muted-foreground",
  primary: "border-primary/40 bg-primary/10 text-primary",
};

const STATUS_TONE: Record<string, keyof typeof TONE> = {
  draft: "muted", ready: "primary", submitted: "primary", query: "warning", query_replied: "primary",
  approved: "positive", denied: "risk", preauth_rejected: "risk", short_paid: "warning", settled: "positive", closed: "muted",
  requested: "primary", rejected: "risk", admitted: "primary", discharged: "muted",
  open: "primary", in_progress: "warning", waiting: "muted", completed: "positive", cancelled: "muted", escalated: "risk",
  urgent: "risk", high: "warning", normal: "muted", low: "muted",
};

export function Chip({ value, label }: { value: string; label?: string }) {
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] font-medium", TONE[STATUS_TONE[value] ?? "muted"])}>
      {label ?? CLAIM_STATUS_LABEL[value] ?? value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}
    </span>
  );
}

export function ReadinessBadge({ score, compact }: { score: number; compact?: boolean }) {
  const b = readinessBand(score);
  return (
    <span className={cn("tnum inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] font-semibold", TONE[b.tone])}>
      {score}{compact ? null : <span className="font-medium">· {b.label}</span>}
    </span>
  );
}

export function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="mt-3 flex items-center gap-2">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
      <span className="tnum text-[12px] text-muted-foreground">Page {page} of {pages}</span>
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
    </div>
  );
}

export function DataTable({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            {head.map((h, i) => <th key={i} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export const td = "px-3 py-2";
export const tr = "border-b border-border/60 last:border-0 hover:bg-muted/30";

export function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d.length === 10 ? `${d}T00:00:00` : d);
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
