import mysql from "mysql2/promise";

export const pool = mysql.createPool(process.env.DATABASE_URL);

/**
 * Uniform raw-SQL entry point used by the routes: pass SQL with ?/? and
 * values; resolves to row objects. mysql2 parameterizes values separately
 * from the SQL text — the SQL-injection defense for raw SQL.
 */
export async function query<T>(sql: string, values: unknown[] = []): Promise<T[]> {
  const [rows] = await pool.query(sql, values);
  return rows as T[];
}
