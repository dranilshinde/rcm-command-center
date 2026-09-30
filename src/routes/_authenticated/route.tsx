import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapSession } from "@/lib/rcm.functions";
import { sessionQuery } from "@/lib/queries";
import { AppShell } from "@/components/rcm/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    await bootstrapSession();
    await context.queryClient.ensureQueryData(sessionQuery);
    return { user: data.user };
  },
  component: () => (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading your workspace…</div>}>
      <AppShell>
        <Outlet />
      </AppShell>
    </Suspense>
  ),
  errorComponent: ({ error }) => (
    <div className="p-8">
      <p className="text-sm font-medium">We could not open your workspace</p>
      <p className="mt-1 text-[13px] text-muted-foreground">{error.message}</p>
    </div>
  ),
});
