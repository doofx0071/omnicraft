import "dotenv/config";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { env } from "./env.js";
import { apiRoutes } from "./routes/index.js";

// Marks the error thrown by the rate limiter so the handler below can map it
// to the shared 429 response instead of Fastify's default error shape.
const RATE_LIMITED = "OMNICRAFT_RATE_LIMITED";

const app = Fastify({ logger: true });

// Must run before any register(): plugin encapsulation contexts capture the
// error handler at boot, so setting it after await app.register(...) would
// leave the plugin's routes with Fastify's default error body.
app.setErrorHandler((err, _req, reply) => {
  const e = err as { code?: string; cause?: { code?: string }; statusCode?: number };
  if (e.code === RATE_LIMITED) {
    return reply.status(429).send({ error: "Too many requests" });
  }
  const code = e.code ?? e.cause?.code;
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "P1001") {
    app.log.error("❌ Cannot reach the database — see README → Troubleshooting");
    return reply.status(503).send({ error: "Database unavailable — see README → Troubleshooting" });
  }
  app.log.error(err);
  const statusCode = e.statusCode;
  return reply.status(statusCode ?? 500).send({ error: "Internal server error" });
});

await app.register(cors, { origin: env.CORS_ORIGIN });
// Baseline security headers on every response. The Content-Security-Policy
// is left off: this is a JSON API, and the SPA is served by the Vite client.
await app.register(helmet, { contentSecurityPolicy: false });

// Generous per-IP API rate limit — a dev/CRUD baseline, not a hard guard.
// Tune RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MINUTES in server/.env. The plugin
// sets the x-ratelimit-* and retry-after headers itself and throws the error
// the handler above maps to the shared 429 body; registered before the
// routes so the onRequest hook applies to all of them.
await app.register(rateLimit, {
  max: env.RATE_LIMIT_MAX,
  timeWindow: env.RATE_LIMIT_WINDOW_MINUTES * 60_000,
  errorResponseBuilder: () =>
    Object.assign(new Error("Too many requests"), { statusCode: 429, code: RATE_LIMITED }),
});

await app.register(apiRoutes, { prefix: "/api" });
app.setNotFoundHandler(
  {
    // The rate limit applies to routes only; this documents the plugin's
    // supported way to cover unmatched paths (including the /api fallback).
    preHandler: app.rateLimit(),
  },
  (request, reply) => {
    const requestPath = request.url.split("?", 1)[0] ?? request.url;
    if (requestPath === "/api" || requestPath.startsWith("/api/")) {
      return reply.status(404).send({ error: "Not found" });
    }
    return reply.status(404).send({
      message: `Route ${request.method}:${request.url} not found`,
      error: "Not Found",
      statusCode: 404,
    });
  },
);

await app.listen({ port: env.PORT, host: "0.0.0.0" });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    app.close().finally(() => process.exit(0));
  });
}
