import { useState } from "react";
import { Binary, BrainCircuit, Cpu, DatabaseZap, Download, GitBranch, Layers3, Loader2, Radar, ShieldCheck, SlidersHorizontal, TerminalSquare, Wrench } from "lucide-react";
import { Link } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { analyzeFile } from "@/lib/canApi";
import { buildPartialDbcDraft, generatePartialDbcCandidates, type DbcCandidateSignal } from "@/lib/intelligence";

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

type EngineeringTool = (typeof tools)[number];

const Engineering = () => {
  const [activeTool, setActiveTool] = useState<EngineeringTool>(tools[0]);
  const [developerMode, setDeveloperMode] = useState(true);
  const [sensitivity, setSensitivity] = useState(72);
  const [selectedProtocol, setSelectedProtocol] = useState(protocolRows[0][0]);
  const [dbcSignals, setDbcSignals] = useState<DbcCandidateSignal[]>([]);
  const [dbcDraft, setDbcDraft] = useState("");
  const [dbcMessage, setDbcMessage] = useState<string | null>(null);
  const [isGeneratingDbc, setIsGeneratingDbc] = useState(false);
  const ActiveToolIcon = activeTool[2];

  const generateDbc = async () => {
    const fileId = localStorage.getItem("can_ai_file_id");
    if (!fileId) {
      setDbcMessage("Upload and analyze a CAN log first, then return here to generate a partial DBC draft.");
      return;
    }
    setIsGeneratingDbc(true);
    setDbcMessage(null);
    try {
      const analysis = await analyzeFile(fileId);
      const signals = generatePartialDbcCandidates(analysis);
      setDbcSignals(signals);
      setDbcDraft(buildPartialDbcDraft(signals));
      setDbcMessage(`Generated ${signals.length} candidate signal definition${signals.length === 1 ? "" : "s"} from the current log.`);
    } catch (error) {
      setDbcMessage(error instanceof Error ? error.message : "Unable to generate partial DBC draft.");
    } finally {
      setIsGeneratingDbc(false);
    }
  };

  const downloadDbcDraft = () => {
    if (!dbcDraft) return;
    const url = URL.createObjectURL(new Blob([dbcDraft], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "partial-dbc-draft.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
  <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
    <section className="mb-8 animate-fade-up rounded-lg border border-glass-border bg-glass-strong p-5 shadow-dashboard backdrop-blur sm:p-7">
      <p className="inline-flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-3 py-1 text-sm font-semibold uppercase text-primary shadow-glow backdrop-blur"><DatabaseZap className="size-4" /> Engineering Workbench</p>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-end">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Reverse-Engineering Command Tools</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">Professional CAN exploration surfaces for engineers, tuners, EV specialists, and embedded diagnostics teams.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {[[Radar, "Signal candidates"], [Wrench, "DBC drafting"], [ShieldCheck, "Protocol evidence"]].map(([Icon, label]) => <div key={String(label)} className="flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm font-semibold text-foreground"><Icon className="size-4 text-primary" />{String(label)}</div>)}
        </div>
      </div>
    </section>

    <div className="grid gap-6 lg:grid-cols-3">
      {tools.map((tool) => {
        const [title, detail, Icon] = tool;
        return (
        <Card key={title} className="scanline-panel animate-fade-up overflow-hidden">
          <CardContent className="p-6">
            <span className="grid size-12 place-items-center rounded-lg border border-glass-border bg-glass text-primary shadow-glow"><Icon className="size-6" /></span>
            <h2 className="mt-5 text-xl font-bold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
            <Button className="mt-5 w-full" variant={activeTool[0] === title ? "analyzer" : "outline"} size="sm" onClick={() => setActiveTool(tool)}><SlidersHorizontal className="size-4" /> {activeTool[0] === title ? "Tool Active" : "Open Tool"}</Button>
          </CardContent>
        </Card>
      );})}
    </div>

    <Card className="scanline-panel mt-6 animate-fade-up overflow-hidden">
      <CardHeader><CardTitle className="flex items-center gap-2"><ActiveToolIcon className="text-primary" /> {activeTool[0]}</CardTitle></CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-lg border border-glass-border bg-glass p-5">
          <p className="text-sm leading-6 text-muted-foreground">{activeTool[1]}</p>
          <div className="mt-5 space-y-3">
            <label className="flex items-center justify-between gap-4 text-sm font-semibold"><span>Detection Sensitivity</span><span className="font-mono text-primary">{sensitivity}%</span></label>
            <input className="w-full accent-primary" type="range" min="10" max="100" value={sensitivity} onChange={(event) => setSensitivity(Number(event.target.value))} />
            <button type="button" onClick={() => setDeveloperMode((current) => !current)} className="rounded-lg border border-glass-border bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground">Developer Mode: {developerMode ? "On" : "Off"}</button>
          </div>
        </div>
        <div className="rounded-lg border border-glass-border bg-glass p-5 font-mono text-sm text-muted-foreground">
          <p className="text-foreground">status: ready</p>
          <p>active_tool: {activeTool[0]}</p>
          <p>sensitivity: {sensitivity}</p>
          <p>mode: {developerMode ? "developer" : "mechanic"}</p>
          <Button asChild className="mt-4 w-full" variant="outline" size="sm"><Link to={localStorage.getItem("can_ai_file_id") ? `/results/${localStorage.getItem("can_ai_file_id")}` : "/upload"}>Run On Current Log</Link></Button>
        </div>
      </CardContent>
    </Card>

    <Card className="scanline-panel mt-6 animate-fade-up overflow-hidden">
      <CardHeader><CardTitle className="flex items-center gap-2"><BrainCircuit className="text-primary" /> Protocol Intelligence Matrix</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-glass-border text-xs uppercase text-muted-foreground"><tr><th className="py-3">Protocol</th><th>Detection Signals</th><th>Status</th></tr></thead>
          <tbody>{protocolRows.map(([name, signals, status]) => <tr key={name} onClick={() => setSelectedProtocol(name)} className="cursor-pointer border-b border-glass-border/60 transition-colors hover:bg-secondary/60"><td className="py-4 font-bold text-foreground">{name}</td><td className="text-muted-foreground">{signals}</td><td><span className="rounded-lg bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">{selectedProtocol === name ? "Selected" : status}</span></td></tr>)}</tbody>
        </table>
      </CardContent>
    </Card>

    <Card className="scanline-panel mt-6 animate-fade-up overflow-hidden">
      <CardHeader><CardTitle className="flex items-center gap-2"><Layers3 className="text-primary" /> AI DBC Builder</CardTitle></CardHeader>
      <CardContent className="grid gap-5">
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="analyzer" onClick={generateDbc} disabled={isGeneratingDbc}>{isGeneratingDbc ? <Loader2 className="animate-spin" /> : <BrainCircuit className="size-4" />} Generate Partial DBC</Button>
          <Button asChild type="button" variant="outline"><Link to={localStorage.getItem("can_ai_file_id") ? `/results/${localStorage.getItem("can_ai_file_id")}` : "/upload"}>Run On Current Log</Link></Button>
          <Button type="button" variant="outline" onClick={downloadDbcDraft} disabled={!dbcDraft}><Download className="size-4" /> Download Draft</Button>
        </div>
        {dbcMessage ? <div className="rounded-lg border border-glass-border bg-glass p-3 text-sm text-muted-foreground">{dbcMessage}</div> : null}
        {dbcSignals.length ? <div className="overflow-x-auto rounded-lg border border-glass-border bg-glass"><table className="w-full min-w-[860px] text-left text-sm"><thead className="border-b border-glass-border text-xs uppercase text-muted-foreground"><tr><th className="p-3">ID</th><th>Signal</th><th>Start</th><th>Length</th><th>Endian</th><th>Factor</th><th>Unit</th><th>Type</th><th>Confidence</th></tr></thead><tbody>{dbcSignals.map((signal) => <tr key={`${signal.id}-${signal.name}`} className="border-b border-glass-border/60"><td className="p-3 font-mono text-primary">{signal.id}</td><td className="font-semibold text-foreground">{signal.name}</td><td>{signal.bitStart}</td><td>{signal.bitLength}</td><td>{signal.endianness}</td><td>{signal.factor}</td><td>{signal.unit}</td><td>{signal.type}</td><td><div className="h-2 w-24 rounded-full bg-secondary"><div className="h-full rounded-full bg-gradient-accent" style={{ width: `${signal.confidence}%` }} /></div><span className="font-mono text-xs text-primary">{signal.confidence}%</span></td></tr>)}</tbody></table></div> : null}
        {dbcDraft ? <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-glass-border bg-background/40 p-4 text-sm text-foreground">{dbcDraft}</pre> : null}
      </CardContent>
    </Card>
  </main>
  );
};

export default Engineering;
