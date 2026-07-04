import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'

export async function runMigrations(pool: Pool): Promise<void> {
  // Track applied migrations
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         SERIAL PRIMARY KEY,
      filename   VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Pre-seed migrations tracker if tables already exist to prevent duplicate execution errors
  const tableCheck = async (tableName: string): Promise<boolean> => {
    const { rows } = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      )`,
      [tableName]
    )
    return rows[0]?.exists === true
  }

  const columnCheck = async (tableName: string, columnName: string): Promise<boolean> => {
    const { rows } = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
      )`,
      [tableName, columnName]
    )
    return rows[0]?.exists === true
  }

  if (await tableCheck('users')) {
    await pool.query(
      'INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
      ['001_initial_schema.sql']
    )
  }
  if (await tableCheck('campaigns')) {
    await pool.query(
      'INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
      ['002_workspace_hierarchy.sql']
    )
  }
  if (await tableCheck('icp_profiles')) {
    await pool.query(
      'INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
      ['003_feature_upgrade.sql']
    )
  }
  if (await columnCheck('users', 'password_hash')) {
    await pool.query(
      'INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
      ['004_auth_fixes.sql']
    )
  }

  // Find migrations folder — try multiple paths
  const possiblePaths = [
    path.join(process.cwd(), 'migrations'),
    path.join(process.cwd(), '..', 'migrations'),
    path.join(__dirname, '..', '..', '..', 'migrations'),
    path.join(process.cwd(), '..', '..', 'migrations'),
  ]

  let migrationsDir: string | null = null
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      migrationsDir = p
      break
    }
  }

  if (!migrationsDir) {
    console.warn('No migrations directory found — skipping')
    return
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const { rows } = await pool.query(
      'SELECT id FROM _migrations WHERE filename = $1',
      [file]
    )
    if (rows.length > 0) continue

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query(
        'INSERT INTO _migrations (filename) VALUES ($1)',
        [file]
      )
      await client.query('COMMIT')
      console.log(`✅ Migration: ${file}`)
    } catch (err) {
      await client.query('ROLLBACK')
      console.error(`❌ Migration failed: ${file}:`, err)
      throw err
    } finally {
      client.release()
    }
  }
}
