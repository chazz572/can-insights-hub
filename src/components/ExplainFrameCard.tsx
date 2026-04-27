import { useState } from "react";
import { AlertTriangle, BrainCircuit, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { classifyFrame, formatCanId, type FrameLike } from "@/lib/subsystemClassifier";
import { IdFormatSetting } from "@/lib/settings";
import { cn } from "@/lib/utils";

interface ExplainResult {
  summary: string;
  probable_subsystem: string;
  status: "normal" | "suspicious" | "anomalous";
  confidence: number;
  possible_signals: string[];
  vehicle_implications: string;
  next_steps: string[];
}

interface Props {
  frame: FrameLike & { bus?: number | string; timestamp?: number };
  compact?: boolean;
}

const statusStyles: Record<string, string> = {
  normal: "border-success/50 bg-success/10 text-success",
  suspicious: "border-warning/60 bg-warning/10 text-warning",
  anomalous: "border-destructive/60 bg-destructive/10 text-destructive",
};

export const ExplainFrameCard = ({ frame, compact = false }: Props) => {
  const [idFormat] = IdFormatSetting.useValue();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExplainResult | null>(null);

  const heuristic = classifyFrame(frame);

  const explain = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke<ExplainResult & { error?: string }>("explain-frame", {
        body: { frame: { ...frame, heuristic } },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      if (!data) throw new Error("No response from AI.");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to explain frame.");
    } finally {
      setLoading(false);
    }
  };

  const dataHex = (frame.data ?? []).map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ") || "—";
  const dlc = frame.dlc ?? frame.data?.length ?? 0;

  return (
    <div className={cn("data-panel overflow-hidden p-4", compact && "p-3")}>
      <div className="flex items-center justify-between gap-3">
        <p className="stencil flex items-center gap-2 text-[10px] text-primary">
          <BrainCircuit className="size-3.5" /> — Explain This Frame —
        </p>
        <button
          type="button"
          onClick={explain}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-sm border border-primary bg-primary px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary-foreground transition-all hover:brightness-110 disabled:opacity-60"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          {loading ? "Thinking" : "Ask AI"}
        </button>
      </div>

      {/* Frame context block */}
      <div className="mt-3 grid gap-2 rounded-sm border border-glass-border bg-secondary/40 p-3 font-mono text-[11px]">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-[9px] uppercase text-muted-foreground">ID</p>
            <p className="font-bold text-primary">{formatCanId(frame.id, idFormat)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase text-muted-foreground">Bus</p>
            <p className="font-bold">{String(frame.bus ?? "0")}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase text-muted-foreground">DLC</p>
            <p className="font-bold">{dlc}</p>
          </div>
        </div>
        <div>
          <p className="text-[9px] uppercase text-muted-foreground">Payload</p>
          <p className="break-all font-bold text-foreground">{dataHex}</p>
        </div>
        {frame.hz ? (
          <div>
            <p className="text-[9px] uppercase text-muted-foreground">Cadence</p>
            <p className="font-bold">{frame.hz.toFixed(1)} Hz</p>
          </div>
        ) : null}
      </div>

      {/* Heuristic block (instant, no AI required) */}
      <div className="mt-3 rounded-sm border border-glass-border bg-card/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase text-muted-foreground">Heuristic:</span>
          <span className="font-mono text-xs font-bold text-foreground">{heuristic.subsystem}</span>
          <span className={cn("rounded-sm border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider", statusStyles[heuristic.status])}>
            {heuristic.status}
          </span>
          <ConfidenceBar value={heuristic.confidence} />
        </div>
        {heuristic.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {heuristic.tags.map((t) => (
              <span key={t} className="rounded-sm border border-glass-border bg-secondary px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{t}</span>
            ))}
          </div>
        ) : null}
        {heuristic.reasons.length ? (
          <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
            {heuristic.reasons.slice(0, 3).map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        ) : null}
      </div>

      {error ? (
        <div className="mt-3 flex items-center gap-2 rounded-sm border border-destructive/60 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      ) : null}

      {result ? (
        <div className="mt-3 space-y-3 rounded-sm border border-primary/40 bg-gradient-subtle p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase text-muted-foreground">AI:</span>
            <span className="font-mono text-xs font-bold text-foreground">{result.probable_subsystem}</span>
            <span className={cn("rounded-sm border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider", statusStyles[result.status] ?? statusStyles.normal)}>
              {result.status}
            </span>
            <ConfidenceBar value={result.confidence} />
          </div>
          <p className="text-sm leading-6 text-foreground">{result.summary}</p>

          {result.possible_signals?.length ? (
            <div>
              <p className="font-mono text-[10px] uppercase text-muted-foreground">Possible signals</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {result.possible_signals.map((s, i) => (
                  <span key={i} className="rounded-sm border border-glass-border bg-secondary px-2 py-0.5 font-mono text-[10px] text-foreground">{s}</span>
                ))}
              </div>
            </div>
          ) : null}

          {result.vehicle_implications ? (
            <div>
              <p className="font-mono text-[10px] uppercase text-muted-foreground">Vehicle implications</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{result.vehicle_implications}</p>
            </div>
          ) : null}

          {result.next_steps?.length ? (
            <div>
              <p className="font-mono text-[10px] uppercase text-muted-foreground">Next steps</p>
              <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                {result.next_steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-primary" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const ConfidenceBar = ({ value }: { value: number }) => {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <span className="ml-auto inline-flex items-center gap-1.5">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
        <span className="block h-full rounded-full bg-gradient-accent" style={{ width: `${pct}%` }} />
      </span>
      <span className="font-mono text-[10px] text-primary">{pct}%</span>
    </span>
  );
};
