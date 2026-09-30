import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { EmptyState, PageHeader } from "@/components/rcm/app-shell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { auditQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/audit")({
  loader: ({ context }) => context.queryClient.ensureQueryData(auditQuery({ page: 1 })),
  head: () => ({
    meta: [
      { title: "Audit log — RCM Buddy" },
      { name: "description", content: "Every change on the platform: who, when, what and where. Read-only." },
      { property: "og:title", content: "Audit log — RCM Buddy" },
      { property: "og:description", content: "Tamper-proof change history." },
    ],
  }),
  component: Audit,
});

const MODULES = ["hospitals", "hospital_groups", "branches", "departments", "teams", "user_roles", "user_scopes", "insurers", "tpas", "tpa_spocs", "master_list_items", "onboarding_steps", "profiles"];

function Audit() {
  const [page, setPage] = useState(1);
  const [module, setModule] = useState("all");
  const params = { page, module: module === "all" ? undefined : module };
  const { data } = useQuery({ ...auditQuery(params), placeholderData: (p) => p });
  const rows = data?.rows ?? [];
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 50)));

  return (
    <div>
      <PageHeader title="Audit log" description="Written automatically by the database. No one can edit or delete entries from the app." />
      <div className="mb-3 flex items-center gap-2">
        <Select value={module} onValueChange={(v) => { setModule(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All areas</SelectItem>
            {MODULES.map((m) => <SelectItem key={m} value={m}>{m.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="tnum text-[12px] text-muted-foreground">{data?.total ?? 0} entries</span>
      </div>
      {rows.length === 0 ? <EmptyState title="No changes recorded" description="Changes appear here as soon as anyone edits data." /> : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">When</th><th className="px-3 py-2 font-medium">Who</th>
                <th className="px-3 py-2 font-medium">Area</th><th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Record</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="tnum px-3 py-2 text-muted-foreground">{new Date(r.created_at).toLocaleString("en-IN")}</td>
                  <td className="px-3 py-2">{r.actor_name ?? "System"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.module.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.action}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.record_label ?? r.record_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 ? (
        <div className="mt-3 flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="tnum text-[12px] text-muted-foreground">Page {page} of {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      ) : null}
    </div>
  );
}
