import { Activity, ArrowRight, BarChart3, Car, CheckCircle2, DatabaseZap, FileText, Gauge, Radar, ShieldAlert, UploadCloud, Wrench, Zap } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

const workflow = [
  { step: "01", label: "Intake", detail: "Drop in LOG, DBC, or batch — auto-routed to the right pipeline.", icon: UploadCloud },
  { step: "02", label: "Diagnose", detail: "Timing, entropy, active IDs, decoded signals, anomaly flags.", icon: Radar },
  { step: "03", label: "Deliver", detail: "Mechanic summary, RE views, scope traces, customer-ready report.", icon: BarChart3 },
];

const personas = [
  { title: "EV Repair Bay", detail: "Plain-English evidence for batteries, charging, inverter, thermal, and chassis faults.", icon: Zap, code: "EV-01" },
  { title: "Fleet Service", detail: "Vehicle health, saved diagnostics, comparison workflows, ops reporting.", icon: Car, code: "FL-02" },
  { title: "CAN Bench", detail: "DBC inspection, byte-level RE, timing integrity, counters, checksums, signals.", icon: DatabaseZap, code: "EN-03" },
];

const capabilities = [
  "Auto-routing — LOG / DBC / LOG+DBC / Batch",
  "Timing, jitter, gap, frequency analysis",
  "DBC message + signal + bit-layout viewer",
  "Decoded signal dashboards w/ DBC",
  "AI Mechanic + AI Reverse Engineer summaries",
  "Fleet · Compare · Visualize · Reports",
];

const Stat = ({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) => (
  <div className="data-panel riveted relative p-3">
    <Icon className="mb-1.5 size-4 text-primary" />
    <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
    <p className="led-readout text-2xl">{value}</p>
  </div>
);

const Home = () => (
  <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
    <section className="mx-auto max-w-7xl space-y-6">
      {/* Service order header */}
      <div className="data-panel riveted relative overflow-hidden">
        <div className="grid items-center gap-8 p-6 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-sm border border-glass-border bg-card/60 px-3 py-1.5">
              <span className="status-led" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-foreground">Service Bay · Online</span>
            </div>
            <h1 className="font-display text-4xl font-bold leading-[1.05] text-foreground sm:text-5xl lg:text-6xl">
              CAN Diagnostics<br />
              <span className="text-primary">Built For The Bench.</span>
            </h1>
            <p className="mt-5 max-w-xl font-sans text-base leading-7 text-muted-foreground">
              Raw CAN logs in. Evidence-based diagnostics, decoded signals, reverse-engineering insight, and shop-ready reports out. No fluff.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="rounded-sm font-display uppercase tracking-wider">
                <Link to="/upload">
                  <Wrench className="size-4" />
                  Start Job <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-sm border-2 font-display uppercase tracking-wider">
                <Link to={localStorage.getItem("can_ai_file_id") ? `/results/${localStorage.getItem("can_ai_file_id")}` : "/upload"}>
                  Open Last Diagnostic
                </Link>
              </Button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat icon={Gauge} label="Pipelines" value="04" />
              <Stat icon={Zap} label="Formats" value="12+" />
              <Stat icon={Activity} label="Evidence" value="DEEP" />
              <Stat icon={ShieldAlert} label="Reports" value="RDY" />
            </div>
          </div>

          {/* Workflow chart — looks like a service order */}
          <div className="data-panel scanline-panel relative p-5">
            <div className="mb-4 flex items-center justify-between border-b-2 border-dashed border-glass-border pb-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">— Work Order —</p>
                <h2 className="mt-1 font-display text-xl font-bold uppercase">Intake → Output</h2>
              </div>
              <div className="rounded-sm border border-glass-border bg-background/60 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                #WO-001
              </div>
            </div>
            <div className="space-y-2">
              {workflow.map((item) => (
                <div key={item.label} className="group flex items-center gap-3 rounded-sm border border-glass-border bg-card/40 p-3 transition-colors hover:border-primary/40">
                  <span className="grid size-12 shrink-0 place-items-center rounded-sm border border-glass-border bg-secondary font-display text-base font-bold text-foreground">
                    {item.step}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-foreground">
                      <item.icon className="size-3.5 text-muted-foreground" />
                      {item.label}
                    </p>
                    <p className="mt-0.5 font-sans text-xs leading-5 text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t-2 border-dashed border-glass-border pt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Tech: AUTO</span>
              <span>Status: <span className="text-success">READY</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* Service stations */}
      <div>
        <p className="stencil mb-3 text-xs text-muted-foreground">— Service Stations —</p>
        <div className="grid gap-3 lg:grid-cols-3">
          {personas.map((item) => (
            <div key={item.title} className="data-panel riveted relative p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-sm bg-secondary text-primary">
                  <item.icon className="size-5" />
                </span>
                <span className="rounded-sm border border-glass-border bg-background/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {item.code}
                </span>
              </div>
              <h2 className="font-display text-lg font-bold uppercase tracking-wide text-foreground">{item.title}</h2>
              <p className="mt-2 font-sans text-sm leading-6 text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tool inventory */}
      <div className="data-panel relative overflow-hidden p-5 sm:p-6">
        <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="stencil text-xs text-primary">— Tool Inventory —</p>
            <h2 className="mt-1 font-display text-2xl font-bold uppercase text-foreground">Certified · Stocked · Ready</h2>
          </div>
          <FileText className="size-7 text-primary" />
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {capabilities.map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-sm border border-glass-border bg-card/40 p-3 font-sans text-sm text-foreground">
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
