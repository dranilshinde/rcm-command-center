import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import logo from "@/assets/rcm-buddy-logo.png.asset.json";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity, Bell, Building2, ClipboardList, Database, FileStack, Gauge, HeartPulse,
  Landmark, LayoutGrid, LineChart, ListChecks, LogOut, Network, Receipt, ScrollText,
  Mail, Search, Settings, ShieldCheck, Users, Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sessionQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

type NavItem = { label: string; to?: string; icon: typeof Gauge; phase?: number };
type NavSection = { title: string; items: NavItem[] };

const NAV: NavSection[] = [
  {
    title: "Operations",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: Gauge },
      { label: "Command Center", icon: Activity, phase: 2 },
      { label: "Work Queue", icon: ListChecks, phase: 3 },
      { label: "Claims", icon: FileStack, phase: 2 },
      { label: "Pre-Authorisation", icon: ClipboardList, phase: 2 },
      { label: "Queries & Denials", icon: HeartPulse, phase: 3 },
    ],
  },
  {
    title: "Revenue",
    items: [
      { label: "AR Management", icon: Wallet, phase: 5 },
      { label: "Settlements", icon: Receipt, phase: 5 },
      { label: "Reconciliation", icon: Landmark, phase: 5 },
      { label: "Analytics", icon: LineChart, phase: 7 },
    ],
  },
  {
    title: "Network",
    items: [
      { label: "Hospital Groups", to: "/hospital-groups", icon: Network },
      { label: "Hospitals", to: "/hospitals", icon: Building2 },
      { label: "Onboarding", to: "/onboarding", icon: ClipboardList },
      { label: "Payers & TPAs", to: "/payers", icon: LayoutGrid },
      { label: "Users & Teams", to: "/users", icon: Users },
      { label: "Admin Invitations", to: "/invitations", icon: Mail },
    ],
  },
  {
    title: "Platform",
    items: [
      { label: "Roles & Permissions", to: "/roles", icon: ShieldCheck },
      { label: "Master Data", to: "/master-data", icon: Database },
      { label: "Audit Log", to: "/audit", icon: ScrollText },
      { label: "Notifications", to: "/notifications", icon: Bell },
      { label: "Settings", to: "/settings", icon: Settings },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { data: session } = useSuspenseQuery(sessionQuery);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = (session.profile?.full_name || "U")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <img src={logo.url} alt="RCM Buddy" className="h-11 w-11 object-contain" />
          <div className="leading-tight">
            <p className="text-[13px] font-semibold text-sidebar-accent-foreground">RCM Buddy</p>
            <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">Revenue Cycle OS</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {NAV.map((section) => (
            <div key={section.title} className="mb-4">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  if (!item.to) {
                    return (
                      <li
                        key={item.label}
                        title={`Planned for phase ${item.phase}`}
                        className="flex cursor-not-allowed items-center gap-2 rounded px-2 py-1.5 text-[13px] text-sidebar-foreground/35"
                      >
                        <Icon className="h-4 w-4" />
                        <span className="flex-1 truncate">{item.label}</span>
                        <span className="rounded border border-sidebar-border px-1 text-[9px] uppercase tracking-wide">
                          P{item.phase}
                        </span>
                      </li>
                    );
                  }
                  const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
                  return (
                    <li key={item.label}>
                      <Link
                        to={item.to}
                        className={cn(
                          "flex items-center gap-2 rounded px-2 py-1.5 text-[13px] transition-colors",
                          active
                            ? "bg-sidebar-primary text-sidebar-primary-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-[11px] font-semibold text-sidebar-accent-foreground">
              {initials}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[12px] font-medium text-sidebar-accent-foreground">
                {session.profile?.full_name}
              </p>
              <p className="truncate text-[10px] text-sidebar-foreground/60">
                {session.roles[0]?.name ?? "No role assigned"}
              </p>
            </div>
            <button
              onClick={signOut}
              aria-label="Sign out"
              className="rounded p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-surface/95 px-4 backdropblur">
          <Link to="/dashboard" className="flex items-center gap-2 lg:hidden">
            <img src={logo.url} alt="RCM Buddy" className="h-8 w-8 object-contain" />
          </Link>
          <div className="relative hidden max-w-md flex-1 md:block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              disabled
              placeholder="Global search arrives with claims in phase 2"
              className="h-9 w-full cursor-not-allowed rounded-md border border-input bg-muted/40 pl-8 pr-3 text-[13px] text-muted-foreground"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden rounded border border-border bg-muted px-2 py-1 text-[11px] text-muted-foreground sm:inline">
              {session.hospitals.length} hospital{session.hospitals.length === 1 ? "" : "s"} in scope
            </span>
            <Link
              to="/notifications"
              className="rounded border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
            </Link>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-5 md:px-6">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-[13px] text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "positive" | "warning" | "risk";
}) {
  const toneClass = {
    default: "text-foreground",
    positive: "text-positive",
    warning: "text-warning",
    risk: "text-risk",
  }[tone];
  return (
    <div className="rounded-lg border border-border bg-card p-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("tnum mt-1.5 text-2xl font-semibold", toneClass)}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/60 p-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "border-positive/40 bg-positive/10 text-positive",
    completed: "border-positive/40 bg-positive/10 text-positive",
    onboarding: "border-warning/50 bg-warning/10 text-warning",
    in_progress: "border-warning/50 bg-warning/10 text-warning",
    pending: "border-border bg-muted text-muted-foreground",
    suspended: "border-risk/40 bg-risk/10 text-risk",
    inactive: "border-border bg-muted text-muted-foreground",
    on_leave: "border-warning/50 bg-warning/10 text-warning",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded border px-1.5 py-0.5 text-[11px] font-medium capitalize",
        map[status] ?? "border-border bg-muted text-muted-foreground",
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
