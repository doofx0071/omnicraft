import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
});

// Unique-constraint codes across the supported databases: PostgreSQL,
// MySQL and SQLite (which may surface wrapped inside `cause`).
const UNIQUE_VIOLATIONS = new Set(["23505", "ER_DUP_ENTRY", "SQLITE_CONSTRAINT_UNIQUE"]);

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return UNIQUE_VIOLATIONS.has(e.code ?? "") || UNIQUE_VIOLATIONS.has(e.cause?.code ?? "");
}

export const usersRoutes = new Hono()
  .get("/", async (c) => c.json(await db.select().from(users).orderBy(users.id)))
  .post("/", async (c) => {
    const parsed = createUserSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: z.prettifyError(parsed.error) }, 400);
    }
    try {
      const [user] = await db.insert(users).values(parsed.data).returning();
      return c.json(user, 201);
    } catch (err) {
      if (isUniqueViolation(err)) {
        return c.json({ error: "Email already in use" }, 409);
      }
      throw err;
    }
  })
  .delete("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) {
      return c.json({ error: "Invalid user id" }, 400);
    }
    const [deleted] = await db.delete(users).where(eq(users.id, id)).returning();
    if (!deleted) {
      return c.json({ error: "User not found" }, 404);
    }
    return c.json(deleted);
  });
