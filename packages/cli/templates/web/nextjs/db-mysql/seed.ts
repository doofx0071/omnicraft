import { pool } from "./index.js";

// Idempotent seed: clears and re-inserts the sample rows.
await pool.query("DELETE FROM users");
await pool.query("INSERT INTO users (name, email) VALUES (?, ?), (?, ?)", [
  "Ada Lovelace",
  "ada@example.com",
  "Grace Hopper",
  "grace@example.com",
]);

console.log("✅ Database seeded with sample users");
await pool.end();
