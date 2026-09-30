import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/rcm/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { masterDataQuery, sessionQuery } from "@/lib/queries";
import { createMasterItem, toggleMasterItem } from "@/lib/rcm.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/master-data")({
  loader: ({ context }) => context.queryClient.ensureQueryData(masterDataQuery),
  head: () => ({
    meta: [
      { title: "Master data — RCM Buddy" },
      { name: "description", content: "Shared lists: claim types, denial reasons, query reasons, task types and more." },
      { property: "og:title", content: "Master data — RCM Buddy" },
      { property: "og:description", content: "Shared reference lists for the revenue cycle." },
    ],
  }),
  component: MasterData,
});

function MasterData() {
  const { data } = useSuspenseQuery(masterDataQuery);
  const { data: session } = useSuspenseQuery(sessionQuery);
  const canEdit = session.isSuperAdmin || session.permissions.includes("master_data.EDIT");
  const [listId, setListId] = useState(data.lists[0]?.id ?? "");
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const qc = useQueryClient();
  const create = useServerFn(createMasterItem);
  const toggle = useServerFn(toggleMasterItem);
  const items = data.items.filter((i) => i.list_id === listId);
  const list = data.lists.find((l) => l.id === listId);

  async function add() {
    if (!code || !label) { toast.error("Code and label are required."); return; }
    try {
      await create({ data: { listId, code, label, sortOrder: items.length + 1 } });
      setCode(""); setLabel("");
      qc.invalidateQueries({ queryKey: ["master-data"] });
      toast.success("Item added.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not add item."); }
  }

  return (
    <div>
      <PageHeader title="Master data" description="Reference lists used across claims, denials and tasks. Deactivate instead of deleting so history stays intact." />
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <ul className="rounded-lg border border-border bg-card p-1">
          {data.lists.map((l) => (
            <li key={l.id}>
              <button onClick={() => setListId(l.id)}
                className={cn("w-full rounded px-3 py-2 text-left text-[13px]", l.id === listId ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                {l.name}
              </button>
            </li>
          ))}
        </ul>
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border p-4">
            <h2 className="text-sm font-semibold">{list?.name}</h2>
            <p className="text-[12px] text-muted-foreground">{list?.description}</p>
            {canEdit ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Input className="h-9 w-40" placeholder="Code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
                <Input className="h-9 w-64" placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
                <Button size="sm" onClick={add}>Add item</Button>
              </div>
            ) : null}
          </div>
          <ul className="divide-y divide-border">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                <span className="tnum w-40 text-muted-foreground">{i.code}</span>
                <span className={i.is_active ? "" : "text-muted-foreground line-through"}>{i.label}</span>
                <span className="ml-auto">
                  <Switch checked={i.is_active} disabled={!canEdit}
                    onCheckedChange={async (v) => {
                      try { await toggle({ data: { itemId: i.id, isActive: v } }); qc.invalidateQueries({ queryKey: ["master-data"] }); }
                      catch (e) { toast.error(e instanceof Error ? e.message : "Could not update."); }
                    }} />
                </span>
              </li>
            ))}
            {items.length === 0 ? <li className="p-6 text-center text-[13px] text-muted-foreground">No items in this list yet.</li> : null}
          </ul>
        </div>
      </div>
    </div>
  );
}
