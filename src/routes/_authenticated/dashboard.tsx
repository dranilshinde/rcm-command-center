import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageHeader, StatCard, StatusChip } from "@/components/rcm/app-shell";
import { sessionQuery, statsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(statsQuery),
      context.queryClient.ensureQueryData(sessionQuery),
    ]),
  head: () => ({
    meta: [
      { title: "Dashboard — RCM Buddy" },
      { name: "description", content: "Platform foundation overview: hospitals, branches, teams, users and onboarding progress." },
      { property: "og:title", content: "Dashboard — RCM Buddy" },
      { property: "og:description", content: "Platform foundation overview across your hospital network." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: stats } = useSuspenseQuery(statsQuery);
  const { data: session } = useSuspenseQuery(sessionQuery);

  return (
    <div>
      <PageHeader
        title={`Good day, ${session.profile?.full_name?.split(" ")[0] ?? "there"}`}
        description="Your hospitals, branches and people at a glance. Claim and money figures move here in the management dashboard (later phase)."
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Hospital groups" value={stats.groups} hint="Across all customer organisations" />
        <StatCard label="Hospitals" value={stats.hospitals} hint={`${stats.activeHospitals} live, ${stats.onboarding} onboarding`} />
        <StatCard label="Branches" value={stats.branches} hint={`${stats.departments} departments`} />
        <StatCard label="Users" value={stats.users} hint={`${stats.teams} teams configured`} tone="positive" />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Hospitals in your scope</h2>
            <Link to="/hospitals" className="text-[12px] text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Hospital</th>
                  <th className="pb-2 pr-3 font-medium">Code</th>
                  <th className="pb-2 pr-3 font-medium">City</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {session.hospitals.slice(0, 8).map((h) => (
                  <tr key={h.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                    <td className="py-2 pr-3">
                      <Link to="/hospitals/$hospitalId" params={{ hospitalId: h.id }} className="hover:underline">
                        {h.name}
                      </Link>
                    </td>
                    <td className="tnum py-2 pr-3 text-muted-foreground">{h.code}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{h.city ?? "—"}</td>
                    <td className="py-2">
                      <StatusChip status={h.status} />
                    </td>
                  </tr>
                ))}
                {session.hospitals.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted-foreground">
                      No hospitals have been shared with you yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Onboarding progress</h2>
            <p className="tnum mt-2 text-3xl font-semibold">{stats.onboardingProgress}%</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded bg-muted">
              <div className="h-full rounded bg-primary" style={{ width: `${stats.onboardingProgress}%` }} />
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Across all onboarding checklists in your network.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Payer network</h2>
            <dl className="mt-3 space-y-2 text-[13px]">
              <Row label="Insurers" value={stats.insurers} />
              <Row label="TPAs" value={stats.tpas} />
              <Row label="TPA contacts" value={stats.spocs} />
              <Row label="Changes logged (24h)" value={stats.auditToday} />
            </dl>
          </div>
        </div>
      </section>

    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tnum font-medium">{value}</dd>
    </div>
  );
}
