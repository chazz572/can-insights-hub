import { useEffect, useState } from "react";
import { Activity, BarChart3, BellRing, Car, Code2, CreditCard, Database, FileText, Gauge, KeyRound, Share2, Users, Webhook, type LucideIcon } from "lucide-react";
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
  const statCards: Array<[string, string | number, LucideIcon]> = [
    ["Saved analyses", analyses.length, FileText],
    ["Fleet vehicles", vehicles.length, Car],
    ["Avg. health", `${averageHealth}/100`, Gauge],
    ["API status", "Ready", KeyRound],
  ];
  const featureCards: Array<[string, string, LucideIcon]> = [
    ["Team accounts", "Invite engineers, mechanics, and fleet managers with role-based access.", Users],
    ["Developer API", "Use API keys for automated log ingestion and external tools.", Code2],
    ["Webhook notifications", "Send completion and anomaly events to fleet systems.", Webhook],
    ["Shareable links", "Package analysis summaries for customers and shop teams.", Share2],
    ["Maintenance prediction", "Track fleet health trends and prioritize service workflows.", Activity],
  ];

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
      <section className="mb-8 animate-fade-up">
        <p className="inline-flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-3 py-1 text-sm font-semibold uppercase text-primary shadow-glow backdrop-blur">
          <Database className="size-4" /> Commercial workspace
        </p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">SaaS command center</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">Saved diagnostics, fleet health, subscription tiers, team access, and developer API readiness.</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-4">
        {statCards.map(([label, value, Icon]) => (
          <Card key={String(label)} className="animate-fade-up overflow-hidden">
            <CardContent className="flex items-start justify-between gap-4 p-6">
              <div>
                <p className="text-sm font-semibold uppercase text-muted-foreground">{String(label)}</p>
                <p className="mt-4 text-3xl font-extrabold text-primary">{String(value)}</p>
              </div>
              <span className="grid size-12 place-items-center rounded-lg border border-glass-border bg-glass text-primary shadow-glow"><Icon className="size-5" /></span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="animate-fade-up overflow-hidden">
          <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="text-primary" /> Recent saved analyses</CardTitle></CardHeader>
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
          <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="text-primary" /> Subscription tiers</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {[
              ["Free", "Basic analysis", "1 vehicle"],
              ["Pro", "Advanced diagnostics + AI", "Saved comparisons"],
              ["Enterprise", "Fleet dashboard", "Teams + API access"],
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
        <CardHeader><CardTitle className="flex items-center gap-2"><BellRing className="text-primary" /> Onboarding checklist</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          {["Upload first log", "Review AI summary", "Save analysis", "Invite team"].map((step, index) => <div key={step} className="rounded-lg border border-glass-border bg-glass p-4"><p className="font-mono text-xs text-primary">0{index + 1}</p><p className="mt-2 font-semibold">{step}</p></div>)}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {featureCards.map(([title, text, Icon]) => (
          <Card key={String(title)} className="animate-fade-up"><CardContent className="p-6"><Icon className="mb-4 size-7 text-primary" /><h2 className="text-xl font-bold">{String(title)}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{String(text)}</p></CardContent></Card>
        ))}
      </div>
    </main>
  );
};

export default Workspace;
