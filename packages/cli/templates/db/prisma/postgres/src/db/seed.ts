import "dotenv/config";
import { db } from "./index.js";

// Idempotent seed: clears and re-inserts the sample rows.
await db.user.deleteMany();
await db.user.createMany({
  data: [
    { name: "Ada Lovelace", email: "ada@example.com" },
    { name: "Grace Hopper", email: "grace@example.com" },
  ],
});

console.log("✅ Database seeded with sample users");
process.exit(0);
