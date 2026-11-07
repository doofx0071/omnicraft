import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { env } from "./env.js";
import { apiRouter } from "./routes/index.js";

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
// Baseline security headers on every response. The Content-Security-Policy
// is left off: this is a JSON API, and the SPA is served by the Vite client.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

// Generous per-IP API rate limit — a dev/CRUD baseline, not a hard guard.
// Tune RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MINUTES in server/.env. On exceed
// the library answers 429 with the message below and a Retry-After header.
const apiRateLimiter = rateLimit({
  limit: env.RATE_LIMIT_MAX,
  windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60_000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests" },
});

app.use("/api", apiRateLimiter);
app.use("/api", apiRouter);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// JSON error handler — keeps API responses consistent instead of
// Express's default HTML error page.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const code = dbErrorCode(err);
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "P1001") {
    console.error("❌ Cannot reach the database — see README → Troubleshooting");
    res.status(503).json({ error: "Database unavailable — see README → Troubleshooting" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// Drizzle wraps driver errors (see .cause); Prisma uses P-codes. One small
// helper covers both ORMs.
function dbErrorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code ?? e.cause?.code;
}

const server = app.listen(env.PORT, () => {
  console.log(`✅ API ready at http://localhost:${env.PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.closeAllConnections();
    server.close(() => process.exit(0));
  });
}
