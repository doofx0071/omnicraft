import "dotenv/config";
import cors from "cors";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { env } from "./env.js";
import { apiRouter } from "./routes/index.js";

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());
app.use("/api", apiRouter);

// JSON error handler — keeps API responses consistent instead of
// Express's default HTML error page.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const code = dbErrorCode(err);
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "P1001") {
    console.error(
      "❌ Cannot reach PostgreSQL — is it running? Start it with: docker compose up -d",
    );
    res
      .status(503)
      .json({ error: "Database unavailable — start PostgreSQL with: docker compose up -d" });
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
