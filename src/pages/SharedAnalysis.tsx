import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, BarChart3, ExternalLink, Eye, FileText, Hash, MessageSquareText, ShieldCheck } from "lucide-react";

import { AnalysisCard } from "@/components/AnalysisCard";
import { JsonTable } from "@/components/JsonTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchSharedAnalysis, type SharedSnapshot } from "@/lib/shareApi";

const renderText = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
};

const SharedAnalysis = () => {
  const { token } = useParams<{ token: string }>();
  const [snapshot, setSnapshot] = useState<SharedSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setError("Missing share token.");
      setLoading(false);
      return;
    }
    fetchSharedAnalysis(token)
      .then((snap) => { if (!cancelled) setSnapshot(snap); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const result = snapshot?.result;
  const summaryRaw = result?.summary;
  const summaryText = summaryRaw && typeof summaryRaw === "object" && !Array.isArray(summaryRaw)
    ? renderText((summaryRaw as { text?: unknown }).text ?? summaryRaw)
    : renderText(summaryRaw);
  const anomalies = Array.isArray(result?.anomalies) ? result.anomalies : [];
  const idStats = Array.isArray(result?.id_stats) ? result.id_stats : [];
  const vb = result?.vehicle_behavior ?? {};

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-3 py-1 text-sm font-semibold uppercase text-primary shadow-glow backdrop-blur">
            <Eye className="size-4" />
            Read-Only Share
          </p>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {snapshot?.title || "Shared CAN Analysis"}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            {snapshot?.fileId ? <>Log ID: <span className="font-mono text-foreground">{snapshot.fileId}</span></> : "Public snapshot of a CAN intelligence analysis."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link to="/"><ExternalLink className="size-4" /> Open CJL CAN Intelligence</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <Card className="overflow-hidden">
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
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="p-6">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-destructive">
              <AlertTriangle className="size-5" /> Unable to load this share
            </h2>
            <p className="mt-2 text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : result ? (
        <div className="grid gap-6">
          <AnalysisCard title="Summary" icon={<MessageSquareText className="size-5" />}>
            <div className="rounded-lg border border-glass-border bg-glass p-4 text-sm leading-7 text-foreground backdrop-blur whitespace-pre-wrap [overflow-wrap:anywhere]">
              {summaryText}
            </div>
          </AnalysisCard>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card><CardContent className="p-5">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Total Messages</p>
              <p className="mt-3 text-3xl font-extrabold text-primary">{renderText(result.total_messages)}</p>
              <MessageSquareText className="mt-2 size-5 text-primary/70" />
            </CardContent></Card>
            <Card><CardContent className="p-5">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Unique IDs</p>
              <p className="mt-3 text-3xl font-extrabold text-primary">{renderText(result.unique_ids)}</p>
              <Hash className="mt-2 size-5 text-primary/70" />
            </CardContent></Card>
            <Card><CardContent className="p-5">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Anomalies</p>
              <p className="mt-3 text-3xl font-extrabold text-primary">{anomalies.length}</p>
              <ShieldCheck className="mt-2 size-5 text-primary/70" />
            </CardContent></Card>
          </div>

          <AnalysisCard title="Vehicle Behavior Candidates" icon={<BarChart3 className="size-5" />}>
            <div className="grid gap-4 lg:grid-cols-3">
              {([
                ["Speed", vb.possible_speed_ids],
                ["RPM", vb.possible_rpm_ids],
                ["Pedal", vb.possible_pedal_ids],
              ] as const).map(([label, items]) => (
                <div key={label} className="rounded-lg border border-glass-border bg-glass p-4 backdrop-blur">
                  <p className="text-xs font-bold uppercase text-muted-foreground">{label}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Array.isArray(items) && items.length ? items.map((it, i) => (
                      <span key={i} className="rounded-md border border-glass-border bg-secondary px-2 py-1 font-mono text-xs">{renderText(it)}</span>
                    )) : <span className="text-sm text-muted-foreground">None detected.</span>}
                  </div>
                </div>
              ))}
            </div>
          </AnalysisCard>

          {anomalies.length ? (
            <AnalysisCard title={`Anomalies (${anomalies.length})`} icon={<AlertTriangle className="size-5" />}>
              <JsonTable data={anomalies} />
            </AnalysisCard>
          ) : null}

          {idStats.length ? (
            <AnalysisCard title="Top CAN ID Activity" icon={<FileText className="size-5" />}>
              <JsonTable data={idStats} />
            </AnalysisCard>
          ) : null}

          <p className="text-center text-xs text-muted-foreground">
            Shared {snapshot?.createdAt ? new Date(snapshot.createdAt).toLocaleString() : ""}
            {snapshot?.expiresAt ? ` · expires ${new Date(snapshot.expiresAt).toLocaleString()}` : " · no expiration"}
          </p>
        </div>
      ) : null}
    </main>
  );
};

export default SharedAnalysis;
