import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/rcm/app-shell";
import { DataTable, errMsg, td, tr } from "@/components/rcm/claims-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { rulesQuery } from "@/lib/claims-queries";
import { ROLE_LABEL } from "@/lib/claims-domain";
import { runEngineNow, saveReminderRule, saveSlaRule, toggleRule } from "@/lib/followups.functions";
import { payersQuery, sessionQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/sla-rules")({
  head: () => ({
    meta: [
      { title: "SLA & Reminder Rules — RCM Buddy" },
      { name: "description", content: "Set SLA targets, reminders and the escalation ladder per hospital, insurer and TPA." },
      { property: "og:title", content: "SLA & Reminder Rules — RCM Buddy" },
      { property: "og:description", content: "SLA, reminder and escalation rules by payer." },
    ],
  }),
  component: Rules,
});

const PROCESS_LABEL: Record<string, string> = {
  preauth: "Pre-auth decision", query_response: "Reply to payer query", submission: "Submit claim after discharge",
  payment: "Payment after approval", settlement: "Settlement after submission",
};
const RULE_LABEL: Record<string, string> = {
  payer_followup: "Follow-up task when claim is quiet", no_response: "Reminder when payer silent",
  commitment_missed: "Missed payment commitment", sla_breach: "SLA breach escalation",
  escalate_l1: "Escalation level 1", escalate_l2: "Escalation level 2", escalate_l3: "Escalation level 3",
  escalate_l4: "Escalation level 4", escalate_l5: "Escalation level 5", escalate_l6: "Escalation level 6",
};

const fmtHours = (h: number) => (h === 0 ? "Immediately" : h % 24 === 0 ? `${h / 24} day${h === 24 ? "" : "s"}` : `${h} hours`);
const scopeText = (r: any) => [r.hospitals?.name, r.insurers?.name, r.tpas?.name].filter(Boolean).join(" · ") || (r.organization_id ? "All hospitals" : "Platform default");

type Editing = { kind: "sla" | "reminder"; row: any | null } | null;

function Rules() {
  const { data, error } = useQuery(rulesQuery);
  const { data: session } = useSuspenseQuery(sessionQuery);
  const canConfigure = session.isSuperAdmin || session.permissions.includes("followups.CONFIGURE");
  const qc = useQueryClient();
  const toggle = useServerFn(toggleRule);
  const run = useServerFn(runEngineNow);
  const [editing, setEditing] = useState<Editing>(null);
  const [running, setRunning] = useState(false);

  async function runNow() {
    setRunning(true);
    try {
      const r = await run();
      toast.success(`Check done: ${r["followup_tasks"] ?? 0} follow-up tasks, ${r["reminders"] ?? 0} reminders, ${r["escalations"] ?? 0} escalations, ${r["sla_breaches"] ?? 0} SLA breaches, ${r["missed_commitments"] ?? 0} missed commitments`);
      ["rules", "tasks", "escalations", "notifications", "followups"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    } catch (e) { toast.error(errMsg(e)); } finally { setRunning(false); }
  }
  async function flip(kind: "sla" | "reminder", id: string, is_active: boolean) {
    try { await toggle({ data: { kind, id, is_active } }); qc.invalidateQueries({ queryKey: ["rules"] }); }
    catch (e) { toast.error(errMsg(e)); }
  }
  if (error) return <EmptyState title="Could not load rules" description={(error as Error).message} />;
  const last = data?.lastRun as { started_at: string; stats: Record<string, number> } | null;

  return (
    <div>
      <PageHeader
        title="SLA & Reminder Rules"
        description="The most specific rule wins: TPA, then insurer, then hospital, then your organisation, then the platform default. Checks run every hour."
        actions={canConfigure ? <Button size="sm" onClick={runNow} disabled={running}>{running ? "Running…" : "Run checks now"}</Button> : null}
      />
      <p className="mb-4 text-[12px] text-muted-foreground">
        {last ? `Last check ${new Date(last.started_at).toLocaleString("en-IN")} — ${last.stats["followup_tasks"] ?? 0} follow-up tasks, ${last.stats["reminders"] ?? 0} reminders, ${last.stats["escalations"] ?? 0} escalations, ${last.stats["sla_breaches"] ?? 0} SLA breaches.` : "No checks have run yet."}
      </p>
      <Tabs defaultValue="sla">
        <TabsList><TabsTrigger value="sla">SLA targets</TabsTrigger><TabsTrigger value="reminders">Reminders & escalations</TabsTrigger></TabsList>
        <TabsContent value="sla" className="mt-3">
          {canConfigure ? <Button size="sm" variant="outline" className="mb-2" onClick={() => setEditing({ kind: "sla", row: null })}>Add SLA override</Button> : null}
          <DataTable head={["Process", "Applies to", "Target", "Description", "Active", ""]}>
            {(data?.sla ?? []).map((r) => (
              <tr key={r.id} className={tr}>
                <td className={`${td} font-medium`}>{PROCESS_LABEL[r.process] ?? r.process}</td>
                <td className={`${td} text-muted-foreground`}>{scopeText(r)}</td>
                <td className={`${td} tnum`}>{fmtHours(r.target_hours)}</td>
                <td className={`${td} text-muted-foreground`}>{r.description ?? "—"}</td>
                <td className={td}><Switch checked={r.is_active} disabled={!canConfigure || (!r.organization_id && !session.isSuperAdmin)} onCheckedChange={(v) => flip("sla", r.id, v)} /></td>
                <td className={`${td} text-right`}>{canConfigure && (r.organization_id || session.isSuperAdmin) ? <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditing({ kind: "sla", row: r })}>Edit</Button> : null}</td>
              </tr>
            ))}
          </DataTable>
        </TabsContent>
        <TabsContent value="reminders" className="mt-3">
          {canConfigure ? <Button size="sm" variant="outline" className="mb-2" onClick={() => setEditing({ kind: "reminder", row: null })}>Add rule or override</Button> : null}
          <DataTable head={["Rule", "Name", "Applies to", "After", "Alerts", "Active", ""]}>
            {(data?.reminders ?? []).map((r) => (
              <tr key={r.id} className={tr}>
                <td className={`${td} font-medium`}>{RULE_LABEL[r.rule_key] ?? r.rule_key}</td>
                <td className={td}>{r.name}</td>
                <td className={`${td} text-muted-foreground`}>{scopeText(r)}</td>
                <td className={`${td} tnum`}>{fmtHours(r.threshold_hours)}</td>
                <td className={`${td} text-[12px] text-muted-foreground`}>{(r.notify_roles ?? []).map((x: string) => ROLE_LABEL[x] ?? x).join(", ") || "Claim owner"}</td>
                <td className={td}><Switch checked={r.is_active} disabled={!canConfigure || (!r.organization_id && !session.isSuperAdmin)} onCheckedChange={(v) => flip("reminder", r.id, v)} /></td>
                <td className={`${td} text-right`}>{canConfigure && (r.organization_id || session.isSuperAdmin) ? <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditing({ kind: "reminder", row: r })}>Edit</Button> : null}</td>
              </tr>
            ))}
          </DataTable>
        </TabsContent>
      </Tabs>
      {editing ? <RuleDialog editing={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function RuleDialog({ editing, onClose }: { editing: NonNullable<Editing>; onClose: () => void }) {
  const { data: session } = useSuspenseQuery(sessionQuery);
  const { data: payers } = useQuery(payersQuery);
  const qc = useQueryClient();
  const saveSla = useServerFn(saveSlaRule);
  const saveRem = useServerFn(saveReminderRule);
  const r = editing.row;
  const isSla = editing.kind === "sla";
  const [f, setF] = useState({
    key: r ? (isSla ? r.process : r.rule_key) : (isSla ? "settlement" : "payer_followup"),
    name: r?.name ?? "", description: r?.description ?? "",
    amount: r ? String(isSla ? (r.target_hours % 24 === 0 ? r.target_hours / 24 : r.target_hours) : (r.threshold_hours % 24 === 0 ? r.threshold_hours / 24 : r.threshold_hours)) : "",
    unit: r ? ((isSla ? r.target_hours : r.threshold_hours) % 24 === 0 && (isSla ? r.target_hours : r.threshold_hours) > 0 ? "days" : "hours") : "days",
    hospital_id: r?.hospital_id ?? "", insurer_id: r?.insurer_id ?? "", tpa_id: r?.tpa_id ?? "",
    roles: (r?.notify_roles ?? []) as string[],
  });
  const [busy, setBusy] = useState(false);
  const hours = Math.round(Number(f.amount) * (f.unit === "days" ? 24 : 1));

  async function go() {
    if (!(hours >= (isSla ? 1 : 0)) || f.amount === "") { toast.error("Enter a valid time."); return; }
    setBusy(true);
    const scope = { hospital_id: f.hospital_id || null, insurer_id: f.insurer_id || null, tpa_id: f.tpa_id || null };
    try {
      if (isSla) await saveSla({ data: { id: r?.id ?? null, process: f.key, target_hours: hours, description: f.description || null, ...scope } });
      else await saveRem({ data: { id: r?.id ?? null, rule_key: f.key, name: f.name || RULE_LABEL[f.key]!, threshold_hours: hours, notify_roles: f.roles, ...scope } });
      toast.success("Rule saved"); qc.invalidateQueries({ queryKey: ["rules"] }); onClose();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  const pick = (label: string, k: "hospital_id" | "insurer_id" | "tpa_id", items: { id: string; name: string }[]) => (
    <div><Label>{label}</Label>
      <Select value={f[k] || "any"} disabled={!!r} onValueChange={(v) => setF({ ...f, [k]: v === "any" ? "" : v })}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="any">Any</SelectItem>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{r ? "Edit rule" : isSla ? "Add SLA override" : "Add reminder / escalation rule"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>{isSla ? "Process" : "Rule"}</Label>
            <Select value={f.key} disabled={!!r} onValueChange={(v) => setF({ ...f, key: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(isSla ? PROCESS_LABEL : RULE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {!isSla ? <div className="col-span-2"><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={RULE_LABEL[f.key]} /></div> : null}
          <div><Label>{isSla ? "Target" : "After"}</Label><Input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
          <div><Label>Unit</Label>
            <Select value={f.unit} onValueChange={(v) => setF({ ...f, unit: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="hours">Hours</SelectItem><SelectItem value="days">Days</SelectItem></SelectContent>
            </Select>
          </div>
          {pick("Hospital", "hospital_id", session.hospitals)}
          {pick("Insurer", "insurer_id", payers?.insurers ?? [])}
          <div className="col-span-2">{pick("TPA", "tpa_id", payers?.tpas ?? [])}</div>
          {isSla ? <div className="col-span-2"><Label>Description</Label><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div> : (
            <div className="col-span-2"><Label>Also alert these roles</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {Object.entries(ROLE_LABEL).map(([k, v]) => {
                  const on = f.roles.includes(k);
                  return <button type="button" key={k} onClick={() => setF({ ...f, roles: on ? f.roles.filter((x) => x !== k) : [...f.roles, k] })} className={`rounded border px-2 py-0.5 text-[12px] ${on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>{v}</button>;
                })}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">The claim owner is always alerted.</p>
            </div>
          )}
        </div>
        <DialogFooter><Button onClick={go} disabled={busy}>{busy ? "Saving…" : "Save rule"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
