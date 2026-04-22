import { ArrowRight, BarChart3, BrainCircuit, Radar, ShieldAlert, UploadCloud } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const workflow = [
  { label: "Upload CSV", detail: "Drop raw CAN captures", icon: UploadCloud },
  { label: "Analyze CAN IDs", detail: "Detect patterns instantly", icon: Radar },
  { label: "Review Dashboard", detail: "Inspect anomalies and signals", icon: BarChart3 },
];

const Home = () => (
  <main className="min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-10">
    <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col justify-center gap-10 py-10">
      <div className="grid items-center gap-10 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="animate-fade-up">
          <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-4 py-2 text-sm font-semibold text-primary shadow-glow backdrop-blur">
            <BrainCircuit className="size-4" />
            CAN bus intelligence
          </div>
          <h1 className="max-w-4xl text-5xl font-extrabold leading-tight text-foreground sm:text-6xl lg:text-7xl">CAN AI Analyzer</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Upload a CSV capture and turn raw CAN traffic into structured anomaly reports, signal candidates, and vehicle behavior insights.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="analyzer" size="lg">
              <Link to="/upload">
                Upload CSV <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to={localStorage.getItem("can_ai_file_id") ? `/results/${localStorage.getItem("can_ai_file_id")}` : "/upload"}>View Results</Link>
            </Button>
          </div>
        </div>

        <Card className="animate-fade-up overflow-hidden [animation-delay:120ms]">
          <CardContent className="p-6">
            <div className="mb-6 flex items-center justify-between border-b border-glass-border pb-5">
              <div>
                <p className="text-sm font-semibold uppercase text-primary">Analysis pipeline</p>
                <h2 className="mt-2 text-2xl font-bold">Premium CAN telemetry suite</h2>
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
    </section>
  </main>
);

export default Home;
