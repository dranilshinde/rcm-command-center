import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createOrganization } from "@/lib/rcm.functions";

export function NewOrganizationDialog({ onCreated, variant = "outline" }: { onCreated?: (id: string) => void; variant?: "outline" | "default" }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "" });
  const [busy, setBusy] = useState(false);
  const create = useServerFn(createOrganization);
  const qc = useQueryClient();

  async function submit() {
    if (form.name.trim().length < 2 || form.code.length < 2) {
      toast.error("Enter the organisation name and a code of at least 2 characters.");
      return;
    }
    setBusy(true);
    try {
      const r = await create({ data: form });
      toast.success("Organisation created.");
      setOpen(false);
      setForm({ name: "", code: "" });
      await qc.invalidateQueries();
      onCreated?.(r.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message.replace(/^\[.*?\]\s*/, "") : "We could not create the organisation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant={variant}>New organisation</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New organisation</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Organisation name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Aster Healthcare" />
          </div>
          <div className="space-y-1.5">
            <Label>Organisation code</Label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} placeholder="e.g. ASTER" />
          </div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Create organisation"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
