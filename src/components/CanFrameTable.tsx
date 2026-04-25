import { useEffect, useMemo, useRef, useState } from "react";
import { CanFrame, formatBytes, formatId, formatTime, idHue } from "@/lib/canAnalyzer";
import { cn } from "@/lib/utils";

interface Props {
  frames: CanFrame[];
  autoScroll: boolean;
  changedMaskByID: Map<number, number>;
  onSelect?: (frame: CanFrame) => void;
  selectedId?: number | null;
}

const ROW_H = 30;
const OVERSCAN = 8;

export const CanFrameTable = ({ frames, autoScroll, changedMaskByID, onSelect, selectedId }: Props) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(480);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight));
    ro.observe(el);
    setViewportH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!autoScroll) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [frames.length, autoScroll]);

  const total = frames.length;
  const totalH = total * ROW_H;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const endIdx = Math.min(total, Math.ceil((scrollTop + viewportH) / ROW_H) + OVERSCAN);
  const visible = useMemo(() => frames.slice(startIdx, endIdx), [frames, startIdx, endIdx]);

  return (
    <div className="data-panel relative h-full overflow-hidden">
      {/* Header */}
      <div className="hidden sm:grid grid-cols-[10rem_7rem_4rem_3.5rem_1fr] gap-2 border-b border-glass-border bg-secondary/60 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>Timestamp</span>
        <span>ID</span>
        <span>Bus</span>
        <span>DLC</span>
        <span>Data</span>
      </div>
      <div className="grid sm:hidden grid-cols-[5rem_5rem_1fr] gap-2 border-b border-glass-border bg-secondary/60 px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        <span>Time</span>
        <span>ID</span>
        <span>Data</span>
      </div>
      <div
        ref={scrollRef}
        onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
        className="h-[calc(100%-2.25rem)] overflow-auto"
      >
        <div style={{ height: totalH, position: "relative" }}>
          <div style={{ transform: `translateY(${startIdx * ROW_H}px)` }}>
            {visible.map((f, i) => {
              const realIdx = startIdx + i;
              const mask = changedMaskByID.get(f.id) ?? 0;
              const isLast = realIdx === total - 1;
              const selected = selectedId === f.id;
              const hue = idHue(f.id);
              return (
                <button
                  key={`${realIdx}-${f.timestamp}`}
                  type="button"
                  onClick={() => onSelect?.(f)}
                  style={{ height: ROW_H }}
                  className={cn(
                    "grid w-full grid-cols-[5rem_5rem_1fr] sm:grid-cols-[10rem_7rem_4rem_3.5rem_1fr] items-center gap-2 border-b border-glass-border/40 px-3 sm:px-4 text-left font-mono text-[10px] sm:text-[11px] transition-colors",
                    "hover:bg-primary/10",
                    selected && "bg-primary/15",
                    isLast && "animate-fade-up",
                  )}
                >
                  <span className="truncate text-muted-foreground">{formatTime(f.timestamp)}</span>
                  <span
                    className="truncate font-bold"
                    style={{ color: `hsl(${hue} 80% 62%)` }}
                  >
                    {formatId(f.id)}
                  </span>
                  <span className="hidden sm:block truncate text-foreground/80">{String(f.bus)}</span>
                  <span className="hidden sm:block text-foreground/80">{f.dlc}</span>
                  <span className="flex gap-[2px] sm:gap-[3px] overflow-hidden text-foreground">
                    {f.data.map((b, bi) => (
                      <span
                        key={bi}
                        className={cn(
                          "inline-block w-[1.6em] text-center transition-colors",
                          mask & (1 << bi) ? "rounded-sm bg-primary/30 text-primary" : "",
                        )}
                      >
                        {b.toString(16).toUpperCase().padStart(2, "0")}
                      </span>
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
