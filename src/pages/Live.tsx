import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle, BrainCircuit, CircleDot, Pause, Play, Radio, RotateCcw, TrendingUp, Zap } from "lucide-react";
import { ExplainFrameCard } from "@/components/ExplainFrameCard";
import { InferredSubsystemsPanel } from "@/components/InferredSubsystemsPanel";
import { classifyFrame, formatCanId, type FrameLike } from "@/lib/subsystemClassifier";
import { IdFormatSetting } from "@/lib/settings";
import { cn } from "@/lib/utils";

interface LiveFrame {
  id: number;
  bus: number;
  dlc: number;
  data: number[];
  ts: number;
  classification: ReturnType<typeof classifyFrame>;
}

// --- Mock CAN stream ---------------------------------------------------------
// Drop-in: replace with WebSocket / Server-Sent Events when a real stream is available.
const PROFILE: Array<{ id: number; bus: number; dlc: number; period: number; payload: () => number[] }> = [
  { id: 0x0c9, bus: 0, dlc: 8, period: 10, payload: () => randPayload(8, 0x10, 0x60) }, // engine torque
  { id: 0x130, bus: 0, dlc: 8, period: 20, payload: () => randPayload(8, 0x00, 0xff) }, // wheel speeds
  { id: 0x244, bus: 0, dlc: 8, period: 40, payload: () => randPayload(8, 0x00, 0xff) }, // TCM
  { id: 0x3b3, bus: 0, dlc: 8, period: 50, payload: () => randPayload(8, 0x00, 0xff) }, // EPS
  { id: 0x4b1, bus: 0, dlc: 8, period: 100, payload: () => randPayload(8, 0x00, 0xff) }, // cluster
  { id: 0x540, bus: 0, dlc: 6, period: 200, payload: () => randPayload(6, 0x00, 0xff) }, // BCM
  { id: 0x7e8, bus: 0, dlc: 8, period: 500, payload: () => [0x03, 0x41, 0x0c, 0x1a, 0xf8, 0, 0, 0] }, // OBD response
  { id: 0x1a4, bus: 0, dlc: 8, period: 8, payload: () => randPayload(8, 0x00, 0xff) }, // EV inverter (high rate)
];

const randPayload = (n: number, lo: number, hi: number) =>
  Array.from({ length: n }, () => lo + Math.floor(Math.random() * (hi - lo + 1)));

const ANOMALY_CHANCE = 0.012;

const generateLiveFrame = (): { id: number; bus: number; dlc: number; data: number[] } => {
  const profile = PROFILE[Math.floor(Math.random() * PROFILE.length)];
  let data = profile.payload();
  let dlc = profile.dlc;
  // Inject occasional anomalies for the highlight feed
  if (Math.random() < ANOMALY_CHANCE) {
    const kind = Math.floor(Math.random() * 3);
    if (kind === 0) data = Array(8).fill(0xff); // dropped
    else if (kind === 1) data = Array(8).fill(0x00); // stuck
    else dlc = 4; // mismatched DLC
  }
  return { id: profile.id, bus: profile.bus, dlc, data };
};

// ----------------------------------------------------------------------------

const MAX_FEED = 200;
const STAT_WINDOW_MS = 5000;

const Live = () => {
  const [idFormat] = IdFormatSetting.useValue();
  const [running, setRunning] = useState(true);
  const [frames, setFrames] = useState<LiveFrame[]>([]);
  const [events, setEvents] = useState<Array<{ id: string; ts: number; kind: string; detail: string; severity: "watch" | "anomalous" }>>([]);
  const [selected, setSelected] = useState<LiveFrame | null>(null);
  const [seenIds, setSeenIds] = useState<Set<number>>(new Set());
  const [newlySeen, setNewlySeen] = useState<number[]>([]);
  const tickRef = useRef<number | null>(null);
  const seenRef = useRef<Set<number>>(new Set());

  // Stream loop
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      // Emit a small burst per tick to feel "live"
      const burst = 4 + Math.floor(Math.random() * 6);
      const next: LiveFrame[] = [];
      const newlySeenLocal: number[] = [];
      for (let i = 0; i < burst; i++) {
        const raw = generateLiveFrame();
        const flike: FrameLike = { id: raw.id, data: raw.data, dlc: raw.dlc };
        const classification = classifyFrame(flike);
        const f: LiveFrame = { ...raw, ts: Date.now() + i, classification };
        next.push(f);
        if (!seenRef.current.has(raw.id)) {
          seenRef.current.add(raw.id);
          newlySeenLocal.push(raw.id);
        }
      }
      setFrames((prev) => [...next, ...prev].slice(0, MAX_FEED));
      if (newlySeenLocal.length) {
        setSeenIds(new Set(seenRef.current));
        setNewlySeen((prev) => [...newlySeenLocal, ...prev].slice(0, 8));
      }
      // Push events for non-normal frames
      const newEvents = next
        .filter((f) => f.classification.status !== "normal")
        .map((f) => ({
          id: `${f.ts}-${f.id}`,
          ts: f.ts,
          kind: f.classification.subsystem,
          detail: f.classification.reasons[f.classification.reasons.length - 1] ?? "Anomaly detected",
          severity: f.classification.status as "watch" | "anomalous",
        }));
      if (newEvents.length) setEvents((prev) => [...newEvents, ...prev].slice(0, 50));
    }, 250);
    tickRef.current = id;
    return () => window.clearInterval(id);
  }, [running]);

  const reset = () => {
    setFrames([]);
    setEvents([]);
    setSelected(null);
    setNewlySeen([]);
    seenRef.current = new Set();
    setSeenIds(new Set());
  };

  // Aggregations for summary cards
  const recent = useMemo(() => {
    const cutoff = Date.now() - STAT_WINDOW_MS;
    return frames.filter((f) => f.ts >= cutoff);
  }, [frames]);

  const mostActive = useMemo(() => {
    const counts = new Map<number, number>();
    recent.forEach((f) => counts.set(f.id, (counts.get(f.id) ?? 0) + 1));
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ id, count, hz: count / (STAT_WINDOW_MS / 1000) }));
  }, [recent]);

  const idStatsForClassifier = useMemo(
    () => mostActive.map((m) => ({ id: m.id, count: m.count, hz: m.hz })),
    [mostActive],
  );

  const totalFps = (recent.length / (STAT_WINDOW_MS / 1000)).toFixed(0);
  const recentAnoms = events.filter((e) => Date.now() - e.ts < 10000).length;

  return (
    <main className="mx-auto min-h-screen max-w-[1600px] px-3 pb-28 pt-4 sm:px-6 sm:py-6 lg:px-8 lg:pb-8">
      <section className="mb-6 animate-fade-up data-panel scanline-panel riveted relative overflow-hidden p-5 sm:p-6">
        <div className="hazard-stripe absolute inset-x-0 top-0 h-1.5 opacity-80" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="stencil text-[10px] text-primary">— LIVE STREAM · BAY 7 —</p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-wider sm:text-4xl">Real-Time CAN Stream</h1>
            <p className="mt-1 max-w-2xl font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Live frame feed · auto-classified subsystems · anomaly highlights · explain on click
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest", running ? "border-success/50 bg-success/10 text-success" : "border-warning/60 bg-warning/10 text-warning")}>
              <span className={cn("status-led", running ? "" : "warn")} /> {running ? "STREAMING" : "PAUSED"}
            </span>
            <button onClick={() => setRunning((r) => !r)} className="inline-flex items-center gap-2 rounded-sm border border-primary bg-primary px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-primary-foreground transition-colors hover:brightness-110">
              {running ? <Pause className="size-4" /> : <Play className="size-4" />} {running ? "Pause" : "Resume"}
            </button>
            <button onClick={reset} className="inline-flex items-center gap-2 rounded-sm border border-glass-border bg-secondary px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-foreground transition-colors hover:border-destructive hover:text-destructive">
              <RotateCcw className="size-4" /> Reset
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryStat icon={Activity} label="Live FPS" value={totalFps} accent />
          <SummaryStat icon={CircleDot} label="Unique IDs" value={String(seenIds.size)} />
          <SummaryStat icon={AlertTriangle} label="Recent anomalies" value={String(recentAnoms)} warn={recentAnoms > 0} />
          <SummaryStat icon={TrendingUp} label="Newly seen" value={String(newlySeen.length)} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Live feed */}
        <div className="data-panel overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-glass-border px-4 py-2">
            <p className="stencil flex items-center gap-2 text-[10px] text-primary">
              <Radio className="size-3.5" /> — Live Frame Feed —
            </p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{frames.length} buffered · click to inspect</p>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {frames.length === 0 ? (
              <div className="p-8 text-center font-mono text-xs text-muted-foreground">Waiting for frames…</div>
            ) : (
              <table className="w-full text-left font-mono text-[11px]">
                <thead className="sticky top-0 z-10 border-b border-glass-border bg-card text-[9px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Subsystem</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {frames.map((f) => {
                    const isAnom = f.classification.status !== "normal";
                    return (
                      <tr
                        key={`${f.ts}-${f.id}`}
                        onClick={() => setSelected(f)}
                        className={cn(
                          "cursor-pointer border-b border-glass-border/50 transition-colors hover:bg-primary/10",
                          selected && selected.ts === f.ts && "bg-primary/15",
                          isAnom && "bg-warning/5",
                        )}
                      >
                        <td className="px-3 py-1.5 text-muted-foreground">{new Date(f.ts).toLocaleTimeString([], { hour12: false })}</td>
                        <td className="px-3 py-1.5 font-bold text-primary">{formatCanId(f.id, idFormat)}</td>
                        <td className="px-3 py-1.5 text-foreground">{f.classification.subsystem}</td>
                        <td className="px-3 py-1.5">
                          <span className={cn(
                            "rounded-sm border px-1.5 py-0.5 text-[9px] font-bold uppercase",
                            f.classification.status === "normal" ? "border-success/50 bg-success/10 text-success"
                              : f.classification.status === "watch" ? "border-warning/60 bg-warning/10 text-warning"
                              : "border-destructive/60 bg-destructive/10 text-destructive",
                          )}>
                            {f.classification.status}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-foreground/80">
                          {f.data.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right column: events + most active + explain */}
        <div className="space-y-4">
          <div className="data-panel p-4">
            <p className="stencil mb-3 flex items-center gap-2 text-[10px] text-primary">
              <Zap className="size-3.5" /> — Recent Anomalies —
            </p>
            {events.length === 0 ? (
              <p className="font-mono text-[11px] text-muted-foreground">No anomalies detected in the live window.</p>
            ) : (
              <ul className="max-h-48 space-y-1.5 overflow-y-auto">
                {events.slice(0, 12).map((e) => (
                  <li key={e.id} className={cn(
                    "rounded-sm border px-2 py-1.5 font-mono text-[11px]",
                    e.severity === "anomalous" ? "border-destructive/60 bg-destructive/10 text-destructive" : "border-warning/60 bg-warning/10 text-warning",
                  )}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold uppercase">{e.kind}</span>
                      <span className="text-[9px] opacity-70">{new Date(e.ts).toLocaleTimeString([], { hour12: false })}</span>
                    </div>
                    <p className="mt-0.5 text-[10px] opacity-90">{e.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="data-panel p-4">
            <p className="stencil mb-3 flex items-center gap-2 text-[10px] text-primary">
              <TrendingUp className="size-3.5" /> — Most Active IDs (last 5s) —
            </p>
            {mostActive.length === 0 ? (
              <p className="font-mono text-[11px] text-muted-foreground">Stream just starting up…</p>
            ) : (
              <div className="space-y-1.5">
                {mostActive.map((m) => {
                  const max = mostActive[0].count || 1;
                  return (
                    <div key={m.id} className="grid grid-cols-[5rem_1fr_3.5rem] items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-primary">{formatCanId(m.id, idFormat)}</span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-secondary">
                        <span className="block h-full rounded-full bg-gradient-accent" style={{ width: `${(m.count / max) * 100}%` }} />
                      </span>
                      <span className="text-right font-mono text-[10px] text-muted-foreground">{m.hz.toFixed(1)} Hz</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {newlySeen.length ? (
            <div className="data-panel p-4">
              <p className="stencil mb-3 flex items-center gap-2 text-[10px] text-primary">
                <BrainCircuit className="size-3.5" /> — Newly Seen IDs —
              </p>
              <div className="flex flex-wrap gap-1">
                {newlySeen.map((id) => (
                  <span key={id} className="rounded-sm border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
                    {formatCanId(id, idFormat)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {selected ? (
            <ExplainFrameCard frame={{ id: selected.id, bus: selected.bus, dlc: selected.dlc, data: selected.data }} />
          ) : null}
        </div>
      </section>

      <section className="mt-6">
        <InferredSubsystemsPanel idStats={idStatsForClassifier as Array<Record<string, unknown>>} title="Live Inferred Subsystems" />
      </section>
    </main>
  );
};

const SummaryStat = ({ icon: Icon, label, value, accent, warn }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent?: boolean; warn?: boolean }) => (
  <div className={cn("data-panel flex items-center gap-3 px-4 py-3", accent && "border-primary/40", warn && "border-warning/50")}>
    <Icon className={cn("size-5 shrink-0", warn ? "text-warning" : accent ? "text-primary" : "text-muted-foreground")} />
    <div className="min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn("font-mono text-lg font-bold leading-tight", accent && "led-readout")}>{value}</p>
    </div>
  </div>
);

export default Live;
