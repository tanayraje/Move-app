import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const port = Number(process.env.PORT || 3000);

export default defineConfig({
base: "/",
plugins: [
react(),
tailwindcss(),

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
