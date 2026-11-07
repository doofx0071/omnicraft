import "dotenv/config";
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { apiRoutes } from "./index.js";

// Mirrors src/index.ts wiring and uses hono's built-in request helper —
// the routes run in-process with no listening socket and no extra test
// dependency.
const app = new Hono().route("/api", apiRoutes);

describe("GET /api/health", () => {
  it("returns 200 ok", async () => {
    const response = await app.request("/api/health");
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(typeof body.uptime).toBe("number");
    expect(typeof body.timestamp).toBe("string");
  });
});
