import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/rcm/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sessionQuery } from "@/lib/queries";
import { updateOwnProfile } from "@/lib/rcm.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — RCM Buddy" },
      { name: "description", content: "Your profile and availability." },
      { property: "og:title", content: "Settings — RCM Buddy" },
      { property: "og:description", content: "Your profile and availability." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: session } = useSuspenseQuery(sessionQuery);
  const p = session.profile;
  const [form, setForm] = useState({
    full_name: p?.full_name ?? "", phone: "", job_title: p?.job_title ?? "", availability: p?.availability ?? "available",
  });
  const [busy, setBusy] = useState(false);
  const save = useServerFn(updateOwnProfile);
  const qc = useQueryClient();

  async function submit() {
    setBusy(true);
    try { await save({ data: form }); qc.invalidateQueries(); toast.success("Profile saved."); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not save."); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="Settings" description={`Signed in as ${p?.email ?? ""}. Roles: ${session.roles.join(", ") || "none"}.`} />
      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="space-y-1.5"><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Job title</Label><Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Availability</Label>
          <Select value={form.availability} onValueChange={(v) => setForm({ ...form, availability: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="busy">Busy</SelectItem>
              <SelectItem value="on_leave">On leave</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save profile"}</Button>
      </div>
    </div>
  );
}
