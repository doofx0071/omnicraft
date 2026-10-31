import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Proxies API and Laravel Sanctum CSRF requests so the client and server can
// run on different ports without CORS setup during development.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/sanctum": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
