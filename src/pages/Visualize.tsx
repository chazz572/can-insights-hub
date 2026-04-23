import { useState } from "react";
import { Activity, ChartNoAxesCombined, Clock3, FastForward, Gauge, Layers3, ScanLine, SlidersHorizontal } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const bars = [38, 76, 52, 88, 44, 92, 61, 72, 48, 84, 57, 95];
const timeline = ["0x123", "0x18FEF1", "0x7E8", "0x201", "0x391", "0x456", "0x18DAF1", "0x100"];

const Visualize = () => {
  const [scrub, setScrub] = useState(66);
  const [isPlaying, setIsPlaying] = useState(true);

  return (
  <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
    <section className="mb-8 animate-fade-up">
      <p className="inline-flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-3 py-1 text-sm font-semibold uppercase text-primary shadow-glow backdrop-blur"><ChartNoAxesCombined className="size-4" /> Visualization Lab</p>
      <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">CAN Replay And Signal Graphing</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">Replay traffic, inspect timing jitter, overlay candidate signals, and scrub through diagnostic events.</p>
    </section>

    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <Card className="animate-fade-up overflow-hidden">
        <CardHeader><CardTitle className="flex items-center gap-2"><FastForward className="text-primary" /> Real-Time CAN Replay</CardTitle></CardHeader>
        <CardContent>
          <div className="relative h-64 overflow-hidden rounded-lg border border-glass-border bg-glass p-5">
            <div className="absolute inset-y-0 left-1/2 w-px bg-primary/50 shadow-glow motion-safe:animate-signal-sweep" />
            <div className="grid h-full gap-3">
              {timeline.map((id, index) => <div key={id} className="flex items-center gap-3"><span className="w-24 font-mono text-xs text-muted-foreground">{id}</span><span className="h-2 rounded-full bg-gradient-accent shadow-glow" style={{ width: `${Math.max(8, (28 + index * 7) * scrub / 100)}%` }} /></div>)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="animate-fade-up overflow-hidden">
        <CardHeader><CardTitle className="flex items-center gap-2"><SlidersHorizontal className="text-primary" /> Timeline Scrubber</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-lg border border-glass-border bg-glass p-5">
            <input aria-label="Timeline Scrubber" className="w-full accent-primary" type="range" min="0" max="100" value={scrub} onChange={(event) => setScrub(Number(event.target.value))} />
            <div className="mt-5 grid grid-cols-3 gap-3 text-center text-sm"><div className="rounded-lg bg-secondary p-3">00:00</div><button type="button" onClick={() => setIsPlaying((current) => !current)} className="rounded-lg bg-secondary p-3 text-primary">{isPlaying ? "Pause" : "Play"}</button><div className="rounded-lg bg-secondary p-3">02:41</div></div>
          </div>
          <div className="mt-4 grid gap-3">
            {[[Clock3, "Timing Jitter"], [Layers3, "Entropy Heatmap"], [Gauge, "Multi-signal Overlay"]].map(([Icon, label]) => <div key={String(label)} className="flex items-center gap-3 rounded-lg border border-glass-border bg-glass p-3 text-sm"><Icon className="size-4 text-primary" /> {String(label)}</div>)}
          </div>
        </CardContent>
      </Card>
    </div>

    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <Card className="animate-fade-up overflow-hidden"><CardHeader><CardTitle className="flex items-center gap-2"><Activity className="text-primary" /> Signal overlay</CardTitle></CardHeader><CardContent><div className="flex h-56 items-end gap-2 rounded-lg border border-glass-border bg-glass p-4">{bars.map((bar, index) => <span key={index} className="flex-1 rounded-t-md bg-primary/80" style={{ height: `${bar}%` }} />)}</div></CardContent></Card>
      <Card className="animate-fade-up overflow-hidden"><CardHeader><CardTitle className="flex items-center gap-2"><ScanLine className="text-primary" /> ID activity timeline</CardTitle></CardHeader><CardContent><div className="grid gap-3">{timeline.map((id, index) => <div key={id} className="grid grid-cols-[6rem_1fr] items-center gap-3 text-sm"><span className="font-mono text-muted-foreground">{id}</span><span className="h-3 rounded-full bg-secondary"><span className="block h-full rounded-full bg-gradient-accent" style={{ width: `${35 + index * 8}%` }} /></span></div>)}</div></CardContent></Card>
    </div>
  </main>
  );
};

export default Visualize;
