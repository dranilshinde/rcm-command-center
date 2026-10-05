import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/rcm/app-shell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getRoleMatrix, resetHospitalRole, setRolePermission } from "@/lib/access.functions";
import { describeAccess } from "@/lib/access";
import { sessionQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/roles")({
  loader: ({ context }) => context.queryClient.ensureQueryData(sessionQuery),
  head: () => ({
    meta: [
      { title: "Roles & permissions — RCM Buddy" },
      { name: "description", content: "Decide what each role can do: which claims they edit, which queues they assign and which pages are locked." },
      { property: "og:title", content: "Roles & permissions — RCM Buddy" },
      { property: "og:description", content: "The RCM Buddy role and permission rules." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RolesPage,
});

const ACTIONS = ["VIEW", "CREATE", "EDIT", "DELETE", "ASSIGN", "REASSIGN", "APPROVE", "EXPORT", "IMPORT", "ESCALATE", "CLOSE", "CONFIGURE"];
const DEFAULT = "__default";
const STAFF = ["hospital", "branch", "team"];

function RolesPage() {
  const { data: session } = useSuspenseQuery(sessionQuery);
  const [scope, setScope] = useState(session.isSuperAdmin ? DEFAULT : session.hospitals[0]?.id ?? DEFAULT);
  const hospitalId = scope === DEFAULT ? null : scope;
  const fetchMatrix = useServerFn(getRoleMatrix);
  const setPerm = useServerFn(setRolePermission);
  const reset = useServerFn(resetHospitalRole);
  const m = useQuery({ queryKey: ["role-matrix", hospitalId], queryFn: () => fetchMatrix({ data: { hospitalId } }) });
  const [roleId, setRoleId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const roles = (m.data?.roles ?? []).filter((r) => !hospitalId || (STAFF.includes(r.role_level)));
  const role = roles.find((r) => r.id === roleId) ?? roles[0];
  const rid = role?.id ?? "";
  const editableRole = !!role && (!hospitalId || role.key !== "hospital_admin");
  const canEdit = !!m.data?.canEdit && editableRole;

  const def = new Set((m.data?.defaults ?? []).filter((x) => x.role_id === rid).map((x) => x.permission_id));
  const ov = new Map((m.data?.overrides ?? []).filter((x) => x.role_id === rid).map((x) => [x.permission_id, x.allowed]));
  const effective = (pid: string) => (ov.has(pid) ? !!ov.get(pid) : def.has(pid));
  const perms = m.data?.permissions ?? [];
  const modules = Array.from(new Set(perms.map((p) => p.module))).sort();
  const effKeys = perms.filter((p) => effective(p.id)).map((p) => `${p.module}.${p.action}`);
  const summary = describeAccess(effKeys, false);

  async function toggle(pid: string) {
    if (!canEdit) return;
    setBusy(pid);
    try { await setPerm({ data: { hospitalId, roleId: rid, permissionId: pid, allowed: !effective(pid) } }); await m.refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not change this rule."); }
    finally { setBusy(null); }
  }

  return (
    <div>
      <PageHeader title="Roles & permissions"
        description="Rules are enforced in the database. Super Admins set the defaults; each hospital admin can adjust them for their own staff." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger className="h-9 w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT}>Default rules (all hospitals)</SelectItem>
            {session.hospitals.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={rid} onValueChange={setRoleId}>
          <SelectTrigger className="h-9 w-72"><SelectValue placeholder="Select a role" /></SelectTrigger>
          <SelectContent>{roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
        </Select>
        {hospitalId && canEdit && ov.size ? (
          <Button size="sm" variant="outline" onClick={async () => { await reset({ data: { hospitalId, roleId: rid } }); await m.refetch(); toast.success("Back to default rules."); }}>
            Reset to defaults ({ov.size} change{ov.size === 1 ? "" : "s"})
          </Button>) : null}
      </div>

      {m.isLoading ? <p className="text-[13px] text-muted-foreground">Loading rules…</p> : role ? (
        <>
          <section className="mb-4 grid gap-3 md:grid-cols-3 text-[13px]">
            <div className="rounded-lg border border-border bg-card p-3"><p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Claims</p>{summary.claims}</div>
            <div className="rounded-lg border border-border bg-card p-3"><p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Work queue</p>{summary.queue}</div>
            <div className="rounded-lg border border-border bg-card p-3"><p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Locked pages</p>{summary.locked.length ? summary.locked.join(", ") : "None"}</div>
          </section>
          <p className="mb-2 text-[12px] text-muted-foreground">
            {canEdit ? "Click a dot to allow or block. " : m.data?.canEdit ? "This role can't be changed per hospital. " : "View only — you can't change these rules. "}
            {hospitalId ? "A red ring means this hospital differs from the default." : ""}
          </p>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-[12px]">
              <thead><tr className="border-b border-border bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="sticky left-0 bg-muted/40 px-3 py-2 font-medium">Module</th>
                {ACTIONS.map((a) => <th key={a} className="px-1.5 py-2 text-center font-medium">{a}</th>)}
              </tr></thead>
              <tbody>{modules.map((mod) => (
                <tr key={mod} className="border-b border-border/60 last:border-0">
                  <td className="sticky left-0 bg-card px-3 py-1.5 font-medium capitalize">{mod.replace(/_/g, " ")}</td>
                  {ACTIONS.map((a) => {
                    const p = perms.find((x) => x.module === mod && x.action === a);
                    if (!p) return <td key={a} />;
                    const on = effective(p.id);
                    return (
                      <td key={a} className="px-1.5 py-1.5 text-center">
                        <button type="button" disabled={!canEdit || busy === p.id} onClick={() => toggle(p.id)}
                          title={`${on ? "Allowed" : "Not allowed"}${ov.has(p.id) ? " (changed for this hospital)" : ""}`}
                          aria-label={`${mod} ${a}`}
                          className={cn("inline-block h-3 w-3 rounded-full", on ? "bg-positive" : "bg-muted-foreground/20",
                            ov.has(p.id) && "ring-2 ring-primary ring-offset-1", canEdit && "cursor-pointer hover:scale-125")} />
                      </td>);
                  })}
                </tr>))}</tbody>
            </table>
          </div>
        </>
      ) : <p className="text-[13px] text-muted-foreground">No roles to show.</p>}
    </div>
  );
}
