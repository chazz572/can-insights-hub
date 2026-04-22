import { BarChart3, Home, UploadCloud } from "lucide-react";
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

  const resultsPath = fileId ? `/results/${fileId}` : "/upload";

  const links = [
    { to: "/", label: "Home", icon: Home, end: true },
    { to: "/upload", label: "Upload", icon: UploadCloud },
    { to: resultsPath, label: "Results", icon: BarChart3 },
  ];

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-sidebar-border bg-sidebar/80 p-5 shadow-dashboard backdrop-blur-xl md:flex md:flex-col">
        <Link to="/" className="group mb-8 flex items-center gap-3 rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="grid size-11 place-items-center rounded-lg bg-gradient-accent text-sm font-extrabold text-primary-foreground shadow-glow transition-transform duration-300 group-hover:scale-105">
            CAN
          </span>
          <span>
            <span className="block text-base font-bold text-foreground">CANAI Analyzer</span>
            <span className="text-xs font-medium text-muted-foreground">AI analytics suite</span>
          </span>
        </Link>

        <nav className="space-y-2">
          {links.map((item) => (
            <RouterNavLink key={item.label} to={item.to} className={navClass} end={item.end}>
              <item.icon className="transition-transform duration-300 group-hover:scale-110" />
              {item.label}
            </RouterNavLink>
          ))}
        </nav>

        <div className="mt-auto rounded-lg border border-glass-border bg-glass p-4 backdrop-blur">
          <p className="text-xs font-semibold uppercase text-primary">Live analysis</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Upload CAN exports and inspect anomalies, identifiers, and behavior signals.</p>
        </div>
      </aside>

      <header className="fixed inset-x-3 bottom-3 z-40 rounded-lg border border-sidebar-border bg-sidebar/90 p-2 shadow-dashboard backdrop-blur-xl md:hidden">
        <nav className="grid grid-cols-3 gap-2">
          {links.map((item) => (
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
