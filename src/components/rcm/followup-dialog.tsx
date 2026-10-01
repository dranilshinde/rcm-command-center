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
import { logFollowup } from "@/lib/followups.functions";

export const OUTCOME_LABEL: Record<string, string> = {
  in_process: "In process with payer",
  payment_committed: "Payment committed",
  documents_requested: "Documents requested",
  under_query: "Under query",
  no_response: "No response",
  approved: "Approved, awaiting payment",
  rejected: "Rejected",
  other: "Other",
};

type Outcome = "in_process" | "payment_committed" | "documents_requested" | "under_query" | "no_response" | "approved" | "rejected" | "other";
type Channel = "call" | "email" | "portal" | "visit" | "whatsapp";

export function LogFollowupDialog({ claimId, trigger }: { claimId: string; trigger?: React.ReactNode }) {
  const qc = useQueryClient();
  const log = useServerFn(logFollowup);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ channel: "call" as Channel, contact_name: "", outcome: "in_process" as Outcome, notes: "", commitment_date: "", commitment_amount: "", next_followup_at: "" });

  async function go() {
    if (f.outcome === "payment_committed" && !f.commitment_date) { toast.error("Enter the committed payment date."); return; }
    setBusy(true);
    try {
      await log({ data: {
        claimId, channel: f.channel, contact_name: f.contact_name || null, outcome: f.outcome, notes: f.notes || null,
        commitment_date: f.commitment_date || null, commitment_amount: f.commitment_amount ? Number(f.commitment_amount) : null,
        next_followup_at: f.next_followup_at || null,
      } });
      toast.success("Follow-up logged");
      ["claim", "followups", "tasks", "claims"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setOpen(false);
      setF({ ...f, notes: "", commitment_date: "", commitment_amount: "", next_followup_at: "" });
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button size="sm" variant="outline">Log follow-up</Button>}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Log payer follow-up</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Channel</Label>
            <Select value={f.channel} onValueChange={(v) => setF({ ...f, channel: v as Channel })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="call">Phone call</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="portal">Payer portal</SelectItem><SelectItem value="visit">Office visit</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Spoke to</Label><Input value={f.contact_name} onChange={(e) => setF({ ...f, contact_name: e.target.value })} placeholder="TPA / insurer contact" /></div>
          <div className="col-span-2"><Label>Outcome</Label>
            <Select value={f.outcome} onValueChange={(v) => setF({ ...f, outcome: v as Outcome })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(OUTCOME_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {f.outcome === "payment_committed" ? (
            <>
              <div><Label>Committed payment date</Label><Input type="date" value={f.commitment_date} onChange={(e) => setF({ ...f, commitment_date: e.target.value })} /></div>
              <div><Label>Committed amount (₹)</Label><Input inputMode="decimal" value={f.commitment_amount} onChange={(e) => setF({ ...f, commitment_amount: e.target.value })} /></div>
            </>
          ) : null}
          <div className="col-span-2"><Label>Next follow-up on</Label><Input type="date" value={f.next_followup_at} onChange={(e) => setF({ ...f, next_followup_at: e.target.value })} /></div>
          <div className="col-span-2"><Label>Notes</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          <p className="col-span-2 text-[12px] text-muted-foreground">Open follow-up tasks on this claim are completed. If you set a next date or a commitment date, a new follow-up task is scheduled for then; a missed commitment is flagged automatically.</p>
        </div>
        <DialogFooter><Button onClick={go} disabled={busy}>{busy ? "Saving…" : "Save follow-up"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
