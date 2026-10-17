import pg from 'pg'
import { assertDatabaseEnv, env } from './env.ts'

const { Pool } = pg

let pool: pg.Pool | null = null

export function getPool() {
  if (pool) return pool
  assertDatabaseEnv()
  pool = env.databaseUrl
    ? new Pool({ connectionString: env.databaseUrl })
    : new Pool({
      host: env.pgHost,
      port: env.pgPort,
      user: env.pgUser,
      password: env.pgPassword,
      database: env.pgDatabase,
    })
  return pool
}

export async function closePool() {
  if (!pool) return
  await pool.end()
  pool = null
}
