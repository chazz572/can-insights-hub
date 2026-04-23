import { useEffect, useMemo, useState } from "react";
import { Activity, ChartNoAxesCombined, Clock3, FastForward, Gauge, Layers3, Pause, Play, RotateCcw, ScanLine, ShieldCheck, SlidersHorizontal, Waves } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const replayFrames = [
  { time: 0, id: "0x123", data: "12 7A 00 41 9C 08 22 FF", signal: 38, jitter: 1.4 },
  { time: 8, id: "0x18FEF1", data: "01 0C A8 21 00 00 44 10", signal: 76, jitter: 3.2 },
  { time: 16, id: "0x7E8", data: "03 41 0C 2E B0 00 00 00", signal: 52, jitter: 2.1 },
  { time: 26, id: "0x201", data: "2A 00 91 7F 18 62 00 03", signal: 88, jitter: 5.7 },
  { time: 38, id: "0x391", data: "00 14 80 80 00 20 11 04", signal: 44, jitter: 1.9 },
  { time: 54, id: "0x456", data: "9D 04 2C 00 7A 18 00 EF", signal: 92, jitter: 6.4 },
  { time: 72, id: "0x18DAF1", data: "10 14 62 F1 90 4E 4C 32", signal: 61, jitter: 4.8 },
  { time: 94, id: "0x100", data: "00 FF 7B 21 43 00 12 76", signal: 72, jitter: 2.8 },
  { time: 118, id: "0x123", data: "13 7D 00 42 A0 09 24 FF", signal: 48, jitter: 1.6 },
  { time: 139, id: "0x7E8", data: "03 41 0D 31 00 00 00 00", signal: 84, jitter: 4.1 },
  { time: 153, id: "0x201", data: "2E 00 98 82 1B 65 00 04", signal: 57, jitter: 2.5 },
  { time: 161, id: "0x456", data: "A1 05 31 00 7C 19 00 F2", signal: 95, jitter: 6.9 },
];

const durationSeconds = 161;
const speedOptions = [0.5, 1, 2, 4];
const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

const Visualize = () => {
  const [scrub, setScrub] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const currentTime = Math.round((scrub / 100) * durationSeconds);
  const currentIndex = replayFrames.reduce((active, frame, index) => frame.time <= currentTime ? index : active, 0);
  const currentFrame = replayFrames[currentIndex];
  const visibleFrames = replayFrames.slice(Math.max(0, currentIndex - 4), currentIndex + 1).reverse();
  const idActivity = useMemo(() => replayFrames.reduce<Record<string, number>>((counts, frame, index) => {
    counts[frame.id] = Math.max(counts[frame.id] ?? 0, index <= currentIndex ? frame.signal : 0);
    return counts;
  }, {}), [currentIndex]);

  useEffect(() => {
    if (!isPlaying) return undefined;

    const timer = window.setInterval(() => {
      setScrub((current) => {
        const next = current + speed * 0.62;
        if (next >= 100) {
          setIsPlaying(false);
          return 100;
        }
        return next;
      });
    }, 120);

    return () => window.clearInterval(timer);
  }, [isPlaying, speed]);

  const resetReplay = () => {
    setScrub(0);
    setIsPlaying(false);
  };

  return (
  <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
    <section className="mb-8 animate-fade-up rounded-lg border border-glass-border bg-glass-strong p-5 shadow-dashboard backdrop-blur sm:p-7">
      <p className="inline-flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-3 py-1 text-sm font-semibold uppercase text-primary shadow-glow backdrop-blur"><ChartNoAxesCombined className="size-4" /> Visualization Lab</p>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_0.75fr] lg:items-end">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">CAN Replay and Signal Graphing</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">Replay traffic, inspect timing jitter, overlay candidate signals, and scrub through diagnostic events.</p>
        </div>
        <div className="rounded-lg border border-primary/30 bg-gradient-subtle p-4">
          <Waves className="mb-3 size-6 text-primary" />
          <p className="font-semibold text-foreground">Live evidence view</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Frame stream, load bars, jitter markers, and signal overlays stay synchronized.</p>
        </div>
      </div>
    </section>

    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <Card className="animate-fade-up overflow-hidden">
        <CardHeader><CardTitle className="flex items-center gap-2"><FastForward className="text-primary" /> Real-Time CAN Replay</CardTitle></CardHeader>
        <CardContent>
          <div className="relative overflow-hidden rounded-lg border border-glass-border bg-glass p-5">
            <div className="absolute inset-y-0 w-px bg-primary/50 shadow-glow transition-all duration-150" style={{ left: `${scrub}%` }} />
            <div className="grid gap-3">
              {replayFrames.slice(0, 8).map((frame, index) => {
                const active = replayFrames.findIndex((item) => item.time === frame.time && item.id === frame.id) <= currentIndex;
                return <div key={`${frame.id}-${frame.time}`} className="grid grid-cols-[6rem_1fr_3.5rem] items-center gap-3"><span className="font-mono text-xs text-muted-foreground">{frame.id}</span><span className="h-2 overflow-hidden rounded-full bg-secondary"><span className="block h-full rounded-full bg-gradient-accent shadow-glow transition-all duration-300" style={{ width: active ? `${Math.max(10, frame.signal)}%` : `${Math.max(4, index * 3)}%`, opacity: active ? 1 : 0.28 }} /></span><span className="text-right font-mono text-xs text-foreground">{formatTime(frame.time)}</span></div>;
              })}
            </div>
            <div className="mt-5 rounded-lg border border-glass-border bg-background/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><p className="font-mono text-sm text-primary">{currentFrame.id}</p><p className="font-mono text-sm text-foreground">{currentFrame.data}</p><p className="text-sm text-muted-foreground">Jitter {currentFrame.jitter.toFixed(1)} ms</p></div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="animate-fade-up overflow-hidden">
        <CardHeader><CardTitle className="flex items-center gap-2"><SlidersHorizontal className="text-primary" /> Timeline Scrubber</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-lg border border-glass-border bg-glass p-5">
            <input aria-label="Timeline Scrubber" className="w-full accent-primary" type="range" min="0" max="100" value={scrub} onChange={(event) => { setScrub(Number(event.target.value)); setIsPlaying(false); }} />
            <div className="mt-5 grid grid-cols-3 gap-3 text-center text-sm"><div className="rounded-lg bg-secondary p-3 font-mono text-secondary-foreground">{formatTime(currentTime)}</div><button type="button" onClick={() => setIsPlaying((current) => !current)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary p-3 font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground">{isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}{isPlaying ? "Pause" : "Play"}</button><button type="button" onClick={resetReplay} className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary p-3 font-semibold text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground"><RotateCcw className="size-4" /> Reset</button></div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {speedOptions.map((option) => <button key={option} type="button" onClick={() => setSpeed(option)} className={`rounded-lg border border-glass-border p-2 text-sm font-semibold transition-colors ${speed === option ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground"}`}>{option}x</button>)}
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {[[Clock3, `Timing Jitter: ${currentFrame.jitter.toFixed(1)} ms`], [Layers3, `Active Frame: ${currentIndex + 1}/${replayFrames.length}`], [Gauge, `Signal Load: ${currentFrame.signal}%`]].map(([Icon, label]) => <div key={String(label)} className="flex items-center gap-3 rounded-lg border border-glass-border bg-glass p-3 text-sm"><Icon className="size-4 text-primary" /> {String(label)}</div>)}
          </div>
        </CardContent>
      </Card>
    </div>

    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <Card className="animate-fade-up overflow-hidden"><CardHeader><CardTitle className="flex items-center gap-2"><Activity className="text-primary" /> Signal Overlay</CardTitle></CardHeader><CardContent><div className="flex h-56 items-end gap-2 rounded-lg border border-glass-border bg-glass p-4">{replayFrames.map((frame, index) => <span key={`${frame.id}-${index}`} className="flex-1 rounded-t-md bg-primary/80 transition-all duration-300" style={{ height: `${index <= currentIndex ? frame.signal : 8}%`, opacity: index <= currentIndex ? 1 : 0.25 }} />)}</div></CardContent></Card>
      <Card className="animate-fade-up overflow-hidden"><CardHeader><CardTitle className="flex items-center gap-2"><ScanLine className="text-primary" /> Live Frame Stream</CardTitle></CardHeader><CardContent><div className="grid gap-3">{visibleFrames.map((frame) => <div key={`${frame.id}-${frame.time}`} className="grid grid-cols-[4rem_5rem_1fr] items-center gap-3 rounded-lg border border-glass-border bg-glass p-3 text-sm"><span className="font-mono text-muted-foreground">{formatTime(frame.time)}</span><span className="font-mono text-primary">{frame.id}</span><span className="truncate font-mono text-foreground">{frame.data}</span></div>)}{Object.entries(idActivity).map(([id, value]) => <div key={id} className="grid grid-cols-[6rem_1fr] items-center gap-3 text-sm"><span className="font-mono text-muted-foreground">{id}</span><span className="h-2 rounded-full bg-secondary"><span className="block h-full rounded-full bg-gradient-accent transition-all duration-300" style={{ width: `${Math.max(4, value)}%` }} /></span></div>)}</div></CardContent></Card>
    </div>
  </main>
  );
};

export default Visualize;
