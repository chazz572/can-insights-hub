import { BarChart3, Bell, Car, ChartNoAxesCombined, CheckCircle2, Download, GitCompareArrows, Home, LayoutDashboard, Moon, Settings, Sun, TerminalSquare, UploadCloud, UserCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink as RouterNavLink, useLocation } from "react-router-dom";

import { cn } from "@/lib/utils";

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "group flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    isActive
      ? "bg-gradient-accent text-primary-foreground shadow-glow"
      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-glow",
  );

export const AppNav = () => {
  const location = useLocation();
  const [fileId, setFileId] = useState<string | null>(() => localStorage.getItem("can_ai_file_id"));
  const [theme, setTheme] = useState<"dark" | "light">(() => (localStorage.getItem("can_ai_theme") === "light" ? "light" : "dark"));
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setFileId(localStorage.getItem("can_ai_file_id"));
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

  const resultsPath = fileId ? `/results/${fileId}` : "/upload";
  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2400);
  };

  const links = [
    { to: "/", label: "Home", icon: Home, end: true },
    { to: "/workspace", label: "Workspace", icon: LayoutDashboard },
    { to: "/upload", label: "Upload", icon: UploadCloud },
    { to: resultsPath, label: "Results", icon: BarChart3 },
    { to: "/engineering", label: "Engineering", icon: TerminalSquare },
    { to: "/visualize", label: "Visualize", icon: ChartNoAxesCombined },
    { to: "/compare", label: "Compare", icon: GitCompareArrows },
    { to: "/fleet", label: "Fleet", icon: Car },
    { to: "/reports", label: "Reports", icon: Download },
  ];

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-sidebar-border bg-sidebar/80 p-5 shadow-dashboard backdrop-blur-xl md:flex md:flex-col">
        <Link to="/" className="group mb-8 flex items-center gap-3 rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="grid size-11 place-items-center rounded-lg bg-gradient-accent text-sm font-extrabold text-primary-foreground shadow-glow transition-transform duration-300 group-hover:scale-105">
            CAN
          </span>
          <span>
            <span className="block text-base font-bold text-foreground">CJL CAN Intelligence Platform</span>
            <span className="text-xs font-medium text-muted-foreground">AI Analytics Suite</span>
          </span>
        </Link>

        <nav className="space-y-1 overflow-y-auto pr-1">
          {links.map((item) => (
            <RouterNavLink key={item.label} to={item.to} className={navClass} end={item.end}>
              <item.icon className="transition-transform duration-300 group-hover:scale-110" />
              {item.label}
            </RouterNavLink>
          ))}
        </nav>

        <div className="mt-5 space-y-2 border-t border-glass-border pt-5">
          {["Diagnostics", "Engineering", "Fleet", "AI", "SaaS"].map((section) => (
            <div key={section} className="rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-primary">
              {section}
            </div>
          ))}
        </div>

        <div className="mt-auto rounded-lg border border-glass-border bg-glass p-4 backdrop-blur">
          <p className="text-xs font-semibold uppercase text-primary">CJL CAN Intelligence Platform</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Formats · Diagnostics · Engineering · Fleet · AI</p>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-30 border-b border-glass-border bg-background/70 px-4 py-3 shadow-dashboard backdrop-blur-xl md:left-72 md:px-8">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-primary">CJL CAN Intelligence Platform</p>
            <p className="truncate text-sm text-muted-foreground">Cloud CAN Analysis · Diagnostics · Reverse Engineering</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Toggle theme" onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")} className="grid size-10 place-items-center rounded-lg border border-glass-border bg-glass text-foreground shadow-glow backdrop-blur transition-all duration-300 hover:scale-105 hover:border-primary/40">
              {theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </button>
            <button type="button" aria-label="Notifications" onClick={() => showNotice("No Critical Alerts · CAN Monitor Ready")} className="hidden size-10 place-items-center rounded-lg border border-glass-border bg-glass text-foreground backdrop-blur transition-all duration-300 hover:border-primary/40 hover:shadow-glow sm:grid">
              <Bell className="size-4" />
            </button>
            <button type="button" aria-label="Settings" onClick={() => showNotice("Settings Shortcut · Open Account For Workspace Controls")} className="hidden size-10 place-items-center rounded-lg border border-glass-border bg-glass text-foreground backdrop-blur transition-all duration-300 hover:border-primary/40 hover:shadow-glow sm:grid">
              <Settings className="size-4" />
            </button>
            <RouterNavLink to="/auth" className="flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm font-semibold text-foreground backdrop-blur transition-all duration-300 hover:border-primary/40 hover:shadow-glow">
              <UserCircle className="size-4 text-primary" />
              <span className="hidden sm:inline">Account</span>
            </RouterNavLink>
          </div>
        </div>
        {notice ? <div className="mt-3 flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-3 py-2 text-xs font-semibold text-muted-foreground shadow-glow"><CheckCircle2 className="size-4 text-success" /> {notice}</div> : null}
      </header>

      <header className="fixed inset-x-3 bottom-3 z-40 rounded-lg border border-sidebar-border bg-sidebar/90 p-2 shadow-dashboard backdrop-blur-xl md:hidden">
        <nav className="grid grid-cols-5 gap-2">
          {links.slice(0, 5).map((item) => (
            <RouterNavLink key={item.label} to={item.to} className={({ isActive }) => cn(navClass({ isActive }), "justify-center px-2 py-2")} end={item.end}>
              <item.icon />
              <span className="sr-only sm:not-sr-only">{item.label}</span>
            </RouterNavLink>
          ))}
        </nav>
      </header>
    </>
  );
};
