import { AlertTriangle, Activity, BarChart3, Binary, BrainCircuit, ChevronDown, Clock, Cpu, Gauge, Hash, Layers3, MessageSquareText, Radar, ShieldCheck, Wrench, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AnalysisCard } from "@/components/AnalysisCard";
import { JsonTable } from "@/components/JsonTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { analyzeFile, AnalysisResult } from "@/lib/canApi";
import { cn } from "@/lib/utils";

const renderText = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "No summary returned.";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
};

const renderList = (value: unknown) => {
  const items = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];

  if (!items.length) {
    return <div className="rounded-lg border border-dashed border-glass-border bg-glass p-4 text-sm text-muted-foreground backdrop-blur">No values returned.</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <span key={`${String(item)}-${index}`} className="rounded-lg border border-glass-border bg-secondary px-3 py-2 font-mono text-sm text-secondary-foreground shadow-glow">
          {renderText(item)}
        </span>
      ))}
    </div>
  );
};

const toRecordArray = (value: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(value)) return value.map((item, index) => (item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : { item: index + 1, value: item }));
  if (value && typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([key, item]) => (item && typeof item === "object" && !Array.isArray(item) ? { key, ...(item as Record<string, unknown>) } : { key, value: item }));
  return [];
};

const numericValue = (row: Record<string, unknown>, keys: string[]) => {
  const value = keys.map((key) => row[key]).find((item) => typeof item === "number" || (typeof item === "string" && !Number.isNaN(Number(item))));
  return value === undefined ? 0 : Number(value);
};

const CollapsiblePanel = ({ title, icon, children, defaultOpen = false }: { title: string; icon: ReactNode; children: ReactNode; defaultOpen?: boolean }) => (
  <details open={defaultOpen} className="group overflow-hidden rounded-lg border border-glass-border bg-glass backdrop-blur-xl transition-all duration-300 hover:border-primary/30 hover:shadow-glow">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5">
      <span className="flex items-center gap-3 text-lg font-bold text-foreground">
        <span className="grid size-10 place-items-center rounded-lg border border-glass-border bg-gradient-subtle text-primary shadow-glow">{icon}</span>
        {title}
      </span>
      <ChevronDown className="size-5 text-muted-foreground transition-transform duration-300 group-open:rotate-180" />
    </summary>
    <div className="border-t border-glass-border p-5 animate-fade-up">{children}</div>
  </details>
);

const FrequencyChart = ({ data }: { data: unknown }) => {
  const rows = toRecordArray(data).map((row, index) => ({ name: String(row.id ?? row.can_id ?? row.arbitration_id ?? row.identifier ?? row.key ?? index + 1), count: numericValue(row, ["count", "frequency", "messages", "total", "value"]) }));
  if (!rows.length) return null;
  return (
    <div className="mb-4 h-56 rounded-lg border border-glass-border bg-glass p-4 backdrop-blur">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows.slice(0, 16)}>
          <CartesianGrid stroke="hsl(var(--glass-border))" vertical={false} />
          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
          <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
          <Tooltip cursor={{ fill: "hsl(var(--secondary) / 0.45)" }} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--glass-border))", borderRadius: "12px" }} />
          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const ByteEntropyHeatmap = ({ data }: { data: unknown }) => {
  const rows = toRecordArray(data).slice(0, 64);
  if (!rows.length) return <JsonTable data={data} />;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
      {rows.map((row, index) => {
        const entropy = Math.max(0, Math.min(1, numericValue(row, ["entropy", "score", "value", "variance"]) / 8 || numericValue(row, ["entropy", "score", "value", "variance"])));
        return (
          <div key={`${String(row.key ?? index)}-${index}`} className="rounded-lg border border-glass-border bg-glass p-3 shadow-glow backdrop-blur" style={{ opacity: 0.42 + entropy * 0.58 }}>
            <p className="font-mono text-xs text-muted-foreground">{String(row.byte ?? row.key ?? `byte_${index}`)}</p>
            <p className="mt-2 text-lg font-bold text-primary">{renderText(row.entropy ?? row.score ?? row.value ?? "—")}</p>
          </div>
        );
      })}
    </div>
  );
};

const TimingLineChart = ({ data }: { data: unknown }) => {
  const rows = toRecordArray(data).map((row, index) => ({ name: String(row.key ?? row.timestamp ?? index + 1), jitter: numericValue(row, ["jitter", "period_jitter", "period", "delta", "value"]) }));
  if (!rows.length) return <JsonTable data={data} />;
  return (
    <div className="mb-4 h-56 rounded-lg border border-glass-border bg-glass p-4 backdrop-blur">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows.slice(0, 48)}>
          <CartesianGrid stroke="hsl(var(--glass-border))" vertical={false} />
          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
          <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--glass-border))", borderRadius: "12px" }} />
          <Line type="monotone" dataKey="jitter" stroke="hsl(var(--chart-cyan))" strokeWidth={3} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const SystemsBadges = ({ data }: { data: unknown }) => {
  const rows = toRecordArray(data);
  if (!rows.length) return <JsonTable data={data} />;
  return <div className="flex flex-wrap gap-2">{rows.map((row, index) => <span key={index} className="rounded-lg border border-glass-border bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground shadow-glow">{renderText(row.category ?? row.key ?? row.system ?? row.value)}</span>)}</div>;
};

const MechanicSummary = ({ data }: { data: unknown }) => (
  <div className="rounded-lg border border-primary/30 bg-gradient-subtle p-5 shadow-glow backdrop-blur">
    <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">{renderText(data)}</p>
  </div>
);

const scoreTone = (score: number) => score >= 80 ? "text-success" : score >= 55 ? "text-warning" : "text-destructive";

const InsightCard = ({ title, value, detail, icon: Icon, score }: { title: string; value: string; detail: string; icon: typeof Activity; score?: number }) => (
  <Card className="animate-fade-up overflow-hidden">
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-muted-foreground">{title}</p>
          <p className={cn("mt-3 text-2xl font-extrabold", score === undefined ? "text-primary" : scoreTone(score))}>{value}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
        </div>
        <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-glass-border bg-glass text-primary shadow-glow backdrop-blur"><Icon className="size-5" /></span>
      </div>
    </CardContent>
  </Card>
);

const BitToggleVisualization = ({ data }: { data: unknown }) => {
  const rows = toRecordArray(data).slice(0, 64);
  if (!rows.length) return <JsonTable data={data} />;
  return (
    <div className="mb-4 grid grid-cols-8 gap-2 sm:grid-cols-16">
      {rows.map((row, index) => {
        const activity = Math.max(0, Math.min(1, numericValue(row, ["activity", "transitions", "ones", "value"])));
        return <div key={index} title={`bit ${renderText(row.bit ?? index)}`} className="aspect-square rounded-md border border-glass-border bg-secondary shadow-glow transition-all duration-300 hover:scale-110" style={{ opacity: 0.35 + activity * 0.65 }} />;
      })}
    </div>
  );
};

const IdActivityTimeline = ({ data }: { data: unknown }) => {
  const rows = toRecordArray(data).slice(0, 24);
  if (!rows.length) return null;
  const max = Math.max(...rows.map((row) => numericValue(row, ["count", "frequency", "messages", "total", "value"])), 1);
  return (
    <div className="grid gap-3 rounded-lg border border-glass-border bg-glass p-4 backdrop-blur">
      {rows.map((row, index) => {
        const count = numericValue(row, ["count", "frequency", "messages", "total", "value"]);
        return (
          <div key={index} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-3 text-sm">
            <span className="truncate font-mono text-muted-foreground">{renderText(row.id ?? row.key ?? index + 1)}</span>
            <span className="h-2 overflow-hidden rounded-full bg-secondary"><span className="block h-full rounded-full bg-gradient-accent" style={{ width: `${Math.max(6, (count / max) * 100)}%` }} /></span>
            <span className="text-right font-mono text-foreground">{count}</span>
          </div>
        );
      })}
    </div>
  );
};

const ByteCorrelationHeatmap = ({ data }: { data: unknown }) => {
  const rows = toRecordArray(data).slice(0, 8);
  if (!rows.length) return null;
  return (
    <div className="grid grid-cols-8 gap-1 rounded-lg border border-glass-border bg-glass p-3 backdrop-blur">
      {Array.from({ length: 64 }, (_, index) => {
        const row = rows[index % rows.length] ?? {};
        const strength = Math.max(0.15, Math.min(1, numericValue(row, ["entropy", "unique_values", "observed_count", "value"]) / 8));
        return <span key={index} className="aspect-square rounded-sm bg-primary transition-transform duration-300 hover:scale-125" style={{ opacity: strength }} />;
      })}
    </div>
  );
};

const MiniChart = () => (
  <div className="flex h-24 items-end gap-2 rounded-lg border border-glass-border bg-glass p-4 backdrop-blur">
    {[42, 64, 38, 78, 52, 88, 68, 96, 58, 74].map((height, index) => (
      <span
        key={index}
        className="flex-1 rounded-full bg-gradient-accent opacity-80 shadow-glow motion-safe:animate-pulse-glow"
        style={{ height: `${height}%`, animationDelay: `${index * 120}ms` }}
      />
    ))}
  </div>
);

const MetricCard = ({ title, value, icon: Icon }: { title: string; value: unknown; icon: typeof MessageSquareText }) => (
  <Card className="animate-fade-up overflow-hidden">
    <CardContent className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase text-muted-foreground">{title}</p>
          <p className="mt-4 text-4xl font-extrabold text-primary">{renderText(value)}</p>
        </div>
        <div className="grid size-12 place-items-center rounded-lg border border-glass-border bg-glass text-primary shadow-glow backdrop-blur">
          <Icon className="size-6" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const Results = () => {
  const { id, file_id } = useParams();
  const fileId = file_id ?? id;
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadAnalysis = async () => {
      if (!fileId) {
        setError("Missing file id in the URL.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await analyzeFile(fileId);
        if (isMounted) {
          setAnalysis(result);
          localStorage.setItem("can_ai_file_id", fileId);
        }
      } catch (analysisError) {
        if (isMounted) setError(analysisError instanceof Error ? analysisError.message : "Analysis request failed.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadAnalysis();

    return () => {
      isMounted = false;
    };
  }, [fileId]);

  const data = analysis;
  const anomalies = data?.anomalies ?? [];
  const vehicleBehavior = data?.vehicle_behavior ?? {};
  const summary = data?.summary;
  const summaryText = summary && typeof summary === "object" && !Array.isArray(summary) ? summary.text ?? summary : summary;
  const diagnostics = data?.diagnostics ?? {};
  const idStats = data?.id_stats ?? [];
  const busLoad = Math.min(100, Math.round(((data?.total_messages ?? 0) / Math.max(Number(data?.unique_ids ?? 1), 1)) * 10));
  const componentHealth = Math.max(0, Math.min(100, 100 - anomalies.length * 12));
  const suspectIds = toRecordArray(idStats).filter((row) => numericValue(row, ["count", "frequency", "messages", "total", "value"]) > 1).length;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="animate-fade-up">
          <p className="inline-flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-3 py-1 text-sm font-semibold uppercase text-primary shadow-glow backdrop-blur">
            <BrainCircuit className="size-4" />
            Results dashboard
          </p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">CAN analysis</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">File ID: <span className="font-mono text-foreground">{fileId ?? "—"}</span></p>
        </div>
        <Button asChild variant="outline">
          <Link to="/upload">Analyze another CSV</Link>
        </Button>
      </div>

      {isLoading ? (
        <Card className="animate-fade-up overflow-hidden">
          <CardContent className="space-y-5 p-6">
            <div className="h-5 w-56 animate-pulse rounded-lg bg-muted" />
            <div className="h-28 animate-pulse rounded-lg bg-muted" />
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="h-24 animate-pulse rounded-lg bg-muted" />
              <div className="h-24 animate-pulse rounded-lg bg-muted" />
              <div className="h-24 animate-pulse rounded-lg bg-muted" />
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive/40 bg-destructive/10 shadow-dashboard">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-destructive">Unable to load results</h2>
            <p className="mt-2 text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : data ? (
        <div className="grid gap-6">
          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <AnalysisCard title="Summary" icon={<MessageSquareText className="size-5" />}>
              <pre className="whitespace-pre-wrap rounded-lg border border-glass-border bg-glass p-5 text-sm leading-7 text-foreground backdrop-blur">{renderText(summaryText)}</pre>
            </AnalysisCard>
            <AnalysisCard title="Signal Activity" description="Live telemetry intensity preview." icon={<BarChart3 className="size-5" />}>
              <MiniChart />
            </AnalysisCard>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <MetricCard title="Total Messages" value={data.total_messages} icon={MessageSquareText} />
            <MetricCard title="Unique IDs" value={data.unique_ids} icon={Hash} />
            <MetricCard title="Anomalies Detected" value={anomalies.length} icon={AlertTriangle} />
          </div>

          <div className="grid gap-6 lg:grid-cols-4">
            <InsightCard title="Fault Prediction" value={anomalies.length ? "Watch" : "Low risk"} detail="Derived from anomaly density and ID activity." icon={ShieldCheck} />
            <InsightCard title="Component Health" value={`${componentHealth}/100`} detail="Heuristic score from detected anomalies." icon={Gauge} score={componentHealth} />
            <InsightCard title="Suspect IDs" value={String(suspectIds)} detail="High-activity candidates for review." icon={Radar} />
            <InsightCard title="CAN Bus Load" value={`${busLoad}%`} detail="Estimated from message volume per identifier." icon={Zap} score={100 - busLoad} />
          </div>

          <AnalysisCard title="Mechanic Mode" description="Simplified diagnostic summary for service workflows." icon={<Wrench className="size-5" />}>
            <MechanicSummary data={diagnostics.mechanic_summary ?? summaryText} />
          </AnalysisCard>

          <div className="grid gap-5">
            <CollapsiblePanel title="Basic View" icon={<Binary className="size-5" />} defaultOpen>
              <FrequencyChart data={idStats} />
              <div className="mb-4"><IdActivityTimeline data={idStats} /></div>
              <JsonTable data={idStats} />
            </CollapsiblePanel>

            <CollapsiblePanel title="Diagnostics" icon={<AlertTriangle className="size-5" />} defaultOpen>
              <JsonTable data={data.anomalies} />
            </CollapsiblePanel>

            <CollapsiblePanel title="Reverse Engineering" icon={<Radar className="size-5" />}>
              <JsonTable data={data.reverse_engineering} />
            </CollapsiblePanel>

            <CollapsiblePanel title="Vehicle Behavior" icon={<Gauge className="size-5" />}>
              <div className="grid gap-5">
                <div className="grid gap-5 lg:grid-cols-3">
                  <div className="space-y-3"><h3 className="font-semibold">Possible Speed IDs</h3>{renderList(vehicleBehavior.possible_speed_ids)}</div>
                  <div className="space-y-3"><h3 className="font-semibold">Possible RPM IDs</h3>{renderList(vehicleBehavior.possible_rpm_ids)}</div>
                  <div className="space-y-3"><h3 className="font-semibold">Possible Pedal IDs</h3>{renderList(vehicleBehavior.possible_pedal_ids)}</div>
                </div>
                <JsonTable data={vehicleBehavior} />
              </div>
            </CollapsiblePanel>
          </div>

          <AnalysisCard title="Advanced Diagnostics" description="Complete diagnostics payload returned by the backend." icon={<BrainCircuit className="size-5" />}>
            <div className="grid gap-4">
              <CollapsiblePanel title="protocol" icon={<Cpu className="size-5" />} defaultOpen><JsonTable data={diagnostics.protocol} /></CollapsiblePanel>
              <CollapsiblePanel title="byte_analysis" icon={<Layers3 className="size-5" />}><ByteEntropyHeatmap data={diagnostics.byte_analysis} /><div className="mt-4"><ByteCorrelationHeatmap data={diagnostics.byte_analysis} /></div><div className="mt-4"><JsonTable data={diagnostics.byte_analysis} /></div></CollapsiblePanel>
              <CollapsiblePanel title="bit_analysis" icon={<Binary className="size-5" />}><BitToggleVisualization data={diagnostics.bit_analysis} /><JsonTable data={diagnostics.bit_analysis} /></CollapsiblePanel>
              <CollapsiblePanel title="timing" icon={<Clock className="size-5" />}><TimingLineChart data={diagnostics.timing} /><JsonTable data={diagnostics.timing} /></CollapsiblePanel>
              <CollapsiblePanel title="signals" icon={<Radar className="size-5" />}><JsonTable data={diagnostics.signals} /></CollapsiblePanel>
              <CollapsiblePanel title="systems" icon={<Gauge className="size-5" />}><SystemsBadges data={diagnostics.systems} /><div className="mt-4"><JsonTable data={diagnostics.systems} /></div></CollapsiblePanel>
              <CollapsiblePanel title="mechanic_summary" icon={<Wrench className="size-5" />} defaultOpen><MechanicSummary data={diagnostics.mechanic_summary} /></CollapsiblePanel>
            </div>
          </AnalysisCard>
        </div>
      ) : null}
    </main>
  );
};

export default Results;
