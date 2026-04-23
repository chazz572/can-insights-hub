import { ChangeEvent, DragEvent, FormEvent, useState } from "react";
import { CheckCircle2, FileText, GitCompareArrows, Loader2, Radar, ShieldCheck, TrendingDown, TrendingUp, UploadCloud } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EcuSwapPanel } from "@/components/EcuSwapPanel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { analyzeFile, uploadCanFiles, type AnalysisResult } from "@/lib/canApi";
import { cn } from "@/lib/utils";

const comparisonModes = [
  ["Compare Two Logs", "Side-by-side anomaly count, ID changes, timing drift, and signal candidates."],
  ["Before vs After Tuning", "Highlight calibration deltas, bus load movement, and payload volatility."],
  ["Golden File Comparison", "Validate new captures against a known-good reference profile."],
];

type Slot = "before" | "after";
type CompareResult = { before: AnalysisResult; after: AnalysisResult; beforeId: string; afterId: string };

const acceptedTypes = ".csv,.log,.txt,.crtd,.asc,.blf,.mf4,.mdf,.jsonl,.dbc,text/csv,text/plain";

const metricDelta = (after = 0, before = 0) => after - before;

const FileDropZone = ({ label, file, dragging, disabled, onFile, onDrag }: { label: string; file: File | null; dragging: boolean; disabled: boolean; onFile: (file: File | null) => void; onDrag: (dragging: boolean) => void }) => {
  const inputId = `${label.toLowerCase()}-can-file`;
  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    onDrag(false);
    if (!disabled) onFile(event.dataTransfer.files?.[0] ?? null);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label} File</Label>
      <Label
        htmlFor={inputId}
        onDragOver={(event) => { event.preventDefault(); if (!disabled) onDrag(true); }}
        onDragLeave={() => onDrag(false)}
        onDrop={handleDrop}
        className={cn(
          "group flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-glass-border bg-glass p-6 text-center backdrop-blur transition-all duration-300 hover:border-primary/50 hover:shadow-glow",
          dragging && "scale-[1.01] border-primary bg-secondary shadow-glow",
          disabled && "cursor-wait opacity-75",
        )}
      >
        <span className="grid size-16 place-items-center rounded-lg border border-glass-border bg-gradient-subtle text-primary shadow-glow transition-transform duration-300 group-hover:scale-105">
          {file ? <CheckCircle2 className="size-8 text-success" /> : <UploadCloud className="size-8" />}
        </span>
        <span className="mt-5 text-lg font-bold text-foreground">{file ? file.name : `Drop ${label} Log Here`}</span>
        <span className="mt-2 text-sm leading-6 text-muted-foreground">{file ? `${Math.max(1, Math.round(file.size / 1024))} KB ready for comparison` : "CSV, candump, CRTD, ASC, BLF, MF4/MDF, CANedge, DBC, or TXT"}</span>
        <Input id={inputId} className="sr-only" type="file" accept={acceptedTypes} disabled={disabled} onChange={(event: ChangeEvent<HTMLInputElement>) => onFile(event.target.files?.[0] ?? null)} />
      </Label>
    </div>
  );
};

const Compare = () => {
  const [files, setFiles] = useState<Record<Slot, File | null>>({ before: null, after: null });
  const [dragging, setDragging] = useState<Record<Slot, boolean>>({ before: false, after: false });
  const [isComparing, setIsComparing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);

  const setSlotFile = (slot: Slot, file: File | null) => {
    setMessage(null);
    setResult(null);
    setFiles((current) => ({ ...current, [slot]: file }));
  };

  const compare = async (event: FormEvent) => {
    event.preventDefault();
    if (!files.before || !files.after) {
      setMessage("Add both Before and After CAN log files to compare.");
      return;
    }

    setIsComparing(true);
    setMessage(null);
    setResult(null);

    try {
      const beforeUpload = await uploadCanFiles([files.before]);
      const afterUpload = await uploadCanFiles([files.after]);
      const beforeId = beforeUpload.files[0]?.file_id;
      const afterId = afterUpload.files[0]?.file_id;
      if (!beforeId || !afterId) throw new Error("Both files must convert successfully before comparison.");
      const [before, after] = await Promise.all([analyzeFile(beforeId), analyzeFile(afterId)]);
      setResult({ before, after, beforeId, afterId });
      setMessage(`Comparison Ready: ${files.before.name} vs ${files.after.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to compare those files.");
    } finally {
      setIsComparing(false);
    }
  };

  const anomalyDelta = result ? metricDelta(result.after.anomalies?.length ?? 0, result.before.anomalies?.length ?? 0) : 0;
  const messageDelta = result ? metricDelta(result.after.total_messages ?? 0, result.before.total_messages ?? 0) : 0;
  const idDelta = result ? metricDelta(result.after.unique_ids ?? 0, result.before.unique_ids ?? 0) : 0;

  return (
  <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
    <section className="mb-8 animate-fade-up rounded-lg border border-glass-border bg-glass-strong p-5 shadow-dashboard backdrop-blur sm:p-7">
      <p className="inline-flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-3 py-1 text-sm font-semibold uppercase text-primary shadow-glow backdrop-blur"><GitCompareArrows className="size-4" /> Comparison Suite</p>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_0.75fr] lg:items-end">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Before, After, Golden File</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">Commercial comparison workflows for tuning validation, regression checks, and known-good fleet baselines.</p>
        </div>
        <div className="rounded-lg border border-primary/30 bg-gradient-subtle p-4">
          <Radar className="mb-3 size-6 text-primary" />
          <p className="font-semibold text-foreground">Delta engine ready</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Messages, IDs, anomalies, and timing drift are prepared for evidence review.</p>
        </div>
      </div>
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
        <FileDropZone label="Before" file={files.before} dragging={dragging.before} disabled={isComparing} onFile={(file) => setSlotFile("before", file)} onDrag={(value) => setDragging((current) => ({ ...current, before: value }))} />
        <FileDropZone label="After" file={files.after} dragging={dragging.after} disabled={isComparing} onFile={(file) => setSlotFile("after", file)} onDrag={(value) => setDragging((current) => ({ ...current, after: value }))} />
        <div className="rounded-lg border border-glass-border bg-glass p-5"><TrendingUp className="mb-3 text-success" /><p className="font-semibold">Improved Signals</p><p className="text-sm text-muted-foreground">Reduced anomalies, cleaner ID counts, and timing stability appear here.</p>{result ? <p className="mt-3 font-mono text-sm text-foreground">Messages Δ {messageDelta >= 0 ? "+" : ""}{messageDelta}</p> : null}</div>
        <div className="rounded-lg border border-glass-border bg-glass p-5"><TrendingDown className="mb-3 text-warning" /><p className="font-semibold">Regression Flags</p><p className="text-sm text-muted-foreground">New suspect IDs and anomaly movement appear here.</p>{result ? <p className="mt-3 font-mono text-sm text-foreground">Anomalies Δ {anomalyDelta >= 0 ? "+" : ""}{anomalyDelta} · IDs Δ {idDelta >= 0 ? "+" : ""}{idDelta}</p> : null}</div>
        <Button className="md:col-span-2" type="submit" variant="analyzer" disabled={isComparing || !files.before || !files.after}>{isComparing ? <Loader2 className="animate-spin" /> : <GitCompareArrows className="size-4" />} {isComparing ? "Uploading And Comparing…" : "Run Before / After Comparison"}</Button>
        {message ? <p className="md:col-span-2 rounded-lg border border-glass-border bg-glass p-3 text-sm text-muted-foreground">{message}</p> : null}
        {result ? <div className="md:col-span-2 grid gap-3 rounded-lg border border-glass-border bg-glass p-5 sm:grid-cols-3"><div><FileText className="mb-2 size-5 text-primary" /><p className="text-sm text-muted-foreground">Before File ID</p><p className="truncate font-mono text-sm text-foreground">{result.beforeId}</p></div><div><FileText className="mb-2 size-5 text-primary" /><p className="text-sm text-muted-foreground">After File ID</p><p className="truncate font-mono text-sm text-foreground">{result.afterId}</p></div><div><ShieldCheck className="mb-2 size-5 text-primary" /><p className="text-sm text-muted-foreground">Comparison Status</p><p className="font-semibold text-foreground">Ready For Review</p></div></div> : null}
        </form>
      </CardContent>
    </Card>
    <Card className="mt-6 border-primary/30 bg-gradient-subtle"><CardContent className="flex items-center gap-4 p-5"><ShieldCheck className="size-8 text-primary" /><p className="text-sm leading-6 text-foreground">Saved comparison records are supported by the SaaS data layer and ready for production workflows.</p></CardContent></Card>
  </main>
  );
};

export default Compare;
