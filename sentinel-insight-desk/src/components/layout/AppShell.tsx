import { useState, createContext, useContext, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, AlertTriangle, Network, CreditCard, Activity, Bot,
  ChevronLeft, Search, Shield, Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/alerts", label: "Alert Queue", icon: AlertTriangle },
  { to: "/graph", label: "Graph Explorer", icon: Network },
  { to: "/credit", label: "Credit Scoring", icon: CreditCard },
  { to: "/monitoring", label: "Model Monitoring", icon: Activity },
  { to: "/agent-log", label: "Agent Activity", icon: Bot },
];

const SidebarCtx = createContext<{ collapsed: boolean }>({ collapsed: false });
export const useShellSidebar = () => useContext(SidebarCtx);

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <SidebarCtx.Provider value={{ collapsed }}>
      <div className="flex h-screen w-full bg-background text-foreground">
        {/* Sidebar */}
        <aside
          className={cn(
            "flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200",
            collapsed ? "w-14" : "w-60"
          )}
        >
          <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md" style={{ background: "var(--navy)" }}>
              <Shield className="h-4 w-4 text-white" />
            </div>
            {!collapsed && (
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-semibold tracking-tight">Sentinel</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Risk Ops</span>
              </div>
            )}
          </div>
          <nav className="flex-1 space-y-0.5 p-2">
            {nav.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-l-teal"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  )}
                  style={active ? { borderLeftColor: "var(--teal)" } : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="m-2 flex items-center justify-center gap-2 rounded-md border border-sidebar-border py-1.5 text-xs text-muted-foreground hover:bg-sidebar-accent/60"
          >
            <ChevronLeft className={cn("h-3.5 w-3.5 transition-transform", collapsed && "rotate-180")} />
            {!collapsed && "Collapse"}
          </button>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-card/50 px-4 backdrop-blur">
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="w-full rounded-md border border-input bg-background/60 py-1.5 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Search accounts, alerts, devices…"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
                <Circle className="h-2 w-2 animate-pulse fill-emerald-500 text-emerald-500" />
                <span>All systems live</span>
                <span className="text-border">•</span>
                <span>p95 34ms</span>
                <span className="text-border">•</span>
                <span>v4.2 champion</span>
              </div>
              <div className="h-8 w-8 rounded-full bg-secondary text-center text-xs leading-8 font-medium">JA</div>
            </div>
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarCtx.Provider>
  );
}

export function RiskBadge({ tier }: { tier: "low" | "medium" | "high" | "critical" }) {
  const map = {
    low: { bg: "var(--risk-low)", label: "LOW" },
    medium: { bg: "var(--risk-medium)", label: "MED" },
    high: { bg: "var(--risk-high)", label: "HIGH" },
    critical: { bg: "var(--risk-critical)", label: "CRIT" },
  } as const;
  const m = map[tier];
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white"
      style={{ background: m.bg }}
    >
      {m.label}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
