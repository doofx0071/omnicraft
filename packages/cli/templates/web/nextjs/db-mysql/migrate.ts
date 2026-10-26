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
    "CREATE TABLE IF NOT EXISTS _migrations (name VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  );

  const migrationsDir = new URL("./migrations/", import.meta.url);
  const files = readdirSync(migrationsDir, "utf8")
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const [rows] = await pool.query<mysql.RowDataPacket[]>("SELECT name FROM _migrations");
  const applied = new Set(rows.map((r) => r.name as string));

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(sql);
      await connection.query("INSERT INTO _migrations (name) VALUES (?)", [file]);
      await connection.commit();
      console.log(`✅ applied ${basename(file)}`);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }
}

import type * as mysql from "mysql2/promise";

migrate()
  .then(() => pool.end())
  .catch((err) => {
    console.error("❌ migration failed:", (err as Error).message);
    return pool.end().finally(() => process.exit(1));
  });
