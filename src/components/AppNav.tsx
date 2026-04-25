import { Activity, BarChart3, Beaker, Bell, Car, ChartNoAxesCombined, CheckCircle2, Download, GitCompareArrows, Home, LayoutDashboard, MoreHorizontal, Moon, Settings, Sun, TerminalSquare, UploadCloud, UserCircle, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink as RouterNavLink, useLocation } from "react-router-dom";

import { SettingsDialog } from "@/components/SettingsDialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useApplyGlobalSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

const navClass = ({ isActive, highlight }: { isActive: boolean; highlight?: boolean }) =>
  cn(
    "group relative flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-semibold uppercase tracking-wider transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    "border border-transparent",
    isActive
      ? "bg-primary text-primary-foreground border-primary shadow-[inset_0_-2px_0_hsl(0_0%_0%/0.4)]"
      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:border-glass-border",
    highlight && !isActive && "border-l-4 border-l-primary text-primary",
  );

export const AppNav = () => {
  useApplyGlobalSettings();
  const location = useLocation();
  const [fileId, setFileId] = useState<string | null>(() => localStorage.getItem("can_ai_file_id"));
  const [theme, setTheme] = useState<"dark" | "light">(() => (localStorage.getItem("can_ai_theme") === "light" ? "light" : "dark"));
  const [notice, setNotice] = useState<string | null>(null);
  const [clock, setClock] = useState<string>(() => new Date().toLocaleTimeString([], { hour12: false }));
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  useEffect(() => {
    setFileId(localStorage.getItem("can_ai_file_id"));
    setMobileMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const syncFileId = () => setFileId(localStorage.getItem("can_ai_file_id"));
    window.addEventListener("storage", syncFileId);
    window.addEventListener("focus", syncFileId);
    return () => {
      window.removeEventListener("storage", syncFileId);
      window.removeEventListener("focus", syncFileId);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem("can_ai_theme", theme);
  }, [theme]);

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date().toLocaleTimeString([], { hour12: false })), 1000);
    return () => window.clearInterval(id);
  }, []);

  const resultsPath = fileId ? `/results/${fileId}` : "/upload";
  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2400);
  };

  const links = [
    { to: "/", label: "Home", icon: Home, end: true },
    { to: "/workspace", label: "Bay", icon: LayoutDashboard },
    { to: "/upload", label: "Intake", icon: UploadCloud, end: true },
    { to: resultsPath, label: "Diagnose", icon: BarChart3, end: !fileId },
    { to: "/compare", label: "Compare", icon: GitCompareArrows },
    { to: "/engineering", label: "Bench", icon: TerminalSquare },
    { to: "/visualize", label: "Scope", icon: ChartNoAxesCombined },
    { to: "/analyzer", label: "Analyzer", icon: Activity, highlight: true },
    { to: "/fleet", label: "Fleet", icon: Car },
    { to: "/sample-generator", label: "Sample Gen", icon: Beaker },
    { to: "/reports", label: "Work Order", icon: Download },
  ];

  return (
    <>
      {/* Toolbox sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex flex-col gap-4 p-4 pt-5">
          <Link to="/" className="group flex items-center gap-3 rounded-sm border border-sidebar-border bg-sidebar-accent/40 p-3">
            <span className="grid size-12 place-items-center rounded-sm bg-primary font-display text-lg font-bold text-primary-foreground shadow-[inset_0_-2px_0_hsl(0_0%_0%/0.5)]">
              CJL
            </span>
            <span className="min-w-0">
              <span className="block font-display text-base font-bold leading-tight text-sidebar-accent-foreground">CAN INTELLIGENCE</span>
              <span className="block font-mono text-[10px] uppercase tracking-widest text-sidebar-foreground/70">Service Bay · v2.0</span>
            </span>
          </Link>

          <div className="flex items-center justify-between rounded-sm border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 font-mono text-xs uppercase tracking-wider text-sidebar-foreground">
            <span className="flex items-center gap-2">
              <span className="status-led" />
              SYS ONLINE
            </span>
            <span className="led-readout text-xs">{clock}</span>
          </div>
        </div>

        <div className="px-4 pb-2">
          <p className="stencil text-[10px] text-sidebar-foreground/60">— Service Stations —</p>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pr-2">
          {links.map((item) => (
            <RouterNavLink key={item.label} to={item.to} className={({ isActive }) => navClass({ isActive, highlight: (item as { highlight?: boolean }).highlight })} end={item.end}>
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </RouterNavLink>
          ))}
        </nav>

        <div className="m-3 rounded-sm border border-sidebar-border bg-sidebar-accent/40 p-3">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-sm border border-sidebar-border bg-sidebar text-sidebar-foreground">
              <Wrench className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-sm font-bold uppercase text-sidebar-accent-foreground">Pro Bay Active</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-sidebar-foreground/70">All tools certified</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Top status bar — looks like a shop control panel */}
      <header className="fixed inset-x-0 top-0 z-30 border-b border-glass-border bg-card/95 px-4 py-2.5 backdrop-blur md:left-72 md:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="status-led shrink-0" />
            <div className="min-w-0">
              <p className="font-display text-xs font-bold uppercase tracking-wider text-primary">CJL · Diagnostic Service Platform</p>
              <p className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">CAN Bus · DBC Decode · Fleet Telemetry</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" aria-label="Toggle theme" onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")} className="grid size-9 place-items-center rounded-sm border border-glass-border bg-secondary text-foreground transition-colors hover:border-primary hover:text-primary">
              {theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </button>
            <button type="button" aria-label="Notifications" onClick={() => showNotice("All systems nominal · No active faults")} className="hidden size-9 place-items-center rounded-sm border border-glass-border bg-secondary text-foreground transition-colors hover:border-primary hover:text-primary sm:grid">
              <Bell className="size-4" />
            </button>
            <SettingsDialog
              trigger={
                <button type="button" aria-label="Settings" className="grid size-9 place-items-center rounded-sm border border-glass-border bg-secondary text-foreground transition-colors hover:border-primary hover:text-primary">
                  <Settings className="size-4" />
                </button>
              }
            />
            <RouterNavLink to="/auth" className="flex items-center gap-2 rounded-sm border border-glass-border bg-secondary px-3 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:border-primary hover:text-primary">
              <UserCircle className="size-4 text-primary" />
              <span className="hidden sm:inline">Tech</span>
            </RouterNavLink>
          </div>
        </div>
        {notice ? (
          <div className="mt-2 flex items-center gap-2 rounded-sm border border-success/40 bg-success/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-success">
            <CheckCircle2 className="size-3.5" /> {notice}
          </div>
        ) : null}
      </header>

      {/* Mobile bottom toolbar — 4 quick links + More sheet exposing every tool */}
      <header className="fixed inset-x-2 bottom-2 z-40 rounded-sm border border-sidebar-border bg-sidebar/98 p-1.5 backdrop-blur md:hidden">
        <nav className="grid grid-cols-5 gap-1">
          {[
            links.find((l) => l.to === "/")!,
            links.find((l) => l.to === "/upload")!,
            links.find((l) => l.label === "Diagnose")!,
            links.find((l) => l.to === "/analyzer")!,
          ].map((item) => (
            <RouterNavLink key={item.label} to={item.to} className={({ isActive }) => cn(navClass({ isActive }), "flex-col justify-center gap-1 px-1 py-1.5 text-[9px]")} end={item.end}>
              <item.icon className="size-4" />
              <span>{item.label}</span>
            </RouterNavLink>
          ))}
          <Sheet open={mobileMoreOpen} onOpenChange={setMobileMoreOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className={cn(
                  "group relative flex flex-col items-center justify-center gap-1 rounded-sm border border-transparent px-1 py-1.5 text-[9px] font-semibold uppercase tracking-wider transition-all",
                  "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:border-glass-border",
                )}
                aria-label="More tools"
              >
                <MoreHorizontal className="size-4" />
                <span>More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-md border-sidebar-border bg-sidebar p-4">
              <SheetHeader className="text-left">
                <SheetTitle className="font-display uppercase tracking-wider">All Service Stations</SheetTitle>
              </SheetHeader>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {links.map((item) => (
                  <RouterNavLink
                    key={`m-${item.label}`}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        "flex flex-col items-center justify-center gap-1.5 rounded-sm border px-2 py-3 text-center text-[10px] font-semibold uppercase tracking-wider transition-colors",
                        isActive
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-glass-border bg-card text-foreground hover:border-primary/50",
                      )
                    }
                  >
                    <item.icon className="size-5" />
                    <span className="leading-tight">{item.label}</span>
                  </RouterNavLink>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-glass-border pt-4">
                <button
                  type="button"
                  onClick={() => { setTheme((c) => c === "dark" ? "light" : "dark"); }}
                  className="flex flex-col items-center gap-1.5 rounded-sm border border-glass-border bg-card px-2 py-3 text-[10px] font-semibold uppercase tracking-wider text-foreground hover:border-primary/50"
                >
                  {theme === "dark" ? <Moon className="size-5" /> : <Sun className="size-5" />}
                  <span>Theme</span>
                </button>
                <button
                  type="button"
                  onClick={() => { showNotice("All systems nominal · No active faults"); setMobileMoreOpen(false); }}
                  className="flex flex-col items-center gap-1.5 rounded-sm border border-glass-border bg-card px-2 py-3 text-[10px] font-semibold uppercase tracking-wider text-foreground hover:border-primary/50"
                >
                  <Bell className="size-5" />
                  <span>Notify</span>
                </button>
                <SettingsDialog
                  trigger={
                    <button
                      type="button"
                      className="flex flex-col items-center gap-1.5 rounded-sm border border-glass-border bg-card px-2 py-3 text-[10px] font-semibold uppercase tracking-wider text-foreground hover:border-primary/50"
                    >
                      <Settings className="size-5" />
                      <span>Settings</span>
                    </button>
                  }
                />
                <RouterNavLink
                  to="/auth"
                  className="col-span-3 flex items-center justify-center gap-2 rounded-sm border border-glass-border bg-card px-3 py-3 text-xs font-semibold uppercase tracking-wider text-foreground hover:border-primary/50"
                >
                  <UserCircle className="size-4 text-primary" /> Tech Account
                </RouterNavLink>
              </div>
            </SheetContent>
          </Sheet>
        </nav>
      </header>
    </>
  );
};
