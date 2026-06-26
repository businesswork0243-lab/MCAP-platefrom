import { Pool } from 'pg'

export let pool: Pool

export function getDB(): Pool {
  if (!pool) throw new Error('Database not connected. Call connectDB() first.')
  return pool
}

export async function connectDB(): Promise<void> {
  pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 20 })
  await pool.query('SELECT 1') // test connection
  console.log('PostgreSQL connected')
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
