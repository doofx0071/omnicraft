import assert from "node:assert/strict";
import { resolve } from "node:path";

const database = process.env.OMNICRAFT_TEST_DATABASE;
const databaseUrl = process.env.DATABASE_URL;

assert(database && databaseUrl, "The auth session error fixture environment is incomplete.");

if (database === "sqlite") {
  const { default: Database } = await import("better-sqlite3");
  const connection = new Database(resolve(databaseUrl.replace(/^file:/, "")));
  try {
    connection.exec('DROP TABLE "session"');
  } finally {
    connection.close();
  }
} else if (database === "postgres") {
  const { Client } = await import("pg");
  const connection = new Client({ connectionString: databaseUrl });
  await connection.connect();
  try {
    await connection.query('DROP TABLE "session"');
  } finally {
    await connection.end();
  }
} else if (database === "mysql") {
  const { createConnection } = await import("mysql2/promise");
  const connection = await createConnection(databaseUrl);
  try {
    await connection.query("DROP TABLE `session`");
  } finally {
    await connection.end();
  }
} else {
  throw new Error(`Unsupported database for the auth session error fixture: ${database}`);
}

console.log("Dropped the session table in the disposable integration database.");
