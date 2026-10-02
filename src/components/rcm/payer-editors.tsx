import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { errMsg } from "@/components/rcm/claims-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { savePayer, saveSpoc } from "@/lib/payers.functions";

export const CHANNEL_LABEL: Record<string, string> = { email: "Email", call: "Phone call", portal: "Payer portal", visit: "Office visit", whatsapp: "WhatsApp" };
export const LEVEL_LABEL: Record<number, string> = { 1: "L1 — first contact", 2: "L2 — supervisor", 3: "L3 — senior / head" };

function refresh(qc: ReturnType<typeof useQueryClient>) {
  ["payers", "payer360"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

export function PayerDialog({ kind, payer, trigger }: { kind: "insurer" | "tpa"; payer?: any; trigger?: React.ReactNode }) {
  const qc = useQueryClient();
  const save = useServerFn(savePayer);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const init = () => ({
    name: payer?.name ?? "", code: payer?.payer_code ?? payer?.tpa_code ?? "", insurer_type: payer?.insurer_type ?? "private",
    portal_url: payer?.portal_url ?? "", support_email: payer?.support_email ?? "", support_phone: payer?.support_phone ?? "",
    escalation_email: payer?.escalation_email ?? "", relationship_notes: payer?.relationship_notes ?? "",
    preferred_channel: payer?.preferred_channel ?? "email", target_payment_days: payer?.target_payment_days?.toString() ?? "",
    status: payer?.status ?? "active",
  });
  const [f, setF] = useState(init);
  const set = (k: string, v: string) => setF({ ...f, [k]: v });

  async function go() {
    setBusy(true);
    try {
      await save({ data: { kind, id: payer?.id, ...f, preferred_channel: f.preferred_channel as any, status: f.status as any,
        target_payment_days: f.target_payment_days ? Number(f.target_payment_days) : null } });
      toast.success(payer ? "Payer updated" : "Payer added");
      refresh(qc); setOpen(false);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setF(init()); }}>
      <DialogTrigger asChild>{trigger ?? <Button size="sm">{kind === "insurer" ? "Add insurer" : "Add TPA"}</Button>}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{payer ? "Edit" : "Add"} {kind === "insurer" ? "insurer" : "TPA"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Name</Label><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div><Label>Short code</Label><Input value={f.code} onChange={(e) => set("code", e.target.value)} /></div>
          {kind === "insurer" ? (
            <div><Label>Type</Label>
              <Select value={f.insurer_type} onValueChange={(v) => set("insurer_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="private">Private</SelectItem><SelectItem value="public">Public sector</SelectItem><SelectItem value="standalone_health">Standalone health</SelectItem><SelectItem value="government_scheme">Government scheme</SelectItem></SelectContent>
              </Select>
            </div>
          ) : <div />}
          <div><Label>Support email</Label><Input value={f.support_email} onChange={(e) => set("support_email", e.target.value)} /></div>
          <div><Label>Support phone</Label><Input value={f.support_phone} onChange={(e) => set("support_phone", e.target.value)} /></div>
          <div><Label>Escalation email</Label><Input value={f.escalation_email} onChange={(e) => set("escalation_email", e.target.value)} /></div>
          <div><Label>Portal link</Label><Input value={f.portal_url} onChange={(e) => set("portal_url", e.target.value)} /></div>
          <div><Label>Preferred follow-up channel</Label>
            <Select value={f.preferred_channel} onValueChange={(v) => set("preferred_channel", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CHANNEL_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Target days to pay</Label><Input inputMode="numeric" value={f.target_payment_days} onChange={(e) => set("target_payment_days", e.target.value)} placeholder="e.g. 30" /></div>
          <div><Label>Status</Label>
            <Select value={f.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Relationship notes</Label><Textarea value={f.relationship_notes} onChange={(e) => set("relationship_notes", e.target.value)} placeholder="Agreements, known issues, what works with this payer" /></div>
          <p className="col-span-2 text-[12px] text-muted-foreground">Follow-up timing and escalation thresholds for this payer are set under SLA & Rules. Payer contacts decide who each follow-up task tells your team to call.</p>
        </div>
        <DialogFooter><Button onClick={go} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SpocDialog({ spoc, insurers, tpas, hospitals, fixed, trigger }: {
  spoc?: any; insurers: { id: string; name: string }[]; tpas: { id: string; name: string }[]; hospitals: { id: string; name: string }[];
  fixed?: { kind: "insurer" | "tpa"; id: string }; trigger?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const save = useServerFn(saveSpoc);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const init = () => {
    const payer = spoc ? (spoc.tpa_id ? `tpa:${spoc.tpa_id}` : spoc.insurer_id ? `insurer:${spoc.insurer_id}` : "") : fixed ? `${fixed.kind}:${fixed.id}` : "";
    return { payer, hospital_id: spoc?.hospital_id ?? "all", name: spoc?.name ?? "", designation: spoc?.designation ?? "", email: spoc?.email ?? "",
      phone: spoc?.phone ?? "", location: spoc?.location ?? "", escalation_level: String(spoc?.escalation_level ?? 1), status: spoc?.status ?? "active" };
  };
  const [f, setF] = useState(init);
  const set = (k: string, v: string) => setF({ ...f, [k]: v });

  async function go() {
    if (!f.payer) { toast.error("Choose the TPA or insurer this contact works for."); return; }
    const [kind, id] = f.payer.split(":");
    setBusy(true);
    try {
      await save({ data: { id: spoc?.id, tpa_id: kind === "tpa" ? id : null, insurer_id: kind === "insurer" ? id : null,
        hospital_id: f.hospital_id === "all" ? null : f.hospital_id, name: f.name, designation: f.designation, email: f.email,
        phone: f.phone, location: f.location, escalation_level: Number(f.escalation_level), status: f.status as any } });
      toast.success(spoc ? "Contact updated" : "Contact added");
      refresh(qc); setOpen(false);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setF(init()); }}>
      <DialogTrigger asChild>{trigger ?? <Button size="sm">Add contact</Button>}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{spoc ? "Edit" : "Add"} payer contact (SPOC)</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Works for</Label>
            <Select value={f.payer} onValueChange={(v) => set("payer", v)} disabled={!!fixed && !spoc}>
              <SelectTrigger><SelectValue placeholder="Choose TPA or insurer" /></SelectTrigger>
              <SelectContent>
                {tpas.map((t) => <SelectItem key={t.id} value={`tpa:${t.id}`}>TPA · {t.name}</SelectItem>)}
                {insurers.map((i) => <SelectItem key={i.id} value={`insurer:${i.id}`}>Insurer · {i.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Name</Label><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div><Label>Designation</Label><Input value={f.designation} onChange={(e) => set("designation", e.target.value)} /></div>
          <div><Label>Email</Label><Input value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></div>
          <div><Label>Covers hospital</Label>
            <Select value={f.hospital_id} onValueChange={(v) => set("hospital_id", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All hospitals</SelectItem>{hospitals.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Escalation level</Label>
            <Select value={f.escalation_level} onValueChange={(v) => set("escalation_level", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{[1, 2, 3].map((l) => <SelectItem key={l} value={String(l)}>{LEVEL_LABEL[l]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Location</Label><Input value={f.location} onChange={(e) => set("location", e.target.value)} /></div>
          <div><Label>Status</Label>
            <Select value={f.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
            </Select>
          </div>
          <p className="col-span-2 text-[12px] text-muted-foreground">Follow-up tasks name the L1 contact. As a claim escalates (levels 1–2 → L1, 3–4 → L2, 5–6 → L3) the senior contact is attached. Hospital-specific contacts are preferred over “All hospitals”, and TPA contacts over insurer contacts.</p>
        </div>
        <DialogFooter><Button onClick={go} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
