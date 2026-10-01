import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader, StatCard } from "@/components/rcm/app-shell";
import { ADMIN_ROLE_LABEL } from "@/components/rcm/setup-editors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listInvitations, resendInvitation, revokeInvitation } from "@/lib/setup.functions";
import { sessionQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/invitations")({
  head: () => ({
    meta: [
      { title: "Admin invitations — RCM Buddy" },
      { name: "description", content: "Track hospital admin invitations, resend pending ones and revoke those no longer needed." },
      { property: "og:title", content: "Admin invitations — RCM Buddy" },
      { property: "og:description", content: "Manage hospital admin invitations." },
    ],
  }),
  component: Invitations,
});

const CHIP: Record<string, string> = {
  pending: "border-warning/50 bg-warning/10 text-warning",
  accepted: "border-positive/40 bg-positive/10 text-positive",
  revoked: "border-border bg-muted text-muted-foreground",
};

function Invitations() {
  const { data: session } = useSuspenseQuery(sessionQuery);
  const canManage = session.isSuperAdmin || session.permissions.includes("users.ASSIGN");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const list = useServerFn(listInvitations);
  const resend = useServerFn(resendInvitation);
  const revoke = useServerFn(revokeInvitation);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["invitations"], queryFn: () => list({ data: {} }) });

  const all = data ?? [];
  const q = search.trim().toLowerCase();
  const rows = all.filter((r) => (status === "all" || r.status === status) &&
    (!q || r.email.includes(q) || r.full_name.toLowerCase().includes(q) || r.hospital_name.toLowerCase().includes(q)));

  async function act(id: string, kind: "resend" | "revoke", label: string) {
    if (kind === "revoke" && !confirm(`Revoke the invitation for ${label}? Their access to the hospital will be removed.`)) return;
    setBusyId(id);
    try {
      if (kind === "resend") await resend({ data: { id, redirectTo: `${window.location.origin}/auth` } });
      else await revoke({ data: { id } });
      toast.success(kind === "resend" ? "Invitation email sent again." : "Invitation revoked.");
      qc.invalidateQueries({ queryKey: ["invitations"] });
      qc.invalidateQueries({ queryKey: ["hospital-admins"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
      qc.invalidateQueries({ queryKey: ["invitations"] });
    } finally { setBusyId(null); }
  }

  return (
    <div>
      <PageHeader title="Admin invitations" description="An invitation counts as accepted once the person signs in for the first time." />
      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Pending" value={all.filter((r) => r.status === "pending").length} tone="warning" />
        <StatCard label="Accepted" value={all.filter((r) => r.status === "accepted").length} tone="positive" />
        <StatCard label="Revoked" value={all.filter((r) => r.status === "revoked").length} />
      </section>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input className="h-9 max-w-xs" placeholder="Search name, email or hospital" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="revoked">Revoked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <p className="text-[13px] text-muted-foreground">Loading invitations…</p>
        : error ? <EmptyState title="Invitations could not be loaded" description={error.message} />
        : rows.length === 0 ? (
          <EmptyState title={all.length ? "No invitations match this filter" : "No invitations yet"}
            description="Invitations are created when you add admin users in onboarding or on a hospital's Admin users tab."
            action={<Button size="sm" asChild><Link to="/onboarding">Start onboarding</Link></Button>} />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-[13px]">
              <thead><tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Person</th><th className="px-3 py-2 font-medium">Hospital</th>
                <th className="px-3 py-2 font-medium">Role</th><th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Last sent</th><th className="px-3 py-2 font-medium">Sent</th>
                {canManage ? <th className="px-3 py-2" /> : null}
              </tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2"><p className="font-medium">{r.full_name || "—"}</p><p className="text-[12px] text-muted-foreground">{r.email}</p></td>
                  <td className="px-3 py-2">
                    <Link to="/hospitals/$hospitalId" params={{ hospitalId: r.hospital_id }} className="hover:underline">{r.hospital_name}</Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{ADMIN_ROLE_LABEL[r.role_key] ?? r.role_key}</td>
                  <td className="px-3 py-2">
                    <span className={cn("inline-flex rounded border px-1.5 py-0.5 text-[11px] font-medium capitalize", CHIP[r.status])}>{r.status}</span>
                    {r.status === "accepted" && r.accepted_at ? <p className="tnum text-[11px] text-muted-foreground">{new Date(r.accepted_at).toLocaleDateString("en-IN")}</p> : null}
                  </td>
                  <td className="tnum px-3 py-2 text-muted-foreground">{new Date(r.last_sent_at).toLocaleString("en-IN")}</td>
                  <td className="tnum px-3 py-2">{r.send_count}×</td>
                  {canManage ? (
                    <td className="px-3 py-2 text-right">
                      {r.status === "pending" ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => act(r.id, "resend", r.email)}>Resend</Button>
                          <Button size="sm" variant="outline" className="text-risk" disabled={busyId === r.id} onClick={() => act(r.id, "revoke", r.email)}>Revoke</Button>
                        </div>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
    </div>
  );
}
