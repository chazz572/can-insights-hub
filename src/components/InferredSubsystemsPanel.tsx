import { useMemo } from "react";
import { Layers3 } from "lucide-react";
import { clusterBySubsystem, formatCanId, type FrameLike } from "@/lib/subsystemClassifier";
import { IdFormatSetting } from "@/lib/settings";
import { cn } from "@/lib/utils";

interface Props {
  // Accepts the analysis result's id_stats (or any array with id-like + count/hz fields).
  idStats: Array<Record<string, unknown>>;
  title?: string;
}

const toFrameLikes = (rows: Array<Record<string, unknown>>): FrameLike[] =>
  rows
    .map((row) => {
      const rawId = row.id ?? row.can_id ?? row.arbitration_id ?? row.identifier ?? row.key;
      let id: number | null = null;
      if (typeof rawId === "number") id = rawId;
      else if (typeof rawId === "string") {
        const s = rawId.trim();
        id = s.startsWith("0x") || s.startsWith("0X") ? parseInt(s.slice(2), 16) : Number.isFinite(Number(s)) ? Number(s) : parseInt(s, 16);
      }
      if (id === null || !Number.isFinite(id)) return null;
      const count = Number(row.count ?? row.messages ?? row.total ?? row.frequency ?? 0) || 0;
      const hz = Number(row.hz ?? row.rate ?? row.frequency_hz ?? 0) || 0;
      const dlc = Number(row.dlc ?? row.length ?? 0) || undefined;
      return { id, count, hz, dlc };
    })
    .filter((f): f is FrameLike => f !== null);

export const InferredSubsystemsPanel = ({ idStats, title = "Inferred Subsystems" }: Props) => {
  const [idFormat] = IdFormatSetting.useValue();
  const clusters = useMemo(() => clusterBySubsystem(toFrameLikes(idStats)), [idStats]);

  if (!clusters.length) {
    return (
      <div className="rounded-lg border border-dashed border-glass-border bg-glass p-4 text-sm text-muted-foreground">
        No inferred subsystems — capture more frames or upload a richer log to classify unknown IDs.
      </div>
    );
  }

  const totalAnoms = clusters.reduce((s, c) => s + c.anomalousCount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-primary">
          <Layers3 className="size-4" /> {title}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {clusters.length} subsystem{clusters.length === 1 ? "" : "s"} · {totalAnoms} flagged
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {clusters.map((c) => {
          const conf = Math.round(c.confidence * 100);
          const flagged = c.anomalousCount > 0;
          return (
            <div key={c.subsystem} className={cn("data-panel p-4", flagged && "border-warning/50")}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-sm font-bold uppercase tracking-wider text-foreground">{c.subsystem}</p>
                <span className={cn(
                  "rounded-sm border px-2 py-0.5 font-mono text-[9px] font-bold uppercase",
                  flagged ? "border-warning/60 bg-warning/10 text-warning" : "border-success/50 bg-success/10 text-success",
                )}>
                  {flagged ? `${c.anomalousCount} watch` : "ok"}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-sm border border-glass-border bg-secondary/60 p-2">
                  <p className="font-mono text-[9px] uppercase text-muted-foreground">IDs</p>
                  <p className="font-mono text-sm font-bold">{c.ids.length}</p>
                </div>
                <div className="rounded-sm border border-glass-border bg-secondary/60 p-2">
                  <p className="font-mono text-[9px] uppercase text-muted-foreground">Frames</p>
                  <p className="font-mono text-sm font-bold">{c.totalCount.toLocaleString()}</p>
                </div>
                <div className="rounded-sm border border-glass-border bg-secondary/60 p-2">
                  <p className="font-mono text-[9px] uppercase text-muted-foreground">Avg Hz</p>
                  <p className="font-mono text-sm font-bold text-primary">{c.avgHz ? c.avgHz.toFixed(1) : "—"}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {c.ids.slice(0, 8).map((id) => (
                  <span key={id} className="rounded-sm border border-glass-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                    {formatCanId(id, idFormat)}
                  </span>
                ))}
                {c.ids.length > 8 ? (
                  <span className="font-mono text-[10px] text-muted-foreground">+{c.ids.length - 8} more</span>
                ) : null}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="font-mono text-[9px] uppercase text-muted-foreground">Confidence</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <span className="block h-full rounded-full bg-gradient-accent" style={{ width: `${conf}%` }} />
                </span>
                <span className="font-mono text-[10px] text-primary">{conf}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
