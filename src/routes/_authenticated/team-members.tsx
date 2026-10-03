import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/rcm/app-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inviteTeamMembers, listHospitalAdmins } from "@/lib/setup.functions";
import { rolesQuery, sessionQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/team-members")({
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(rolesQuery),
    context.queryClient.ensureQueryData(sessionQuery),
  ]),
  head: () => ({
    meta: [
      { title: "Team members — RCM Buddy" },
      { name: "description", content: "Invite hospital staff in bulk with any role so they can sign in and work claims." },
      { property: "og:title", content: "Team members — RCM Buddy" },
      { property: "og:description", content: "Invite hospital staff in bulk." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamMembers,
});

type Row = { full_name: string; email: string; roleKey: string; error?: string };

function TeamMembers() {
  const { data: session } = useSuspenseQuery(sessionQuery);
  const { data: roleData } = useSuspenseQuery(rolesQuery);
  const canManage = session.isSuperAdmin || session.permissions.includes("users.ASSIGN");
  const staffRoles = useMemo(
    () => roleData.roles.filter((r) => ["hospital", "branch", "team"].includes(r.role_level)),
    [roleData.roles],
  );
  const [hospitalId, setHospitalId] = useState(session.hospitals[0]?.id ?? "");
  const [defaultRole, setDefaultRole] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ email: string; ok: boolean; reason?: string }[] | null>(null);
  const invite = useServerFn(inviteTeamMembers);
  const listMembers = useServerFn(listHospitalAdmins);
  const qc = useQueryClient();
  const members = useQuery({
    queryKey: ["hospital-admins", hospitalId],
    queryFn: () => listMembers({ data: { hospitalId } }),
    enabled: !!hospitalId,
  });

  const roleByText = useMemo(() => {
    const m = new Map<string, string>();
    staffRoles.forEach((r) => { m.set(r.key.toLowerCase(), r.key); m.set(r.name.toLowerCase(), r.key); });
    return m;
  }, [staffRoles]);

  const rows: Row[] = useMemo(() => text.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
    const parts = line.split(/[,\t;]/).map((p) => p.trim()).filter(Boolean);
    const email = parts.find((p) => p.includes("@")) ?? "";
    const rest = parts.filter((p) => p !== email);
    const full_name = rest[0] ?? "";
    const roleText = rest[1]?.toLowerCase();
    const roleKey = roleText ? roleByText.get(roleText) ?? "" : defaultRole;
    let error: string | undefined;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) error = "Missing or invalid email";
    else if (full_name.length < 2) error = "Name needed";
    else if (!roleKey) error = roleText ? `Unknown role "${rest[1]}"` : "Choose a role";
    return { full_name, email, roleKey, error };
  }), [text, defaultRole, roleByText]);

  const valid = rows.filter((r) => !r.error);
  const roleName = (k: string) => staffRoles.find((r) => r.key === k)?.name ?? k;

  async function send() {
    if (!hospitalId || !valid.length) return;
    setBusy(true);
    try {
      const res = await invite({ data: { hospitalId, redirectTo: `${window.location.origin}/auth`,
        people: valid.map(({ full_name, email, roleKey }) => ({ full_name, email, roleKey })) } });
      setResults(res);
      const ok = res.filter((r) => r.ok).length;
      toast.success(`${ok} of ${res.length} people invited.`);
      if (ok === res.length) setText("");
      qc.invalidateQueries({ queryKey: ["hospital-admins"] });
      qc.invalidateQueries({ queryKey: ["invitations"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invitations could not be sent.");
    } finally { setBusy(false); }
  }

  if (!canManage) return (<div><PageHeader title="Team members" />
    <EmptyState title="You cannot invite staff" description="Ask your hospital admin for permission to manage users." /></div>);
  if (!session.hospitals.length) return (<div><PageHeader title="Team members" />
    <EmptyState title="No hospitals yet" description="Add a hospital first, then invite its team."
      action={<Button size="sm" asChild><Link to="/onboarding">Start onboarding</Link></Button>} /></div>);

  return (
    <div>
      <PageHeader title="Team members" description="Invite a hospital's day-to-day staff. Each person gets an email to set their password and sign in." />
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <section className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Hospital</Label>
              <Select value={hospitalId} onValueChange={(v) => { setHospitalId(v); setResults(null); }}>
                <SelectTrigger><SelectValue placeholder="Select hospital" /></SelectTrigger>
                <SelectContent>{session.hospitals.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>Role for everyone (unless a line says otherwise)</Label>
              <Select value={defaultRole} onValueChange={setDefaultRole}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>{staffRoles.map((r) => <SelectItem key={r.key} value={r.key}>{r.name}</SelectItem>)}</SelectContent>
              </Select></div>
          </div>
          <div className="space-y-1.5">
            <Label>People — one per line: Name, email, role (role optional)</Label>
            <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)}
              placeholder={"Priya Sharma, priya@hospital.in, AR Executive\nRahul Verma, rahul@hospital.in"} className="font-mono text-[12px]" />
            <p className="text-[12px] text-muted-foreground">You can paste straight from Excel. Up to 200 people at a time.</p>
          </div>
          {rows.length ? (
            <div className="max-h-64 overflow-auto rounded border border-border">
              <table className="w-full text-[12px]"><tbody>{rows.map((r, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  <td className="px-2 py-1">{r.full_name || "—"}</td><td className="px-2 py-1 text-muted-foreground">{r.email || "—"}</td>
                  <td className="px-2 py-1">{r.error ? <span className="text-risk">{r.error}</span> : roleName(r.roleKey)}</td>
                </tr>))}</tbody></table>
            </div>) : null}
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-muted-foreground">{valid.length} ready{rows.length - valid.length ? `, ${rows.length - valid.length} need fixing` : ""}</span>
            <Button onClick={send} disabled={busy || !valid.length || !hospitalId}>{busy ? "Sending…" : `Invite ${valid.length || ""}`}</Button>
          </div>
          {results?.some((r) => !r.ok) ? (
            <div className="rounded border border-risk/40 bg-risk/5 p-2 text-[12px]">
              {results.filter((r) => !r.ok).map((r) => <p key={r.email}>{r.reason}</p>)}
            </div>) : null}
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 text-[14px] font-semibold">People with access to this hospital</h2>
          {members.isLoading ? <p className="text-[13px] text-muted-foreground">Loading…</p>
            : !(members.data ?? []).length ? <p className="text-[13px] text-muted-foreground">No one yet.</p>
            : <table className="w-full text-[12px]"><tbody>{(members.data ?? []).map((m) => (
                <tr key={m.userRoleId} className="border-b border-border/60 last:border-0">
                  <td className="py-1.5"><p className="font-medium">{m.full_name}</p><p className="text-muted-foreground">{m.email}</p></td>
                  <td className="py-1.5 text-right text-muted-foreground">{m.roleName}</td>
                </tr>))}</tbody></table>}
          <p className="mt-3 text-[12px] text-muted-foreground">Track pending emails on <Link to="/invitations" className="underline">Admin invitations</Link>.</p>
        </section>
      </div>
    </div>
  );
}
