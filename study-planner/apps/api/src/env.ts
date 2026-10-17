import { requiredEnv } from './loadEnv.ts'

const corsFromEnv = process.env.CORS_ORIGIN?.split(',').map((item) => item.trim()).filter(Boolean)

export const env = {
  apiHost: process.env.API_HOST?.trim() || '127.0.0.1',
  apiPort: Number(process.env.API_PORT || '8788'),
  databaseUrl: process.env.DATABASE_URL?.trim() || '',
  pgHost: process.env.PGHOST?.trim() || '127.0.0.1',
  pgPort: Number(process.env.PGPORT || '5432'),
  pgUser: process.env.PGUSER?.trim() || '',
  pgPassword: process.env.PGPASSWORD ?? '',
  pgDatabase: process.env.PGDATABASE?.trim() || '',
  jwtAccessSecret: requiredEnv('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: requiredEnv('JWT_REFRESH_SECRET'),
  accessTtlSeconds: Number(process.env.JWT_ACCESS_TTL_SECONDS || '900'),
  refreshTtlSeconds: Number(process.env.JWT_REFRESH_TTL_SECONDS || String(30 * 24 * 60 * 60)),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  corsOrigins: corsFromEnv && corsFromEnv.length > 0
    ? corsFromEnv
    : ['http://localhost:5174', 'http://127.0.0.1:5174'],
}

export function assertDatabaseEnv() {
  if (env.databaseUrl) return
  if (env.pgUser && env.pgDatabase) return
  throw new Error('Missing database settings. Set DATABASE_URL or PGUSER + PGDATABASE in .env.local')
}
