import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { closePool, getPool } from './db.ts'
import './loadEnv.ts'

const sqlDir = join(dirname(fileURLToPath(import.meta.url)), '../sql')

export async function migrate() {
  const pool = getPool()
  const files = readdirSync(sqlDir).filter((name) => name.endsWith('.sql')).sort()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  for (const file of files) {
    const applied = await pool.query('SELECT 1 FROM schema_migrations WHERE id = $1', [file])
    if (applied.rowCount) continue
    const sql = readFileSync(join(sqlDir, file), 'utf8')
    await pool.query('BEGIN')
    try {
      await pool.query(sql)
      await pool.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file])
      await pool.query('COMMIT')
      console.log(`Applied migration ${file}`)
    } catch (error) {
      await pool.query('ROLLBACK')
      throw error
    }
  }
}

const isDirectRun = process.argv[1]?.replaceAll('\\', '/').endsWith('/src/migrate.ts')
  || process.argv[1]?.replaceAll('\\', '/').endsWith('/migrate.ts')

if (isDirectRun) {
  migrate()
    .then(async () => {
      await closePool()
      console.log('Migrations complete')
    })
    .catch(async (error: unknown) => {
      console.error(error instanceof Error ? error.message : error)
      await closePool()
      process.exit(1)
    })
}
