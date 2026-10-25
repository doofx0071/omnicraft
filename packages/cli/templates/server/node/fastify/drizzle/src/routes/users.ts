import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
});

export async function usersRoutes(app: FastifyInstance) {
  app.get("/", async () => db.select().from(users).orderBy(users.id));

  app.post("/", async (req, reply) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: z.prettifyError(parsed.error) });
    }
    try {
      const [user] = await db.insert(users).values(parsed.data).returning();
      return reply.status(201).send(user);
    } catch (err) {
      // 23505: PostgreSQL unique_violation — the users.email unique constraint.
      if ((err as { code?: string }).code === "23505") {
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
    const [deleted] = await db.delete(users).where(eq(users.id, id)).returning();
    if (!deleted) {
      return reply.status(404).send({ error: "User not found" });
    }
    return deleted;
  });
}
