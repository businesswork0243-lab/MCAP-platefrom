import { Pool } from 'pg'
import { runMigrations } from './migrate'

export let pool: Pool

export function getDB(): Pool {
  if (!pool) throw new Error('Database not connected. Call connectDB() first.')
  return pool
}

export async function connectDB(): Promise<void> {
  const isLocal = process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    ssl: isLocal ? false : { rejectUnauthorized: false }
  })
  await pool.query('SELECT 1')
  console.log('PostgreSQL connected')
  await runMigrations(pool)
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await getDB().query(sql, params)
  return result.rows as T[]
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}
