import { AlertTriangle, BarChart3, Binary, BrainCircuit, Gauge, Hash, MessageSquareText, Radar } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { AnalysisCard } from "@/components/AnalysisCard";
import { JsonTable } from "@/components/JsonTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { analyzeFile, AnalysisResult } from "@/lib/canApi";

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

const DiagnosticBlock = ({ field, value, collapsible = false }: { field: string; value: unknown; collapsible?: boolean }) => {
  if (collapsible) {
    return (
      <details className="group rounded-lg border border-glass-border bg-glass p-4 backdrop-blur transition-all duration-300 hover:shadow-glow">
        <summary className="cursor-pointer list-none font-mono text-sm font-semibold text-primary transition-colors group-open:mb-4">
          {field}
        </summary>
        <JsonTable data={value} />
      </details>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-glass-border bg-glass p-4 backdrop-blur transition-all duration-300 hover:shadow-glow">
      <h3 className="font-mono text-sm font-semibold text-primary">{field}</h3>
      <JsonTable data={value} />
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

          <div className="grid gap-6 xl:grid-cols-2">
            <AnalysisCard title="Basic View" description="Frequency distribution by CAN identifier." icon={<Binary className="size-5" />}>
              <JsonTable data={data.id_stats} />
            </AnalysisCard>

            <AnalysisCard title="Diagnostics" description="Backend-detected anomalies in the capture." icon={<AlertTriangle className="size-5" />}>
              <JsonTable data={data.anomalies} />
            </AnalysisCard>
          </div>

          <AnalysisCard title="Reverse Engineering" description="Clustered identifiers and inferred signal groups." icon={<Radar className="size-5" />}>
            <JsonTable data={data.reverse_engineering} />
          </AnalysisCard>

          <AnalysisCard title="Vehicle Behavior" icon={<Gauge className="size-5" />}>
            <div className="grid gap-5">
              <div className="grid gap-5 lg:grid-cols-3">
                <div className="space-y-3"><h3 className="font-semibold">Possible Speed IDs</h3>{renderList(vehicleBehavior.possible_speed_ids)}</div>
                <div className="space-y-3"><h3 className="font-semibold">Possible RPM IDs</h3>{renderList(vehicleBehavior.possible_rpm_ids)}</div>
                <div className="space-y-3"><h3 className="font-semibold">Possible Pedal IDs</h3>{renderList(vehicleBehavior.possible_pedal_ids)}</div>
              </div>
              <JsonTable data={vehicleBehavior} />
            </div>
          </AnalysisCard>

          <AnalysisCard title="Advanced Diagnostics" description="Complete diagnostics payload returned by the backend." icon={<BrainCircuit className="size-5" />}>
            <JsonTable data={data.diagnostics} />
          </AnalysisCard>
        </div>
      ) : null}
    </main>
  );
};

export default Results;
