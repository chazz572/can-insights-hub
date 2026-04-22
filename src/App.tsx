import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { checkBackendHealth } from "@/lib/canApi";
import { AppNav } from "./components/AppNav.tsx";
import Home from "./pages/Home.tsx";
import Upload from "./pages/Upload.tsx";
import Results from "./pages/Results.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => {
  const [backendError, setBackendError] = useState<string | null>(null);

  useEffect(() => {
    checkBackendHealth().catch(() => {
      setBackendError("Backend is offline. Start the FastAPI server on http://localhost:8000 and refresh the app.");
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppNav />
          <div className="min-h-screen pb-24 md:pl-72 md:pb-0">
            {backendError ? (
              <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive backdrop-blur">{backendError}</div>
            ) : null}
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/results/:file_id" element={<Results />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
