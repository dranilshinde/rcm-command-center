import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/rcm/app-shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { rolesQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/roles")({
  loader: ({ context }) => context.queryClient.ensureQueryData(rolesQuery),
  head: () => ({
    meta: [
      { title: "Roles & permissions — RCM Buddy" },
      { name: "description", content: "The permission matrix: what each role can do in each module." },
      { property: "og:title", content: "Roles & permissions — RCM Buddy" },
      { property: "og:description", content: "The RCM Buddy role and permission matrix." },
    ],
  }),
  component: RolesPage,
});

const ACTIONS = ["VIEW", "CREATE", "EDIT", "DELETE", "ASSIGN", "APPROVE", "EXPORT", "ESCALATE", "CLOSE", "CONFIGURE"];

function RolesPage() {
  const { data } = useSuspenseQuery(rolesQuery);
  const [roleId, setRoleId] = useState(data.roles[0]?.id ?? "");
  const role = data.roles.find((r) => r.id === roleId);
  const granted = new Set(
    data.rolePermissions.filter((rp) => rp.role_id === roleId).map((rp) => rp.permission_id),
  );
  const modules = Array.from(new Set(data.permissions.map((p) => p.module))).sort();

  return (
    <div>
      <PageHeader
        title="Roles & permissions"
        description="Permissions are stored per role and enforced in the database, not just hidden in the interface."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={roleId} onValueChange={setRoleId}>
          <SelectTrigger className="h-9 w-72"><SelectValue placeholder="Select a role" /></SelectTrigger>
          <SelectContent>
            {data.roles.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.name} · {r.role_level}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {role ? <p className="text-[13px] text-muted-foreground">{role.description}</p> : null}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="sticky left-0 bg-muted/40 px-3 py-2 font-medium">Module</th>
              {ACTIONS.map((a) => <th key={a} className="px-2 py-2 text-center font-medium">{a}</th>)}
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => (
              <tr key={m} className="border-b border-border/60 last:border-0">
                <td className="sticky left-0 bg-card px-3 py-1.5 font-medium capitalize">{m.replace(/_/g, " ")}</td>
                {ACTIONS.map((a) => {
                  const perm = data.permissions.find((p) => p.module === m && p.action === a);
                  const has = perm ? granted.has(perm.id) : false;
                  return (
                    <td key={a} className="px-2 py-1.5 text-center">
                      <span
                        className={cn(
                          "inline-block h-2.5 w-2.5 rounded-full",
                          has ? "bg-positive" : "bg-muted-foreground/20",
                        )}
                        title={has ? "Allowed" : "Not allowed"}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-muted-foreground">
        Filled dots mean the role is allowed to perform that action. Editing the matrix arrives with the
        configuration engine in a later phase.
      </p>
    </div>
  );
}
