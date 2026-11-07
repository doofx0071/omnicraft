import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { env } from "./env.js";
import { apiRateLimit } from "./rate-limit.js";
import { apiRoutes } from "./routes/index.js";

const app = new Hono();

// CORS first so its headers still land on rate-limited responses.
app.use("/api/*", cors({ origin: env.CORS_ORIGIN }));
// Baseline security headers on every response (built-in middleware; no CSP
// on a JSON API, and the SPA is served by the Vite client).
app.use(secureHeaders());
// Generous per-IP API rate limit — a dev/CRUD baseline, not a hard guard.
// Tune RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MINUTES in server/.env. The
// /api/* matcher covers /api itself too (hono matches the bare prefix).
app.use("/api/*", apiRateLimit());
app.route("/api", apiRoutes);
app.all("/api", (c) => c.json({ error: "Not found" }, 404));
app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

// Friendly response when the database is unreachable, instead of a raw
// driver stack trace.
app.onError((err, c) => {
  const e = err as { code?: string; cause?: { code?: string } };
  const code = e.code ?? e.cause?.code;
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "P1001") {
    console.error("❌ Cannot reach the database — see README → Troubleshooting");
    return c.json({ error: "Database unavailable — see README → Troubleshooting" }, 503);
  }
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`✅ API ready at http://localhost:${info.port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
