import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Database, LayoutDashboard, LineChart, Menu, PanelLeftClose, PanelLeftOpen, Radar, Route as RouteIcon, Settings } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TopBar } from "./TopBar";

export const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/airfare-index", label: "Airfare Index", icon: LineChart },
  { to: "/route-explorer", label: "Route Explorer", icon: RouteIcon },
  { to: "/shock-radar", label: "Shock Radar", icon: Radar },
  { to: "/data-sources", label: "Data Sources", icon: Database },
  { to: "/methodology", label: "Methodology", icon: BookOpen },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function SidebarNav({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav aria-label="Primary" className="flex flex-1 flex-col gap-0.5 px-2 py-3">
      {NAV_ITEMS.map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              collapsed && "justify-center px-0",
            )}
          >
            {active && <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-sidebar-primary" aria-hidden />}
            <item.icon className="h-4 w-4 shrink-0" aria-hidden />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className={cn("flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4", collapsed && "justify-center px-0")}>
      <img src="/logo.svg" alt="" className="h-8 w-8 shrink-0 rounded-md ring-1 ring-sidebar-border" />
      {!collapsed && (
        <div className="leading-tight">
          <p className="text-sm font-semibold">Airfare Index India</p>
          <p className="text-[10px] uppercase tracking-wider text-sidebar-muted">SIH26056 · Prototype</p>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-150 md:flex", collapsed ? "w-16" : "w-60")}>
        <Brand collapsed={collapsed} />
        <SidebarNav collapsed={collapsed} />
        <div className="border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="w-full justify-center text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /> <span className="ml-2 text-xs">Collapse</span></>}
          </Button>
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-64 flex-col border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Brand />
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenMenu={() => setMobileOpen(true)} menuButton={<Menu className="h-5 w-5" />} />
        <main className="flex-1 px-4 py-5 md:px-6 lg:px-8">{children}</main>
        <footer className="border-t px-4 py-3 text-[11px] text-muted-foreground md:px-6 lg:px-8">
          Prototype for SIH26056. All figures are simulated DEMO DATA and are not official CPI or MoSPI statistics.
        </footer>
      </div>
    </div>
  );
}
