// ============================================================
// Database Connection & Query Helpers
// Replace `db` with your actual database driver (Prisma, Drizzle,
// pg, mysql2, etc.). This file demonstrates raw SQL patterns.
// ============================================================

// Placeholder DB client — swap with your real ORM/driver
// import { Pool } from "pg";
// const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Execute a query and return all rows.
 * Replace this with your actual DB client.
 */
export async function dbQuery<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  // TODO: Replace with real DB call
  // const result = await pool.query(sql, params);
  // return result.rows as T[];
  console.log("[DB QUERY]", sql, params);
  return [] as T[];
}

/**
 * Execute a query and return a single row.
 */
export async function dbQueryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await dbQuery<T>(sql, params);
  return rows[0] ?? null;
}

/**
 * Execute a write query (INSERT, UPDATE, DELETE).
 */
export async function dbExecute(
  sql: string,
  params?: unknown[]
): Promise<{ rowCount: number }> {
  // TODO: Replace with real DB call
  // const result = await pool.query(sql, params);
  // return { rowCount: result.rowCount ?? 0 };
  console.log("[DB EXECUTE]", sql, params);
  return { rowCount: 0 };
}
