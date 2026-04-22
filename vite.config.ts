import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const getBasePath = () => {
  if (process.env.VITE_BASE_PATH) return process.env.VITE_BASE_PATH;
  if (!process.env.GITHUB_ACTIONS || !process.env.GITHUB_REPOSITORY) return "/";

  const repositoryName = process.env.GITHUB_REPOSITORY.split("/")[1];
  return repositoryName.endsWith(".github.io") ? "/" : `/${repositoryName}/`;
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: getBasePath(),
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
