import "dotenv/config";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { env } from "./env.js";
import { apiRoutes } from "./routes/index.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: env.CORS_ORIGIN });
await app.register(apiRoutes, { prefix: "/api" });

// Friendly response when the database is unreachable, instead of a raw
// driver stack trace.
app.setErrorHandler((err, _req, reply) => {
  const e = err as { code?: string; cause?: { code?: string } };
  const code = e.code ?? e.cause?.code;
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "P1001") {
    app.log.error("❌ Cannot reach the database — see README → Troubleshooting");
    return reply.status(503).send({ error: "Database unavailable — see README → Troubleshooting" });
  }
  app.log.error(err);
  const statusCode = (err as { statusCode?: number }).statusCode;
  return reply.status(statusCode ?? 500).send({ error: "Internal server error" });
});

await app.listen({ port: env.PORT, host: "0.0.0.0" });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    app.close().finally(() => process.exit(0));
  });
}
