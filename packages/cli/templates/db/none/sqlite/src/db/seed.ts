import { db } from "./index.js";

// Idempotent seed: clears and re-inserts the sample rows.
db.prepare("DELETE FROM users").run();
db.prepare("INSERT INTO users (name, email) VALUES (?, ?), (?, ?)").run(
  "Ada Lovelace",
  "ada@example.com",
  "Grace Hopper",
  "grace@example.com",
);

console.log("✅ Database seeded with sample users");
