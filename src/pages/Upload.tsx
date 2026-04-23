import { ChangeEvent, DragEvent, FormEvent, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, FileArchive, FileCode2, FileText, Files, Loader2, Route, ScanLine, ShieldCheck, UploadCloud } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadCanFiles, type UploadResult } from "@/lib/canApi";
import { cn } from "@/lib/utils";

const supported = ["CSV", "TRC", "candump", "CRTD", "ASC", "BLF", "MF4/MDF", "CANedge", "DBC", "TXT", "J1939"];
const extensionFormat: Record<string, string> = {
  csv: "CSV/J1939",
  log: "candump/CANedge",
  txt: "TXT/candump",
  trc: "TRC",
  crtd: "CRTD",
  asc: "ASC",
  blf: "BLF",
  mf4: "MF4",
  mdf: "MDF",
  jsonl: "CANedge",
  dbc: "DBC",
};
const supportedExtensions = new Set(Object.keys(extensionFormat));
const supportedFormatsText = supported.join(", ");
const supportedExtensionsText = [...supportedExtensions].map((item) => `.${item}`).join(", ");

const guessFormat = (file: File) => extensionFormat[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? "Auto-detect";
const getExtension = (file: File) => file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() ?? "" : "";
const validateSelectedFiles = (selectedFiles: File[]) => {
  const unsupported = selectedFiles.filter((item) => !supportedExtensions.has(getExtension(item)));
  if (unsupported.length) {
    return `${unsupported.map((item) => item.name).join(", ")} ${unsupported.length === 1 ? "is" : "are"} not a supported CAN file type. Supported formats: ${supportedFormatsText}. Supported extensions: ${supportedExtensionsText}.`;
  }

  const oversized = selectedFiles.find((item) => item.size > 20 * 1024 * 1024);
  if (oversized) return `${oversized.name} is too large. Upload files under 20 MB.`;

  return null;
};

const Upload = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const hasBatch = files.length > 1;
  useEffect(() => {
    if (!isLoading) return;
    setProgress(10);
    const interval = window.setInterval(() => setProgress((current) => Math.min(current + 7, 91)), 260);
    return () => window.clearInterval(interval);
  }, [isLoading]);

  const acceptFiles = (selectedFiles: FileList | File[] | null) => {
    setError(null);
    setIsComplete(false);
    setResults([]);
    const nextFiles = Array.from(selectedFiles ?? []).slice(0, 12);
    if (!nextFiles.length) {
      setFiles([]);
      return;
    }
    const validationError = validateSelectedFiles(nextFiles);
    if (validationError) {
      setFiles([]);
      setError(validationError);
      return;
    }
    setFiles(nextFiles);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => acceptFiles(event.target.files);
  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (!isLoading) setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (!isLoading) acceptFiles(event.dataTransfer.files);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!files.length) {
      setError("Choose one or more CAN log files before starting conversion.");
      return;
    }
    const validationError = validateSelectedFiles(files);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setIsComplete(false);
    setError(null);

    try {
      const payload = await uploadCanFiles(files);
      setResults(payload.files);
      setProgress(100);
      setIsComplete(true);
      const successful = payload.files.filter((item) => item.file_id);
      if (successful[0]?.file_id) localStorage.setItem("can_ai_file_id", successful[0].file_id);
      window.setTimeout(() => {
        if (successful.length > 1) {
          sessionStorage.setItem("can_ai_batch_results", JSON.stringify(successful));
          navigate("/batch-results");
        } else if (successful[0]?.file_id) {
          navigate(`/results/${successful[0].file_id}`);
        }
      }, 650);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload or conversion failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:px-8 xl:grid-cols-[0.9fr_1.1fr] xl:items-start">
      <section className="animate-fade-up rounded-lg border border-glass-border bg-glass-strong p-5 shadow-dashboard backdrop-blur sm:p-7">
        <p className="inline-flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-3 py-1 text-sm font-semibold uppercase text-primary shadow-glow"><ScanLine className="size-4" /> Intake Pipeline</p>
        <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl">Upload once. Route every CAN artifact correctly.</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">Professional intake for logs, DBC definitions, mixed captures, and batch workflows with clear status before analysis begins.</p>
        <div className="mt-6 grid gap-3">
          {[[Route, "Format-aware routing", "LOG, DBC, LOG+DBC, and batch paths remain distinct."], [ShieldCheck, "Evidence integrity", "Files are validated before conversion and analysis."], [FileText, "Workspace handoff", "Successful uploads open the right result or batch review screen."]].map(([Icon, title, text]) => (
            <div key={String(title)} className="flex gap-3 rounded-lg border border-glass-border bg-glass p-4"><Icon className="mt-1 size-5 shrink-0 text-primary" /><div><p className="font-semibold text-foreground">{String(title)}</p><p className="text-sm leading-6 text-muted-foreground">{String(text)}</p></div></div>
          ))}
        </div>
      </section>

      <Card className="w-full animate-fade-up overflow-hidden">
        <CardHeader>
          <div className="mb-3 grid size-14 place-items-center rounded-lg bg-gradient-accent text-primary-foreground shadow-glow">
            <UploadCloud className="size-7" />
          </div>
          <CardTitle className="text-3xl">Universal CAN Intake</CardTitle>
          <CardDescription>Auto-detect CSV, TRC, candump, CRTD, ASC, BLF, MF4/MDF, CANedge, DBC, J1939, and text logs. Raw logs merge into one analysis; DBC files stay separate as decoders.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="flex flex-wrap gap-2">
              {supported.map((format) => <span key={format} className="rounded-lg border border-glass-border bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">{format}</span>)}
            </div>

            <div className="space-y-3">
              <Label htmlFor="can-files">CAN Log Files</Label>
              <Label
                htmlFor="can-files"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "group flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-glass-border bg-glass p-8 text-center backdrop-blur transition-all duration-300",
                  "hover:border-primary/50 hover:shadow-glow",
                  isDragging && "scale-[1.01] border-primary bg-secondary shadow-glow",
                  isLoading && "cursor-wait opacity-80",
                )}
              >
                <span className="grid size-20 place-items-center rounded-lg border border-glass-border bg-gradient-subtle text-primary shadow-glow transition-transform duration-300 group-hover:scale-105">
                  {isComplete ? <CheckCircle2 className="size-10 text-success" /> : files.length > 1 ? <Files className="size-10" /> : files.length ? <FileText className="size-10" /> : <UploadCloud className="size-10" />}
                </span>
                <span className="mt-6 text-xl font-bold text-foreground">{files.length ? `${files.length} File${files.length > 1 ? "s" : ""} Ready` : "Drop Any CAN Log Format Here"}</span>
                <span className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Batch upload up to 12 files from Files, iCloud, Drive, or local storage. Raw logs are detected, validated, merged chronologically, stored as one normalized CSV, then analyzed as a single dataset.</span>
                <Input id="can-files" className="sr-only" type="file" multiple onChange={handleFileChange} disabled={isLoading} />
              </Label>
            </div>

            {files.length ? (
              <div className="grid gap-3">
                {files.map((item) => (
                  <div key={`${item.name}-${item.size}`} className="flex flex-col gap-3 rounded-lg border border-glass-border bg-glass p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      {guessFormat(item).match(/BLF|MF4|MDF/) ? <FileArchive className="size-5 text-primary" /> : <FileCode2 className="size-5 text-primary" />}
                      <div className="min-w-0">
                        <p className="break-words font-semibold text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{Math.max(1, Math.round(item.size / 1024))} KB · initial guess: {guessFormat(item)}</p>
                      </div>
                    </div>
                    <span className="w-fit rounded-lg border border-glass-border bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">Auto-detect</span>
                  </div>
                ))}
              </div>
            ) : null}

            {error ? <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}

            {(isLoading || isComplete) ? (
              <div className="rounded-lg border border-glass-border bg-glass p-4 text-sm text-muted-foreground backdrop-blur">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2">
                    {isComplete ? <CheckCircle2 className="size-4 text-success" /> : <Loader2 className="size-4 animate-spin text-primary" />}
                    {isComplete ? "Conversion complete" : "Detecting format, converting to CSV, and storing normalized logs…"}
                  </span>
                  <span className="font-mono text-foreground">{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-gradient-accent transition-all duration-500" style={{ width: `${progress}%` }} /></div>
              </div>
            ) : null}

            {results.length ? (
              <div className="grid gap-3">
                {results.map((result) => (
                  <div key={result.filename} className={cn("rounded-lg border p-4 text-sm", result.error ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-glass-border bg-glass text-muted-foreground")}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="font-semibold text-foreground">{result.filename}</span>
                      <span className="rounded-lg bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">{result.detected_format ?? "Failed"}</span>
                    </div>
                    {result.error ? <p className="mt-2">{result.error}</p> : <p className="mt-2">{result.frame_count} frames converted to normalized CSV.</p>}
                    {result.warnings?.map((warning) => <p key={warning} className="mt-2 flex items-start gap-2 text-warning"><AlertTriangle className="mt-0.5 size-4" /> {warning}</p>)}
                  </div>
                ))}
              </div>
            ) : null}

            <Button type="submit" variant="analyzer" size="lg" className="w-full" disabled={isLoading || !files.length}>
              {isLoading ? "Converting…" : hasBatch ? "Convert Batch & Analyze" : "Convert & Analyze"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
};

export default Upload;
