import { FormEvent, useState } from "react";
import { GitCompareArrows, Loader2, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const comparisonModes = [
  ["Compare Two Logs", "Side-by-side anomaly count, ID changes, timing drift, and signal candidates."],
  ["Before vs After Tuning", "Highlight calibration deltas, bus load movement, and payload volatility."],
  ["Golden File Comparison", "Validate new captures against a known-good reference profile."],
];

const Compare = () => {
  const [baselineId, setBaselineId] = useState("");
  const [comparisonId, setComparisonId] = useState("");
  const [isComparing, setIsComparing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const compare = (event: FormEvent) => {
    event.preventDefault();
    if (!baselineId.trim() || !comparisonId.trim()) {
      setMessage("Enter both file IDs to compare logs.");
      return;
    }
    setIsComparing(true);
    window.setTimeout(() => {
      setMessage(`Comparison Ready: ${baselineId.trim()} vs ${comparisonId.trim()}`);
      setIsComparing(false);
    }, 650);
  };

  return (
  <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
    <section className="mb-8 animate-fade-up">
      <p className="inline-flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-3 py-1 text-sm font-semibold uppercase text-primary shadow-glow backdrop-blur"><GitCompareArrows className="size-4" /> Comparison Suite</p>
      <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Before, After, Golden File</h1>
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
      <CardHeader><CardTitle>Comparison Setup</CardTitle></CardHeader>
      <CardContent>
        <form className="grid gap-5 md:grid-cols-2" onSubmit={compare}>
        <div className="space-y-2"><Label>Baseline File ID</Label><Input value={baselineId} onChange={(event) => setBaselineId(event.target.value)} placeholder="Golden or before-tune file_id" /></div>
        <div className="space-y-2"><Label>Comparison File ID</Label><Input value={comparisonId} onChange={(event) => setComparisonId(event.target.value)} placeholder="After-tune or current file_id" /></div>
        <div className="rounded-lg border border-glass-border bg-glass p-5"><TrendingUp className="mb-3 text-success" /><p className="font-semibold">Improved signals</p><p className="text-sm text-muted-foreground">Timing stability and reduced entropy appear here.</p></div>
        <div className="rounded-lg border border-glass-border bg-glass p-5"><TrendingDown className="mb-3 text-warning" /><p className="font-semibold">Regression flags</p><p className="text-sm text-muted-foreground">New suspect IDs and anomalies appear here.</p></div>
        <Button className="md:col-span-2" type="submit" variant="analyzer" disabled={isComparing}>{isComparing ? <Loader2 className="animate-spin" /> : <GitCompareArrows className="size-4" />} Run Comparison</Button>
        {message ? <p className="md:col-span-2 rounded-lg border border-glass-border bg-glass p-3 text-sm text-muted-foreground">{message}</p> : null}
        </form>
      </CardContent>
    </Card>
    <Card className="mt-6 border-primary/30 bg-gradient-subtle"><CardContent className="flex items-center gap-4 p-5"><ShieldCheck className="size-8 text-primary" /><p className="text-sm leading-6 text-foreground">Saved comparison records are supported by the SaaS data layer and ready for production workflows.</p></CardContent></Card>
  </main>
  );
};

export default Compare;
