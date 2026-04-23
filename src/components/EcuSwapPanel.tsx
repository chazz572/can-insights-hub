import { useMemo, useState } from "react";
import { ArrowLeftRight, Download, Network, Workflow } from "lucide-react";

import { AnalysisCard } from "@/components/AnalysisCard";
import { Button } from "@/components/ui/button";
import type { AnalysisResult } from "@/lib/canApi";
import { buildEcuSwapPairs, buildGatewayTranslator, exportTranslatorTable } from "@/lib/intelligenceModules";

export const EcuSwapPanel = ({ before, after }: { before: AnalysisResult | null | undefined; after: AnalysisResult | null | undefined }) => {
  const pairs = useMemo(() => buildEcuSwapPairs(before, after), [before, after]);
  const rules = useMemo(() => buildGatewayTranslator(pairs), [pairs]);
  const [copied, setCopied] = useState(false);

  if (!before || !after) return null;

  const downloadCsv = () => {
    const csv = exportTranslatorTable(rules);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `cjl-gateway-translator.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyJson = async () => {
    await navigator.clipboard.writeText(JSON.stringify(rules, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="grid gap-6">
      <AnalysisCard
        title="ECU Swap Helper"
        description="Pairs Before/After IDs by overlapping volatile bytes, shared counters, and timing similarity."
        icon={<ArrowLeftRight className="size-5" />}
      >
        {pairs.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Before ID</th>
                  <th className="px-3 py-2 text-left">After ID</th>
                  <th className="px-3 py-2 text-left">Overlap bytes</th>
                  <th className="px-3 py-2 text-right">Shared counters</th>
                  <th className="px-3 py-2 text-right">Δ timing (ms)</th>
                  <th className="px-3 py-2 text-right">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {pairs.map((p, i) => (
                  <tr key={`${p.sourceId}-${p.targetId}-${i}`} className="border-t border-glass-border">
                    <td className="px-3 py-2 font-mono text-foreground">{p.sourceId}</td>
                    <td className="px-3 py-2 font-mono text-foreground">{p.targetId}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{p.overlapBytes.length ? p.overlapBytes.join(", ") : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{p.sharedCounters}</td>
                    <td className="px-3 py-2 text-right font-mono">{p.timingDeltaMs}</td>
                    <td className="px-3 py-2 text-right font-mono text-primary">{p.confidence}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">Suggested signal pairs for building a CAN gateway or translator. Validate on the bench before deployment.</p>
          </div>
        ) : <div className="rounded-lg border border-dashed border-glass-border bg-glass p-4 text-sm text-muted-foreground">No overlapping dynamic patterns were strong enough to suggest swap pairs.</div>}
      </AnalysisCard>

      <AnalysisCard
        title="CAN Gateway Translator Builder"
        description="Translation table mapping IDs and dynamic bytes between the two vehicles for manual or automated gateway logic."
        icon={<Network className="size-5" />}
      >
        {rules.length ? (
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={downloadCsv}><Download className="size-4" /> Download CSV</Button>
              <Button type="button" variant="outline" size="sm" onClick={copyJson}><Workflow className="size-4" /> {copied ? "Copied JSON" : "Copy JSON"}</Button>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {rules.map((rule, i) => (
                <div key={`${rule.fromId}-${rule.toId}-${i}`} className="rounded-lg border border-glass-border bg-glass p-4">
                  <p className="font-mono text-sm text-foreground">{rule.fromId} → {rule.toId}</p>
                  <table className="mt-3 w-full text-xs">
                    <thead className="text-muted-foreground"><tr><th className="text-left">From byte</th><th className="text-left">To byte</th><th className="text-left">Transform</th></tr></thead>
                    <tbody>
                      {rule.byteMap.map((m, idx) => (
                        <tr key={idx} className="border-t border-glass-border">
                          <td className="py-1 font-mono">B{m.from}</td>
                          <td className="py-1 font-mono">B{m.to}</td>
                          <td className="py-1">{m.transform}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-xs text-muted-foreground">{rule.notes}</p>
                </div>
              ))}
            </div>
          </div>
        ) : <div className="rounded-lg border border-dashed border-glass-border bg-glass p-4 text-sm text-muted-foreground">Translator rules will appear after swap pairs are detected.</div>}
      </AnalysisCard>
    </div>
  );
};

export default EcuSwapPanel;
