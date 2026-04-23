import { useEffect, useState } from "react";
import { Activity, ArrowRight, BarChart3, BellRing, Car, CheckCircle2, Code2, FileText, Gauge, KeyRound, Route, ScanLine, Share2, ShieldCheck, Users, Webhook, Wrench, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { loadFleetVehicles, loadSavedAnalyses } from "@/lib/saasApi";

const Workspace = () => {
  const [analyses, setAnalyses] = useState<Record<string, unknown>[]>([]);
  const [vehicles, setVehicles] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    loadSavedAnalyses().then(setAnalyses).catch(() => setAnalyses([]));
    loadFleetVehicles().then(setVehicles).catch(() => setVehicles([]));
  }, []);

  const averageHealth = vehicles.length ? Math.round(vehicles.reduce((sum, vehicle) => sum + Number(vehicle.health_score ?? 0), 0) / vehicles.length) : 96;

  const gauges: Array<[string, string | number, string, LucideIcon, "ok" | "warn" | "off"]> = [
    ["Saved Diagnostics", analyses.length, "Stored evidence", FileText, "ok"],
    ["Fleet Vehicles", vehicles.length, "Tracked assets", Car, "ok"],
    ["Avg Health", `${averageHealth}/100`, "Bay health index", Gauge, averageHealth >= 80 ? "ok" : averageHealth >= 60 ? "warn" : "off"],
    ["API Bus", "READY", "Automation online", KeyRound, "ok"],
  ];

  const featureCards: Array<[string, string, LucideIcon]> = [
    ["Team Accounts", "Invite techs, mechanics, fleet managers — role-based access.", Users],
    ["Developer API", "API keys for automated log ingestion and external tools.", Code2],
    ["Webhook Notifications", "Send completion + anomaly events to fleet systems.", Webhook],
    ["Shareable Links", "Package analysis summaries for customers and shop teams.", Share2],
    ["Maintenance Predict", "Track fleet trends and prioritize service workflows.", Activity],
  ];

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Service bay command header */}
      <section className="data-panel riveted relative mb-5 overflow-hidden">
        <div className="p-5 sm:p-7">
          <div className="flex items-center gap-2">
            <span className="status-led" />
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-primary">— Service Bay · Active —</p>
          </div>
          <div className="mt-3 grid gap-5 lg:grid-cols-[1fr_0.7fr] lg:items-end">
            <div>
              <h1 className="font-display text-3xl font-bold uppercase leading-tight tracking-wide sm:text-4xl">
                <span className="text-primary">Bay 01</span> — Command Console
              </h1>
              <p className="mt-2 max-w-2xl font-sans text-muted-foreground">Saved diagnostics, fleet readiness, team workflow, report status, and API automation — one console.</p>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-3 lg:grid-cols-1">
              {[["Evidence", "ok"], ["Fleet", "ok"], ["Reports", "ok"]].map(([label, state]) => (
                <div key={label} className="flex items-center gap-2 rounded-sm border border-glass-border bg-card/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-foreground">
                  <span className={`status-led ${state === "ok" ? "" : "warn"}`} />
                  {label} · LOCKED
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Gauge cluster */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {gauges.map(([label, value, detail, Icon, state]) => (
          <div key={String(label)} className="data-panel scanline-panel relative p-4">
            <div className="mb-2 flex items-start justify-between">
              <span className="grid size-10 place-items-center rounded-sm bg-secondary text-primary">
                <Icon className="size-4" />
              </span>
              <span className={`status-led ${state === "warn" ? "warn" : state === "off" ? "off" : ""}`} />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{String(label)}</p>
            <p className="led-readout mt-1 text-2xl">{String(value)}</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{String(detail)}</p>
          </div>
        ))}
      </div>

      {/* Service log + readiness */}
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="data-panel">
          <div className="flex items-center justify-between border-b-2 border-dashed border-glass-border px-5 py-3">
            <p className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-foreground">
              <BarChart3 className="size-4 text-primary" /> Recent Service Log
            </p>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{analyses.length} entries</span>
          </div>
          <div className="space-y-2 p-4">
            {analyses.length ? analyses.slice(0, 5).map((analysis) => (
              <div key={String(analysis.id)} className="flex items-center justify-between gap-3 rounded-sm border border-glass-border bg-card/40 p-3 transition-colors hover:border-primary/50">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-sm bg-secondary font-mono text-[10px] uppercase text-primary">JOB</span>
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-bold uppercase tracking-wider">{String(analysis.title)}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Health: <span className="text-primary">{String(analysis.health_score ?? "—")}</span></p>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="rounded-sm font-mono text-[10px] uppercase tracking-widest">
                  <Link to={`/results/${String(analysis.file_id)}`}>Open</Link>
                </Button>
              </div>
            )) : (
              <div className="rounded-sm border-2 border-dashed border-glass-border bg-card/30 p-6 text-center font-mono text-xs uppercase tracking-wider text-muted-foreground">
                No service entries yet — open a diagnostic and save snapshot
              </div>
            )}
          </div>
        </div>

        <div className="data-panel">
          <div className="flex items-center gap-2 border-b-2 border-dashed border-glass-border px-5 py-3">
            <ShieldCheck className="size-4 text-primary" />
            <p className="font-display text-sm font-bold uppercase tracking-wider">Bay Readiness</p>
          </div>
          <div className="grid gap-2 p-4">
            {[
              ["Diagnostic Pipeline", "LOG / DBC / batch routing", "ACTIVE"],
              ["Operations Workflow", "Fleet, compare, save, report", "READY"],
              ["Team Platform", "Accounts, API keys, review", "PREPARED"],
            ].map(([tier, detail, feature]) => (
              <div key={tier} className="rounded-sm border border-glass-border bg-card/40 p-3">
                <p className="font-display text-sm font-bold uppercase tracking-wider text-foreground">{tier}</p>
                <p className="mt-0.5 font-sans text-xs text-muted-foreground">{detail}</p>
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-sm bg-success/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-success">
                  <span className="status-led" /> {feature}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Onboarding checklist — service order style */}
      <div className="data-panel mt-5 p-5">
        <div className="mb-3 flex items-center gap-2">
          <BellRing className="size-4 text-primary" />
          <p className="font-display text-sm font-bold uppercase tracking-wider">Onboarding Checklist</p>
        </div>
        <div className="grid gap-2 md:grid-cols-4">
          {["Upload first log", "Review AI summary", "Save diagnostic", "Invite team"].map((step, index) => (
            <div key={step} className="rounded-sm border border-glass-border bg-card/40 p-3">
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary">STEP 0{index + 1}</p>
              <p className="mt-1.5 font-display text-sm font-bold uppercase tracking-wider">{step}</p>
              <ArrowRight className="mt-3 size-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {[["Analyze", "Upload any supported CAN artifact and route it to the correct pipeline.", ScanLine], ["Operate", "Use fleet and comparison workflows to track vehicle readiness.", Route], ["Deliver", "Generate customer-safe reports and integration-ready outputs.", FileText]].map(([title, text, Icon]) => (
          <div key={String(title)} className="data-panel relative overflow-hidden p-5">
            <div className="absolute right-0 top-0 h-full w-1 bg-primary" />
            <Icon className="mb-3 size-6 text-primary" />
            <h2 className="font-display text-lg font-bold uppercase tracking-wider">{String(title)}</h2>
            <p className="mt-1.5 font-sans text-sm leading-6 text-muted-foreground">{String(text)}</p>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <p className="stencil mb-3 text-xs text-muted-foreground">— Shop Add-Ons —</p>
        <div className="grid gap-3 lg:grid-cols-3">
          {featureCards.map(([title, text, Icon]) => (
            <div key={String(title)} className="data-panel p-5">
              <Icon className="mb-3 size-6 text-primary" />
              <h2 className="font-display text-lg font-bold uppercase tracking-wider">{String(title)}</h2>
              <p className="mt-1.5 font-sans text-sm leading-6 text-muted-foreground">{String(text)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="data-panel mt-6 flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Wrench className="size-5 text-primary" />
          <p className="font-display text-sm font-bold uppercase tracking-wider text-foreground">Ready to start a job?</p>
        </div>
        <Button asChild size="sm" className="rounded-sm font-display uppercase tracking-wider">
          <Link to="/upload">Open Intake <ArrowRight className="size-4" /></Link>
        </Button>
      </div>
    </main>
  );
};

export default Workspace;
