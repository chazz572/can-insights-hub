import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const Home = () => (
  <main className="min-h-[calc(100vh-4rem)] overflow-hidden">
    <section className="relative bg-gradient-hero text-primary-foreground">
      <div className="absolute inset-x-0 top-0 h-px animate-signal-sweep bg-gradient-accent opacity-70 motion-reduce:animate-none" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
        <div className="flex flex-col justify-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-accent">CAN bus intelligence</p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">CAN AI Analyzer</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-primary-foreground/80">
            Upload a CSV capture and turn raw CAN traffic into structured diagnostics, signal candidates, and vehicle behavior insights.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="analyzer" size="lg">
              <Link to="/upload">Upload CSV</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link to={localStorage.getItem("can_ai_file_id") ? `/results/${localStorage.getItem("can_ai_file_id")}` : "/upload"}>View Results</Link>
            </Button>
          </div>
        </div>

        <Card className="border-primary-foreground/15 bg-card/10 text-primary-foreground shadow-glow backdrop-blur">
          <CardContent className="p-6">
            <div className="grid gap-4">
              {["Upload CSV", "Analyze CAN IDs", "Review Dashboard"].map((label, index) => (
                <div key={label} className="flex items-center gap-4 rounded-md border border-primary-foreground/15 bg-primary-foreground/10 p-4">
                  <span className="grid size-10 place-items-center rounded-md bg-accent font-bold text-accent-foreground">{index + 1}</span>
                  <div>
                    <p className="font-semibold">{label}</p>
                    <p className="text-sm text-primary-foreground/70">Real backend analysis, no mocked data.</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  </main>
);

export default Home;