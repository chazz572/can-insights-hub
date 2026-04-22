import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { AnalysisCard } from "@/components/AnalysisCard";
import { JsonTable } from "@/components/JsonTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { analyzeFile, AnalysisResult } from "@/lib/canApi";

const renderText = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "No summary returned.";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
};

const renderList = (value: unknown) => {
  const items = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];

  if (!items.length) {
    return <div className="rounded-md border border-dashed bg-muted/50 p-4 text-sm text-muted-foreground">No values returned.</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <span key={`${String(item)}-${index}`} className="rounded-md bg-secondary px-3 py-2 font-mono text-sm text-secondary-foreground">
          {renderText(item)}
        </span>
      ))}
    </div>
  );
};

const asRecord = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

const Results = () => {
  const { id, file_id } = useParams();
  const fileId = file_id ?? id;
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
  const basicView = asRecord(data?.basic_view);
  const diagnostics = asRecord(data?.diagnostics);
  const reverseEngineering = data?.reverse_engineering;
  const reverseEngineeringRecord = asRecord(reverseEngineering);
  const anomalies = data?.anomalies ?? (Array.isArray(diagnostics.anomalies) ? diagnostics.anomalies : []);
  const totalMessages = data?.total_messages ?? basicView.total_messages;
  const uniqueIds = data?.unique_ids ?? basicView.unique_ids;
  const idStats = data?.id_stats ?? basicView.id_frequency;
  const reverseEngineeringRows = Array.isArray(reverseEngineering) ? reverseEngineering : reverseEngineeringRecord.clusters;
  const anomaliesDetected = anomalies.length || diagnostics.anomalies_detected;
  const vehicleBehavior = data?.vehicle_behavior ?? {};

  return (
    <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Results dashboard</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">CAN analysis</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">File ID: <span className="font-mono text-foreground">{fileId ?? "—"}</span></p>
        </div>
        <Button asChild variant="outline">
          <Link to="/upload">Analyze another CSV</Link>
        </Button>
      </div>

      {isLoading ? (
        <Card className="bg-gradient-panel shadow-dashboard">
          <CardContent className="space-y-4 p-6">
            <div className="h-4 w-48 animate-pulse rounded-md bg-muted" />
            <div className="h-24 animate-pulse rounded-md bg-muted" />
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="h-20 animate-pulse rounded-md bg-muted" />
              <div className="h-20 animate-pulse rounded-md bg-muted" />
              <div className="h-20 animate-pulse rounded-md bg-muted" />
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive/40 bg-destructive/10 shadow-dashboard">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-destructive">Unable to load results</h2>
            <p className="mt-2 text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : data ? (
        <div className="grid gap-6">
          <AnalysisCard title="Summary">
            <pre className="whitespace-pre-wrap rounded-md bg-muted/60 p-4 text-sm leading-7 text-foreground">{renderText(data.summary)}</pre>
          </AnalysisCard>

          <div className="grid gap-6 lg:grid-cols-3">
            <AnalysisCard title="Total Messages">
              <p className="text-4xl font-bold text-primary">{renderText(totalMessages)}</p>
            </AnalysisCard>
            <AnalysisCard title="Unique IDs">
              <p className="text-4xl font-bold text-primary">{renderText(uniqueIds)}</p>
            </AnalysisCard>
            <AnalysisCard title="Anomalies Detected">
              <p className="text-4xl font-bold text-primary">{renderText(anomaliesDetected)}</p>
            </AnalysisCard>
          </div>

          <AnalysisCard title="Basic View" description="Frequency distribution by CAN identifier.">
            <JsonTable data={idStats} />
          </AnalysisCard>

          <AnalysisCard title="Diagnostics" description="Backend-detected anomalies in the capture.">
            <JsonTable data={anomalies} />
          </AnalysisCard>

          <AnalysisCard title="Reverse Engineering" description="Clustered identifiers and inferred signal groups.">
            <JsonTable data={reverseEngineeringRows} />
          </AnalysisCard>

          <AnalysisCard title="Vehicle Behavior">
            <div className="grid gap-5 lg:grid-cols-3">
              <div className="space-y-2"><h3 className="font-semibold">Possible Speed IDs</h3>{renderList(vehicleBehavior.possible_speed_ids)}</div>
              <div className="space-y-2"><h3 className="font-semibold">Possible RPM IDs</h3>{renderList(vehicleBehavior.possible_rpm_ids)}</div>
              <div className="space-y-2"><h3 className="font-semibold">Possible Pedal IDs</h3>{renderList(vehicleBehavior.possible_pedal_ids)}</div>
            </div>
          </AnalysisCard>

        </div>
      ) : null}
    </main>
  );
};

export default Results;