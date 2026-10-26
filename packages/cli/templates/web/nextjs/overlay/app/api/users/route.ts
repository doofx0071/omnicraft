import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/app/db/index";

// Route handlers — Next.js IS the server in this architecture (no separate
// API process). Data lives in `app/db` (server-only; never import from
// client components).

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

// Placeholders differ by dialect: $1/$2 on postgres, ? on mysql/sqlite.
const isPostgres = (process.env.DATABASE_URL ?? "").startsWith("postgres");

export async function GET() {
  const rows = await query<UserRow>("SELECT id, name, email, created_at FROM users ORDER BY id");
  return NextResponse.json(rows.map(serialize));
}

export async function POST(request: Request) {
  const parsed = createUserSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  try {
    if (isPostgres) {
      const rows = await query<UserRow>(
        "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email, created_at",
        [parsed.data.name, parsed.data.email],
      );
      return NextResponse.json(serialize(rows[0]!), { status: 201 });
    }
    // mysql / sqlite: no RETURNING — insert, then read back the last row.
    await query("INSERT INTO users (name, email) VALUES (?, ?)", [
      parsed.data.name,
      parsed.data.email,
    ]);
    const rows = await query<UserRow>(
      "SELECT id, name, email, created_at FROM users ORDER BY id DESC",
    );
    return NextResponse.json(serialize(rows[0]!), { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
    throw err;
  }
}

// Unique-constraint codes: postgres 23505, mysql ER_DUP_ENTRY,
// sqlite SQLITE_CONSTRAINT_UNIQUE (possibly wrapped in `cause`).
function isUniqueViolation(err: unknown): boolean {
  const codes = new Set(["23505", "ER_DUP_ENTRY", "SQLITE_CONSTRAINT_UNIQUE"]);
  const e = err as { code?: string; cause?: { code?: string } };
  return codes.has(e.code ?? "") || codes.has(e.cause?.code ?? "");
}
