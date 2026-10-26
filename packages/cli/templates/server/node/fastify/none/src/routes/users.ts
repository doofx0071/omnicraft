import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { query } from "../db/index.js";

interface UserRow {
  id: number;
  name: string;
  email: string;
  created_at: string | Date;
}

function serialize(row: UserRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
});

// Raw SQL through the db adapter's parameterized query() helper — values
// travel separately from the SQL text (the SQL-injection defense), no ORM.
// Placeholders differ by dialect: $1/$2 on postgres, ? on mysql/sqlite.
const isPostgres = (process.env.DATABASE_URL ?? "").startsWith("postgres");
const P = isPostgres ? ["$1", "$2"] : ["?", "?"];

export async function usersRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    const rows = await query<UserRow>("SELECT id, name, email, created_at FROM users ORDER BY id");
    return rows.map(serialize);
  });

  app.post("/", async (req, reply) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: z.prettifyError(parsed.error) });
    }
    try {
      if (isPostgres) {
        const rows = await query<UserRow>(
          "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email, created_at",
          [parsed.data.name, parsed.data.email],
        );
        return reply.status(201).send(serialize(rows[0]!));
      }
      // mysql / sqlite: no RETURNING — insert, then read back the last row.
      await query("INSERT INTO users (name, email) VALUES (?, ?)", [
        parsed.data.name,
        parsed.data.email,
      ]);
      const rows = await query<UserRow>(
        "SELECT id, name, email, created_at FROM users ORDER BY id DESC",
      );
      return reply.status(201).send(serialize(rows[0]!));
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
    const rows = await query<UserRow>(
      "SELECT id, name, email, created_at FROM users WHERE id = " + P[0],
      [id],
    );
    const user = rows[0];
    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }
    await query("DELETE FROM users WHERE id = " + P[0], [id]);
    return serialize(user);
  });
}

// Unique-constraint codes: postgres 23505, mysql ER_DUP_ENTRY,
// sqlite SQLITE_CONSTRAINT_UNIQUE (possibly wrapped in `cause`).
function isUniqueViolation(err: unknown): boolean {
  const codes = new Set(["23505", "ER_DUP_ENTRY", "SQLITE_CONSTRAINT_UNIQUE"]);
  const e = err as { code?: string; cause?: { code?: string } };
  return codes.has(e.code ?? "") || codes.has(e.cause?.code ?? "");
}
