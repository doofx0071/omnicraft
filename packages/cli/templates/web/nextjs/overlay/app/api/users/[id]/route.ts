import { NextResponse } from "next/server";
import { query } from "@/app/db/index";

interface UserRow {
  id: number;
  name: string;
  email: string;
  created_at: string | Date;
}

// Placeholders differ by dialect: $1 on postgres, ? on mysql/sqlite.
const ID = (process.env.DATABASE_URL ?? "").startsWith("postgres") ? "$1" : "?";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }
  const rows = await query<UserRow>(
    "SELECT id, name, email, created_at FROM users WHERE id = " + ID,
    [id],
  );
  const user = rows[0];
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  await query("DELETE FROM users WHERE id = " + ID, [id]);
  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.created_at instanceof Date ? user.created_at.toISOString() : user.created_at,
  });
}
