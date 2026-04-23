import { Binary, BrainCircuit, Cpu, DatabaseZap, GitBranch, Layers3, Radar, SlidersHorizontal, TerminalSquare } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const tools = [
  ["Signal Extraction Wizard", "Guided candidate selection for byte/bit signals, scaling hypotheses, and validation notes.", Radar],
  ["Bit-Level Pattern Recognition", "Detect toggles, counters, status flags, and event bits across high-frequency IDs.", Binary],
  ["Byte Entropy Explorer", "Rank byte positions by volatility, dominant values, and signal-likelihood score.", Layers3],
  ["ID Similarity Clustering", "Group identifiers by timing, byte entropy, payload shape, and activity similarity.", GitBranch],
  ["Protocol Auto-Detection", "Surface likely J1939, ISO-TP, UDS, GMLAN, Tesla-style, or generic CAN traffic.", Cpu],
  ["Raw Data Explorer", "Inspect normalized CSV frames without changing the existing analysis payload.", TerminalSquare],
] as const;

const protocolRows = [
  ["J1939", "PGN ranges, 29-bit IDs, source addresses", "Ready"],
  ["ISO-TP / UDS", "0x7E0-0x7EF diagnostics, multi-frame flow", "Heuristic"],
  ["GMLAN", "GM service IDs and chassis/body traffic", "Heuristic"],
  ["Tesla / EV", "High-rate inverter, regen, BMS-style signals", "Pattern"],
];

const Engineering = () => (
  <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
    <section className="mb-8 animate-fade-up">
      <p className="inline-flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-3 py-1 text-sm font-semibold uppercase text-primary shadow-glow backdrop-blur"><DatabaseZap className="size-4" /> Engineering workbench</p>
      <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Reverse-engineering command tools</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">Professional CAN exploration surfaces for engineers, tuners, EV hackers, and embedded diagnostics teams.</p>
    </section>

    <div className="grid gap-6 lg:grid-cols-3">
      {tools.map(([title, detail, Icon]) => (
        <Card key={title} className="animate-fade-up overflow-hidden">
          <CardContent className="p-6">
            <span className="grid size-12 place-items-center rounded-lg border border-glass-border bg-glass text-primary shadow-glow"><Icon className="size-6" /></span>
            <h2 className="mt-5 text-xl font-bold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
            <Button className="mt-5 w-full" variant="outline" size="sm"><SlidersHorizontal className="size-4" /> Open tool</Button>
          </CardContent>
        </Card>
      ))}
    </div>

    <Card className="mt-6 animate-fade-up overflow-hidden">
      <CardHeader><CardTitle className="flex items-center gap-2"><BrainCircuit className="text-primary" /> Protocol intelligence matrix</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-glass-border text-xs uppercase text-muted-foreground"><tr><th className="py-3">Protocol</th><th>Detection signals</th><th>Status</th></tr></thead>
          <tbody>{protocolRows.map(([name, signals, status]) => <tr key={name} className="border-b border-glass-border/60"><td className="py-4 font-bold text-foreground">{name}</td><td className="text-muted-foreground">{signals}</td><td><span className="rounded-lg bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">{status}</span></td></tr>)}</tbody>
        </table>
      </CardContent>
    </Card>
  </main>
);

export default Engineering;
