import { FormEvent, useMemo, useState } from "react";
import { Beaker, Copy, Download, FileCode2, FileText, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AnalysisCard } from "@/components/AnalysisCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  drivingStateOptions,
  generateSample,
  type DrivingState,
  type SampleOutput,
} from "@/lib/sampleGenerator";
import { fetchVehicleSpecs } from "@/lib/vehicleSpecs";
import { convertSpeedsInText, useSpeedUnit } from "@/lib/units";

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "sample";

const isIOS = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iPadOS = navigator.platform === "MacIntel" && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOS;
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

const openInNewTab = (filename: string, contents: string, mime: string) => {
  // iOS Safari can't trigger anchor-based blob downloads, but it CAN open a new
  // tab containing a real download link with the correct MIME + filename so the
  // user can long-press / use Share → Save to Files and the extension (.dbc /
  // .log) is preserved instead of being saved as .txt or .html.
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);

  const win = window.open("", "_blank");
  if (!win) {
    URL.revokeObjectURL(url);
    // Popup blocked — fall back to copying contents to clipboard
    try {
      void navigator.clipboard?.writeText(contents);
      toast.message(`Couldn't open download tab. ${filename} copied to clipboard.`);
    } catch {
      toast.error("Browser blocked the download. Allow popups and try again.");
    }
    return;
  }
  win.document.open();
  win.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(filename)}</title><style>body{margin:0;font-family:-apple-system,system-ui,sans-serif;background:#111;color:#eee}header{position:sticky;top:0;background:#1a1a1a;padding:12px 16px;border-bottom:1px solid #333;display:flex;align-items:center;gap:8px;flex-wrap:wrap}h1{font-size:13px;margin:0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}a.btn,button{background:#3b82f6;color:#fff;border:0;padding:8px 14px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;display:inline-block}p.hint{margin:8px 16px;font-size:12px;color:#9ca3af}pre{margin:0;padding:16px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.5;white-space:pre-wrap;word-break:break-all}</style></head><body><header><h1>${escapeHtml(filename)}</h1><a class="btn" href="${url}" download="${escapeHtml(filename)}" type="${escapeHtml(mime)}">Download</a><button onclick="navigator.clipboard.writeText(document.getElementById('c').innerText).then(()=>this.textContent='Copied!')">Copy</button></header><p class="hint">iOS: long-press <b>Download</b> → <b>Download Linked File</b> to save as <code>${escapeHtml(filename)}</code>. Or tap Download, then Share → Save to Files.</p><pre id="c">${escapeHtml(contents)}</pre></body></html>`,
  );
  win.document.close();
  // Keep the blob URL alive for ~5 min so the user has time to save.
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
};

const downloadText = (filename: string, contents: string, mime: string) => {
  // iOS Safari: blob downloads silently fail. Open in a new tab with a real
  // download link instead so Safari preserves the .dbc / .log extension.
  if (isIOS()) {
    openInNewTab(filename, contents, mime);
    return;
  }

  // Desktop + Android: classic anchor download works reliably
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const SampleGenerator = () => {
  const [vehicle, setVehicle] = useState("Generic EV sedan");
  const [state, setState] = useState<DrivingState>("launch_0_60");
  const [notes, setNotes] = useState("");
  const [durationText, setDurationText] = useState("15");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SampleOutput | null>(null);
  const [speedUnit, setSpeedUnit] = useSpeedUnit();

  const displaySummary = useMemo(
    () => (result ? convertSpeedsInText(result.summary, speedUnit) : ""),
    [result, speedUnit],
  );

  const baseName = useMemo(
    () => `${slug(vehicle)}__${state}`,
    [vehicle, state],
  );

  const handleGenerate = async (event: FormEvent) => {
    event.preventDefault();
    if (!vehicle.trim()) {
      toast.error("Enter a vehicle description.");
      return;
    }
    setBusy(true);
    const desc = vehicle.trim();
    try {
      // Look up realistic specs for this vehicle (cached). Falls back to built-in
      // matching when AI is unavailable or returns nothing.
      let specs = null as Awaited<ReturnType<typeof fetchVehicleSpecs>>;
      try {
        specs = await fetchVehicleSpecs(desc);
      } catch (err) {
        console.warn("Vehicle spec lookup failed, using built-in profile.", err);
      }

      const out = generateSample({
        vehicleDescription: desc,
        drivingState: state,
        customStateNotes: notes.trim() || undefined,
        durationSec: Number(durationText) || 15,
        specOverride: specs?.override,
      });
      setResult(out);
      const tag = specs?.canonicalName ? ` (${specs.canonicalName})` : "";
      toast.success(`Generated ${out.stats.messages.toLocaleString()} synthetic CAN messages${tag}.`);
    } catch (err) {
      console.error(err);
      toast.error("Generator failed. Try a shorter duration.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard.`);
    } catch {
      toast.error("Clipboard unavailable.");
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 md:px-8">
      <header className="data-panel riveted relative overflow-hidden p-5 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-sm border border-glass-border bg-card/60 px-3 py-1.5">
              <span className="status-led" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-foreground">
                Sample Generator · Standalone Module
              </span>
            </div>
            <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-foreground md:text-3xl">
              Vehicle Sample Log + DBC Generator
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Produce fully synthetic, fictional CAN logs and matching DBC files for any vehicle profile and driving
              state. Outputs are safe, generic, and compatible with the existing analysis pipeline.
            </p>
          </div>
          <div className="grid size-14 shrink-0 place-items-center rounded-sm border border-glass-border bg-card/60 text-primary">
            <Beaker className="size-6" />
          </div>
        </div>
      </header>

      <AnalysisCard
        title="Generator Inputs"
        description="Describe the vehicle and the driving state. All output is fictional."
        icon={<Sparkles className="size-5" />}
      >
        <form onSubmit={handleGenerate} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="vehicle">Vehicle description</Label>
            <Input
              id="vehicle"
              value={vehicle}
              maxLength={120}
              onChange={(e) => setVehicle(e.target.value)}
              placeholder="e.g. Generic EV hatchback, midsize pickup, sport sedan"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">Driving state</Label>
            <select
              id="state"
              value={state}
              onChange={(e) => setState(e.target.value as DrivingState)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {drivingStateOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (seconds)</Label>
            <Input
              id="duration"
              type="number"
              min={2}
              max={120}
              value={durationText}
              onChange={(e) => setDurationText(e.target.value)}
              onBlur={() => {
                const n = Number(durationText);
                if (!Number.isFinite(n) || n < 2) setDurationText("2");
                else if (n > 120) setDurationText("120");
                else setDurationText(String(Math.round(n)));
              }}
            />
            <p className="text-xs text-muted-foreground">2–120 s. Longer logs take a moment to generate.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Custom notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              maxLength={300}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add scenario context, e.g. cold ambient, mild grade, etc."
              className="min-h-[40px]"
            />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={busy} className="w-full md:w-auto">
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
              Generate synthetic sample
            </Button>
          </div>
        </form>
      </AnalysisCard>

      {result ? (
        <div className="grid gap-4">
          <AnalysisCard
            title="Sample Summary"
            description={`${result.stats.messages.toLocaleString()} messages · ${result.stats.uniqueIds} IDs · ${result.stats.avgRateHz.toFixed(0)} msg/s`}
            icon={<FileText className="size-5" />}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
              <div className="inline-flex items-center gap-1 rounded-sm border border-glass-border bg-background/60 p-1 font-mono text-[10px] uppercase tracking-wider">
                <span className="px-2 text-muted-foreground">Units</span>
                <button
                  type="button"
                  onClick={() => setSpeedUnit("kph")}
                  className={`rounded-sm px-2 py-1 transition-colors ${speedUnit === "kph" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"}`}
                >
                  km/h
                </button>
                <button
                  type="button"
                  onClick={() => setSpeedUnit("mph")}
                  className={`rounded-sm px-2 py-1 transition-colors ${speedUnit === "mph" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"}`}
                >
                  mph
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => copy("Summary", displaySummary)}>
                  <Copy className="mr-1.5 size-3.5" /> Copy
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => downloadText(`${baseName}__summary.txt`, displaySummary, "text/plain")}
                >
                  <Download className="mr-1.5 size-3.5" /> Download
                </Button>
              </div>
            </div>
            <pre className="max-h-72 overflow-auto rounded-md border border-glass-border bg-background/60 p-3 font-mono text-xs leading-relaxed text-foreground">
              {displaySummary}
            </pre>
          </AnalysisCard>

          <AnalysisCard
            title="Synthetic DBC"
            description="Generic, fictional signal database — not affiliated with any OEM."
            icon={<FileCode2 className="size-5" />}
          >
            <div className="flex items-center justify-end gap-2 pb-2">
              <Button variant="secondary" size="sm" onClick={() => copy("DBC", result.dbc)}>
                <Copy className="mr-1.5 size-3.5" /> Copy
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => downloadText(`${baseName}.dbc`, result.dbc, "application/octet-stream")}
              >
                <Download className="mr-1.5 size-3.5" /> Download .dbc
              </Button>
            </div>
            <pre className="max-h-96 overflow-auto rounded-md border border-glass-border bg-background/60 p-3 font-mono text-[11px] leading-relaxed text-foreground">
              {result.dbc}
            </pre>
          </AnalysisCard>

          <AnalysisCard
            title="Synthetic CAN Log"
            description="candump-style — pipe directly into the existing Intake / Diagnose pipeline."
            icon={<FileText className="size-5" />}
          >
            <div className="flex items-center justify-end gap-2 pb-2">
              <Button variant="secondary" size="sm" onClick={() => copy("CAN log", result.log)}>
                <Copy className="mr-1.5 size-3.5" /> Copy
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => downloadText(`${baseName}.log`, result.log, "text/plain")}
              >
                <Download className="mr-1.5 size-3.5" /> Download .log
              </Button>
            </div>
            <pre className="max-h-96 overflow-auto rounded-md border border-glass-border bg-background/60 p-3 font-mono text-[11px] leading-relaxed text-foreground">
              {result.log.split("\n").slice(0, 400).join("\n")}
              {result.log.split("\n").length > 400 ? "\n… (truncated for preview — full file in download)" : ""}
            </pre>
          </AnalysisCard>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-glass-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
          Configure inputs above and press <span className="font-mono">Generate</span> to create a synthetic DBC + CAN
          log pair.
        </div>
      )}
    </main>
  );
};

export default SampleGenerator;
