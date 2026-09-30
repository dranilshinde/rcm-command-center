import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { EmptyState, PageHeader, StatCard, StatusChip } from "@/components/rcm/app-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { payersQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/payers")({
  loader: ({ context }) => context.queryClient.ensureQueryData(payersQuery),
  head: () => ({
    meta: [
      { title: "Payers & TPAs — RCM Buddy" },
      { name: "description", content: "Insurers, TPAs and TPA contact people across your hospitals." },
      { property: "og:title", content: "Payers & TPAs — RCM Buddy" },
      { property: "og:description", content: "Insurer, TPA and contact directory." },
    ],
  }),
  component: Payers,
});

function T({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return <EmptyState title="Nothing here yet" />;
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            {head.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
              {r.map((c, j) => <td key={j} className={j === 0 ? "px-3 py-2 font-medium" : "px-3 py-2 text-muted-foreground"}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Payers() {
  const { data } = useSuspenseQuery(payersQuery);
  return (
    <div>
      <PageHeader title="Payers & TPAs" description="The payer directory shared across the platform, plus hospital-specific TPA contacts." />
      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Insurers" value={data.insurers.length} />
        <StatCard label="TPAs" value={data.tpas.length} />
        <StatCard label="TPA contacts" value={data.spocs.length} />
      </section>
      <Tabs defaultValue="insurers">
        <TabsList>
          <TabsTrigger value="insurers">Insurers</TabsTrigger>
          <TabsTrigger value="tpas">TPAs</TabsTrigger>
          <TabsTrigger value="spocs">Contacts</TabsTrigger>
        </TabsList>
        <TabsContent value="insurers" className="mt-4">
          <T head={["Insurer", "Code", "Type", "Support email", "Status"]}
            rows={data.insurers.map((i) => [i.name, i.payer_code, i.insurer_type, i.support_email ?? "—", <StatusChip key={i.id} status={i.status} />])} />
        </TabsContent>
        <TabsContent value="tpas" className="mt-4">
          <T head={["TPA", "Code", "Support email", "Status"]}
            rows={data.tpas.map((t) => [t.name, t.tpa_code, t.support_email ?? "—", <StatusChip key={t.id} status={t.status} />])} />
        </TabsContent>
        <TabsContent value="spocs" className="mt-4">
          <T head={["Name", "TPA", "Hospital", "Designation", "Phone", "Level", "Status"]}
            rows={data.spocs.map((s) => [s.name, s.tpa_name, s.hospital_name, s.designation ?? "—", s.phone ?? "—", s.escalation_level, <StatusChip key={s.id} status={s.status} />])} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
