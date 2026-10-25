import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/index.js";

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
});

function prismaErrorCode(err: unknown): string | undefined {
  return (err as { code?: string }).code;
}

export async function usersRoutes(app: FastifyInstance) {
  app.get("/", async () => db.user.findMany({ orderBy: { id: "asc" } }));

  app.post("/", async (req, reply) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: z.prettifyError(parsed.error) });
    }
    try {
      const user = await db.user.create({ data: parsed.data });
      return reply.status(201).send(user);
    } catch (err) {
      if (prismaErrorCode(err) === "P2002") {
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
    try {
      const deleted = await db.user.delete({ where: { id } });
      return deleted;
    } catch (err) {
      if (prismaErrorCode(err) === "P2025") {
        return reply.status(404).send({ error: "User not found" });
      }
      throw err;
    }
  });
}
