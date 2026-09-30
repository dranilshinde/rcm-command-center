import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useQuery, useSuspenseQuery } from "@tanstack/react-query";
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
import { groupsQuery, hospitalsQuery, organizationsQuery, sessionQuery } from "@/lib/queries";
import { createHospital } from "@/lib/rcm.functions";

export const Route = createFileRoute("/_authenticated/hospitals/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(hospitalsQuery({ page: 1 })),
  head: () => ({
    meta: [
      { title: "Hospitals — RCM Buddy" },
      { name: "description", content: "Every hospital in your network with branches, status and go-live date." },
      { property: "og:title", content: "Hospitals — RCM Buddy" },
      { property: "og:description", content: "Every hospital in your RCM Buddy network." },
    ],
  }),
  component: Hospitals,
});

function Hospitals() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const params = search ? { search, status, page } : { status, page };
  const { data, isFetching } = useQuery({ ...hospitalsQuery(params), placeholderData: (p) => p });
  const { data: session } = useSuspenseQuery(sessionQuery);
  const canCreate = session.permissions.includes("hospitals.CREATE") || session.isSuperAdmin;

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 25;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <PageHeader
        title="Hospitals"
        description="Only hospitals you have been given access to are listed."
        actions={canCreate ? <NewHospitalDialog /> : null}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search by name, code or city"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="h-9 max-w-xs"
        />
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="onboarding">Onboarding</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <span className="tnum text-[12px] text-muted-foreground">
          {isFetching ? "Loading…" : `${total} hospital${total === 1 ? "" : "s"}`}
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No hospitals match this filter"
          description="Try a different search term or status, or add a new hospital."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Hospital</th>
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Group</th>
                <th className="px-3 py-2 font-medium">City</th>
                <th className="px-3 py-2 font-medium">Beds</th>
                <th className="px-3 py-2 font-medium">Branches</th>
                <th className="px-3 py-2 font-medium">Go live</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">
                    <Link to="/hospitals/$hospitalId" params={{ hospitalId: h.id }} className="hover:underline">
                      {h.name}
                    </Link>
                  </td>
                  <td className="tnum px-3 py-2 text-muted-foreground">{h.code}</td>
                  <td className="px-3 py-2 text-muted-foreground">{h.group_name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{h.city ?? "—"}</td>
                  <td className="tnum px-3 py-2">{h.bed_count ?? "—"}</td>
                  <td className="tnum px-3 py-2">{h.branch_count}</td>
                  <td className="tnum px-3 py-2 text-muted-foreground">{h.go_live_date ?? "—"}</td>
                  <td className="px-3 py-2"><StatusChip status={h.status} /></td>
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

function NewHospitalDialog() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: orgs } = useSuspenseQuery(organizationsQuery);
  const { data: groups } = useSuspenseQuery(groupsQuery);
  const create = useServerFn(createHospital);
  const qc = useQueryClient();
  const [form, setForm] = useState({
    organization_id: "", hospital_group_id: "", name: "", code: "", city: "", state: "", bed_count: "",
  });

  async function submit() {
    if (!form.organization_id || !form.name || !form.code) {
      toast.error("Organisation, name and code are required.");
      return;
    }
    setBusy(true);
    try {
      await create({
        data: {
          organization_id: form.organization_id,
          hospital_group_id: form.hospital_group_id || null,
          name: form.name,
          code: form.code,
          city: form.city,
          state: form.state,
          bed_count: form.bed_count ? Number(form.bed_count) : null,
        },
      });
      toast.success("Hospital created with its onboarding checklist.");
      setOpen(false);
      qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "We could not create the hospital.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm">New hospital</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New hospital</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Organisation</Label>
            <Select value={form.organization_id} onValueChange={(v) => setForm({ ...form, organization_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select an organisation" /></SelectTrigger>
              <SelectContent>
                {orgs.filter((o) => o.org_type === "customer").map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Hospital group</Label>
            <Select value={form.hospital_group_id} onValueChange={(v) => setForm({ ...form, hospital_group_id: v })}>
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Code</Label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></div>
          <div className="space-y-1.5"><Label>City</Label>
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>State</Label>
            <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Beds</Label>
            <Input type="number" value={form.bed_count} onChange={(e) => setForm({ ...form, bed_count: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Create hospital"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
