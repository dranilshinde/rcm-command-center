import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader, StatusChip } from "@/components/rcm/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { groupsQuery, organizationsQuery, sessionQuery } from "@/lib/queries";
import { createHospitalGroup } from "@/lib/rcm.functions";

export const Route = createFileRoute("/_authenticated/hospital-groups")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(groupsQuery),
      context.queryClient.ensureQueryData(organizationsQuery),
    ]),
  head: () => ({
    meta: [
      { title: "Hospital groups — RCM Buddy" },
      { name: "description", content: "Manage hospital groups and the organisations they belong to." },
      { property: "og:title", content: "Hospital groups — RCM Buddy" },
      { property: "og:description", content: "Manage hospital groups across the RCM Buddy platform." },
    ],
  }),
  component: HospitalGroups,
});

function HospitalGroups() {
  const { data: groups } = useSuspenseQuery(groupsQuery);
  const { data: orgs } = useSuspenseQuery(organizationsQuery);
  const { data: session } = useSuspenseQuery(sessionQuery);
  const canCreate = session.permissions.includes("hospitals.EDIT") || session.isSuperAdmin;

  return (
    <div>
      <PageHeader
        title="Hospital groups"
        description="Groups sit between an organisation and its hospitals, and drive group-level reporting."
        actions={canCreate ? <NewGroupDialog organizations={orgs.filter((o) => o.org_type === "customer")} /> : null}
      />

      {groups.length === 0 ? (
        <EmptyState title="No hospital groups yet" description="Create a group to start adding hospitals under it." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Group</th>
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Organisation</th>
                <th className="px-3 py-2 font-medium">Headquarters</th>
                <th className="px-3 py-2 font-medium">Hospitals</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{g.name}</td>
                  <td className="tnum px-3 py-2 text-muted-foreground">{g.code}</td>
                  <td className="px-3 py-2 text-muted-foreground">{g.organization_name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{g.headquarters_city ?? "—"}</td>
                  <td className="tnum px-3 py-2">{g.hospital_count}</td>
                  <td className="px-3 py-2"><StatusChip status={g.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NewGroupDialog({ organizations }: { organizations: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ organization_id: "", name: "", code: "", headquarters_city: "" });
  const [busy, setBusy] = useState(false);
  const create = useServerFn(createHospitalGroup);
  const qc = useQueryClient();

  async function submit() {
    if (!form.organization_id || !form.name || !form.code) {
      toast.error("Organisation, name and code are required.");
      return;
    }
    setBusy(true);
    try {
      await create({ data: form });
      toast.success("Hospital group created.");
      setOpen(false);
      setForm({ organization_id: "", name: "", code: "", headquarters_city: "" });
      qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "We could not create the group.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">New group</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New hospital group</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Organisation</Label>
            <Select value={form.organization_id} onValueChange={(v) => setForm({ ...form, organization_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select an organisation" /></SelectTrigger>
              <SelectContent>
                {organizations.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Group name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Group code</Label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          </div>
          <div className="space-y-1.5">
            <Label>Headquarters city</Label>
            <Input value={form.headquarters_city} onChange={(e) => setForm({ ...form, headquarters_city: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Create group"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
