import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { AnalysisResult, JsonRecord } from "@/lib/canApi";

const toRecordArray = (value: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(value)) return value.map((item, i) => (item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : { item: i + 1, value: item }));
  if (value && typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([key, item]) => (item && typeof item === "object" && !Array.isArray(item) ? { key, ...(item as Record<string, unknown>) } : { key, value: item }));
  return [];
};

const stringify = (value: unknown): string => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
};

const PRIMARY: [number, number, number] = [0, 153, 204];
const DARK: [number, number, number] = [20, 24, 33];
const MUTED: [number, number, number] = [110, 115, 125];

interface ReportInput {
  data: AnalysisResult;
  fileId?: string;
  componentHealth: number;
  busLoad: number;
  timingScore: number;
  networkScore: number;
}

export const generatePdfReport = ({ data, fileId, componentHealth, busLoad, timingScore, networkScore }: ReportInput) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;

  const drawHeaderBand = () => {
    doc.setFillColor(...DARK);
    doc.rect(0, 0, pageWidth, 70, "F");
    doc.setFillColor(...PRIMARY);
    doc.rect(0, 68, pageWidth, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("CANAI Diagnostics", margin, 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("CAN Analysis Report", margin, 50);
    doc.setFontSize(9);
    doc.setTextColor(180, 200, 220);
    doc.text(new Date().toLocaleString(), pageWidth - margin, 50, { align: "right" });
  };

  const drawFooter = () => {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(`CANAI Diagnostics  •  Confidential analysis report`, margin, pageHeight - 20);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 20, { align: "right" });
    }
  };

  drawHeaderBand();

  // Cover info
  let y = 100;
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Vehicle Network Health Report", margin, y);
  y += 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`Log ID: ${fileId ?? "—"}`, margin, y);
  y += 14;
  doc.text(`Analysis Pipeline: ${stringify(data.analysis_pipeline ?? "Raw CAN log intelligence")}`, margin, y);
  y += 24;

  // Score grid
  const scores: Array<[string, number]> = [
    ["Component Health", componentHealth],
    ["Network Score", networkScore],
    ["Timing Score", timingScore],
    ["Bus Load %", busLoad],
  ];
  const cardW = (pageWidth - margin * 2 - 24) / 4;
  scores.forEach(([label, value], i) => {
    const x = margin + i * (cardW + 8);
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(x, y, cardW, 70, 6, 6, "F");
    doc.setDrawColor(...PRIMARY);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, cardW, 70, 6, 6, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    const tone: [number, number, number] = value >= 80 ? [34, 160, 100] : value >= 55 ? [200, 145, 30] : [200, 60, 60];
    doc.setTextColor(...tone);
    doc.text(`${value}`, x + 12, y + 38);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(label, x + 12, y + 56);
  });
  y += 90;

  // Summary box
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...DARK);
  doc.text("Executive Summary", margin, y);
  y += 14;
  const summaryRaw = data.summary;
  const summaryText = stringify(summaryRaw && typeof summaryRaw === "object" && !Array.isArray(summaryRaw) ? (summaryRaw as JsonRecord).text ?? summaryRaw : summaryRaw);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 65, 75);
  const wrapped = doc.splitTextToSize(summaryText, pageWidth - margin * 2);
  doc.text(wrapped, margin, y);
  y += wrapped.length * 12 + 14;

  // Key metrics table
  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value"]],
    body: [
      ["Total Messages", stringify(data.total_messages)],
      ["Unique IDs", stringify(data.unique_ids)],
      ["Anomalies Detected", stringify((data.anomalies ?? []).length)],
      ["Signals Detected", stringify(data.signals_detected)],
      ["File Type", stringify(data.file_type ?? "log")],
    ],
    theme: "grid",
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 6 },
    margin: { left: margin, right: margin },
  });

  // Anomalies
  const anomalies = toRecordArray(data.anomalies).slice(0, 25);
  if (anomalies.length) {
    doc.addPage();
    drawHeaderBand();
    let y2 = 100;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...DARK);
    doc.text("Detected Anomalies", margin, y2);
    y2 += 14;
    autoTable(doc, {
      startY: y2,
      head: [["#", "ID", "Reason", "Data"]],
      body: anomalies.map((row, i) => [
        String(i + 1),
        stringify(row.id ?? row.key),
        stringify(row.reason ?? row.type ?? "—"),
        stringify(row.data ?? row.value ?? "—").slice(0, 60),
      ]),
      theme: "striped",
      headStyles: { fillColor: PRIMARY, textColor: 255 },
      styles: { fontSize: 8, cellPadding: 5, overflow: "linebreak" },
      columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 80 }, 2: { cellWidth: 180 } },
      margin: { left: margin, right: margin },
    });
  }

  // Top IDs
  const idStats = toRecordArray(data.id_stats).slice(0, 30);
  if (idStats.length) {
    doc.addPage();
    drawHeaderBand();
    let y3 = 100;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...DARK);
    doc.text("Top CAN ID Activity", margin, y3);
    y3 += 14;
    autoTable(doc, {
      startY: y3,
      head: [["CAN ID", "Count", "Percentage"]],
      body: idStats.map((row) => [
        stringify(row.id ?? row.key),
        stringify(row.count ?? row.messages ?? row.total ?? row.value ?? "—"),
        stringify(row.percentage ?? "—"),
      ]),
      theme: "grid",
      headStyles: { fillColor: PRIMARY, textColor: 255 },
      styles: { fontSize: 9, cellPadding: 5 },
      margin: { left: margin, right: margin },
    });
  }

  // Vehicle behavior candidates
  const vb = data.vehicle_behavior ?? {};
  const behaviorRows: Array<[string, string]> = [
    ["Speed Candidates", (vb.possible_speed_ids ?? []).map(stringify).join(", ") || "None"],
    ["RPM Candidates", (vb.possible_rpm_ids ?? []).map(stringify).join(", ") || "None"],
    ["Pedal Candidates", (vb.possible_pedal_ids ?? []).map(stringify).join(", ") || "None"],
  ];
  doc.addPage();
  drawHeaderBand();
  let y4 = 100;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...DARK);
  doc.text("Vehicle Behavior Candidates", margin, y4);
  y4 += 14;
  autoTable(doc, {
    startY: y4,
    head: [["Signal Class", "Candidate IDs"]],
    body: behaviorRows,
    theme: "grid",
    headStyles: { fillColor: PRIMARY, textColor: 255 },
    styles: { fontSize: 10, cellPadding: 7 },
    columnStyles: { 0: { cellWidth: 140, fontStyle: "bold" } },
    margin: { left: margin, right: margin },
  });

  // Disclaimer
  const lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y4;
  let yd = lastY + 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text("Notes", margin, yd);
  yd += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const notes = doc.splitTextToSize(
    "All signal candidates are heuristic suggestions derived from byte/bit activity, timing, and entropy patterns. Validate with controlled captures or a matching DBC before acting on them. This report is an engineering aid and not a substitute for a manufacturer scan-tool diagnosis.",
    pageWidth - margin * 2,
  );
  doc.text(notes, margin, yd);

  drawFooter();
  doc.save(`canai-report-${fileId ?? "analysis"}.pdf`);
};
