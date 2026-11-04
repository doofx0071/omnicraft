import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxies /api to the backend so the client and server can run on
// different ports without CORS setup during development.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
