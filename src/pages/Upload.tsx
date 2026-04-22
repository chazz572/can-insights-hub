import { ChangeEvent, FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { analyzeFile, uploadCsv } from "@/lib/canApi";

const Upload = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    setError(null);

    if (selectedFile && !selectedFile.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      setError("Please select a CSV file.");
      return;
    }

    setFile(selectedFile);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError("Choose a CSV file before starting analysis.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const fileId = await uploadCsv(file);
      await analyzeFile(fileId);
      localStorage.setItem("can_ai_file_id", fileId);
      navigate(`/results/${fileId}`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload or analysis failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="grid min-h-[calc(100vh-4rem)] place-items-center px-4 py-10 sm:px-6 lg:px-8">
      <Card className="w-full max-w-xl bg-gradient-panel shadow-dashboard">
        <CardHeader>
          <CardTitle className="text-3xl">Upload CAN CSV</CardTitle>
          <CardDescription>Start a backend analysis from a CAN capture export.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="csv-file">CSV file</Label>
              <Input id="csv-file" type="file" accept=".csv,text/csv" onChange={handleFileChange} disabled={isLoading} />
              {file ? <p className="text-sm text-muted-foreground">Selected: {file.name}</p> : null}
            </div>

            {error ? <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}

            {isLoading ? (
              <div className="rounded-md border bg-muted/50 p-4 text-sm text-muted-foreground">Uploading and analyzing your CSV…</div>
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