import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";

export const usersRouter = Router();

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
});

usersRouter.get("/", async (_req, res) => {
  const allUsers = await db.select().from(users).orderBy(users.id);
  res.json(allUsers);
});

// Unique-constraint codes across the supported databases: PostgreSQL,
// MySQL and SQLite (which may surface wrapped inside `cause`).
const UNIQUE_VIOLATIONS = new Set(["23505", "ER_DUP_ENTRY", "SQLITE_CONSTRAINT_UNIQUE"]);

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return UNIQUE_VIOLATIONS.has(e.code ?? "") || UNIQUE_VIOLATIONS.has(e.cause?.code ?? "");
}

usersRouter.post("/", async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: z.prettifyError(parsed.error) });
  }
  try {
    await db.insert(users).values(parsed.data);
    const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
    if (!user) throw new Error("Created user could not be loaded.");
    res.status(201).json(user);
  } catch (err) {
    if (isUniqueViolation(err)) {
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
  const [deleted] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!deleted) {
    return res.status(404).json({ error: "User not found" });
  }
  await db.delete(users).where(eq(users.id, id));
  res.json(deleted);
});
