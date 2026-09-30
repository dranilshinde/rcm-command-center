import { createFileRoute, Link } from "@tanstack/react-router";
import logo from "@/assets/rcm-buddy-logo.png.asset.json";
import { Activity, Building2, ShieldCheck, Wallet } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RCM Buddy — Multi-Hospital Revenue Cycle Operating System" },
      {
        name: "description",
        content:
          "Run insurance claims, payers, AR and RCM teams across hospital groups, hospitals and branches from a single command centre built for Indian hospitals.",
      },
      { property: "og:title", content: "RCM Buddy — Multi-Hospital Revenue Cycle Operating System" },
      {
        property: "og:description",
        content: "Claims, payers, AR, denials and team operations for hospital groups in India.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-sidebar text-sidebar-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <img src={logo.url} alt="RCM Buddy" className="h-10 w-10 object-contain" />
          <span className="text-sm font-semibold text-sidebar-accent-foreground">RCM Buddy</span>
        </div>
        <Link
          to="/auth"
          className="rounded-md bg-sidebar-primary px-4 py-2 text-[13px] font-medium text-sidebar-primary-foreground hover:opacity-90"
        >
          Sign in
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sidebar-primary">
          Phase 1 — Platform foundation
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight text-sidebar-accent-foreground md:text-5xl">
          A revenue cycle operating system for hospital groups, not another claims spreadsheet.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] text-sidebar-foreground/75">
          RCM Buddy runs the full cashless cycle — admission to reconciliation — across groups, hospitals,
          branches, departments and teams, with strict data separation between hospitals.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            to="/auth"
            className="rounded-md bg-sidebar-primary px-5 py-2.5 text-sm font-medium text-sidebar-primary-foreground hover:opacity-90"
          >
            Open the console
          </Link>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Building2, title: "Multi-tenant by design", body: "Groups, hospitals, branches, departments and teams from day one." },
            { icon: ShieldCheck, title: "Granular permissions", body: "Configurable roles with per-module actions, enforced in the database." },
            { icon: Activity, title: "Action oriented", body: "Built to answer what is stuck, what is at risk and who must act." },
            { icon: Wallet, title: "Financially traceable", body: "Every figure will drill down to the claim, payment and audit trail." },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-4">
              <f.icon className="h-5 w-5 text-sidebar-primary" />
              <p className="mt-3 text-sm font-medium text-sidebar-accent-foreground">{f.title}</p>
              <p className="mt-1 text-[13px] text-sidebar-foreground/70">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
