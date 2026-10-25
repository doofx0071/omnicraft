import { Hono } from "hono";

export const healthRoutes = new Hono().get("/", (c) =>
  c.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }),
);
