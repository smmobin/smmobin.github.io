import { randomBytes } from 'node:crypto'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

const here = dirname(fileURLToPath(import.meta.url))
export const repoRoot = resolve(here, '../../..')
const envLocalPath = resolve(repoRoot, '.env.local')

function loadEnvFiles() {
  config({ path: resolve(repoRoot, '.env'), quiet: true })
  if (existsSync(envLocalPath)) {
    config({ path: envLocalPath, override: true, quiet: true })
  }
}

function envFileHasKey(contents: string, key: string) {
  return contents.split(/\r?\n/).some((line) => line.startsWith(`${key}=`))
}

function appendMissingSecrets() {
  if (!existsSync(envLocalPath)) return

  const current = readFileSync(envLocalPath, 'utf8')
  const additions: string[] = []

  if (!process.env.JWT_ACCESS_SECRET && !envFileHasKey(current, 'JWT_ACCESS_SECRET')) {
    const value = randomBytes(48).toString('base64url')
    additions.push(`JWT_ACCESS_SECRET=${value}`)
    process.env.JWT_ACCESS_SECRET = value
  }
  if (!process.env.JWT_REFRESH_SECRET && !envFileHasKey(current, 'JWT_REFRESH_SECRET')) {
    const value = randomBytes(48).toString('base64url')
    additions.push(`JWT_REFRESH_SECRET=${value}`)
    process.env.JWT_REFRESH_SECRET = value
  }

  if (additions.length === 0) return
  const prefix = current.endsWith('\n') || current.length === 0 ? '' : '\n'
  appendFileSync(envLocalPath, `${prefix}${additions.join('\n')}\n`, 'utf8')
}

loadEnvFiles()
appendMissingSecrets()
loadEnvFiles()

export function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}
