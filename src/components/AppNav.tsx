import { useEffect, useState } from "react";
import { Link, NavLink as RouterNavLink, useLocation } from "react-router-dom";

import { cn } from "@/lib/utils";

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground",
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

  return (
    <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
      <nav className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="group flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="grid size-9 place-items-center rounded-md bg-gradient-accent text-sm font-bold text-primary-foreground shadow-glow transition-transform group-hover:scale-105">
            CAN
          </span>
          <span className="hidden text-sm font-semibold tracking-wide text-foreground sm:inline">AI Analyzer</span>
        </Link>

        <div className="flex items-center gap-1">
          <RouterNavLink to="/" className={navClass} end>
            Home
          </RouterNavLink>
          <RouterNavLink to="/upload" className={navClass}>
            Upload
          </RouterNavLink>
          {fileId ? (
            <RouterNavLink to={`/results/${fileId}`} className={navClass}>
              Results
            </RouterNavLink>
          ) : (
            <span className="cursor-not-allowed rounded-md px-3 py-2 text-sm font-medium text-muted-foreground/60">Results</span>
          )}
        </div>
      </nav>
    </header>
  );
};