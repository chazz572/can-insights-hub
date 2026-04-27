import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppNav } from "./components/AppNav.tsx";
import Home from "./pages/Home.tsx";
import Upload from "./pages/Upload.tsx";
import Results from "./pages/Results.tsx";
import Auth from "./pages/Auth.tsx";
import BatchResults from "./pages/BatchResults.tsx";
import Compare from "./pages/Compare.tsx";
import Engineering from "./pages/Engineering.tsx";
import Fleet from "./pages/Fleet.tsx";
import Analyzer from "./pages/Analyzer.tsx";
import Live from "./pages/Live.tsx";
import Reports from "./pages/Reports.tsx";
import SampleGenerator from "./pages/SampleGenerator.tsx";
import Visualize from "./pages/Visualize.tsx";
import Workspace from "./pages/Workspace.tsx";
import SharedAnalysis from "./pages/SharedAnalysis.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <AppNav />
          <div className="min-h-screen pb-24 pt-20 transition-colors duration-500 md:pl-72 md:pb-0">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/workspace" element={<Workspace />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/batch-results" element={<BatchResults />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/engineering" element={<Engineering />} />
              <Route path="/fleet" element={<Fleet />} />
              <Route path="/analyzer" element={<Analyzer />} />
              <Route path="/live" element={<Live />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/sample-generator" element={<SampleGenerator />} />
              <Route path="/shared/:token" element={<SharedAnalysis />} />
              <Route path="/visualize" element={<Visualize />} />
              <Route path="/results/:file_id" element={<Results />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
