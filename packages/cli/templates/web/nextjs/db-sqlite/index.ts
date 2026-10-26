import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";

// DATABASE_URL is a file URL (file:./data/app.db) — make sure the folder
// exists so the first run can create the database file.
const file = resolve(process.env.DATABASE_URL?.replace(/^file:/, "") ?? "data/app.db");
mkdirSync(dirname(file), { recursive: true });

const sqlite = new Database(file);

// WAL mode: safe concurrent reads while writing — good defaults for dev.
sqlite.pragma("journal_mode = WAL");

export const db = sqlite;

/**
 * Uniform raw-SQL entry point used by the routes: pass SQL with ?/?
 * parameters; resolves to row objects (empty for statements that return no
 * data, which better-sqlite3 requires be run() instead of all()).
 */
export function query<T>(sql: string, values: unknown[] = []): T[] {
  const stmt = sqlite.prepare(sql);
  const returnsData = stmt.reader;
  if (!returnsData) {
    stmt.run(...values);
    return [];
  }
  return stmt.all(...values) as T[];
}

/** Last inserted row id (for INSERTs without RETURNING). */
export function lastId(): number {
  const row = sqlite.prepare("SELECT last_insert_rowid() AS id").get() as { id: number };
  return Number(row.id);
}
