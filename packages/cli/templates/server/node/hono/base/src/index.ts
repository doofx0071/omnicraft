import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./env.js";
import { apiRoutes } from "./routes/index.js";

const app = new Hono();

app.use("/api/*", cors({ origin: env.CORS_ORIGIN }));
app.route("/api", apiRoutes);

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
