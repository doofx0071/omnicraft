import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema.js";

// DATABASE_URL is a file URL (file:./data/app.db) — make sure the folder
// exists so the first run can create the database file.
const file = resolve(process.env.DATABASE_URL?.replace(/^file:/, "") ?? "data/app.db");
mkdirSync(dirname(file), { recursive: true });

const sqlite = new Database(file);

// WAL mode: safe concurrent reads while writing — good defaults for dev.
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });
