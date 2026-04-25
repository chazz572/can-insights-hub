import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, Eye, Loader2, ShieldCheck } from "lucide-react";

import { AnalysisCard } from "@/components/AnalysisCard";
import { JsonTable } from "@/components/JsonTable";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchSharedAnalysis, type SharedAnalysisRecord } from "@/lib/shareApi";

const SharedAnalysis = () => {
  const { token } = useParams();
  const [record, setRecord] = useState<SharedAnalysisRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!token) { setError("Missing share token."); setLoading(false); return; }
      try {
        const data = await fetchSharedAnalysis(token);
        if (mounted) setRecord(data);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "Unable to load shared analysis.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [token]);

  const data = record?.result_snapshot;
  const anomalies = Array.isArray(data?.anomalies) ? data!.anomalies : [];
  const idStats = data?.id_stats ?? [];

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
      <div className="mb-6 animate-fade-up">
        <p className="inline-flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-3 py-1 text-sm font-semibold uppercase text-primary shadow-glow backdrop-blur">
          <Eye className="size-4" /> Read-Only Shared Analysis
        </p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{record?.title ?? "Shared CAN Analysis"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Shared on {record ? new Date(record.created_at).toLocaleString() : "—"}
          {record?.expires_at ? ` • Expires ${new Date(record.expires_at).toLocaleString()}` : " • Never expires"}
        </p>
      </div>

      {loading ? (
        <Card><CardContent className="flex items-center gap-3 p-6 text-muted-foreground"><Loader2 className="size-5 animate-spin text-primary" /> Loading shared analysis…</CardContent></Card>
      ) : error ? (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-destructive"><AlertTriangle className="size-5" /><h2 className="text-lg font-semibold">Unable to load</h2></div>
            <p className="mt-2 text-sm text-destructive">{error}</p>
            <Button asChild variant="outline" className="mt-4"><Link to="/">Go Home</Link></Button>
          </CardContent>
        </Card>
      ) : data ? (
        <div className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-3">
            {[["Total Messages", data.total_messages], ["Unique IDs", data.unique_ids], ["Anomalies", anomalies.length]].map(([label, value]) => (
              <Card key={String(label)}><CardContent className="p-5"><p className="text-xs font-semibold uppercase text-muted-foreground">{String(label)}</p><p className="mt-2 text-3xl font-extrabold text-primary">{String(value ?? "—")}</p></CardContent></Card>
            ))}
          </div>

          <AnalysisCard title="Summary" icon={<ShieldCheck className="size-5" />}>
            <div className="whitespace-pre-wrap rounded-lg border border-glass-border bg-glass p-4 text-sm leading-7 text-foreground">
              {typeof data.summary === "string" ? data.summary : JSON.stringify(data.summary, null, 2)}
            </div>
          </AnalysisCard>

          <AnalysisCard title="Top CAN ID Activity"><JsonTable data={idStats} /></AnalysisCard>
          <AnalysisCard title="Anomalies"><JsonTable data={anomalies} /></AnalysisCard>
          <AnalysisCard title="Vehicle Behavior Candidates"><JsonTable data={data.vehicle_behavior} /></AnalysisCard>

          <p className="text-center text-xs text-muted-foreground">This is a read-only view. Sign in and create your own analysis to unlock the full toolkit.</p>
        </div>
      ) : null}
    </main>
  );
};

export default SharedAnalysis;
