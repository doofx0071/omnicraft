import "dotenv/config";
import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { apiRoutes } from "./index.js";

// Builds the same API surface as src/index.ts and exercises it with
// fastify.inject — no listening socket and no extra test dependency.
const app = Fastify({ logger: false });
await app.register(apiRoutes, { prefix: "/api" });

describe("GET /api/health", () => {
  it("returns 200 ok", async () => {
    const response = await app.inject({ method: "GET", url: "/api/health" });
    expect(response.statusCode).toBe(200);
    const body = response.json() as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(typeof body.uptime).toBe("number");
    expect(typeof body.timestamp).toBe("string");
  });
});
