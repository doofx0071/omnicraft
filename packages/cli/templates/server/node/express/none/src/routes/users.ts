import { Router } from "express";
import { z } from "zod";
import { query } from "../db/index.js";

export const usersRouter = Router();

interface UserRow {
  id: number;
  name: string;
  email: string;
  created_at: string | Date;
}

// Response shape matches the client's `User` type (camelCase).
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

usersRouter.get("/", async (_req, res) => {
  const rows = await query<UserRow>("SELECT id, name, email, created_at FROM users ORDER BY id");
  res.json(rows.map(serialize));
});

usersRouter.post("/", async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: z.prettifyError(parsed.error) });
  }
  try {
    if (isPostgres) {
      const rows = await query<UserRow>(
        "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email, created_at",
        [parsed.data.name, parsed.data.email],
      );
      return res.status(201).json(serialize(rows[0]!));
    }
    // mysql / sqlite: no RETURNING — insert, then read back the new row.
    await query("INSERT INTO users (name, email) VALUES (?, ?)", [
      parsed.data.name,
      parsed.data.email,
    ]);
    const rows = await query<UserRow>(
      "SELECT id, name, email, created_at FROM users ORDER BY id DESC",
    );
    return res.status(201).json(serialize(rows[0]!));
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
  const idValue = isPostgres ? "$1" : "?";
  const rows = await query<UserRow>(
    "SELECT id, name, email, created_at FROM users WHERE id = " + idValue,
    [id],
  );
  const user = rows[0];
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  await query("DELETE FROM users WHERE id = " + idValue, [id]);
  res.json(serialize(user));
});

// Unique-constraint codes: postgres 23505, mysql ER_DUP_ENTRY,
// sqlite SQLITE_CONSTRAINT_UNIQUE (possibly wrapped in `cause`).
function isUniqueViolation(err: unknown): boolean {
  const codes = new Set(["23505", "ER_DUP_ENTRY", "SQLITE_CONSTRAINT_UNIQUE"]);
  const e = err as { code?: string; cause?: { code?: string } };
  return codes.has(e.code ?? "") || codes.has(e.cause?.code ?? "");
}
