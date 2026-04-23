import { useEffect, useState } from "react";
import { BarChart3, Files, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyzeFile, type AnalysisResult, type UploadResult } from "@/lib/canApi";

type BatchItem = UploadResult & { analysis?: AnalysisResult; loading?: boolean };

const BatchResults = () => {
  const [items, setItems] = useState<BatchItem[]>(() => {
    try { return JSON.parse(sessionStorage.getItem("can_ai_batch_results") ?? "[]"); } catch { return []; }
  });

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const next = await Promise.all(items.map(async (item) => {
        if (!item.file_id) return item;
        try {
          return { ...item, analysis: await analyzeFile(item.file_id), loading: false };
        } catch (error) {
          return { ...item, error: error instanceof Error ? error.message : "Analysis failed", loading: false };
        }
      }));
      if (mounted) setItems(next);
    };
    run();
    return () => { mounted = false; };
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
      <section className="mb-8 animate-fade-up">
        <p className="inline-flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-3 py-1 text-sm font-semibold uppercase text-primary shadow-glow backdrop-blur"><Files className="size-4" /> Multi-File Analysis</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Batch Results Dashboard</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">Every uploaded CAN log was converted to normalized CSV and analyzed independently using the existing engine.</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {items.map((item) => (
          <Card key={item.filename} className="animate-fade-up overflow-hidden">
            <CardHeader><CardTitle className="flex items-center justify-between gap-3"><span className="truncate">{item.filename}</span><span className="rounded-lg bg-secondary px-3 py-1 text-xs text-secondary-foreground">{item.detected_format}</span></CardTitle></CardHeader>
            <CardContent>
              {item.analysis ? (
                <div className="grid gap-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg border border-glass-border bg-glass p-3"><p className="text-2xl font-bold text-primary">{item.analysis.total_messages ?? 0}</p><p className="text-xs text-muted-foreground">Messages</p></div>
                    <div className="rounded-lg border border-glass-border bg-glass p-3"><p className="text-2xl font-bold text-primary">{item.analysis.unique_ids ?? 0}</p><p className="text-xs text-muted-foreground">IDs</p></div>
                    <div className="rounded-lg border border-glass-border bg-glass p-3"><p className="text-2xl font-bold text-primary">{item.analysis.anomalies?.length ?? 0}</p><p className="text-xs text-muted-foreground">Anomalies</p></div>
                  </div>
                  <Button asChild variant="outline"><Link to={`/results/${item.file_id}`}><BarChart3 className="size-4" /> Open Full Results</Link></Button>
                </div>
              ) : item.error ? <p className="text-sm text-destructive">{item.error}</p> : <p className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin text-primary" /> Running analysis…</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
};

export default BatchResults;
