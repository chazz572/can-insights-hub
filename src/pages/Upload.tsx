import { ChangeEvent, DragEvent, FormEvent, useEffect, useState } from "react";
import { CheckCircle2, FileText, Loader2, UploadCloud } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { analyzeFile, uploadCsv } from "@/lib/canApi";
import { cn } from "@/lib/utils";

const Upload = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!isLoading) return;

    setProgress(12);
    const interval = window.setInterval(() => {
      setProgress((current) => Math.min(current + 9, 88));
    }, 280);

    return () => window.clearInterval(interval);
  }, [isLoading]);

  const acceptFile = (selectedFile: File | null) => {
    setError(null);
    setIsComplete(false);

    if (selectedFile && !selectedFile.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      setError("Please select a CSV file.");
      return;
    }

    setFile(selectedFile);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    acceptFile(event.target.files?.[0] ?? null);
  };

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (!isLoading) setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (!isLoading) acceptFile(event.dataTransfer.files?.[0] ?? null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError("Choose a CSV file before starting analysis.");
      return;
    }

    setIsLoading(true);
    setIsComplete(false);
    setError(null);

    try {
      const fileId = await uploadCsv(file);
      await analyzeFile(fileId);
      setProgress(100);
      setIsComplete(true);
      localStorage.setItem("can_ai_file_id", fileId);
      window.setTimeout(() => navigate(`/results/${fileId}`), 450);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload or analysis failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10 sm:px-6 lg:px-8">
      <Card className="w-full max-w-2xl animate-fade-up overflow-hidden">
        <CardHeader>
          <div className="mb-3 grid size-14 place-items-center rounded-lg bg-gradient-accent text-primary-foreground shadow-glow">
            <UploadCloud className="size-7" />
          </div>
          <CardTitle className="text-3xl">Upload CAN CSV</CardTitle>
          <CardDescription>Start a backend analysis from a CAN capture export.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-3">
              <Label htmlFor="csv-file">CSV file</Label>
              <Label
                htmlFor="csv-file"
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
                  {isComplete ? <CheckCircle2 className="size-10 text-success" /> : file ? <FileText className="size-10" /> : <UploadCloud className="size-10" />}
                </span>
                <span className="mt-6 text-xl font-bold text-foreground">{file ? file.name : "Drop your CAN CSV here"}</span>
                <span className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Select or drag in a CSV export to launch analysis.</span>
                <Input id="csv-file" className="sr-only" type="file" accept=".csv,text/csv" onChange={handleFileChange} disabled={isLoading} />
              </Label>
              {file ? <p className="text-sm text-muted-foreground">Selected: {file.name}</p> : null}
            </div>

            {error ? <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}

            {(isLoading || isComplete) ? (
              <div className="rounded-lg border border-glass-border bg-glass p-4 text-sm text-muted-foreground backdrop-blur">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2">
                    {isComplete ? <CheckCircle2 className="size-4 text-success" /> : <Loader2 className="size-4 animate-spin text-primary" />}
                    {isComplete ? "Analysis complete" : "Uploading and analyzing your CSV…"}
                  </span>
                  <span className="font-mono text-foreground">{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-gradient-accent transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>
            ) : null}

            <Button type="submit" variant="analyzer" size="lg" className="w-full" disabled={isLoading || !file}>
              {isLoading ? "Analyzing…" : "Upload & Analyze"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
};

export default Upload;
