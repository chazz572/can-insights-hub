import { AlertTriangle, Activity, BarChart3, Binary, BrainCircuit, Car, ChevronDown, Clock, Cpu, Download, FileCode2, FileText, Gauge, GitBranch, Hash, Layers3, Link2, Loader2, Map, MessageSquareText, Radar, Save, ScanLine, ShieldCheck, Sparkles, TimerReset, Wrench, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AnalysisCard } from "@/components/AnalysisCard";
import { IntelligenceSuite } from "@/components/IntelligenceSuite";
import { JsonTable } from "@/components/JsonTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { analyzeFile, AnalysisResult, type JsonRecord } from "@/lib/canApi";
import { buildPartialDbcDraft, generatePartialDbcCandidates, inferVehicleIdentification } from "@/lib/intelligence";
import { requestAiInsight, saveAnalysisSnapshot, type AiInsightKind } from "@/lib/saasApi";
import { generatePdfReport } from "@/lib/pdfReport";
import { createShareLink } from "@/lib/shareApi";
import { createShareLink } from "@/lib/shareApi";
import { cn } from "@/lib/utils";
import { convertSpeedsInText, type SpeedUnit, useSpeedUnit } from "@/lib/units";

const renderText = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "No summary returned.";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
};

const renderTextU = (value: unknown, unit: SpeedUnit) => convertSpeedsInText(renderText(value), unit);

const renderList = (value: unknown) => {
  const items = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];

  if (!items.length) {
    return <div className="rounded-lg border border-dashed border-glass-border bg-glass p-4 text-sm text-muted-foreground backdrop-blur">No values returned.</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <span key={`${String(item)}-${index}`} className="rounded-lg border border-glass-border bg-secondary px-3 py-2 font-mono text-sm text-secondary-foreground shadow-glow">
          {renderText(item)}
        </span>
      ))}
    </div>
  );
};

const toRecordArray = (value: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(value)) return value.map((item, index) => (item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : { item: index + 1, value: item }));
  if (value && typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([key, item]) => (item && typeof item === "object" && !Array.isArray(item) ? { key, ...(item as Record<string, unknown>) } : { key, value: item }));
  return [];
};

const numericValue = (row: Record<string, unknown>, keys: string[]) => {
  const value = keys.map((key) => row[key]).find((item) => typeof item === "number" || (typeof item === "string" && !Number.isNaN(Number(item))));
  return value === undefined ? 0 : Number(value);
};

const titleCase = (value: string) => value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());

const formatReportRows = (title: string, value: unknown, limit = 12) => {
  const rows = toRecordArray(value).slice(0, limit);
  if (!rows.length) return `${title}\n- None detected.\n`;

  return `${title}\n${rows.map((row, index) => {
    const fields = Object.entries(row)
      .slice(0, 6)
      .map(([key, item]) => `${titleCase(key.replace(/_/g, " "))}: ${renderText(item).replace(/\n/g, " ")}`)
      .join(" | ");
    return `${index + 1}. ${fields}`;
  }).join("\n")}\n`;
};

const buildDetailedReport = ({ data, fileId, anomalies, diagnostics, summaryText, componentHealth, busLoad, suspectIds }: { data: AnalysisResult; fileId?: string; anomalies: JsonRecord[]; diagnostics: NonNullable<AnalysisResult["diagnostics"]>; summaryText: unknown; componentHealth: number; busLoad: number; suspectIds: number }) => {
  const vehicleBehavior = data.vehicle_behavior ?? {};
  const generatedAt = new Date().toLocaleString();
  const protocol = diagnostics.protocol && typeof diagnostics.protocol === "object" ? diagnostics.protocol as JsonRecord : {};
  const issueLevel = anomalies.length > 5 || componentHealth < 55 ? "serious" : anomalies.length || componentHealth < 80 ? "worth checking" : "mostly normal";
  const speedIds = (vehicleBehavior.possible_speed_ids ?? []).map(renderText).join(", ") || "none found";
  const rpmIds = (vehicleBehavior.possible_rpm_ids ?? []).map(renderText).join(", ") || "none found";
  const pedalIds = (vehicleBehavior.possible_pedal_ids ?? []).map(renderText).join(", ") || "none found";

  return [
    "CJL CAN Intelligence Platform Mechanic Health Report",
    `Checked: ${generatedAt}`,
    "",
    "What I’m Seeing",
    `I looked over the car’s communication log. The scan saw ${data.total_messages ?? "a number of"} messages from ${data.unique_ids ?? "multiple"} control modules. Overall, this looks ${issueLevel}. The health score is ${componentHealth}/100, and the network activity looks about ${busLoad}% loaded during this capture.`,
    "",
    "What This Means In Plain English",
    anomalies.length
      ? `The car had ${anomalies.length} message${anomalies.length === 1 ? "" : "s"} that looked unusual compared with the rest of the log. That does not automatically mean a bad part, but it does mean those moments deserve a closer look.`
      : "I did not see obvious abnormal message patterns in this capture. If the car still has symptoms, I would want another log while the problem is actively happening.",
    suspectIds
      ? `There were ${suspectIds} repeating message groups that may be tied to live vehicle behavior. These are useful clues for tracking speed, RPM, pedal input, battery behavior, or module chatter.`
      : "I did not find strong repeating signal groups from this capture.",
    "",
    "Likely Signals Found",
    `Speed-related messages: ${speedIds}`,
    `RPM-related messages: ${rpmIds}`,
    `Pedal-related messages: ${pedalIds}`,
    "",
    "Mechanic Notes",
    renderText(diagnostics.mechanic_summary ?? summaryText),
    "",
    "What I Would Do Next",
    anomalies.length
      ? "1. Recheck the vehicle while the symptom is happening and compare it to this log."
      : "1. Keep this report as a baseline and run another scan if the issue comes back.",
    "2. Watch the suspected speed, RPM, and pedal messages while driving or testing safely.",
    "3. If warning lights or drivability problems are present, pair this CAN review with a normal diagnostic scan tool report.",
    "4. Do not replace parts based only on this report; use it to guide the next inspection.",
    "",
    "For Reference",
    `Log ID: ${fileId ?? "—"}`,
    `Network type detected: ${renderText(protocol.likely_protocol ?? "unknown")}`,
  ].join("\n");
};

const CollapsiblePanel = ({ title, icon, children, defaultOpen = false }: { title: string; icon: ReactNode; children: ReactNode; defaultOpen?: boolean }) => (
  <details open={defaultOpen} className="group overflow-hidden rounded-lg border border-glass-border bg-glass backdrop-blur-xl transition-all duration-300 hover:border-primary/30 hover:shadow-glow">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5">
      <span className="flex items-center gap-3 text-lg font-bold text-foreground">
        <span className="grid size-10 place-items-center rounded-lg border border-glass-border bg-gradient-subtle text-primary shadow-glow">{icon}</span>
        {title}
      </span>
      <ChevronDown className="size-5 text-muted-foreground transition-transform duration-300 group-open:rotate-180" />
    </summary>
    <div className="border-t border-glass-border p-5 animate-fade-up">{children}</div>
  </details>
);

const FrequencyChart = ({ data }: { data: unknown }) => {
  const rows = toRecordArray(data).map((row, index) => ({ name: String(row.id ?? row.can_id ?? row.arbitration_id ?? row.identifier ?? row.key ?? index + 1), count: numericValue(row, ["count", "frequency", "messages", "total", "value"]) }));
  if (!rows.length) return null;
  return (
    <div className="mb-4 h-56 rounded-lg border border-glass-border bg-glass p-4 backdrop-blur">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows.slice(0, 16)}>
          <CartesianGrid stroke="hsl(var(--glass-border))" vertical={false} />
          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
          <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
          <Tooltip cursor={{ fill: "hsl(var(--secondary) / 0.45)" }} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--glass-border))", borderRadius: "12px" }} />
          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const ByteEntropyHeatmap = ({ data }: { data: unknown }) => {
  const rows = toRecordArray(data).slice(0, 64);
  if (!rows.length) return <JsonTable data={data} />;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
      {rows.map((row, index) => {
        const entropy = Math.max(0, Math.min(1, numericValue(row, ["entropy", "score", "value", "variance"]) / 8 || numericValue(row, ["entropy", "score", "value", "variance"])));
        return (
          <div key={`${String(row.key ?? index)}-${index}`} className="rounded-lg border border-glass-border bg-glass p-3 shadow-glow backdrop-blur" style={{ opacity: 0.42 + entropy * 0.58 }}>
            <p className="font-mono text-xs text-muted-foreground">{String(row.byte ?? row.key ?? `byte_${index}`)}</p>
            <p className="mt-2 text-lg font-bold text-primary">{renderText(row.entropy ?? row.score ?? row.value ?? "—")}</p>
          </div>
        );
      })}
    </div>
  );
};

const TimingLineChart = ({ data }: { data: unknown }) => {
  const rows = toRecordArray(data).map((row, index) => ({ name: String(row.key ?? row.timestamp ?? index + 1), jitter: numericValue(row, ["jitter", "period_jitter", "period", "delta", "value"]) }));
  if (!rows.length) return <JsonTable data={data} />;
  return (
    <div className="mb-4 h-56 rounded-lg border border-glass-border bg-glass p-4 backdrop-blur">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows.slice(0, 48)}>
          <CartesianGrid stroke="hsl(var(--glass-border))" vertical={false} />
          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
          <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--glass-border))", borderRadius: "12px" }} />
          <Line type="monotone" dataKey="jitter" stroke="hsl(var(--chart-cyan))" strokeWidth={3} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const SystemsBadges = ({ data }: { data: unknown }) => {
  const rows = toRecordArray(data);
  if (!rows.length) return <JsonTable data={data} />;
  return <div className="flex flex-wrap gap-2">{rows.map((row, index) => <span key={index} className="max-w-full break-words rounded-lg border border-glass-border bg-secondary px-3 py-2 text-sm font-semibold leading-5 text-secondary-foreground shadow-glow">{renderText(row.category ?? row.key ?? row.system ?? row.value)}</span>)}</div>;
};

const MechanicSummary = ({ data, unit = "kph" }: { data: unknown; unit?: SpeedUnit }) => (
  <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-primary/30 bg-gradient-subtle p-3 shadow-glow backdrop-blur sm:p-5">
    <div className="block min-w-0 max-w-full overflow-hidden whitespace-pre-wrap break-all text-xs leading-6 text-foreground [overflow-wrap:anywhere] sm:break-words sm:text-sm sm:leading-7">
      {renderTextU(data, unit)}
    </div>
  </div>
);

const averageNumeric = (rows: Array<Record<string, unknown>>, keys: string[]) => {
  const values = rows.map((row) => numericValue(row, keys)).filter((value) => Number.isFinite(value) && value > 0);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
};

const describeVehicleState = ({ speedCandidates, rpmCandidates, pedalCandidates, byteRows, bitRows, timingRows, totalMessages }: { speedCandidates: unknown[]; rpmCandidates: unknown[]; pedalCandidates: unknown[]; byteRows: Array<Record<string, unknown>>; bitRows: Array<Record<string, unknown>>; timingRows: Array<Record<string, unknown>>; totalMessages: number }) => {
  const avgEntropy = averageNumeric(byteRows, ["entropy", "unique_values", "value"]);
  const avgBitActivity = averageNumeric(bitRows, ["activity", "transitions", "value"]);
  const avgSamples = averageNumeric(timingRows, ["samples", "count", "messages"]);
  const hasMotionSignals = speedCandidates.length > 0 || pedalCandidates.length > 0;
  const hasEngineSignals = rpmCandidates.length > 0;
  const busyCapture = totalMessages > 750 || avgSamples > 20;

  if (hasMotionSignals && (avgEntropy > 1.4 || avgBitActivity > 0.04 || busyCapture)) {
    return "Vehicle activity is supported by candidate physical signals plus changing byte/bit patterns. Treat speed, RPM, pedal, brake, steering, and torque labels as candidates until validated by DBC decoding or controlled captures.";
  }

  if (hasEngineSignals && !speedCandidates.length && (avgEntropy > 0.8 || avgBitActivity > 0.02)) {
    return "RPM-like candidates changed, but speed or wheel-speed evidence was not isolated. Engine or motor activity needs DBC validation before calling this idle, driving, ICE, or EV behavior.";
  }

  if (!hasMotionSignals && !hasEngineSignals && avgEntropy < 0.8 && avgBitActivity < 0.02) {
    return "Vehicle motion cannot be determined from this capture. No decoded speed, wheel-speed, pedal, brake, steering, torque, gear, engine-RPM, or motor-RPM signal was isolated.";
  }

  if (!hasMotionSignals && !hasEngineSignals) {
    return "The network is awake and active, but vehicle motion cannot be determined because the log lacks validated speed, RPM, pedal, brake, steering, wheel-speed, torque, and gear evidence.";
  }

  return "The log contains some changing traffic, but the strongest evidence points to a limited operating state rather than a full driving capture. Treat this as a useful module-activity snapshot, not a complete road-test recording.";
};

const buildPlainEnglishSummaryReport = ({ data, fileId, anomalies, suspectIds, componentHealth }: { data: AnalysisResult; fileId?: string; anomalies: number; suspectIds: number; componentHealth: number }) => {
  const vehicleBehavior = data.vehicle_behavior ?? {};
  const speedCandidates = vehicleBehavior.possible_speed_ids ?? [];
  const rpmCandidates = vehicleBehavior.possible_rpm_ids ?? [];
  const pedalCandidates = vehicleBehavior.possible_pedal_ids ?? [];
  const byteRows = toRecordArray(data.diagnostics?.byte_analysis);
  const bitRows = toRecordArray(data.diagnostics?.bit_analysis);
  const timingRows = toRecordArray(data.diagnostics?.timing);
  const totalMessages = Number(data.total_messages ?? 0);
  const uniqueIds = Number(data.unique_ids ?? 0);
  const protocol = data.diagnostics?.protocol && typeof data.diagnostics.protocol === "object" ? data.diagnostics.protocol as JsonRecord : {};
  const systems = toRecordArray(data.diagnostics?.systems);
  const idRows = toRecordArray(data.id_stats);
  const deepDiveRows = toRecordArray(data.diagnostics?.id_deep_dive);
  const highEntropyBytes = byteRows.filter((row) => numericValue(row, ["entropy", "unique_values", "value"]) > 1.5).length;
  const activeBits = bitRows.filter((row) => numericValue(row, ["activity", "transitions", "value"]) > 0.05).length;
  const stuckBits = bitRows.filter((row) => numericValue(row, ["ones"]) === 0 || numericValue(row, ["zeros"]) === 0).length;
  const noisyIds = idRows.filter((row) => numericValue(row, ["percentage"]) > 25 || numericValue(row, ["count", "messages", "total"]) > totalMessages * 0.25).map((row) => renderText(row.id ?? row.key)).slice(0, 4);
  const quietIds = deepDiveRows.filter((row) => numericValue(row, ["messages", "count"]) <= 2).map((row) => renderText(row.id ?? row.key)).slice(0, 5);
  const volatileIds = deepDiveRows.filter((row) => numericValue(row, ["payload_change_rate"]) > 0.35 || toRecordArray(row.volatile_bytes).length > 0).map((row) => renderText(row.id ?? row.key)).slice(0, 6);
  const statusIds = deepDiveRows.filter((row) => String(row.likely_role ?? "").includes("status") || numericValue(row, ["payload_change_rate"]) <= 0.05).map((row) => renderText(row.id ?? row.key)).slice(0, 6);
  const diagnosticPresent = systems.some((row) => String(row.category ?? "").includes("diagnostic")) || idRows.some((row) => /^7|18DA/i.test(renderText(row.id ?? row.key)));
  const avgJitter = averageNumeric(timingRows, ["period_jitter", "jitter"]);
  const busLoad = Math.min(100, Math.round((totalMessages / Math.max(uniqueIds || 1, 1)) * 10));
  const movementSummary = describeVehicleState({ speedCandidates, rpmCandidates, pedalCandidates, byteRows, bitRows, timingRows, totalMessages });
  const condition = anomalies > 5 || componentHealth < 55 ? "the capture has multiple warning signs and should be reviewed closely" : anomalies > 0 || componentHealth < 80 ? "the capture has a few unusual spots, but it is not automatically pointing to a failed part" : "the capture looks fairly steady based on the checks available here";
  const timelineRows = toRecordArray(data.anomalies).slice(0, 3);
  const hasMotionSignals = speedCandidates.length > 0 || rpmCandidates.length > 0 || pedalCandidates.length > 0;
  const extendedRatio = Number(protocol.extended_id_ratio ?? 0);
  const likelyProtocol = renderText(protocol.likely_protocol ?? (extendedRatio > 0.5 ? "CAN 2.0B / extended identifiers" : "CAN 2.0A / standard identifiers"));
  const hasJ1939 = Boolean(protocol.has_j1939_shape) || likelyProtocol.toLowerCase().includes("j1939");
  const hasDiagnosticShape = Boolean(protocol.has_uds_or_isotp_shape) || diagnosticPresent;
  const sortedIds = [...idRows].sort((a, b) => numericValue(b, ["count", "messages", "total", "value"]) - numericValue(a, ["count", "messages", "total", "value"]));
  const dominantIds = sortedIds.slice(0, 5).map((row) => `${renderText(row.id ?? row.key)} (${numericValue(row, ["count", "messages", "total", "value"])} msgs)`);
  const dynamicDetails = deepDiveRows.filter((row) => numericValue(row, ["payload_change_rate"]) > 0.15 || toRecordArray(row.volatile_bytes).length > 0).slice(0, 5).map((row) => `${renderText(row.id ?? row.key)} changes ${Math.round(numericValue(row, ["payload_change_rate"]) * 100)}% of frames; volatile bytes ${toRecordArray(row.volatile_bytes).map((item) => renderText(item.value ?? item.key ?? item.item)).join(", ") || "not isolated"}`);
  const staticDetails = deepDiveRows.filter((row) => numericValue(row, ["payload_change_rate"]) <= 0.05).slice(0, 5).map((row) => `${renderText(row.id ?? row.key)} (${numericValue(row, ["messages", "count"])} frames)`);
  const counterLikeIds = deepDiveRows.filter((row) => String(row.likely_role ?? "").includes("single-byte") || (numericValue(row, ["payload_change_rate"]) > 0.15 && toRecordArray(row.volatile_bytes).length <= 2)).map((row) => renderText(row.id ?? row.key)).slice(0, 6);
  const systemGroups = (Object.entries(systems.reduce((acc: Record<string, string[]>, row) => {
    const label = titleCase(renderText(row.module_type ?? row.category ?? "unresolved_active_module").replace(/_/g, " "));
    acc[label] = [...(acc[label] ?? []), renderText(row.id ?? row.key)];
    return acc;
  }, {})) as Array<[string, string[]]>).sort((a, b) => b[1].length - a[1].length).slice(0, 5);

  const sections = [
    ["Vehicle Activity", [movementSummary, speedCandidates.length ? `Speed-related candidates were found (${speedCandidates.map(renderText).slice(0, 5).join(", ")}), so movement behavior can be investigated further.` : "No speed signal was detected, so the capture does not show reliable vehicle movement, acceleration, cruising, slowing, or stopping.", pedalCandidates.length ? `Pedal/brake-style candidates were found (${pedalCandidates.map(renderText).slice(0, 5).join(", ")}), which are good targets for validation.` : "No accelerator, brake, or pedal signal was detected. The log contains no strong evidence of driver input changes.", rpmCandidates.length ? `RPM-style candidates were found (${rpmCandidates.map(renderText).slice(0, 5).join(", ")}), which may help separate engine-on idle from driving after validation.` : "No RPM signal was detected. If the engine was running, this capture did not include a clear engine-speed frame."]],
    ["Systems Active", [`Active module groups: ${systemGroups.map(([group, ids]) => `${group} (${ids.slice(0, 6).join(", ")})`).join("; ") || "unresolved active ECU candidates from timing/payload evidence"}.`, dominantIds.length ? `The strongest ECU/message clusters are ${dominantIds.join(", ")}. These repeated IDs likely come from awake modules broadcasting periodic status frames.` : "No dominant ECU/message cluster was available from the ID frequency data.", hasMotionSignals ? "The network contains some dynamic candidates, so it may include operating-state traffic." : "The traffic resembles normal idle-state chatter: modules are awake and broadcasting periodic frames, but movement-related frames are absent.", noisyIds.length ? `IDs that appear unusually noisy or dominant: ${noisyIds.join(", ")}. These should be checked first for excessive chatter or a module talking more than expected.` : "No module appears overwhelmingly noisy; traffic distribution looks balanced for this capture.", quietIds.length ? `Very quiet IDs: ${quietIds.join(", ")}. These may be one-time status frames, sleeping modules, security/immobilizer chatter, or messages that only appear during specific actions.` : "No unusually quiet ID group stands out from the available deep-dive data."]],
    ["Abnormality And Health Insights", [avgJitter > 0 ? `Average timing jitter is about ${avgJitter.toFixed(4)}. In plain English, the message timing is ${avgJitter > 0.05 ? "noticeably uneven, which can point to bus congestion, intermittent module behavior, or a short capture with irregular events" : "fairly steady, meaning messages are arriving on a predictable schedule"}.` : "Timing jitter does not stand out, so the log does not show obvious message-scheduling instability.", highEntropyBytes ? `${highEntropyBytes} byte position(s) show meaningful variation. Changing bytes matter because they are where live sensor values, counters, switches, and status flags usually live.` : "Byte values are mostly stable, which supports the idle/housekeeping interpretation rather than active driving behavior.", activeBits ? `${activeBits} active bit candidate(s) changed during the capture. These are useful for finding boolean flags, counters, and small status fields.` : "Bit-level activity is low, so there are few obvious changing flags or counters in this log.", busLoad > 80 ? "The bus looks very busy and should be reviewed for overload or excessive chatter." : busLoad > 45 ? "The bus is busy but not clearly overloaded; this can be normal when many modules are awake." : "The bus does not look overloaded. Traffic volume appears manageable for this capture.", anomalies ? `${anomalies} suspicious payload event(s) were detected and should be compared with symptoms, wiring checks, and module behavior.` : "No major abnormal payload events were found. Based on this capture, there is no obvious CAN-level fault pattern."]],
    ["Reverse-Engineering Insights", [volatileIds.length ? `Best DBC starting points: ${volatileIds.join(", ")}. These IDs have changing payloads or volatile bytes, making them the best candidates for future signal work.` : "There are limited high-variation IDs, so this capture is better for mapping housekeeping/status traffic than extracting driving signals.", dynamicDetails.length ? `Dynamic ID details: ${dynamicDetails.join("; ")}.` : "No strongly dynamic IDs were isolated from the deep-dive rows.", statusIds.length ? `Likely status, timer, flag, counter, checksum, or housekeeping frames: ${statusIds.join(", ")}. These IDs are stable or low-change and may represent keep-alive traffic, module state, simple flags, or rolling bytes.` : "No clear housekeeping/status group was isolated from the available deep-dive rows.", counterLikeIds.length ? `Counter/checksum-style candidates: ${counterLikeIds.join(", ")}. These have limited changing bytes or single-byte/status behavior rather than full sensor-like movement.` : "No strong rolling counter/checksum candidate was separated from the available data.", staticDetails.length ? `Static or near-static IDs: ${staticDetails.join("; ")}. These are useful for module mapping and baseline state, not motion decoding.` : "No static ID list was available from the deep-dive data.", `${activeBits} active bit candidate(s) and ${highEntropyBytes} changing byte area(s) are the main places to inspect first in future DBC work.`, !speedCandidates.length && !rpmCandidates.length && !pedalCandidates.length ? "No speed/RPM/pedal candidates were found because this idle capture does not contain repeated, changing, motion-shaped patterns from driving, acceleration, braking, wheel speed, steering, torque, or gear changes." : "Validate candidate IDs by recording controlled actions and confirming that bytes rise, fall, or toggle with the physical vehicle behavior."]],
    ["What This Log Does Not Contain", [speedCandidates.length ? "A possible speed signal is present, but it still needs validation." : "No speed signal.", rpmCandidates.length ? "A possible RPM signal is present, but it still needs validation." : "No RPM signal.", pedalCandidates.length ? "A possible pedal/brake signal is present, but it still needs validation." : "No pedal or brake signal.", "No steering or wheel-speed signal was identified.", "No torque or gear signal was identified.", hasDiagnosticShape ? "Diagnostic-shaped traffic appears present." : "No diagnostic request/response traffic was detected.", hasJ1939 ? "J1939-shaped extended traffic appears present." : "No J1939 PGNs were identified.", timelineRows.length ? "Some anomaly events are available for review." : "No event timeline changes were detected."]],
    ["What This Log Is", ["This is an evidence map of the captured CAN traffic, not a guess about vehicle type.", "Modules are awake and broadcasting periodic status frames.", "The log is useful for module mapping, baseline behavior, status frames, counters, timers, flags, and identifying which IDs are stable versus dynamic.", "Any motion, load, RPM, pedal, brake, steering, wheel-speed, torque, or gear label should be treated as validated only when supported by explicit decoded signals or controlled action correlation."]],
    ["How To Capture A Better Log", ["Record at least 30–60 seconds while the vehicle is safely moving, not just sitting with ignition on.", "Drive at varying speeds so speed bytes have a clear rising, cruising, and slowing pattern.", "Press and release the accelerator and brake in controlled, safe conditions so pedal/brake frames can be separated from normal chatter.", "Turn the steering wheel and, if possible, include low-speed turns so steering or wheel-speed activity has a chance to appear.", "Perform a few start/stop or ignition cycles if you want to identify wake-up, idle, shutdown, and module housekeeping frames."]],
    ["Protocol, Network, And Timeline", [`Protocol impression: ${likelyProtocol}. ${extendedRatio <= 0.5 && !hasJ1939 ? "This is consistent with standard 11-bit CAN / CAN 2.0A." : "Extended identifier usage is present, so CAN 2.0B-style traffic is part of the capture."}`, hasDiagnosticShape ? "Diagnostic-style traffic appears present, so UDS/ISO-TP or service-tool activity may be included." : "No ISO-TP or UDS diagnostic request/response traffic is present; this appears to be normal module chatter rather than scan-tool communication.", hasJ1939 ? "J1939-shaped traffic appears present." : "No J1939 PGNs were identified in this capture.", busLoad > 80 ? "The bus looks heavily loaded and should be reviewed for overload or excessive chatter." : busLoad > 45 ? "The bus is busy but still within a normal awake-module range for this type of capture." : "The bus looks healthy and not overloaded for an idle-state capture.", avgJitter > 0.05 ? `Timing jitter averages ${avgJitter.toFixed(4)}, which is uneven enough to review for congestion, intermittent modules, or a short irregular capture.` : `Timing jitter ${avgJitter > 0 ? `averages ${avgJitter.toFixed(4)} and ` : ""}is within a normal idle-state range for this summary.`, `The log includes ${totalMessages || "unknown"} messages across ${uniqueIds || "multiple"} IDs; overall, ${condition}.`, timelineRows.length ? `Key events: ${timelineRows.map((row, index) => `event ${index + 1} on ID ${renderText(row.id ?? row.key ?? "unknown")}`).join("; ")}.` : "No clear event timeline was detected."]],
  ] as Array<[string, string[]]>;

  return [`CJL CAN Intelligence Platform Plain English Summary`, `Log ID: ${fileId ?? "—"}`, `Generated: ${new Date().toLocaleString()}`, "", ...sections.flatMap(([title, items]) => [title, ...items.map((item) => `- ${item}`), ""])].join("\n");
};

const scoreTone = (score: number) => score >= 80 ? "text-success" : score >= 55 ? "text-warning" : "text-destructive";

const InsightCard = ({ title, value, detail, icon: Icon, score }: { title: string; value: string; detail: string; icon: typeof Activity; score?: number }) => (
  <Card className="animate-fade-up overflow-hidden">
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-fit-tile text-xs font-semibold uppercase text-muted-foreground">{title}</p>
          <p className={cn("text-fit-tile mt-3 text-2xl font-extrabold", score === undefined ? "text-primary" : scoreTone(score))}>{value}</p>
          <p className="text-fit-tile mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
        </div>
        <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-glass-border bg-glass text-primary shadow-glow backdrop-blur"><Icon className="size-5" /></span>
      </div>
    </CardContent>
  </Card>
);

const BitToggleVisualization = ({ data }: { data: unknown }) => {
  const rows = toRecordArray(data).slice(0, 64);
  if (!rows.length) return <JsonTable data={data} />;
  return (
    <div className="mb-4 grid grid-cols-8 gap-2 sm:grid-cols-16">
      {rows.map((row, index) => {
        const activity = Math.max(0, Math.min(1, numericValue(row, ["activity", "transitions", "ones", "value"])));
        return <div key={index} title={`bit ${renderText(row.bit ?? index)}`} className="aspect-square rounded-md border border-glass-border bg-secondary shadow-glow transition-all duration-300 hover:scale-110" style={{ opacity: 0.35 + activity * 0.65 }} />;
      })}
    </div>
  );
};

const IdActivityTimeline = ({ data }: { data: unknown }) => {
  const rows = toRecordArray(data).slice(0, 24);
  if (!rows.length) return null;
  const max = Math.max(...rows.map((row) => numericValue(row, ["count", "frequency", "messages", "total", "value"])), 1);
  return (
    <div className="grid gap-3 rounded-lg border border-glass-border bg-glass p-4 backdrop-blur">
      {rows.map((row, index) => {
        const count = numericValue(row, ["count", "frequency", "messages", "total", "value"]);
        return (
          <div key={index} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-3 text-sm">
            <span className="truncate font-mono text-muted-foreground">{renderText(row.id ?? row.key ?? index + 1)}</span>
            <span className="h-2 overflow-hidden rounded-full bg-secondary"><span className="block h-full rounded-full bg-gradient-accent" style={{ width: `${Math.max(6, (count / max) * 100)}%` }} /></span>
            <span className="text-right font-mono text-foreground">{count}</span>
          </div>
        );
      })}
    </div>
  );
};

const ByteCorrelationHeatmap = ({ data }: { data: unknown }) => {
  const rows = toRecordArray(data).slice(0, 8);
  if (!rows.length) return null;
  return (
    <div className="grid grid-cols-8 gap-1 rounded-lg border border-glass-border bg-glass p-3 backdrop-blur">
      {Array.from({ length: 64 }, (_, index) => {
        const row = rows[index % rows.length] ?? {};
        const strength = Math.max(0.15, Math.min(1, numericValue(row, ["entropy", "unique_values", "observed_count", "value"]) / 8));
        return <span key={index} className="aspect-square rounded-sm bg-primary transition-transform duration-300 hover:scale-125" style={{ opacity: strength }} />;
      })}
    </div>
  );
};

const MiniChart = () => (
  <div className="flex h-24 items-end gap-2 rounded-lg border border-glass-border bg-glass p-4 backdrop-blur">
    {[42, 64, 38, 78, 52, 88, 68, 96, 58, 74].map((height, index) => (
      <span
        key={index}
        className="flex-1 rounded-full bg-gradient-accent opacity-80 shadow-glow motion-safe:animate-pulse-glow"
        style={{ height: `${height}%`, animationDelay: `${index * 120}ms` }}
      />
    ))}
  </div>
);

const MetricCard = ({ title, value, icon: Icon }: { title: string; value: unknown; icon: typeof MessageSquareText }) => (
  <Card className="animate-fade-up overflow-hidden">
    <CardContent className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-fit-tile text-sm font-semibold uppercase text-muted-foreground">{title}</p>
          <p className="text-fit-tile mt-4 text-3xl font-extrabold text-primary sm:text-4xl">{renderText(value)}</p>
        </div>
        <div className="grid size-12 place-items-center rounded-lg border border-glass-border bg-glass text-primary shadow-glow backdrop-blur">
          <Icon className="size-6" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const InfoTip = ({ text }: { text: string }) => <UiTooltip><TooltipTrigger asChild><span className="inline-grid size-5 cursor-help place-items-center rounded-full border border-glass-border text-xs text-muted-foreground">?</span></TooltipTrigger><TooltipContent className="max-w-xs">{text}</TooltipContent></UiTooltip>;

const FreezeFrameSnapshots = ({ anomalies, idStats }: { anomalies: unknown[]; idStats: unknown }) => {
  const rows = (anomalies.length ? toRecordArray(anomalies) : toRecordArray(idStats).slice(0, 4)).slice(0, 4);
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{rows.map((row, index) => <div key={index} className="rounded-lg border border-glass-border bg-glass p-4"><p className="font-mono text-sm text-primary">Frame {index + 1}</p><p className="mt-2 text-sm text-muted-foreground">ID {renderText(row.id ?? row.key ?? "unknown")}</p><p className="mt-2 break-words font-mono text-xs leading-5 text-foreground">{renderText(row.reason ?? row.data ?? row.value ?? "stable sample")}</p></div>)}</div>;
};

const TroubleTimeline = ({ anomalies, timing }: { anomalies: unknown[]; timing: unknown }) => {
  const rows = (anomalies.length ? toRecordArray(anomalies) : toRecordArray(timing).slice(0, 6)).slice(0, 6);
  return <div className="grid gap-3">{rows.map((row, index) => <div key={index} className="grid grid-cols-[4rem_1fr] gap-3 text-sm"><span className="font-mono text-muted-foreground">T+{index}s</span><div className="rounded-lg border border-glass-border bg-glass p-3"><p className="font-semibold text-foreground">{renderText(row.reason ?? row.id ?? row.key ?? "Timing checkpoint")}</p><p className="text-muted-foreground">{renderText(row.data ?? row.period_jitter ?? row.value ?? "No critical event")}</p></div></div>)}</div>;
};

const ModuleActivityMap = ({ systems }: { systems: unknown }) => {
  const rows = toRecordArray(systems).slice(0, 18);
  const modules: Array<Record<string, unknown>> = rows.length ? rows : Array.from({ length: 6 }, (_, index) => ({ id: `M${index + 1}`, category: "module", module_type: "active" }));
  const groups = modules.reduce((acc: Record<string, Array<Record<string, unknown>>>, row) => {
    const group = renderText(row.module_type ?? row.category ?? "active_module").replace(/_/g, " ");
    acc[group] = [...(acc[group] ?? []), row];
    return acc;
  }, {});

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.entries(groups) as Array<[string, Array<Record<string, unknown>>]>).slice(0, 3).map(([group, items]) => (
          <div key={group} className="min-w-0 rounded-lg border border-glass-border bg-glass p-4 backdrop-blur">
            <p className="break-words text-xs font-bold uppercase leading-5 text-muted-foreground">{titleCase(group)}</p>
            <p className="mt-2 text-3xl font-extrabold text-primary">{items.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">active identifier{items.length === 1 ? "" : "s"}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((row, index) => {
          const confidence = Math.round((numericValue(row, ["confidence_score", "confidence"]) || 0.55) * 100);
          const moduleType = renderText(row.module_type ?? row.category ?? "active").replace(/_/g, " ");
          return (
            <div key={`${renderText(row.id ?? row.key)}-${index}`} className="min-w-0 overflow-hidden rounded-lg border border-glass-border bg-glass p-4 backdrop-blur transition-all duration-300 hover:border-primary/40 hover:shadow-glow">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="break-all font-mono text-sm font-bold leading-5 text-foreground">ID {renderText(row.id ?? row.key)}</p>
                  <p className="mt-1 break-words text-xs font-semibold uppercase leading-5 text-primary">{titleCase(moduleType)}</p>
                </div>
                <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-glass-border bg-gradient-subtle text-primary shadow-glow"><Car className="size-5" /></span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-gradient-accent" style={{ width: `${Math.min(100, Math.max(8, confidence))}%` }} />
              </div>
              <div className="mt-3 grid min-w-0 gap-2 text-xs text-muted-foreground sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-start">
                <span className="min-w-0 break-words">{confidence}% heuristic confidence</span>
                <span className="min-w-0 break-all font-mono sm:text-right">{renderText(row.category ?? "CAN")}</span>
              </div>
              {row.reasoning ? <p className="mt-3 break-words text-xs leading-5 text-muted-foreground">{renderText(row.reasoning)}</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PipelineBadge = ({ type, label }: { type: string; label: string }) => (
  <span className="inline-flex max-w-full items-center gap-2 rounded-lg border border-glass-border bg-secondary px-3 py-1 text-xs font-bold uppercase leading-5 text-secondary-foreground shadow-glow">
    <FileText className="size-4 shrink-0" />
    <span className="text-fit-tile">{type.replace(/_/g, " ")} · {label}</span>
  </span>
);

const DbcViewer = ({ diagnostics }: { diagnostics: AnalysisResult["diagnostics"] }) => {
  const dbc = diagnostics?.dbc && typeof diagnostics.dbc === "object" ? diagnostics.dbc as JsonRecord : {};
  return (
    <div className="grid gap-6">
      <AnalysisCard title="DBC Message List" description="Definitions from BO_ entries only; no vehicle behavior is inferred." icon={<FileCode2 className="size-5" />}><JsonTable data={dbc.messages} /></AnalysisCard>
      <AnalysisCard title="DBC Signal List" description="SG_ bit positions, scaling, units, value ranges, signedness, and byte order." icon={<Binary className="size-5" />}><JsonTable data={dbc.signals} /></AnalysisCard>
      <AnalysisCard title="Bit Layout Viewer" description="Signal placement and multiplexing structure by message." icon={<Layers3 className="size-5" />}><JsonTable data={dbc.bit_layout} /></AnalysisCard>
    </div>
  );
};

const LogPipelinePanels = ({ data, diagnostics, idStats, anomalies, vehicleBehavior, partialDbcDraft }: { data: AnalysisResult; diagnostics: NonNullable<AnalysisResult["diagnostics"]>; idStats: JsonRecord[]; anomalies: JsonRecord[]; vehicleBehavior: NonNullable<AnalysisResult["vehicle_behavior"]>; partialDbcDraft: string }) => (
  <div className="grid gap-5">
    <CollapsiblePanel title="Raw Message Table & ID Activity" icon={<Binary className="size-5" />} defaultOpen><FrequencyChart data={idStats} /><div className="mb-4"><IdActivityTimeline data={idStats} /></div><JsonTable data={idStats} /></CollapsiblePanel>
    <CollapsiblePanel title="Timing Charts" icon={<Clock className="size-5" />} defaultOpen><TimingLineChart data={diagnostics.timing} /><JsonTable data={diagnostics.timing} /></CollapsiblePanel>
    <CollapsiblePanel title="Entropy & Byte-Change Charts" icon={<Layers3 className="size-5" />}><ByteEntropyHeatmap data={diagnostics.byte_analysis} /><div className="mt-4"><ByteCorrelationHeatmap data={diagnostics.byte_analysis} /></div><div className="mt-4"><BitToggleVisualization data={diagnostics.bit_analysis} /></div></CollapsiblePanel>
    <CollapsiblePanel title="ECU Activity Map" icon={<Map className="size-5" />}><ModuleActivityMap systems={diagnostics.systems} /></CollapsiblePanel>
    <CollapsiblePanel title="Anomalies & Health Indicators" icon={<AlertTriangle className="size-5" />} defaultOpen><JsonTable data={anomalies} /></CollapsiblePanel>
    <CollapsiblePanel title="Reverse-Engineering Insights" icon={<Radar className="size-5" />}><JsonTable data={data.reverse_engineering} /><div className="mt-4"><JsonTable data={diagnostics.counter_checksum_analysis} /></div></CollapsiblePanel>
    <CollapsiblePanel title="Vehicle Behavior Candidates" icon={<Gauge className="size-5" />}><div className="grid gap-5 lg:grid-cols-3"><div className="space-y-3"><h3 className="font-semibold">Speed Candidates</h3>{renderList(vehicleBehavior.possible_speed_ids)}</div><div className="space-y-3"><h3 className="font-semibold">RPM Candidates</h3>{renderList(vehicleBehavior.possible_rpm_ids)}</div><div className="space-y-3"><h3 className="font-semibold">Pedal Candidates</h3>{renderList(vehicleBehavior.possible_pedal_ids)}</div></div></CollapsiblePanel>
    <CollapsiblePanel title="Partial DBC Draft Available" icon={<Download className="size-5" />}><pre className="whitespace-pre-wrap rounded-lg border border-glass-border bg-glass p-4 text-sm text-foreground">{partialDbcDraft}</pre></CollapsiblePanel>
  </div>
);

const LogDbcPipelinePanels = ({ data, diagnostics, idStats }: { data: AnalysisResult; diagnostics: NonNullable<AnalysisResult["diagnostics"]>; idStats: JsonRecord[] }) => (
  <div className="grid gap-5">
    <AnalysisCard title="Pre-Decode CAN ID Inventory" description="Unique merged-log IDs printed before DBC matching, in decimal and hex." icon={<Hash className="size-5" />}>
      <JsonTable data={diagnostics.can_id_inventory} />
    </AnalysisCard>
    <AnalysisCard title="Full Power LOG + DBC Dashboard" description="Decoded-signal workflow: live log frames are interpreted with matching DBC definitions." icon={<Gauge className="size-5" />}>
      <JsonTable data={diagnostics.decoded_signals} />
    </AnalysisCard>
    <div className="grid gap-5 xl:grid-cols-2">
      <CollapsiblePanel title="Raw Frames Side" icon={<Binary className="size-5" />} defaultOpen><FrequencyChart data={idStats} /><JsonTable data={idStats} /></CollapsiblePanel>
      <CollapsiblePanel title="Decoded Signals Side" icon={<FileCode2 className="size-5" />} defaultOpen><JsonTable data={diagnostics.decoded_signals} /></CollapsiblePanel>
    </div>
    <CollapsiblePanel title="Driving Timeline & Event Detection" icon={<TimerReset className="size-5" />} defaultOpen><JsonTable data={diagnostics.event_timeline} /></CollapsiblePanel>
    <CollapsiblePanel title="Signal-Level Reverse Engineering" icon={<Radar className="size-5" />}><JsonTable data={data.reverse_engineering} /><div className="mt-4"><JsonTable data={diagnostics.signals} /></div></CollapsiblePanel>
  </div>
);

const Results = () => {
  const { id, file_id } = useParams();
  const fileId = file_id ?? id;
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<AiInsightKind | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [speedUnit, setSpeedUnit] = useSpeedUnit();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadAnalysis = async () => {
      if (!fileId) {
        setError("Missing file id in the URL.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await analyzeFile(fileId);
        if (isMounted) {
          setAnalysis(result);
          localStorage.setItem("can_ai_file_id", fileId);
        }
      } catch (analysisError) {
        if (isMounted) setError(analysisError instanceof Error ? analysisError.message : "Analysis request failed.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadAnalysis();

    return () => {
      isMounted = false;
    };
  }, [fileId]);

  const data = analysis;
  const anomalies = data?.anomalies ?? [];
  const vehicleBehavior = data?.vehicle_behavior ?? {};
  const summary = data?.summary;
  const summaryText = summary && typeof summary === "object" && !Array.isArray(summary) ? summary.text ?? summary : summary;
  const diagnostics = data?.diagnostics ?? {};
  const routing = diagnostics.file_routing && typeof diagnostics.file_routing === "object" ? diagnostics.file_routing as JsonRecord : {};
  const fileType = String(data?.file_type ?? routing.file_type ?? "log");
  const pipelineLabel = String(data?.analysis_pipeline ?? routing.analysis_pipeline ?? "Raw CAN log intelligence");
  const idStats = data?.id_stats ?? [];
  const networkHealth = diagnostics.network_health && typeof diagnostics.network_health === "object" ? diagnostics.network_health as JsonRecord : {};
  const timingRows = toRecordArray(diagnostics.timing);
  const timingIrregularity = numericValue(networkHealth, ["timing_irregularity_score"]);
  const averageTimingJitter = timingIrregularity || averageNumeric(timingRows, ["period_jitter", "jitter"]);
  const busLoad = Math.min(100, Math.round(((data?.total_messages ?? 0) / Math.max(Number(data?.unique_ids ?? 1), 1)) * 10));
  const timingScore = Math.max(10, Math.min(100, Math.round(100 - Math.min(90, averageTimingJitter * 1000))));
  const networkScore = Math.max(10, Math.min(100, Math.round(numericValue(networkHealth, ["bus_health_score"]) || (busLoad > 90 ? 68 : busLoad > 60 ? 78 : 92))));
  const componentHealth = Math.max(0, Math.min(100, 100 - anomalies.length * 12));
  const suspectIds = toRecordArray(idStats).filter((row) => numericValue(row, ["count", "frequency", "messages", "total", "value"]) > 1).length;
  const vehicleIdentification = null;
  const partialDbcDraft = data && fileType === "log" ? buildPartialDbcDraft(generatePartialDbcCandidates(data)) : "";
  const vehicleState = diagnostics.vehicle_state && typeof diagnostics.vehicle_state === "object" ? diagnostics.vehicle_state as JsonRecord : {};
  const vehicleType = diagnostics.vehicle_type && typeof diagnostics.vehicle_type === "object" ? diagnostics.vehicle_type as JsonRecord : {};
  const shortPlainSummary = data
    ? fileType === "dbc"
      ? `DBC definition file: ${data.unique_ids ?? 0} message definitions parsed. No charts, behavior, vehicle type, or health conclusions are produced because a DBC has no live traffic.`
      : fileType === "log_dbc"
        ? `Full Power LOG + DBC: ${toRecordArray(diagnostics.decoded_signals).length} DBC decoded signal${toRecordArray(diagnostics.decoded_signals).length === 1 ? "" : "s"} displayed without activity-threshold filtering.`
        : `Raw LOG analysis: timing, entropy, ECU activity, anomalies, and reverse-engineering hints only. No physical signal decoding is attempted without a DBC.`
    : "";

  const saveSnapshot = async () => {
    if (!fileId || !data) return;
    try {
      await saveAnalysisSnapshot({ fileId, result: data });
      setActionMessage("Analysis saved to your workspace.");
    } catch (saveError) {
      setActionMessage(saveError instanceof Error ? saveError.message : "Unable to save analysis.");
    }
  };

  const runAi = async (kind: AiInsightKind) => {
    if (!data) return;
    setAiLoading(kind);
    setAiInsight(null);
    try {
      setAiInsight(await requestAiInsight({ kind, analysis: data }));
    } catch (aiError) {
      setAiInsight(aiError instanceof Error ? aiError.message : "AI insight failed.");
    } finally {
      setAiLoading(null);
    }
  };

  const downloadReport = () => {
    if (!data) return;
    const report = buildDetailedReport({ data, fileId, anomalies, diagnostics, summaryText, componentHealth, busLoad, suspectIds });
    const url = URL.createObjectURL(new Blob([report], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `cjl-can-health-report-${fileId}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPlainEnglishSummary = () => {
    if (!data) return;
    const report = buildPlainEnglishSummaryReport({ data, fileId, anomalies: anomalies.length, suspectIds, componentHealth });
    const url = URL.createObjectURL(new Blob([report], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `plain-english-summary-${fileId}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdfReport = () => {
    if (!data) return;
    try {
      generatePdfReport({ data, fileId, componentHealth, busLoad, timingScore, networkScore });
      setActionMessage("PDF report generated and downloaded.");
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "Failed to generate PDF.");
    }
  };

  const handleCreateShareLink = async () => {
    if (!data) return;
    setSharing(true);
    setShareUrl(null);
    try {
      const { url } = await createShareLink({ fileId, result: data, title: `CAN Analysis ${fileId ?? ""}`.trim() });
      setShareUrl(url);
      setActionMessage("Share link created — anyone with this URL can view a read-only snapshot.");
      try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "Failed to create share link.");
    } finally {
      setSharing(false);
    }
  };

  const createShare = async () => {
    if (!data) return;
    setSharing(true);
    setShareUrl(null);
    try {
      const { url } = await createShareLink({ fileId, result: data, title: `CAN Analysis ${fileId ?? ""}`.trim(), expiresInDays: 30 });
      setShareUrl(url);
      try { await navigator.clipboard.writeText(url); setActionMessage("Share link created and copied to clipboard. Expires in 30 days."); }
      catch { setActionMessage("Share link created. Copy it below to share."); }
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "Failed to create share link.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="animate-fade-up">
          <p className="inline-flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-3 py-1 text-sm font-semibold uppercase text-primary shadow-glow backdrop-blur">
            <BrainCircuit className="size-4" />
            Results Dashboard
          </p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">CAN Analysis</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">File ID: <span className="font-mono text-foreground">{fileId ?? "—"}</span></p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="default" onClick={downloadPdfReport}><FileText className="size-4" /> Download PDF Report</Button>
          <Button type="button" variant="outline" onClick={createShare} disabled={sharing}>{sharing ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />} Create Share Link</Button>
          <Button type="button" variant="outline" onClick={saveSnapshot}><Save className="size-4" /> Save Analysis</Button>
          <Button type="button" variant="outline" onClick={downloadReport}><Download className="size-4" /> Health Report</Button>
          <Button type="button" variant="outline" onClick={downloadPlainEnglishSummary}><Download className="size-4" /> Plain English Summary</Button>
          <Button asChild variant="outline"><Link to="/upload">Analyze Another Log</Link></Button>
        </div>
      </div>
      {shareUrl ? (
        <div className="mb-4 flex flex-col gap-2 rounded-lg border border-primary/40 bg-glass p-3 shadow-glow backdrop-blur sm:flex-row sm:items-center">
          <Link2 className="size-4 shrink-0 text-primary" />
          <input readOnly value={shareUrl} className="flex-1 truncate rounded-sm border border-glass-border bg-background/60 px-2 py-1 font-mono text-xs text-foreground" onFocus={(e) => e.currentTarget.select()} />
          <Button type="button" size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(shareUrl); setActionMessage("Link copied to clipboard."); }}>Copy</Button>
          <Button type="button" size="sm" variant="ghost" asChild><a href={shareUrl} target="_blank" rel="noreferrer">Open</a></Button>
        </div>
      ) : null}
      {actionMessage ? <div className="mb-6 rounded-lg border border-glass-border bg-glass p-3 text-sm text-muted-foreground shadow-glow backdrop-blur">{actionMessage}</div> : null}

      {isLoading ? (
        <Card className="animate-fade-up overflow-hidden">
          <CardContent className="space-y-5 p-6">
            <div className="h-5 w-56 animate-pulse rounded-lg bg-muted" />
            <div className="h-28 animate-pulse rounded-lg bg-muted" />
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="h-24 animate-pulse rounded-lg bg-muted" />
              <div className="h-24 animate-pulse rounded-lg bg-muted" />
              <div className="h-24 animate-pulse rounded-lg bg-muted" />
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive/40 bg-destructive/10 shadow-dashboard">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-destructive">Unable To Load Results</h2>
            <p className="mt-2 text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : data ? (
        <div className="grid gap-6">
          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <AnalysisCard title="Summary" icon={<MessageSquareText className="size-5" />}>
              <div className="grid gap-4">
                <div className="flex items-center justify-between gap-2">
                  <PipelineBadge type={fileType} label={pipelineLabel} />
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
                </div>
                <div className="min-w-0 max-w-full overflow-hidden break-all rounded-lg border border-primary/30 bg-gradient-subtle p-3 text-xs font-medium leading-6 text-foreground shadow-glow backdrop-blur [overflow-wrap:anywhere] sm:break-words sm:p-4 sm:text-sm">{convertSpeedsInText(shortPlainSummary, speedUnit)}</div>
                <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-glass-border bg-glass p-4 text-sm leading-7 text-foreground backdrop-blur whitespace-pre-wrap [overflow-wrap:anywhere]">{renderTextU(summaryText, speedUnit)}</div>
              </div>
            </AnalysisCard>
            <AnalysisCard title={fileType === "dbc" ? "DBC Structure" : fileType === "log_dbc" ? "Decoded Signal Activity" : "Raw Bus Activity"} description={fileType === "dbc" ? "Message and signal definitions only." : fileType === "log_dbc" ? "Physical units from DBC-backed decoding." : "Timing and frame intensity without physical decoding."} icon={<BarChart3 className="size-5" />}>
              {fileType === "dbc" ? <JsonTable data={diagnostics.dbc && typeof diagnostics.dbc === "object" ? (diagnostics.dbc as JsonRecord).signals : []} /> : fileType === "log_dbc" ? <JsonTable data={diagnostics.decoded_signals} /> : <MiniChart />}
            </AnalysisCard>
          </div>

          {fileType !== "dbc" ? <IntelligenceSuite analysis={data} /> : null}

          {fileType === "dbc" ? <DbcViewer diagnostics={diagnostics} /> : fileType === "log_dbc" ? <LogDbcPipelinePanels data={data} diagnostics={diagnostics} idStats={idStats} /> : <LogPipelinePanels data={data} diagnostics={diagnostics} idStats={idStats} anomalies={anomalies} vehicleBehavior={vehicleBehavior} partialDbcDraft={partialDbcDraft} />}

          {fileType !== "dbc" ? <>

          {vehicleIdentification ? (
            <AnalysisCard title="Vehicle Identification" description="Heuristic AVI fingerprint from ID ranges, protocol shape, timing, entropy, and diagnostic patterns." icon={<Car className="size-5" />}>
              <div className="grid gap-4 lg:grid-cols-3">
                {[["Category", vehicleIdentification.category], ["Protocol", vehicleIdentification.protocol], ["OEM Style", vehicleIdentification.oemStyle]].map(([label, guess]) => {
                  const item = guess as { label: string; confidence: number };
                  return <div key={String(label)} className="min-w-0 overflow-hidden rounded-lg border border-glass-border bg-glass p-4"><p className="text-fit-tile text-xs font-bold uppercase text-muted-foreground">{String(label)}</p><p className="text-fit-tile mt-2 text-sm font-semibold leading-6 text-foreground sm:text-base">{item.label}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-gradient-accent" style={{ width: `${item.confidence}%` }} /></div><p className="text-fit-tile mt-2 font-mono text-sm text-primary">{item.confidence}% confidence</p></div>;
                })}
              </div>
              <p className="text-fit-tile mt-4 rounded-lg border border-glass-border bg-glass p-4 text-sm leading-6 text-muted-foreground">{vehicleIdentification.explanation}</p>
            </AnalysisCard>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-3">
            <MetricCard title="Total Messages" value={data.total_messages} icon={MessageSquareText} />
            <MetricCard title="Unique IDs" value={data.unique_ids} icon={Hash} />
            <MetricCard title="Anomalies Detected" value={anomalies.length} icon={AlertTriangle} />
          </div>

          <div className="grid gap-6 lg:grid-cols-4">
            <InsightCard title="Fault Prediction" value={anomalies.length ? "Watch" : "Low Risk"} detail="Derived from anomaly density and ID activity." icon={ShieldCheck} />
            <InsightCard title="Component Health" value={`${componentHealth}/100`} detail="Heuristic score from detected anomalies." icon={Gauge} score={componentHealth} />
            <InsightCard title="Suspect IDs" value={String(suspectIds)} detail="High-activity candidates for review." icon={Radar} />
            <InsightCard title="CAN Bus Load" value={`${busLoad}%`} detail="Estimated from message volume per identifier." icon={Zap} score={100 - busLoad} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <AnalysisCard title="Freeze-Frame Snapshots" description="Representative diagnostic checkpoints captured from anomalies or high-activity IDs." icon={<ScanLine className="size-5" />}>
              <FreezeFrameSnapshots anomalies={anomalies} idStats={idStats} />
            </AnalysisCard>
            <AnalysisCard title="Trouble Event Timeline" description="Chronological view of likely fault, timing, and activity events." icon={<TimerReset className="size-5" />}>
              <TroubleTimeline anomalies={anomalies} timing={diagnostics.timing} />
            </AnalysisCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <AnalysisCard title="Sensor Health Indicators" description="Signal health derived from anomaly density, byte entropy, timing stability, and bus load." icon={<Activity className="size-5" />}>
              <div className="grid gap-3 sm:grid-cols-2">
                {[["Timing", timingScore], ["Payload", componentHealth], ["Network", networkScore], ["Activity", Math.min(100, Number(data.unique_ids ?? 0) * 12)]].map(([label, score]) => <div key={String(label)} className="rounded-lg border border-glass-border bg-glass p-4"><div className="mb-2 flex items-center justify-between"><span className="font-semibold">{String(label)}</span><InfoTip text="Heuristic indicator calculated from normalized diagnostics, jitter, bus health, and activity." /></div><div className="h-2 rounded-full bg-secondary"><div className="h-full rounded-full bg-gradient-accent" style={{ width: `${Number(score)}%` }} /></div><p className="mt-2 font-mono text-sm text-primary">{String(score)}/100</p></div>)}
              </div>
            </AnalysisCard>
            <AnalysisCard title="Module Activity Map" description="High-level ECU/module map from system classification and active identifiers." icon={<Map className="size-5" />}>
              <ModuleActivityMap systems={diagnostics.systems} />
            </AnalysisCard>
          </div>

          <AnalysisCard title="Replay & Multi-Signal Overlay" description="Professional replay-style visualization using current ID frequency and timing diagnostics." icon={<GitBranch className="size-5" />}>
            <div className="grid gap-5 lg:grid-cols-[1fr_0.75fr]">
              <div className="diagnostic-grid relative h-48 overflow-hidden rounded-lg border border-glass-border bg-glass p-4"><div className="absolute inset-y-0 left-1/3 w-px bg-primary/70 shadow-glow motion-safe:animate-signal-sweep" />{toRecordArray(idStats).slice(0, 8).map((row, index) => <div key={index} className="mb-3 grid grid-cols-[6rem_1fr] items-center gap-3 text-sm"><span className="font-mono text-muted-foreground">{renderText(row.id ?? row.key)}</span><span className="h-2 rounded-full bg-secondary"><span className="block h-full rounded-full bg-gradient-accent" style={{ width: `${Math.min(100, 20 + numericValue(row, ["count", "frequency", "messages", "total", "value"]) * 6)}%` }} /></span></div>)}</div>
              <div className="rounded-lg border border-glass-border bg-glass p-4"><p className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Timeline Scrubber</p><div className="h-2 rounded-full bg-secondary"><div className="h-full w-3/5 rounded-full bg-gradient-accent" /></div><div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground"><span>Start</span><span className="text-primary">Event</span><span>End</span></div></div>
            </div>
          </AnalysisCard>

          <AnalysisCard title="Mechanic Mode" description="Simplified diagnostic summary for service workflows." icon={<Wrench className="size-5" />}>
            <MechanicSummary data={diagnostics.mechanic_summary ?? summaryText} unit={speedUnit} />
          </AnalysisCard>

          <AnalysisCard title="AI Diagnostic Copilot" description="Plain-English mechanic, reverse-engineering, repair, signal naming, and byte decoding guidance." icon={<Sparkles className="size-5" />}>
            <div className="flex flex-wrap gap-2">
              {([
                ["mechanic", "AI Mechanic"],
                ["reverse", "AI Reverse Engineer"],
                ["repair", "Repair Suggestions"],
                ["signal", "Signal Naming"],
                ["decoder", "Byte Decoder"],
              ] as Array<[AiInsightKind, string]>).map(([kind, label]) => (
                <Button key={kind} type="button" variant="outline" size="sm" onClick={() => runAi(kind)} disabled={Boolean(aiLoading)}>
                  {aiLoading === kind ? <Loader2 className="animate-spin" /> : <Sparkles className="size-4" />}
                  {label}
                </Button>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-glass-border bg-glass p-5 text-sm leading-7 text-foreground backdrop-blur">
              <pre className="whitespace-pre-wrap font-sans">{aiInsight ?? "Choose an AI Mode to Generate Professional Diagnostic Guidance from This Analysis."}</pre>
            </div>
          </AnalysisCard>

          {fileType === "log" ? <div className="grid gap-5">
            <CollapsiblePanel title="Basic View" icon={<Binary className="size-5" />} defaultOpen>
              <FrequencyChart data={idStats} />
              <div className="mb-4"><IdActivityTimeline data={idStats} /></div>
              <JsonTable data={idStats} />
            </CollapsiblePanel>

            <CollapsiblePanel title="Diagnostics" icon={<AlertTriangle className="size-5" />} defaultOpen>
              <JsonTable data={data.anomalies} />
            </CollapsiblePanel>

            <CollapsiblePanel title="Reverse Engineering" icon={<Radar className="size-5" />}>
              <JsonTable data={data.reverse_engineering} />
            </CollapsiblePanel>

            <CollapsiblePanel title="Vehicle Behavior" icon={<Gauge className="size-5" />}>
              <div className="grid gap-5">
                <div className="grid gap-5 lg:grid-cols-3">
                  <div className="space-y-3"><h3 className="font-semibold">Possible Speed IDs</h3>{renderList(vehicleBehavior.possible_speed_ids)}</div>
                  <div className="space-y-3"><h3 className="font-semibold">Possible RPM IDs</h3>{renderList(vehicleBehavior.possible_rpm_ids)}</div>
                  <div className="space-y-3"><h3 className="font-semibold">Possible Pedal IDs</h3>{renderList(vehicleBehavior.possible_pedal_ids)}</div>
                </div>
                <JsonTable data={vehicleBehavior} />
              </div>
            </CollapsiblePanel>
          </div> : null}

          <AnalysisCard title="Advanced Diagnostics" description="Complete diagnostics payload returned by the backend." icon={<BrainCircuit className="size-5" />}>
            <div className="grid gap-4">
              <CollapsiblePanel title="Protocol" icon={<Cpu className="size-5" />} defaultOpen><JsonTable data={diagnostics.protocol} /></CollapsiblePanel>
              <CollapsiblePanel title="Pre-Decode CAN ID Inventory" icon={<Hash className="size-5" />} defaultOpen><JsonTable data={diagnostics.can_id_inventory} /></CollapsiblePanel>
              <CollapsiblePanel title="Byte Analysis" icon={<Layers3 className="size-5" />}><ByteEntropyHeatmap data={diagnostics.byte_analysis} /><div className="mt-4"><ByteCorrelationHeatmap data={diagnostics.byte_analysis} /></div><div className="mt-4"><JsonTable data={diagnostics.byte_analysis} /></div></CollapsiblePanel>
              <CollapsiblePanel title="Bit Analysis" icon={<Binary className="size-5" />}><BitToggleVisualization data={diagnostics.bit_analysis} /><JsonTable data={diagnostics.bit_analysis} /></CollapsiblePanel>
              <CollapsiblePanel title="Timing" icon={<Clock className="size-5" />}><TimingLineChart data={diagnostics.timing} /><JsonTable data={diagnostics.timing} /></CollapsiblePanel>
              <CollapsiblePanel title="Signals" icon={<Radar className="size-5" />}><JsonTable data={diagnostics.signals} /></CollapsiblePanel>
              <CollapsiblePanel title="Systems" icon={<Gauge className="size-5" />}><SystemsBadges data={diagnostics.systems} /><div className="mt-4"><JsonTable data={diagnostics.systems} /></div></CollapsiblePanel>
              <CollapsiblePanel title="ID Deep Dive" icon={<Hash className="size-5" />}><JsonTable data={diagnostics.id_deep_dive} /></CollapsiblePanel>
              <CollapsiblePanel title="Network Health" icon={<Zap className="size-5" />}><JsonTable data={diagnostics.network_health} /></CollapsiblePanel>
              <CollapsiblePanel title="Driver Behavior" icon={<Car className="size-5" />}><JsonTable data={diagnostics.driver_behavior} /></CollapsiblePanel>
              <CollapsiblePanel title="Event Timeline" icon={<TimerReset className="size-5" />}><JsonTable data={diagnostics.event_timeline} /></CollapsiblePanel>
              <CollapsiblePanel title="Partial DBC Draft Available" icon={<Download className="size-5" />}><pre className="whitespace-pre-wrap rounded-lg border border-glass-border bg-glass p-4 text-sm text-foreground">{partialDbcDraft}</pre></CollapsiblePanel>
              <CollapsiblePanel title="Mechanic Summary" icon={<Wrench className="size-5" />} defaultOpen><MechanicSummary data={diagnostics.mechanic_summary} unit={speedUnit} /></CollapsiblePanel>
            </div>
          </AnalysisCard>
          </> : null}
        </div>
      ) : null}
    </main>
  );
};

export default Results;
