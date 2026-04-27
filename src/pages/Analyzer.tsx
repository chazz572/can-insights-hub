import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Activity,
  CircleDot,
  FileUp,
  Filter,
  Gauge,
  Pause,
  Play,
  Plug,
  PlugZap,
  RefreshCw,
  Search,
  SkipBack,
  Sparkles,
  Trash2,
  Waves,
  Zap,
} from "lucide-react";
import {
  CanAnalyzer,
  CanFrame,
  FilterSpec,
  IdStat,
  RawCanFrame,
  createDemoSource,
  filterFrames,
  formatBytes,
  formatId,
  formatTime,
  idHue,
} from "@/lib/canAnalyzer";
import { CanFrameTable } from "@/components/CanFrameTable";
import { ExplainFrameCard } from "@/components/ExplainFrameCard";
import { InferredSubsystemsPanel } from "@/components/InferredSubsystemsPanel";
import { cn } from "@/lib/utils";

// Singleton analyzer for the page
const analyzer = new CanAnalyzer(5000);

const useAnalyzer = () => {
  return useSyncExternalStore(
    (cb) => analyzer.subscribe(cb),
    () => analyzer.getState().totalFrames + ":" + analyzer.getState().fps + ":" + analyzer.getState().status + ":" + analyzer.getState().bufferSize + ":" + (analyzer.getState().paused ? 1 : 0),
    () => "",
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string; led: string }> = {
    live: { label: "LIVE", cls: "border-success/50 bg-success/10 text-success", led: "" },
    replay: { label: "REPLAY", cls: "border-primary/50 bg-primary/10 text-primary", led: "warn" },
    paused: { label: "PAUSED", cls: "border-warning/50 bg-warning/10 text-warning", led: "warn" },
    connecting: { label: "CONNECTING", cls: "border-warning/50 bg-warning/10 text-warning", led: "warn" },
    error: { label: "ERROR", cls: "border-destructive/60 bg-destructive/10 text-destructive", led: "error" },
    disconnected: { label: "OFFLINE", cls: "border-glass-border bg-secondary text-muted-foreground", led: "off" },
  };
  const m = map[status] ?? map.disconnected;
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest", m.cls)}>
      <span className={cn("status-led", m.led)} />
      {m.label}
    </span>
  );
};

const Stat = ({ label, value, icon: Icon, accent }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; accent?: boolean }) => (
  <div className={cn("data-panel flex items-center gap-3 px-4 py-3", accent && "border-primary/40")}>
    <Icon className={cn("size-5 shrink-0", accent ? "text-primary" : "text-muted-foreground")} />
    <div className="min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn("font-mono text-lg font-bold leading-tight", accent && "led-readout")}>{value}</p>
    </div>
  </div>
);

const Analyzer = () => {
  useAnalyzer();
  const state = analyzer.getState();
  const allFrames = analyzer.getBuffer();
  const idStats = analyzer.getIdStats();

  const [filter, setFilter] = useState<FilterSpec>({ idQuery: "", busQuery: "", dataQuery: "" });
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [wsUrl, setWsUrl] = useState("ws://localhost:8080/can");
  const [demoStop, setDemoStop] = useState<(() => void) | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => filterFrames(allFrames, filter), [allFrames, filter, state.bufferSize]);
  const changedMaskByID = useMemo(() => {
    const m = new Map<number, number>();
    idStats.forEach((s) => m.set(s.id, s.changedMask));
    return m;
  }, [idStats, state.totalFrames]);

  const selectedStat = selectedId != null ? idStats.find((s) => s.id === selectedId) : null;

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === " ") {
        e.preventDefault();
        if (state.status === "replay") (state.paused ? analyzer.playReplay() : analyzer.pauseReplay());
        else analyzer.togglePause();
      }
      if (e.key.toLowerCase() === "a") setAutoScroll((v) => !v);
      if (e.key.toLowerCase() === "c") analyzer.clear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.status, state.paused]);

  const startDemo = () => {
    if (demoStop) return;
    const stop = createDemoSource(analyzer);
    setDemoStop(() => stop);
  };
  const stopDemo = () => {
    if (demoStop) {
      demoStop();
      setDemoStop(null);
    }
  };

  const handleConnect = () => {
    stopDemo();
    analyzer.connectWebSocket(wsUrl);
  };
  const handleDisconnect = () => {
    analyzer.disconnectWebSocket();
  };

  const handleFile = async (file: File) => {
    stopDemo();
    analyzer.disconnectWebSocket();
    const text = await file.text();
    let parsed: RawCanFrame[] = [];
    try {
      const j = JSON.parse(text);
      parsed = Array.isArray(j) ? j : (j.frames ?? []);
    } catch {
      // Fallback: try newline-delimited JSON
      parsed = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => JSON.parse(l));
    }
    analyzer.loadLog(parsed);
  };

  const replay = analyzer.getReplayInfo();
  const inReplay = state.status === "replay" || replay.total > 0;
  const replayProgress = replay.total ? replay.index / replay.total : 0;

  const statusLabel = state.paused && state.status !== "disconnected" ? "paused" : state.status;

  return (
    <main className="mx-auto min-h-screen max-w-[1600px] px-3 pb-28 pt-4 sm:px-6 sm:py-6 lg:px-8 lg:pb-8">
      {/* Hero header */}
      <section className="mb-6 animate-fade-up data-panel scanline-panel riveted relative overflow-hidden p-5 sm:p-6">
        <div className="hazard-stripe absolute inset-x-0 top-0 h-1.5 opacity-80" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="stencil text-[10px] text-primary">— LIVE BUS · BAY 7 —</p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-wider sm:text-4xl">CAN Analyzer</h1>
            <p className="mt-1 max-w-2xl font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Real-time frame capture · WebSocket ingest · Offline replay · Byte-diff inspector
            </p>
          </div>
          <StatusBadge status={statusLabel} />
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Frames" value={state.totalFrames.toLocaleString()} icon={Activity} accent />
          <Stat label="FPS" value={`${state.fps}`} icon={Gauge} accent />
          <Stat label="Buffer" value={`${state.bufferSize}/${state.maxBuffer}`} icon={Waves} />
          <Stat label="Unique IDs" value={`${idStats.length}`} icon={CircleDot} />
        </div>
      </section>

      {/* Source controls */}
      <section className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="data-panel p-4">
          <p className="stencil mb-3 text-[10px] text-primary">— WebSocket Source —</p>
          <div className="flex gap-2">
            <input
              value={wsUrl}
              onChange={(e) => setWsUrl(e.target.value)}
              placeholder="ws://host:port/path"
              className="flex-1 rounded-sm border border-glass-border bg-input px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            {state.status === "live" || state.status === "connecting" ? (
              <button onClick={handleDisconnect} className="inline-flex items-center gap-2 rounded-sm border border-destructive/50 bg-destructive/10 px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-destructive transition-colors hover:bg-destructive/20">
                <Plug className="size-4" /> Disconnect
              </button>
            ) : (
              <button onClick={handleConnect} className="inline-flex items-center gap-2 rounded-sm border border-primary bg-primary px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-primary-foreground transition-colors hover:brightness-110">
                <PlugZap className="size-4" /> Connect
              </button>
            )}
          </div>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">Server must emit JSON frames matching the documented schema.</p>
        </div>

        <div className="data-panel p-4">
          <p className="stencil mb-3 text-[10px] text-primary">— Log File Replay —</p>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.log,.ndjson,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <div className="flex gap-2">
            <button onClick={() => fileRef.current?.click()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-sm border border-glass-border bg-secondary px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-foreground transition-colors hover:border-primary hover:text-primary">
              <FileUp className="size-4" /> Load JSON Log
            </button>
            {inReplay && (
              <>
                <button onClick={() => (state.paused ? analyzer.playReplay() : analyzer.pauseReplay())} className="grid size-10 place-items-center rounded-sm border border-primary bg-primary text-primary-foreground transition-colors hover:brightness-110">
                  {state.paused ? <Play className="size-4" /> : <Pause className="size-4" />}
                </button>
                <button onClick={() => analyzer.seekReplay(0)} className="grid size-10 place-items-center rounded-sm border border-glass-border bg-secondary text-foreground transition-colors hover:border-primary hover:text-primary">
                  <SkipBack className="size-4" />
                </button>
              </>
            )}
          </div>
          {inReplay && (
            <div className="mt-3">
              <input
                type="range"
                min={0}
                max={1}
                step={0.001}
                value={replayProgress}
                onChange={(e) => analyzer.seekReplay(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                <span>{replay.index}/{replay.total}</span>
                <div className="flex gap-1">
                  {[0.5, 1, 2, 4, 10].map((s) => (
                    <button
                      key={s}
                      onClick={() => analyzer.setReplaySpeed(s)}
                      className={cn(
                        "rounded-sm border px-1.5 py-0.5 transition-colors",
                        analyzer.getReplaySpeed() === s
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-glass-border bg-secondary text-foreground hover:border-primary",
                      )}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="data-panel p-4">
          <p className="stencil mb-3 text-[10px] text-primary">— Quick Actions —</p>
          <div className="grid grid-cols-2 gap-2">
            {!demoStop ? (
              <button onClick={startDemo} className="inline-flex items-center justify-center gap-2 rounded-sm border border-glass-border bg-secondary px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-foreground transition-colors hover:border-primary hover:text-primary">
                <Sparkles className="size-4" /> Demo Stream
              </button>
            ) : (
              <button onClick={stopDemo} className="inline-flex items-center justify-center gap-2 rounded-sm border border-warning/60 bg-warning/10 px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-warning transition-colors hover:bg-warning/20">
                <Sparkles className="size-4" /> Stop Demo
              </button>
            )}
            <button onClick={() => analyzer.togglePause()} className="inline-flex items-center justify-center gap-2 rounded-sm border border-glass-border bg-secondary px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-foreground transition-colors hover:border-primary hover:text-primary">
              {state.paused ? <Play className="size-4" /> : <Pause className="size-4" />} {state.paused ? "Resume" : "Pause"}
            </button>
            <button onClick={() => analyzer.clear()} className="inline-flex items-center justify-center gap-2 rounded-sm border border-glass-border bg-secondary px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-foreground transition-colors hover:border-destructive hover:text-destructive">
              <Trash2 className="size-4" /> Clear
            </button>
            <button onClick={() => setAutoScroll((v) => !v)} className={cn("inline-flex items-center justify-center gap-2 rounded-sm border px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-colors", autoScroll ? "border-primary bg-primary text-primary-foreground" : "border-glass-border bg-secondary text-foreground hover:border-primary")}>
              <RefreshCw className="size-4" /> Auto-Scroll
            </button>
          </div>
          <p className="mt-3 font-mono text-[10px] text-muted-foreground">⌨ Space = pause · A = auto-scroll · C = clear</p>
        </div>
      </section>

      {/* Filter bar */}
      <section className="data-panel mb-4 p-3">
        <div className="grid gap-3 md:grid-cols-[auto_1fr_1fr_1fr_auto] md:items-center">
          <p className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-primary">
            <Filter className="size-4" /> Filters
          </p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={filter.idQuery}
              onChange={(e) => setFilter((f) => ({ ...f, idQuery: e.target.value }))}
              placeholder="ID  e.g. 0x123, 256, 0x100-0x1FF"
              className="w-full rounded-sm border border-glass-border bg-input pl-8 pr-3 py-2 font-mono text-xs focus:border-primary focus:outline-none"
            />
          </div>
          <input
            value={filter.busQuery}
            onChange={(e) => setFilter((f) => ({ ...f, busQuery: e.target.value }))}
            placeholder="Bus  e.g. 0"
            className="rounded-sm border border-glass-border bg-input px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none"
          />
          <input
            value={filter.dataQuery}
            onChange={(e) => setFilter((f) => ({ ...f, dataQuery: e.target.value }))}
            placeholder="Data hex  e.g. DE AD BE EF"
            className="rounded-sm border border-glass-border bg-input px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none"
          />
          <button
            onClick={() => setFilter({ idQuery: "", busQuery: "", dataQuery: "" })}
            className="rounded-sm border border-glass-border bg-secondary px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            Reset
          </button>
        </div>
        <p className="mt-2 font-mono text-[10px] text-muted-foreground">
          Showing {filtered.length.toLocaleString()} of {allFrames.length.toLocaleString()} frames
        </p>
      </section>

      {/* Main grid: Table + Inspector */}
      <section className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="h-[60vh] min-h-[420px]">
          <CanFrameTable
            frames={filtered}
            autoScroll={autoScroll}
            changedMaskByID={changedMaskByID}
            onSelect={(f) => setSelectedId(f.id)}
            selectedId={selectedId}
          />
        </div>

        <aside className="flex flex-col gap-4">
          {/* Inspector */}
          <div className="data-panel p-4">
            <p className="stencil mb-3 flex items-center gap-2 text-[10px] text-primary">
              <Zap className="size-3.5" /> — Frame Inspector —
            </p>
            {selectedStat ? (
              <div className="space-y-3">
                <div>
                  <p className="font-mono text-[10px] uppercase text-muted-foreground">ID</p>
                  <p className="font-mono text-2xl font-bold" style={{ color: `hsl(${idHue(selectedStat.id)} 80% 62%)` }}>
                    {formatId(selectedStat.id)}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-sm border border-glass-border bg-secondary p-2">
                    <p className="font-mono text-[9px] uppercase text-muted-foreground">Count</p>
                    <p className="font-mono text-sm font-bold">{selectedStat.count}</p>
                  </div>
                  <div className="rounded-sm border border-glass-border bg-secondary p-2">
                    <p className="font-mono text-[9px] uppercase text-muted-foreground">Hz</p>
                    <p className="font-mono text-sm font-bold text-primary">{selectedStat.hz.toFixed(1)}</p>
                  </div>
                  <div className="rounded-sm border border-glass-border bg-secondary p-2">
                    <p className="font-mono text-[9px] uppercase text-muted-foreground">DLC</p>
                    <p className="font-mono text-sm font-bold">{selectedStat.dlc}</p>
                  </div>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase text-muted-foreground">Bytes (Δ highlighted)</p>
                  <div className="mt-1 grid grid-cols-8 gap-1">
                    {selectedStat.lastData.map((b, i) => {
                      const changed = selectedStat.changedMask & (1 << i);
                      return (
                        <div
                          key={i}
                          className={cn(
                            "rounded-sm border px-1 py-1.5 text-center font-mono text-xs",
                            changed ? "border-primary bg-primary/20 text-primary" : "border-glass-border bg-secondary text-foreground",
                          )}
                        >
                          <p className="text-[9px] text-muted-foreground">B{i}</p>
                          <p className="font-bold">{b.toString(16).toUpperCase().padStart(2, "0")}</p>
                          <p className="text-[9px] text-muted-foreground">{b}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase text-muted-foreground">Binary</p>
                  <p className="break-all font-mono text-[10px] text-foreground/80">
                    {selectedStat.lastData.map((b) => b.toString(2).padStart(8, "0")).join(" ")}
                  </p>
                </div>
              </div>
            ) : (
              <p className="font-mono text-xs text-muted-foreground">Select a frame in the table to inspect bytes, frequency, and bit deltas.</p>
            )}
          </div>

          {selectedStat ? (
            <ExplainFrameCard
              frame={{
                id: selectedStat.id,
                bus: selectedStat.bus,
                dlc: selectedStat.dlc,
                data: selectedStat.lastData,
                hz: selectedStat.hz,
                count: selectedStat.count,
              }}
            />
          ) : null}

          {/* Top IDs */}
          <div className="data-panel flex-1 overflow-hidden p-4">
            <p className="stencil mb-3 text-[10px] text-primary">— Top IDs —</p>
            <div className="max-h-[40vh] overflow-auto">
              {idStats
                .slice()
                .sort((a, b) => b.count - a.count)
                .slice(0, 30)
                .map((s) => {
                  const max = idStats.reduce((m, x) => Math.max(m, x.count), 1);
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className={cn(
                        "grid w-full grid-cols-[5rem_1fr_3rem] items-center gap-2 rounded-sm px-2 py-1 text-left transition-colors hover:bg-primary/10",
                        selectedId === s.id && "bg-primary/15",
                      )}
                    >
                      <span className="font-mono text-[11px] font-bold" style={{ color: `hsl(${idHue(s.id)} 80% 62%)` }}>
                        {formatId(s.id)}
                      </span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-secondary">
                        <span
                          className="block h-full rounded-full bg-gradient-accent"
                          style={{ width: `${(s.count / max) * 100}%` }}
                        />
                      </span>
                      <span className="text-right font-mono text-[10px] text-muted-foreground">{s.count}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
};

export default Analyzer;
