import { Pool } from "pg";

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Uniform raw-SQL entry point used by the routes: pass SQL with $1/$2
 * placeholders and values; resolves to row objects. Parameterized queries
 * are the SQL-injection defense — values never concatenate into the text.
 */
export async function query<T>(sql: string, values: unknown[] = []): Promise<T[]> {
  const { rows } = await pool.query<T>(sql, values);
  return rows;
}
