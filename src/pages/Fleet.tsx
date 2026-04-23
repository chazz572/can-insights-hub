import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, Car, Gauge, Loader2, MapPinned, Route, ShieldCheck, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createFleetVehicle, loadFleetVehicles } from "@/lib/saasApi";

const Fleet = () => {
  const [vehicles, setVehicles] = useState<Record<string, unknown>[]>([]);
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => loadFleetVehicles().then(setVehicles).catch(() => setVehicles([]));
  useEffect(() => { refresh(); }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      await createFleetVehicle(name);
      setName("");
      await refresh();
    } catch (fleetError) {
      setError(fleetError instanceof Error ? fleetError.message : "Unable to add vehicle.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
      <section className="mb-8 animate-fade-up">
        <p className="inline-flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-3 py-1 text-sm font-semibold uppercase text-primary shadow-glow backdrop-blur"><Car className="size-4" /> Fleet intelligence</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Multi-vehicle health dashboard</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">Track health scores, driver behavior signals, and maintenance prediction across commercial vehicles.</p>
      </section>
      <Card className="mb-6 animate-fade-up overflow-hidden">
        <CardContent className="p-5">
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Add vehicle name" maxLength={120} />
            <Button type="submit" variant="analyzer" disabled={isLoading}>{isLoading ? <Loader2 className="animate-spin" /> : null} Add vehicle</Button>
          </form>
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        {[["Driver behavior", "Harsh braking, idle time, acceleration variance", Route], ["Maintenance prediction", "Health trend, mileage, recurring anomaly risk", Wrench], ["Fleet risk", "Critical vehicles and safety-orange alerts", AlertTriangle]].map(([title, detail, Icon]) => <Card key={String(title)} className="animate-fade-up"><CardContent className="p-5"><Icon className="mb-4 size-7 text-primary" /><p className="font-bold">{String(title)}</p><p className="mt-2 text-sm text-muted-foreground">{String(detail)}</p></CardContent></Card>)}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {(vehicles.length ? vehicles : [
          { id: "demo-1", vehicle_name: "Demo Fleet Truck", health_score: 94, status: "healthy" },
          { id: "demo-2", vehicle_name: "Service Van", health_score: 76, status: "maintenance_due" },
          { id: "demo-3", vehicle_name: "Prototype ECU", health_score: 88, status: "monitoring" },
        ]).map((vehicle) => (
          <Card key={String(vehicle.id)} className="animate-fade-up overflow-hidden">
            <CardHeader><CardTitle className="flex items-center justify-between gap-3"><span className="truncate">{String(vehicle.vehicle_name)}</span><Gauge className="text-primary" /></CardTitle></CardHeader>
            <CardContent>
              <p className="text-4xl font-extrabold text-primary">{String(vehicle.health_score ?? 100)}/100</p>
              <p className="mt-2 text-sm uppercase text-muted-foreground">{String(vehicle.status ?? "monitoring").replace(/_/g, " ")}</p>
              <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg border border-glass-border bg-glass p-3"><MapPinned className="mb-2 size-4 text-primary" /> Driver behavior</div>
                <div className="rounded-lg border border-glass-border bg-glass p-3"><Wrench className="mb-2 size-4 text-primary" /> Service window</div><div className="rounded-lg border border-glass-border bg-glass p-3"><ShieldCheck className="mb-2 size-4 text-primary" /> Safety state</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
};

export default Fleet;
