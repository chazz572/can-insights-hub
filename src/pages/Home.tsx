import { Activity, ArrowRight, BarChart3, BrainCircuit, Car, CheckCircle2, DatabaseZap, FileText, Gauge, Radar, ShieldAlert, UploadCloud, Users, Zap } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const workflow = [
  { label: "Route by file type", detail: "LOG, DBC, LOG+DBC, and batch pipelines stay separate.", icon: UploadCloud },
  { label: "Extract defensible evidence", detail: "Timing, entropy, active IDs, decoded signals, and anomalies.", icon: Radar },
  { label: "Deliver professional outputs", detail: "Mechanic summaries, reverse-engineering views, charts, and reports.", icon: BarChart3 },
];

const personas = [
  { title: "EV repair shops", detail: "Plain-English diagnostic evidence for batteries, charging, inverter, thermal, and chassis issues.", icon: Zap },
  { title: "Fleet teams", detail: "Vehicle health, saved analysis history, comparison workflows, and operations-ready reporting.", icon: Car },
  { title: "CAN engineers", detail: "DBC inspection, byte-level reverse engineering, timing integrity, counters, checksums, and decoded signals.", icon: DatabaseZap },
];

const capabilities = [
  "Automatic LOG / DBC / LOG+DBC routing",
  "Timing, jitter, gap, and frequency analysis",
  "DBC message, signal, scaling, and bit-layout viewer",
  "Decoded signal dashboards when DBC data is present",
  "AI Mechanic and AI Reverse Engineer summaries",
  "Fleet, comparison, visualization, and report workspaces",
];

const Home = () => (
  <main className="min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-10">
    <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col justify-center gap-10 py-8">
      <div className="grid items-center gap-10 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="animate-fade-up">
          <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-4 py-2 text-sm font-semibold text-primary shadow-glow backdrop-blur">
            <BrainCircuit className="size-4" />
            CJL CAN Intelligence Platform
          </div>
          <h1 className="max-w-4xl text-4xl font-extrabold leading-tight text-foreground sm:text-6xl lg:text-7xl">Professional CAN diagnostics, DBC decoding, and fleet intelligence.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            CJL turns raw CAN logs and DBC files into evidence-based diagnostics, reverse-engineering insight, decoded signal views, and polished reports for shops, fleets, and engineers.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="analyzer" size="lg">
              <Link to="/upload">
                Start Analysis <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to={localStorage.getItem("can_ai_file_id") ? `/results/${localStorage.getItem("can_ai_file_id")}` : "/upload"}>View Results</Link>
            </Button>
          </div>
          <div className="mt-8 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[[Gauge, "Pipelines", "4"], [Zap, "Formats", "12+"], [Activity, "Evidence", "Deep"], [ShieldAlert, "Reports", "Ready"]].map(([Icon, label, value]) => (
              <div key={String(label)} className="scanline-panel rounded-lg border border-glass-border bg-glass p-3 shadow-glow backdrop-blur">
                <Icon className="mb-2 size-4 text-primary" />
                <p className="text-xs font-semibold uppercase text-muted-foreground">{String(label)}</p>
                <p className="mt-1 font-mono text-lg font-bold text-foreground">{String(value)}</p>
              </div>
            ))}
          </div>
        </div>

        <Card className="scanline-panel animate-fade-up overflow-hidden [animation-delay:120ms]">
          <CardContent className="p-6">
            <div className="mb-6 flex items-center justify-between border-b border-glass-border pb-5">
              <div>
                <p className="text-sm font-semibold uppercase text-primary">SaaS command center</p>
                <h2 className="mt-2 text-2xl font-bold">From upload to decision-ready output</h2>
              </div>
              <ShieldAlert className="size-8 text-accent" />
            </div>
            <div className="grid gap-4">
              {workflow.map((item, index) => (
                <div key={item.label} className="group flex items-center gap-4 rounded-lg border border-glass-border bg-glass p-4 backdrop-blur transition-all duration-300 hover:border-primary/40 hover:shadow-glow">
                  <span className="grid size-12 place-items-center rounded-lg bg-gradient-accent font-bold text-primary-foreground shadow-glow transition-transform duration-300 group-hover:scale-105">
                    <item.icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.detail}</p>
                  </div>
                  <span className="font-mono text-sm text-muted-foreground">0{index + 1}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {personas.map((item) => (
          <div key={item.title} className="rounded-lg border border-glass-border bg-glass p-5 shadow-dashboard backdrop-blur">
            <item.icon className="mb-4 size-6 text-primary" />
            <h2 className="text-xl font-bold text-foreground">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-glass-border bg-glass-strong p-5 shadow-dashboard backdrop-blur">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase text-primary">Professional capabilities</p>
            <h2 className="mt-2 text-2xl font-bold text-foreground">Built like a paid SaaS product, without adding monetization yet.</h2>
          </div>
          <FileText className="size-8 text-accent" />
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {capabilities.map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-lg border border-glass-border bg-glass p-3 text-sm font-medium text-foreground">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  </main>
);

export default Home;
