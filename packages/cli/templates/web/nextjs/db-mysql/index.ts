import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;

// CI/build-time escape hatch: `next build` evaluates route modules, so this
// import-time check would fail a build that runs without real credentials.
// When SKIP_ENV_VALIDATION is "1" or "true", a placeholder URL is used
// instead of throwing. NEVER enable this in production — the placeholder is
// intentionally unusable and real configuration would go unvalidated.
const skipEnvValidation = ["1", "true"].includes(
  (process.env.SKIP_ENV_VALIDATION ?? "").toLowerCase(),
);

if (!databaseUrl && !skipEnvValidation) {
  throw new Error("DATABASE_URL is required — copy .env.example to .env");
}

export const pool = mysql.createPool(
  databaseUrl ?? "mysql://SKIP_ENV_VALIDATION_PLACEHOLDER@localhost:3306/placeholder",
);

/**
 * Uniform raw-SQL entry point used by the routes: pass SQL with ?/? and
 * values; resolves to row objects. mysql2 parameterizes values separately
 * from the SQL text — the SQL-injection defense for raw SQL.
 */
export async function query<T>(sql: string, values: unknown[] = []): Promise<T[]> {
  const [rows] = await pool.query(sql, values);
  return rows as T[];
}
