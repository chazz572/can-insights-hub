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

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "sample";

const downloadText = async (filename: string, contents: string, mime: string) => {
  const blob = new Blob([contents], { type: mime });

  // Try Web Share API first (works best on mobile, especially iOS)
  try {
    const file = new File([blob], filename, { type: mime });
    const nav = navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean;
      share?: (data: { files: File[]; title?: string }) => Promise<void>;
    };
    if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
      await nav.share({ files: [file], title: filename });
      return;
    }
  } catch (err) {
    // user cancelled or share failed — fall through to download
    if ((err as Error)?.name === "AbortError") return;
  }

  // Fallback: classic anchor download (desktop + Android Chrome)
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  // Last-resort fallback for iOS Safari: open data URL in a new tab
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
  if (isIOS) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const win = window.open();
      if (win) {
        win.document.write(
          `<title>${filename}</title><pre style="white-space:pre-wrap;font-family:monospace;font-size:12px;padding:12px;">${contents.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string))}</pre>`,
        );
        win.document.title = filename;
      }
      void dataUrl;
    };
    reader.readAsDataURL(blob);
  }
};

const SampleGenerator = () => {
  const [vehicle, setVehicle] = useState("Generic EV sedan");
  const [state, setState] = useState<DrivingState>("launch_0_60");
  const [notes, setNotes] = useState("");
  const [durationText, setDurationText] = useState("15");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SampleOutput | null>(null);

  const baseName = useMemo(
    () => `${slug(vehicle)}__${state}`,
    [vehicle, state],
  );

  const handleGenerate = (event: FormEvent) => {
    event.preventDefault();
    if (!vehicle.trim()) {
      toast.error("Enter a vehicle description.");
      return;
    }
    setBusy(true);
    // Defer to next tick so the button shows busy state on big logs
    window.setTimeout(() => {
      try {
        const out = generateSample({
          vehicleDescription: vehicle.trim(),
          drivingState: state,
          customStateNotes: notes.trim() || undefined,
          durationSec: Number(durationText) || 15,
        });
        setResult(out);
        toast.success(`Generated ${out.stats.messages.toLocaleString()} synthetic CAN messages.`);
      } catch (err) {
        console.error(err);
        toast.error("Generator failed. Try a shorter duration.");
      } finally {
        setBusy(false);
      }
    }, 30);
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
            <div className="flex items-center justify-end gap-2 pb-2">
              <Button variant="secondary" size="sm" onClick={() => copy("Summary", result.summary)}>
                <Copy className="mr-1.5 size-3.5" /> Copy
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => downloadText(`${baseName}__summary.txt`, result.summary, "text/plain")}
              >
                <Download className="mr-1.5 size-3.5" /> Download
              </Button>
            </div>
            <pre className="max-h-72 overflow-auto rounded-md border border-glass-border bg-background/60 p-3 font-mono text-xs leading-relaxed text-foreground">
              {result.summary}
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
                onClick={() => downloadText(`${baseName}.dbc`, result.dbc, "text/plain")}
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
