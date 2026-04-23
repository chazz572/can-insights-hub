import { Activity, AlertTriangle, BadgeCheck, Boxes, BrainCircuit, CircuitBoard, Compass, Gauge, Grid3x3, ListChecks, ShieldCheck, Sigma, Sparkles, ToggleLeft } from "lucide-react";

import { AnalysisCard } from "@/components/AnalysisCard";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AnalysisResult } from "@/lib/canApi";
import {
  buildActiveBitMap,
  buildBehaviorSummaries,
  buildDynamicByteHeatmap,
  buildInstantIntelligence,
  buildModuleActivityMap,
  computeCanHealthScore,
  detectCountersAndChecksums,
  evaluateDbcMatching,
} from "@/lib/intelligenceModules";

const stateColor: Record<string, string> = {
  active: "bg-success/15 text-success border-success/30",
  quiet: "bg-muted/30 text-muted-foreground border-glass-border",
  noisy: "bg-warning/15 text-warning border-warning/30",
  abnormal: "bg-destructive/15 text-destructive border-destructive/30",
};

const cellTone: Record<string, string> = {
  static: "bg-muted/30",
  rare: "bg-primary/20",
  moderate: "bg-primary/50",
  dynamic: "bg-primary shadow-glow",
};

const patternBadge: Record<string, string> = {
  toggle: "bg-primary/15 text-primary border-primary/30",
  flag: "bg-success/15 text-success border-success/30",
  "stuck-high": "bg-warning/15 text-warning border-warning/30",
  "stuck-low": "bg-warning/15 text-warning border-warning/30",
  "rare-event": "bg-muted/30 text-muted-foreground border-glass-border",
};

const kindBadge: Record<string, string> = {
  rolling_counter: "bg-primary/15 text-primary border-primary/30",
  wraparound: "bg-primary/10 text-primary border-primary/30",
  checksum: "bg-warning/15 text-warning border-warning/30",
  candidate: "bg-muted/30 text-muted-foreground border-glass-border",
};

const behaviorBadge: Record<string, string> = {
  rising: "bg-success/15 text-success border-success/30",
  falling: "bg-warning/15 text-warning border-warning/30",
  cyclic: "bg-primary/15 text-primary border-primary/30",
  stable: "bg-muted/30 text-muted-foreground border-glass-border",
  noisy: "bg-destructive/15 text-destructive border-destructive/30",
  mixed: "bg-glass border-glass-border text-foreground",
};

const Empty = ({ message }: { message: string }) => (
  <div className="rounded-lg border border-dashed border-glass-border bg-glass p-4 text-sm text-muted-foreground">{message}</div>
);

export const IntelligenceSuite = ({ analysis }: { analysis: AnalysisResult | null | undefined }) => {
  if (!analysis) return null;

  const instant = buildInstantIntelligence(analysis);
  const modules = buildModuleActivityMap(analysis);
  const heat = buildDynamicByteHeatmap(analysis);
  const bits = buildActiveBitMap(analysis);
  const counters = detectCountersAndChecksums(analysis);
  const health = computeCanHealthScore(analysis);
  const behaviors = buildBehaviorSummaries(analysis);
  const dbc = evaluateDbcMatching(analysis);

  return (
    <div className="grid gap-6">
      {/* 8. Upload-a-Log → Instant Intelligence */}
      <AnalysisCard
        title="Instant Intelligence Brief"
        description="Unified, deduplicated overview combining decoding, modules, dynamic bytes, active bits, counters, and health."
        icon={<Sparkles className="size-5" />}
      >
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-lg border border-primary/30 bg-gradient-subtle p-4 shadow-glow">
            <p className="text-xs font-bold uppercase text-primary">Headline</p>
            <p className="mt-2 text-lg font-bold text-foreground">{instant.headline}</p>
            <ul className="mt-4 grid gap-2 text-sm text-muted-foreground">
              {instant.highlights.map((line) => (
                <li key={line} className="flex items-start gap-2"><BadgeCheck className="mt-0.5 size-4 shrink-0 text-primary" /> {line}</li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Module clusters", value: instant.modules, icon: Compass },
              { label: "Dynamic bytes", value: instant.dynamicBytes, icon: Grid3x3 },
              { label: "Active bits", value: instant.activeBits, icon: ToggleLeft },
              { label: "Counter/checksum", value: instant.counters, icon: Sigma },
            ].map((tile) => (
              <Card key={tile.label} className="overflow-hidden">
                <CardContent className="p-4">
                  <tile.icon className="size-5 text-primary" />
                  <p className="mt-3 text-2xl font-extrabold text-foreground">{tile.value}</p>
                  <p className="text-xs text-muted-foreground">{tile.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AnalysisCard>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* 5. CAN Health Score */}
        <AnalysisCard title="CAN Health Score" description="Composite of jitter, chatter, payload volatility, and ID stability." icon={<ShieldCheck className="size-5" />}>
          <div className="flex items-center gap-4">
            <div className="grid size-24 place-items-center rounded-full border-4 border-primary/40 bg-gradient-subtle text-3xl font-extrabold text-primary shadow-glow">
              {health.score}
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{health.grade}</p>
              <p className="text-sm text-muted-foreground">0–100 scale derived from captured data only.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            {health.components.map((c) => (
              <div key={c.label} className="rounded-lg border border-glass-border bg-glass p-3">
                <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                  <span>{c.label}</span>
                  <span className="font-mono text-primary">{c.score}/100</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-gradient-accent" style={{ width: `${c.score}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{c.note}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{health.explanation}</p>
        </AnalysisCard>

        {/* 1. Module Activity Map */}
        <AnalysisCard title="Module Activity Map" description="ID clusters by chatter, timing, and volatility — active, quiet, noisy, abnormal." icon={<CircuitBoard className="size-5" />}>
          {modules.length ? (
            <div className="grid gap-3">
              {modules.map((cluster) => (
                <div key={cluster.label} className={cn("rounded-lg border p-4 backdrop-blur", stateColor[cluster.state])}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold uppercase">{cluster.label}</p>
                    <span className="font-mono text-xs">{cluster.ids.length} ID{cluster.ids.length === 1 ? "" : "s"}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5">{cluster.reason}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {cluster.ids.slice(0, 14).map((id) => (
                      <span key={id} className="rounded-md border border-glass-border bg-background/50 px-2 py-0.5 font-mono text-xs">{id}</span>
                    ))}
                    {cluster.ids.length > 14 ? <span className="text-xs">+{cluster.ids.length - 14} more</span> : null}
                  </div>
                  <p className="mt-2 text-xs">avg share {cluster.averageRate}% · avg volatility {cluster.averageVolatility}</p>
                </div>
              ))}
            </div>
          ) : <Empty message="Not enough ID statistics to cluster modules yet." />}
        </AnalysisCard>
      </div>

      {/* 2. Dynamic Byte Heatmap */}
      <AnalysisCard title="Dynamic Byte Heatmap" description="Per-ID volatility for each byte position — static, rare, moderate, dynamic." icon={<Grid3x3 className="size-5" />}>
        {heat.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-muted-foreground">
                  <th className="px-2 py-2 text-left">ID</th>
                  {Array.from({ length: 8 }).map((_, i) => (<th key={i} className="px-1 py-2 text-center font-mono">B{i}</th>))}
                  <th className="px-2 py-2 text-right">dyn</th>
                </tr>
              </thead>
              <tbody>
                {heat.map((row) => (
                  <tr key={row.id} className="border-t border-glass-border">
                    <td className="px-2 py-1 font-mono text-xs text-foreground">{row.id}</td>
                    {row.cells.map((cell) => (
                      <td key={cell.byteIndex} className="px-1 py-1 text-center">
                        <span title={`vol ${cell.volatility} · ${cell.classification}`} className={cn("inline-block size-6 rounded-md border border-glass-border", cellTone[cell.classification])} />
                      </td>
                    ))}
                    <td className="px-2 py-1 text-right font-mono text-xs text-primary">{row.dynamicCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty message="No byte volatility data available." />}
      </AnalysisCard>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* 3. Active Bit Detector */}
        <AnalysisCard title="Active Bit Detector" description="Bit-level toggles, flags, and stuck/rare patterns with correlation hints." icon={<ToggleLeft className="size-5" />}>
          {bits.length ? (
            <div className="grid gap-2">
              {bits.slice(0, 16).map((b) => (
                <div key={`${b.id}-${b.bit}`} className="grid grid-cols-[5rem_4rem_1fr_5rem] items-center gap-3 rounded-lg border border-glass-border bg-glass p-3">
                  <span className="font-mono text-xs text-foreground">bit {b.bit}</span>
                  <span className="font-mono text-xs text-muted-foreground">B{b.byte}.{b.bitInByte}</span>
                  <div className="min-w-0">
                    <span className={cn("inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold capitalize", patternBadge[b.pattern])}>{b.pattern.replace("-", " ")}</span>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{b.correlation}</p>
                  </div>
                  <span className="text-right font-mono text-xs text-primary">{(b.activity * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          ) : <Empty message="No bit-analysis rows available." />}
        </AnalysisCard>

        {/* 4. Counter/Checksum Detector */}
        <AnalysisCard title="Counter & Checksum Detector" description="Rolling counters, wraparound bytes, and likely checksum positions." icon={<Sigma className="size-5" />}>
          {counters.length ? (
            <div className="grid gap-2">
              {counters.map((c, i) => (
                <div key={`${c.id}-${c.byteIndex}-${i}`} className="rounded-lg border border-glass-border bg-glass p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-foreground">{c.id} · byte {c.byteIndex}</span>
                    <span className={cn("rounded-md border px-2 py-0.5 text-xs font-semibold", kindBadge[c.kind])}>{c.kind.replace("_", " ")}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{c.reason}</p>
                  <p className="mt-1 font-mono text-xs text-primary">confidence {c.confidence}%</p>
                </div>
              ))}
            </div>
          ) : <Empty message="No counter or checksum candidates detected." />}
        </AnalysisCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* 6. Behavior Summaries */}
        <AnalysisCard title="Behavior Summaries" description="Plain-English motion of decoded signals and dynamic-byte payloads." icon={<Activity className="size-5" />}>
          {behaviors.length ? (
            <div className="grid gap-2">
              {behaviors.slice(0, 14).map((b, i) => (
                <div key={`${b.subject}-${i}`} className="rounded-lg border border-glass-border bg-glass p-3">
                  <div className="flex items-center justify-between">
                    <p className="truncate font-semibold text-foreground">{b.subject}</p>
                    <span className={cn("rounded-md border px-2 py-0.5 text-xs font-semibold capitalize", behaviorBadge[b.behavior])}>{b.behavior}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{b.description}</p>
                </div>
              ))}
            </div>
          ) : <Empty message="No decoded signals or deep-dive rows for behaviour summaries." />}
        </AnalysisCard>

        {/* 7. DBC Auto-Matching Enhancements */}
        <AnalysisCard title="DBC Auto-Matching" description="Aliasing, normalization, and fallback matching with per-match confidence." icon={<ListChecks className="size-5" />}>
          <div className="grid gap-3">
            <div className="flex items-center justify-between rounded-lg border border-glass-border bg-glass p-3">
              <div>
                <p className="font-semibold text-foreground">{dbc.matchedIds}/{dbc.totalLogIds} log IDs matched</p>
                {dbc.notes.map((note) => <p key={note} className="text-xs text-muted-foreground">{note}</p>)}
              </div>
              <Gauge className="size-6 text-primary" />
            </div>
            {dbc.matches.length ? (
              <div className="max-h-72 overflow-auto rounded-lg border border-glass-border">
                <table className="min-w-full text-xs">
                  <thead className="bg-muted/30 text-muted-foreground"><tr><th className="px-3 py-2 text-left">Log ID</th><th className="px-3 py-2 text-left">DBC ID</th><th className="px-3 py-2 text-left">Method</th><th className="px-3 py-2 text-right">Conf.</th></tr></thead>
                  <tbody>
                    {dbc.matches.map((m, i) => (
                      <tr key={`${m.logId}-${i}`} className="border-t border-glass-border">
                        <td className="px-3 py-1.5 font-mono">{m.logId}</td>
                        <td className="px-3 py-1.5 font-mono">{m.dbcId}</td>
                        <td className="px-3 py-1.5">{m.method}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-primary">{m.confidence}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {dbc.unmatchedIds.length ? (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs">
                <p className="flex items-center gap-2 font-semibold text-warning"><AlertTriangle className="size-4" /> Unmatched log IDs</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {dbc.unmatchedIds.map((id) => <span key={id} className="rounded-md border border-glass-border bg-background/40 px-2 py-0.5 font-mono">{id}</span>)}
                </div>
              </div>
            ) : null}
          </div>
        </AnalysisCard>
      </div>

      <div className="rounded-lg border border-glass-border bg-glass p-4 text-xs text-muted-foreground">
        <BrainCircuit className="mr-2 inline size-4 text-primary" />
        These intelligence modules describe only what the captured data shows. They do not infer vehicle make, model, or OEM identity.
      </div>
    </div>
  );
};

export default IntelligenceSuite;
