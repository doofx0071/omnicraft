import { eq } from "drizzle-orm";
import { Hono } from "hono";
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

export const usersRoutes = new Hono()
  .get("/", async (c) => {
    const rows = await query<UserRow>("SELECT id, name, email, created_at FROM users ORDER BY id");
    return c.json(rows.map(serialize));
  })
  .post("/", async (c) => {
    const parsed = createUserSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: z.prettifyError(parsed.error) }, 400);
    }
    try {
      if (isPostgres) {
        const rows = await query<UserRow>(
          "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email, created_at",
          [parsed.data.name, parsed.data.email],
        );
        return c.json(serialize(rows[0]!), 201);
      }
      // mysql / sqlite: no RETURNING — insert, then read back the last row.
      await query("INSERT INTO users (name, email) VALUES (?, ?)", [
        parsed.data.name,
        parsed.data.email,
      ]);
      const rows = await query<UserRow>(
        "SELECT id, name, email, created_at FROM users ORDER BY id DESC",
      );
      return c.json(serialize(rows[0]!), 201);
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
    const idValue = isPostgres ? "$1" : "?";
    const rows = await query<UserRow>(
      "SELECT id, name, email, created_at FROM users WHERE id = " + idValue,
      [id],
    );
    const user = rows[0];
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }
    await query("DELETE FROM users WHERE id = " + idValue, [id]);
    return c.json(serialize(user));
  });

// Unique-constraint codes: postgres 23505, mysql ER_DUP_ENTRY,
// sqlite SQLITE_CONSTRAINT_UNIQUE (possibly wrapped in `cause`).
function isUniqueViolation(err: unknown): boolean {
  const codes = new Set(["23505", "ER_DUP_ENTRY", "SQLITE_CONSTRAINT_UNIQUE"]);
  const e = err as { code?: string; cause?: { code?: string } };
  return codes.has(e.code ?? "") || codes.has(e.cause?.code ?? "");
}
