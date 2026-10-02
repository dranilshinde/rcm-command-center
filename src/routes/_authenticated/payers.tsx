import { createFileRoute, Link, Outlet, useMatch } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { EmptyState, PageHeader, StatCard, StatusChip } from "@/components/rcm/app-shell";
import { CHANNEL_LABEL, LEVEL_LABEL, PayerDialog, SpocDialog } from "@/components/rcm/payer-editors";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hospitalsQuery, payersQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/payers")({
  loader: ({ context }) => context.queryClient.ensureQueryData(payersQuery),
  head: () => ({
    meta: [
      { title: "Payers & TPAs — RCM Buddy" },
      { name: "description", content: "Manage insurers, TPAs and payer contacts, and open a 360° view of each payer." },
      { property: "og:title", content: "Payers & TPAs — RCM Buddy" },
      { property: "og:description", content: "Insurer, TPA and contact directory with payer 360." },
    ],
  }),
  component: PayersLayout,
});

function PayersLayout() {
  const child = useMatch({ from: "/_authenticated/payers/$kind/$payerId", shouldThrow: false });
  return child ? <Outlet /> : <Payers />;
}

const edit = <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></Button>;

function T({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return <EmptyState title="Nothing here yet" />;
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            {head.map((h, i) => <th key={i} className="px-3 py-2 font-medium">{h}</th>)}
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
  const { data: hosp } = useQuery(hospitalsQuery({ page: 1 }));
  const hospitals = (hosp?.rows ?? []).map((h: any) => ({ id: h.id, name: h.name }));
  const link = (kind: "insurer" | "tpa", id: string, name: string) => (
    <Link to="/payers/$kind/$payerId" params={{ kind, payerId: id }} className="text-primary hover:underline">{name}</Link>
  );
  return (
    <div>
      <PageHeader title="Payers & TPAs" description="Your payer directory and the contacts the follow-up engine routes work to. Click a payer for its 360° view." />
      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Insurers" value={data.insurers.length} />
        <StatCard label="TPAs" value={data.tpas.length} />
        <StatCard label="Payer contacts" value={data.spocs.length} />
      </section>
      <Tabs defaultValue="insurers">
        <TabsList>
          <TabsTrigger value="insurers">Insurers</TabsTrigger>
          <TabsTrigger value="tpas">TPAs</TabsTrigger>
          <TabsTrigger value="spocs">Contacts (SPOCs)</TabsTrigger>
        </TabsList>
        <TabsContent value="insurers" className="mt-4">
          <div className="mb-2 flex justify-end"><PayerDialog kind="insurer" /></div>
          <T head={["Insurer", "Code", "Type", "Channel", "Target days", "Status", ""]}
            rows={data.insurers.map((i: any) => [link("insurer", i.id, i.name), i.payer_code, i.insurer_type, CHANNEL_LABEL[i.preferred_channel] ?? "—", i.target_payment_days ?? "—", <StatusChip key="s" status={i.status} />, <PayerDialog key="e" kind="insurer" payer={i} trigger={edit} />])} />
        </TabsContent>
        <TabsContent value="tpas" className="mt-4">
          <div className="mb-2 flex justify-end"><PayerDialog kind="tpa" /></div>
          <T head={["TPA", "Code", "Channel", "Target days", "Support email", "Status", ""]}
            rows={data.tpas.map((t: any) => [link("tpa", t.id, t.name), t.tpa_code, CHANNEL_LABEL[t.preferred_channel] ?? "—", t.target_payment_days ?? "—", t.support_email ?? "—", <StatusChip key="s" status={t.status} />, <PayerDialog key="e" kind="tpa" payer={t} trigger={edit} />])} />
        </TabsContent>
        <TabsContent value="spocs" className="mt-4">
          <div className="mb-2 flex justify-end"><SpocDialog insurers={data.insurers} tpas={data.tpas} hospitals={hospitals} /></div>
          <T head={["Name", "Payer", "Hospital", "Designation", "Phone", "Level", "Status", ""]}
            rows={data.spocs.map((s: any) => [s.name, s.tpa_name, s.hospital_name, s.designation ?? "—", s.phone ?? "—", LEVEL_LABEL[s.escalation_level] ?? s.escalation_level, <StatusChip key="s" status={s.status} />, <SpocDialog key="e" spoc={s} insurers={data.insurers} tpas={data.tpas} hospitals={hospitals} trigger={edit} />])} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
