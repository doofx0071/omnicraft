import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
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

export async function usersRoutes(app: FastifyInstance) {
  app.get("/", async () => db.select().from(users).orderBy(users.id));

  app.post("/", async (req, reply) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: z.prettifyError(parsed.error) });
    }
    try {
      await db.insert(users).values(parsed.data);
      const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
      if (!user) throw new Error("Created user could not be loaded.");
      return reply.status(201).send(user);
    } catch (err) {
      if (isUniqueViolation(err)) {
        return reply.status(409).send({ error: "Email already in use" });
      }
      throw err;
    }
  });

  app.delete("/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) {
      return reply.status(400).send({ error: "Invalid user id" });
    }
    const [deleted] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!deleted) {
      return reply.status(404).send({ error: "User not found" });
    }
    await db.delete(users).where(eq(users.id, id));
    return deleted;
  });
}
