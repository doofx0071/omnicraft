import { Hono } from "hono";
import { healthRoutes } from "./health.js";
import { usersRoutes } from "./users.js";

export const apiRoutes = new Hono().route("/health", healthRoutes).route("/users", usersRoutes);
