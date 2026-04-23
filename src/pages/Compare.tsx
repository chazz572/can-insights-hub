import { GitCompareArrows, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const comparisonModes = [
  ["Compare Two Logs", "Side-by-side anomaly count, ID changes, timing drift, and signal candidates."],
  ["Before vs After Tuning", "Highlight calibration deltas, bus load movement, and payload volatility."],
  ["Golden File Comparison", "Validate new captures against a known-good reference profile."],
];

const Compare = () => (
  <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
    <section className="mb-8 animate-fade-up">
      <p className="inline-flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-3 py-1 text-sm font-semibold uppercase text-primary shadow-glow backdrop-blur"><GitCompareArrows className="size-4" /> Comparison suite</p>
      <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Before, after, golden file</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">Commercial comparison workflows for tuning validation, regression checks, and known-good fleet baselines.</p>
    </section>
    <div className="grid gap-6 lg:grid-cols-3">
      {comparisonModes.map(([title, text], index) => (
        <Card key={title} className="animate-fade-up overflow-hidden">
          <CardContent className="p-6">
            <span className="grid size-12 place-items-center rounded-lg bg-gradient-accent text-primary-foreground shadow-glow">0{index + 1}</span>
            <h2 className="mt-5 text-xl font-bold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
          </CardContent>
        </Card>
      ))}
    </div>
    <Card className="mt-6 animate-fade-up overflow-hidden">
      <CardHeader><CardTitle>Comparison setup</CardTitle></CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2"><Label>Baseline file ID</Label><Input placeholder="Golden or before-tune file_id" /></div>
        <div className="space-y-2"><Label>Comparison file ID</Label><Input placeholder="After-tune or current file_id" /></div>
        <div className="rounded-lg border border-glass-border bg-glass p-5"><TrendingUp className="mb-3 text-success" /><p className="font-semibold">Improved signals</p><p className="text-sm text-muted-foreground">Timing stability and reduced entropy appear here.</p></div>
        <div className="rounded-lg border border-glass-border bg-glass p-5"><TrendingDown className="mb-3 text-warning" /><p className="font-semibold">Regression flags</p><p className="text-sm text-muted-foreground">New suspect IDs and anomalies appear here.</p></div>
      </CardContent>
    </Card>
    <Card className="mt-6 border-primary/30 bg-gradient-subtle"><CardContent className="flex items-center gap-4 p-5"><ShieldCheck className="size-8 text-primary" /><p className="text-sm leading-6 text-foreground">Saved comparison records are supported by the SaaS data layer and ready for production workflows.</p></CardContent></Card>
  </main>
);

export default Compare;
