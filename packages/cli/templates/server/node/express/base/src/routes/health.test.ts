import "dotenv/config";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { apiRouter } from "./index.js";

// Mounts the API router exactly like src/index.ts, but on an ephemeral
// port so the test never collides with a running dev server or a fixed
// port in CI. No extra test dependency needed — plain fetch.
const app = express();
app.use("/api", apiRouter);

let server: Server;
let baseUrl: string;

beforeAll(() => {
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(() => {
  server.close();
});

describe("GET /api/health", () => {
  it("returns 200 ok", async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(typeof body.uptime).toBe("number");
    expect(typeof body.timestamp).toBe("string");
  });
});
