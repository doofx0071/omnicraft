import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";

export const usersRouter = Router();

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
});

function prismaErrorCode(err: unknown): string | undefined {
  return (err as { code?: string }).code;
}

usersRouter.get("/", async (_req, res) => {
  const allUsers = await db.user.findMany({ orderBy: { id: "asc" } });
  res.json(allUsers);
});

usersRouter.post("/", async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: z.prettifyError(parsed.error) });
  }
  try {
    const user = await db.user.create({ data: parsed.data });
    res.status(201).json(user);
  } catch (err) {
    if (prismaErrorCode(err) === "P2002") {
      return res.status(409).json({ error: "Email already in use" });
    }
    throw err;
  }
});

usersRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid user id" });
  }
  try {
    const deleted = await db.user.delete({ where: { id } });
    res.json(deleted);
  } catch (err) {
    if (prismaErrorCode(err) === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    throw err;
  }
});
