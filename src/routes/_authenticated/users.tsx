import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader, StatCard, StatusChip } from "@/components/rcm/app-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { rolesQuery, sessionQuery, usersQuery } from "@/lib/queries";
import { assignUserRole, grantUserScope } from "@/lib/rcm.functions";

export const Route = createFileRoute("/_authenticated/users")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(usersQuery),
      context.queryClient.ensureQueryData(rolesQuery),
    ]),
  head: () => ({
    meta: [
      { title: "Users & teams — RCM Buddy" },
      { name: "description", content: "People on the platform, the roles they hold and the hospitals they can see." },
      { property: "og:title", content: "Users & teams — RCM Buddy" },
      { property: "og:description", content: "Manage people, roles and hospital access." },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const { data: users } = useSuspenseQuery(usersQuery);
  const { data: session } = useSuspenseQuery(sessionQuery);
  const { data: roleData } = useSuspenseQuery(rolesQuery);
  const canAssign = session.isSuperAdmin || session.permissions.includes("users.ASSIGN");
  const [target, setTarget] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title="Users & access"
        description="Roles decide what a person can do; access scopes decide which hospitals and branches they can see."
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="People" value={users.length} />
        <StatCard label="Platform staff" value={users.filter((u) => u.is_platform_user).length} />
        <StatCard label="On leave" value={users.filter((u) => u.status === "on_leave").length} tone="warning" />
        <StatCard label="Roles available" value={roleData.roles.length} />
      </section>

      {users.length === 0 ? (
        <EmptyState title="No users visible" description="You do not have permission to view the user directory." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Roles</th>
                <th className="px-3 py-2 font-medium">Access</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Availability</th>
                {canAssign ? <th className="px-3 py-2 font-medium">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{u.full_name || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{u.email ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{u.roles.join(", ") || "No role"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {u.scopes.length ? u.scopes.map((s) => s.scope_type).join(", ") : "None"}
                  </td>
                  <td className="px-3 py-2"><StatusChip status={u.status} /></td>
                  <td className="px-3 py-2 text-muted-foreground capitalize">{u.availability}</td>
                  {canAssign ? (
                    <td className="px-3 py-2">
                      <Button size="sm" variant="outline" onClick={() => setTarget(u.id)}>Manage</Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {target ? (
        <ManageAccessDialog
          userId={target}
          onClose={() => setTarget(null)}
          roles={roleData.roles}
          hospitals={session.hospitals}
          groups={session.groups}
        />
      ) : null}
    </div>
  );
}

function ManageAccessDialog({
  userId,
  onClose,
  roles,
  hospitals,
  groups,
}: {
  userId: string;
  onClose: () => void;
  roles: { id: string; name: string; role_level: string }[];
  hospitals: { id: string; name: string }[];
  groups: { id: string; name: string }[];
}) {
  const [roleId, setRoleId] = useState("");
  const [hospitalId, setHospitalId] = useState("");
  const [scopeType, setScopeType] = useState("hospital");
  const [scopeTarget, setScopeTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const assign = useServerFn(assignUserRole);
  const grant = useServerFn(grantUserScope);
  const qc = useQueryClient();

  async function save() {
    setBusy(true);
    try {
      if (roleId) await assign({ data: { userId, roleId, hospitalId: hospitalId || null } });
      if (scopeType && (scopeType === "platform" || scopeTarget)) {
        await grant({
          data: {
            userId,
            scopeType,
            hospitalId: scopeType === "hospital" ? scopeTarget : null,
            groupId: scopeType === "group" ? scopeTarget : null,
          },
        });
      }
      toast.success("Access updated.");
      qc.invalidateQueries();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "We could not update access.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Manage role and access</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Add role</Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
              <SelectContent>
                {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Role applies to hospital (optional)</Label>
            <Select value={hospitalId} onValueChange={setHospitalId}>
              <SelectTrigger><SelectValue placeholder="All hospitals in scope" /></SelectTrigger>
              <SelectContent>
                {hospitals.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Grant access to</Label>
            <Select value={scopeType} onValueChange={(v) => { setScopeType(v); setScopeTarget(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hospital">A hospital</SelectItem>
                <SelectItem value="group">A hospital group</SelectItem>
                <SelectItem value="platform">The whole platform</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scopeType !== "platform" ? (
            <div className="space-y-1.5">
              <Label>{scopeType === "hospital" ? "Hospital" : "Hospital group"}</Label>
              <Select value={scopeTarget} onValueChange={setScopeTarget}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {(scopeType === "hospital" ? hospitals : groups).map((x) => (
                    <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
