import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EmptyState, PageHeader } from "@/components/rcm/app-shell";
import { Button } from "@/components/ui/button";
import { notificationsQuery } from "@/lib/queries";
import { markNotificationRead } from "@/lib/rcm.functions";

export const Route = createFileRoute("/_authenticated/notifications")({
  loader: ({ context }) => context.queryClient.ensureQueryData(notificationsQuery),
  head: () => ({
    meta: [
      { title: "Notifications — RCM Buddy" },
      { name: "description", content: "Alerts that need your attention." },
      { property: "og:title", content: "Notifications — RCM Buddy" },
      { property: "og:description", content: "Alerts that need your attention." },
    ],
  }),
  component: Notifications,
});

function Notifications() {
  const { data } = useSuspenseQuery(notificationsQuery);
  const mark = useServerFn(markNotificationRead);
  const qc = useQueryClient();
  return (
    <div>
      <PageHeader title="Notifications" description="In-app alerts. Email, SMS and WhatsApp delivery will be connected in a later phase." />
      {data.length === 0 ? <EmptyState title="You're all caught up" description="New alerts about assignments, SLAs and escalations will appear here." /> : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {data.map((n) => (
            <li key={n.id} className="flex items-start gap-3 px-4 py-3 text-[13px]">
              <span className={n.read_at ? "mt-1.5 h-2 w-2 rounded-full bg-muted" : "mt-1.5 h-2 w-2 rounded-full bg-primary"} />
              <div className="flex-1">
                <p className="font-medium">{n.title}</p>
                {n.body ? <p className="text-muted-foreground">{n.body}</p> : null}
                <p className="tnum mt-1 text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString("en-IN")}</p>
              </div>
              {!n.read_at ? (
                <Button size="sm" variant="outline" onClick={async () => { await mark({ data: { id: n.id } }); qc.invalidateQueries({ queryKey: ["notifications"] }); }}>
                  Mark read
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
