import "dotenv/config";
import { db } from "./index.js";

/**
 * Minimal SQL-file migration runner for SQLite.
 *
 * Migrations live in `src/db/migrations/*.sql`, applied in filename order
 * inside a transaction; applied ones are tracked in `_migrations`.
 * Raw SQL on purpose — this template uses the driver directly, no ORM.
 */
export function migrate(): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  );

  const migrationsDir = new URL("./migrations/", import.meta.url);
  const files: string[] = [];
  for (const entry of readdirSync(migrationsDir)) {
    if (entry.endsWith(".sql")) files.push(entry);
  }

  const applied = new Set(
    (db.prepare("SELECT name FROM _migrations").all() as { name: string }[]).map((r) => r.name),
  );

  const markApplied = db.prepare("INSERT INTO _migrations (name) VALUES (?)");

  for (const file of files.sort()) {
    if (applied.has(file)) continue;
    const sql = readFileSync(new URL(file, migrationsDir), "utf8");
    db.transaction(() => {
      db.exec(sql);
      markApplied.run(file);
    })();
    console.log(`✅ applied ${file}`);
  }
}

import { readFileSync, readdirSync } from "node:fs";

migrate();
