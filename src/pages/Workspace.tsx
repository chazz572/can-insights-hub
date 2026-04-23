import { useEffect, useState } from "react";
import { Activity, ArrowRight, BarChart3, BellRing, Car, CheckCircle2, Code2, Database, FileText, Gauge, KeyRound, Route, ScanLine, Share2, ShieldCheck, Users, Webhook, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadFleetVehicles, loadSavedAnalyses } from "@/lib/saasApi";

const Workspace = () => {
  const [analyses, setAnalyses] = useState<Record<string, unknown>[]>([]);
  const [vehicles, setVehicles] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    loadSavedAnalyses().then(setAnalyses).catch(() => setAnalyses([]));
    loadFleetVehicles().then(setVehicles).catch(() => setVehicles([]));
  }, []);

  const averageHealth = vehicles.length ? Math.round(vehicles.reduce((sum, vehicle) => sum + Number(vehicle.health_score ?? 0), 0) / vehicles.length) : 96;
  const statCards: Array<[string, string | number, string, LucideIcon]> = [
    ["Saved Analyses", analyses.length, "Stored diagnostic evidence", FileText],
    ["Fleet Vehicles", vehicles.length, "Tracked assets", Car],
    ["Avg. Health", `${averageHealth}/100`, "Workspace health index", Gauge],
    ["API Status", "Ready", "Automation endpoints online", KeyRound],
  ];
  const featureCards: Array<[string, string, LucideIcon]> = [
    ["Team Accounts", "Invite engineers, mechanics, and fleet managers with role-based access.", Users],
    ["Developer API", "Use API keys for automated log ingestion and external tools.", Code2],
    ["Webhook Notifications", "Send completion and anomaly events to fleet systems.", Webhook],
    ["Shareable Links", "Package analysis summaries for customers and shop teams.", Share2],
    ["Maintenance Prediction", "Track fleet health trends and prioritize service workflows.", Activity],
  ];

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
      <section className="mb-8 animate-fade-up rounded-lg border border-glass-border bg-glass-strong p-5 shadow-dashboard backdrop-blur sm:p-7">
        <p className="inline-flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-3 py-1 text-sm font-semibold uppercase text-primary shadow-glow backdrop-blur">
          <Database className="size-4" /> Commercial Workspace
        </p>
        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-end">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Professional Diagnostics Command Center</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">One operations hub for saved CAN evidence, fleet readiness, team workflow, reporting status, and API automation.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {["Evidence locked", "Fleet aware", "Reports ready"].map((item) => <div key={item} className="flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm font-semibold text-foreground"><CheckCircle2 className="size-4 text-success" />{item}</div>)}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-4">
        {statCards.map(([label, value, detail, Icon]) => (
          <Card key={String(label)} className="animate-fade-up overflow-hidden">
            <CardContent className="flex items-start justify-between gap-4 p-6">
              <div>
                <p className="text-sm font-semibold uppercase text-muted-foreground">{String(label)}</p>
                <p className="mt-4 text-3xl font-extrabold text-primary">{String(value)}</p>
                <p className="mt-2 text-xs font-medium text-muted-foreground">{String(detail)}</p>
              </div>
              <span className="grid size-12 place-items-center rounded-lg border border-glass-border bg-glass text-primary shadow-glow"><Icon className="size-5" /></span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="animate-fade-up overflow-hidden">
          <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="text-primary" /> Recent Saved Analyses</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {analyses.length ? analyses.slice(0, 5).map((analysis) => (
              <div key={String(analysis.id)} className="flex items-center justify-between gap-3 rounded-lg border border-glass-border bg-glass p-4">
                <div className="min-w-0"><p className="truncate font-semibold">{String(analysis.title)}</p><p className="text-sm text-muted-foreground">Health score {String(analysis.health_score ?? "—")}</p></div>
                <Button asChild variant="outline" size="sm"><Link to={`/results/${String(analysis.file_id)}`}>Open</Link></Button>
              </div>
            )) : <div className="rounded-lg border border-dashed border-glass-border bg-glass p-6 text-sm text-muted-foreground">No saved analyses yet. Open results and save a snapshot.</div>}
          </CardContent>
        </Card>

        <Card className="animate-fade-up overflow-hidden">
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="text-primary" /> Workspace Readiness</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {[
              ["Diagnostic pipeline", "LOG / DBC / batch routing", "Active"],
              ["Operations workflow", "Fleet, compare, save, and report surfaces", "Ready"],
              ["Team platform", "Accounts, API keys, and shared review model", "Prepared"],
            ].map(([tier, detail, feature]) => (
              <div key={tier} className="rounded-lg border border-glass-border bg-glass p-4 transition-all duration-300 hover:border-primary/40 hover:shadow-glow">
                <p className="font-bold text-foreground">{tier}</p>
                <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
                <p className="mt-3 inline-flex rounded-lg bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">{feature}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 animate-fade-up overflow-hidden">
        <CardHeader><CardTitle className="flex items-center gap-2"><BellRing className="text-primary" /> Onboarding Checklist</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          {["Upload first log", "Review AI summary", "Save analysis", "Invite team"].map((step, index) => <div key={step} className="rounded-lg border border-glass-border bg-glass p-4"><p className="font-mono text-xs text-primary">0{index + 1}</p><p className="mt-2 font-semibold">{step}</p><ArrowRight className="mt-4 size-4 text-muted-foreground" /></div>)}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {[["Analyze", "Upload any supported CAN artifact and route it to the correct pipeline.", ScanLine], ["Operate", "Use fleet and comparison workflows to track vehicle readiness.", Route], ["Deliver", "Generate customer-safe reports and integration-ready outputs.", FileText]].map(([title, text, Icon]) => (
          <Card key={String(title)} className="animate-fade-up border-primary/20 bg-gradient-subtle"><CardContent className="p-6"><Icon className="mb-4 size-7 text-primary" /><h2 className="text-xl font-bold">{String(title)}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{String(text)}</p></CardContent></Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {featureCards.map(([title, text, Icon]) => (
          <Card key={String(title)} className="animate-fade-up"><CardContent className="p-6"><Icon className="mb-4 size-7 text-primary" /><h2 className="text-xl font-bold">{String(title)}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{String(text)}</p></CardContent></Card>
        ))}
      </div>
    </main>
  );
};

export default Workspace;
