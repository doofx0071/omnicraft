import "dotenv/config";
import { db } from "./index.js";
import { users } from "./schema.js";

// Idempotent seed: clears and re-inserts the sample rows.
await db.delete(users);
await db.insert(users).values([
  { name: "Ada Lovelace", email: "ada@example.com" },
  { name: "Grace Hopper", email: "grace@example.com" },
]);

console.log("✅ Database seeded with sample users");
process.exit(0);
