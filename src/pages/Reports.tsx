import { useState } from "react";
import { BellRing, CheckCircle2, Code2, Download, FileJson, FileText, Link2, ShieldCheck, Share2, Webhook } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const reportTypes = [
  ["Vehicle Health PDF", "Mechanic-friendly summary, fault prediction, health scores, and service recommendations.", FileText],
  ["Engineering JSON", "Raw normalized intelligence package for developer pipelines and notebooks.", FileJson],
  ["Shareable Link", "Controlled access links for customers, shop teams, or fleet stakeholders.", Share2],
  ["Webhook Notifications", "Push completion, anomaly, and fleet maintenance events to external systems.", Webhook],
] as const;

const Reports = () => {
  const [configured, setConfigured] = useState<string | null>(null);

  const configure = (title: string) => {
    setConfigured(`${title} configured for the current workspace.`);
  };

  return (
  <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
    <section className="mb-8 animate-fade-up rounded-lg border border-glass-border bg-glass-strong p-5 shadow-dashboard backdrop-blur sm:p-7">
      <p className="inline-flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-3 py-1 text-sm font-semibold uppercase text-primary shadow-glow backdrop-blur"><Download className="size-4" /> Reports & API</p>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_0.75fr] lg:items-end">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Export, Share, and Automate</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">Commercial reporting, developer API access, and notification surfaces for production diagnostics workflows.</p>
        </div>
        <div className="rounded-lg border border-primary/30 bg-gradient-subtle p-4">
          <ShieldCheck className="mb-3 size-6 text-primary" />
          <p className="font-semibold text-foreground">Professional delivery layer</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Outputs are structured for customer review, engineering export, and workflow automation.</p>
        </div>
      </div>
    </section>

    <div className="grid gap-6 lg:grid-cols-4">
      {reportTypes.map(([title, detail, Icon]) => <Card key={title} className="animate-fade-up overflow-hidden"><CardContent className="p-6"><Icon className="mb-5 size-8 text-primary" /><h2 className="text-lg font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p><Button className="mt-5 w-full" variant="outline" size="sm" onClick={() => configure(title)}>Configure</Button></CardContent></Card>)}
    </div>
    {configured ? <div className="mt-6 flex items-center gap-2 rounded-lg border border-glass-border bg-glass p-4 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-success" /> {configured}</div> : null}

    <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card className="animate-fade-up overflow-hidden"><CardHeader><CardTitle className="flex items-center gap-2"><Code2 className="text-primary" /> Developer API Access</CardTitle></CardHeader><CardContent><div className="rounded-lg border border-glass-border bg-glass p-4 font-mono text-sm text-muted-foreground">POST /functions/v1/upload<br />POST /functions/v1/analyze<br />POST /functions/v1/ai-diagnostics</div><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-lg bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">analysis:read</span><span className="rounded-lg bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">analysis:write</span><span className="rounded-lg bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">fleet:read</span></div></CardContent></Card>
      <Card className="animate-fade-up overflow-hidden"><CardHeader><CardTitle className="flex items-center gap-2"><BellRing className="text-primary" /> Automation Events</CardTitle></CardHeader><CardContent className="grid gap-3">{["analysis.completed", "anomaly.detected", "fleet.maintenance_due", "comparison.regression_found"].map((event) => <div key={event} className="flex items-center justify-between rounded-lg border border-glass-border bg-glass p-4"><span className="font-mono text-sm text-foreground">{event}</span><Link2 className="size-4 text-primary" /></div>)}</CardContent></Card>
    </div>
  </main>
  );
};

export default Reports;
