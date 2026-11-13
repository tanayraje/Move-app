import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";

const port = Number(process.env.PORT || 3000);

// Stamps the built service worker with a per-build id so each deploy gets its
// own cache name and the browser sees sw.js as changed.
function stampServiceWorker(): Plugin {
  const buildId = (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 8) || Date.now().toString(36);
  return {
    name: "move-stamp-service-worker",
    apply: "build",
    closeBundle() {
      const file = path.resolve(import.meta.dirname, "dist", "sw.js");
      if (!fs.existsSync(file)) return;
      fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/__BUILD_ID__/g, buildId));
    },
  };
}

export default defineConfig({
base: "/",
plugins: [
react(),
tailwindcss(),
stampServiceWorker(),
],
resolve: {
alias: {
"@": path.resolve(import.meta.dirname, "src"),
"@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
},
dedupe: ["react", "react-dom"],
},
root: path.resolve(import.meta.dirname),
build: {
outDir: path.resolve(import.meta.dirname, "dist"),
emptyOutDir: true,
rollupOptions: {
  output: {
    manualChunks(id) {
      if (!id.includes("node_modules")) return;
      if (id.includes("leaflet") || id.includes("react-leaflet")) return "maps";
      if (id.includes("@supabase")) return "supabase";
      if (id.includes("recharts")) return "charts";
      if (id.includes("lucide-react") || id.includes("react-icons")) return "icons";
    },
  },
},
},
server: {
port,
host: "0.0.0.0",
},
preview: {
port,
host: "0.0.0.0",
},
});
