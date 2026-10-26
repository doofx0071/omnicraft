import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// Proxies /api to the backend so the client and server can run on
// different ports without CORS setup during development.
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
