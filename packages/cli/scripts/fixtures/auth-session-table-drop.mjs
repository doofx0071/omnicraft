import assert from "node:assert/strict";
import { resolve } from "node:path";

const database = process.env.OMNICRAFT_TEST_DATABASE;
const databaseUrl = process.env.DATABASE_URL;

assert(
  database === "sqlite" || database === "postgres",
  `This fixture only drops SQLite or PostgreSQL session tables (received ${database}).`,
);
assert(databaseUrl, "The auth session error fixture DATABASE_URL is missing.");

if (database === "sqlite") {
  const { default: Database } = await import("better-sqlite3");
  const connection = new Database(resolve(databaseUrl.replace(/^file:/, "")));
  try {
    connection.exec('DROP TABLE "session"');
  } finally {
    connection.close();
  }
} else {
  const { Client } = await import("pg");
  const connection = new Client({ connectionString: databaseUrl });
  await connection.connect();
  try {
    await connection.query('DROP TABLE "session"');
  } finally {
    await connection.end();
  }
}

console.log(`Dropped the session table in the disposable ${database} database.`);
