import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { pool } from "./index.js";

/**
 * Minimal SQL-file migration runner.
 *
 * Migrations live in `src/db/migrations/*.sql`, applied in filename order.
 * Applied migrations are tracked in the `_migrations` table. Raw SQL on
 * purpose — this template uses the driver directly, no ORM.
 */
export async function migrate(): Promise<void> {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
  );

  const migrationsDir = new URL("./migrations/", import.meta.url);
  const files = readdirSync(migrationsDir, "utf8")
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const { rows } = await pool.query<{ name: string }>("SELECT name FROM _migrations");
  const applied = new Set(rows.map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`✅ applied ${basename(file)}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}

migrate()
  .then(() => pool.end())
  .catch((err) => {
    console.error("❌ migration failed:", err.message);
    return pool.end().finally(() => process.exit(1));
  });
