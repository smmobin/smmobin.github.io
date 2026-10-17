import type { Express, Request, Response } from 'express'
import { getPool } from '../db.ts'
import { env } from '../env.ts'
import { HttpError, asyncHandler } from '../http.ts'
import { emptyWorkspace, isWorkspaceData, type WorkspaceData } from '../workspace.ts'
import { hashPassword, isValidEmail, normalizeEmail, verifyPassword } from './password.ts'
import {
  REFRESH_COOKIE,
  clearRefreshCookie,
  createRefreshTokenValue,
  hashRefreshToken,
  setRefreshCookie,
  signAccessToken,
  verifyAccessToken,
  type AccessClaims,
} from './tokens.ts'

type UserRow = {
  id: string
  email: string
  password_hash: string
  display_name: string
  role: 'student' | 'advisor'
}

type Identity = {
  id: string
  email: string
  displayName: string
  role: 'student' | 'advisor'
  advisorId: null
  advisorName: null
  data: WorkspaceData | null
}

function readBearer(req: Request) {
  const header = req.get('authorization') ?? ''
  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

async function requireAccess(req: Request) {
  const token = readBearer(req)
  if (!token) throw new HttpError(401, 'نشست معتبر نیست.')
  try {
    return await verifyAccessToken(token)
  } catch {
    throw new HttpError(401, 'نشست معتبر نیست.')
  }
}

async function loadWorkspace(userId: string, displayName: string) {
  const result = await getPool().query<{ data: unknown }>(
    'SELECT data FROM student_workspaces WHERE owner_id = $1',
    [userId],
  )
  const data = result.rows[0]?.data
  return isWorkspaceData(data) ? data : emptyWorkspace(displayName)
}

async function identityFor(user: Pick<UserRow, 'id' | 'email' | 'display_name' | 'role'>): Promise<Identity> {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
    advisorId: null,
    advisorName: null,
    data: user.role === 'student' ? await loadWorkspace(user.id, user.display_name) : null,
  }
}

async function issueSession(res: Response, claims: AccessClaims, userId: string) {
  const accessToken = await signAccessToken(claims)
  const refreshToken = createRefreshTokenValue()
  const tokenHash = hashRefreshToken(refreshToken)
  const expiresAt = new Date(Date.now() + env.refreshTtlSeconds * 1000)
  await getPool().query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt.toISOString()],
  )
  setRefreshCookie(res, refreshToken)
  return accessToken
}

async function rotateRefresh(res: Response, presentedToken: string) {
  const tokenHash = hashRefreshToken(presentedToken)
  const pool = getPool()
  const found = await pool.query<{
    id: string
    user_id: string
    expires_at: Date
    revoked_at: Date | null
  }>(
    `SELECT id, user_id, expires_at, revoked_at
     FROM refresh_tokens
     WHERE token_hash = $1`,
    [tokenHash],
  )
  const row = found.rows[0]
  if (!row) throw new HttpError(401, 'نشست معتبر نیست.')

  if (row.revoked_at) {
    await pool.query(
      `UPDATE refresh_tokens
       SET revoked_at = COALESCE(revoked_at, now())
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [row.user_id],
    )
    clearRefreshCookie(res)
    throw new HttpError(401, 'نشست باطل شد. دوباره وارد شوید.')
  }

  if (row.expires_at.getTime() <= Date.now()) {
    await pool.query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [row.id])
    clearRefreshCookie(res)
    throw new HttpError(401, 'نشست منقضی شده است. دوباره وارد شوید.')
  }

  const userResult = await pool.query<UserRow>(
    'SELECT id, email, password_hash, display_name, role FROM users WHERE id = $1',
    [row.user_id],
  )
  const user = userResult.rows[0]
  if (!user) throw new HttpError(401, 'نشست معتبر نیست.')

  const nextToken = createRefreshTokenValue()
  const nextHash = hashRefreshToken(nextToken)
  const expiresAt = new Date(Date.now() + env.refreshTtlSeconds * 1000)
  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [user.id, nextHash, expiresAt.toISOString()],
  )
  await pool.query(
    `UPDATE refresh_tokens
     SET revoked_at = now(), replaced_by = $2
     WHERE id = $1`,
    [row.id, inserted.rows[0].id],
  )
  setRefreshCookie(res, nextToken)
  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  })
  return { accessToken, user }
}

export function registerAuthRoutes(app: Express) {
  app.post('/api/auth/signup', asyncHandler(async (req, res) => {
    const email = normalizeEmail(String(req.body?.email ?? ''))
    const password = String(req.body?.password ?? '')
    const displayName = String(req.body?.displayName ?? '').trim()
    if (!isValidEmail(email)) throw new HttpError(400, 'ایمیل نامعتبر است.')
    if (password.length < 8) throw new HttpError(400, 'گذرواژه باید حداقل ۸ نویسه باشد.')
    if (!displayName) throw new HttpError(400, 'نام نمایشی را وارد کنید.')

    const pool = getPool()
    const existing = await pool.query('SELECT 1 FROM users WHERE email = $1', [email])
    if (existing.rowCount) throw new HttpError(409, 'این ایمیل قبلاً ثبت شده است.')

    const passwordHash = await hashPassword(password)
    const created = await pool.query<UserRow>(
      `INSERT INTO users (email, password_hash, display_name, role)
       VALUES ($1, $2, $3, 'student')
       RETURNING id, email, password_hash, display_name, role`,
      [email, passwordHash, displayName],
    )
    const user = created.rows[0]
    const workspace = emptyWorkspace(displayName)
    await pool.query(
      `INSERT INTO student_workspaces (owner_id, data)
       VALUES ($1, $2::jsonb)`,
      [user.id, JSON.stringify(workspace)],
    )
    const accessToken = await issueSession(res, {
      sub: user.id,
      email: user.email,
      role: user.role,
    }, user.id)
    res.status(201).json({
      accessToken,
      identity: await identityFor(user),
    })
  }))

  app.post('/api/auth/login', asyncHandler(async (req, res) => {
    const email = normalizeEmail(String(req.body?.email ?? ''))
    const password = String(req.body?.password ?? '')
    if (!isValidEmail(email) || password.length < 8) {
      throw new HttpError(400, 'ایمیل یا گذرواژه نادرست است.')
    }
    const result = await getPool().query<UserRow>(
      'SELECT id, email, password_hash, display_name, role FROM users WHERE email = $1',
      [email],
    )
    const user = result.rows[0]
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      throw new HttpError(401, 'ایمیل یا گذرواژه نادرست است.')
    }
    const accessToken = await issueSession(res, {
      sub: user.id,
      email: user.email,
      role: user.role,
    }, user.id)
    res.json({
      accessToken,
      identity: await identityFor(user),
    })
  }))

  app.post('/api/auth/refresh', asyncHandler(async (req, res) => {
    const presented = req.cookies?.[REFRESH_COOKIE]
    if (!presented || typeof presented !== 'string') {
      throw new HttpError(401, 'نشست معتبر نیست.')
    }
    const { accessToken } = await rotateRefresh(res, presented)
    res.json({ accessToken })
  }))

  app.post('/api/auth/logout', asyncHandler(async (req, res) => {
    const presented = req.cookies?.[REFRESH_COOKIE]
    if (presented && typeof presented === 'string') {
      await getPool().query(
        `UPDATE refresh_tokens
         SET revoked_at = now()
         WHERE token_hash = $1 AND revoked_at IS NULL`,
        [hashRefreshToken(presented)],
      )
    }
    clearRefreshCookie(res)
    res.json({ ok: true })
  }))

  app.get('/api/auth/me', asyncHandler(async (req, res) => {
    const claims = await requireAccess(req)
    const result = await getPool().query<UserRow>(
      'SELECT id, email, password_hash, display_name, role FROM users WHERE id = $1',
      [claims.sub],
    )
    const user = result.rows[0]
    if (!user) throw new HttpError(401, 'نشست معتبر نیست.')
    res.json({ identity: await identityFor(user) })
  }))

  app.get('/api/workspace', asyncHandler(async (req, res) => {
    const claims = await requireAccess(req)
    if (claims.role !== 'student') throw new HttpError(403, 'فقط دانش‌آموز workspace دارد.')
    const result = await getPool().query<UserRow>(
      'SELECT id, email, password_hash, display_name, role FROM users WHERE id = $1',
      [claims.sub],
    )
    const user = result.rows[0]
    if (!user) throw new HttpError(401, 'نشست معتبر نیست.')
    res.json({ data: await loadWorkspace(user.id, user.display_name) })
  }))

  app.put('/api/workspace', asyncHandler(async (req, res) => {
    const claims = await requireAccess(req)
    if (claims.role !== 'student') throw new HttpError(403, 'فقط دانش‌آموز workspace دارد.')
    const data = req.body?.data
    if (!isWorkspaceData(data)) throw new HttpError(400, 'دادهٔ workspace نامعتبر است.')
    const displayName = data.name.trim() || 'دانش‌آموز'
    const pool = getPool()
    await pool.query(
      `INSERT INTO student_workspaces (owner_id, data, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (owner_id)
       DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [claims.sub, JSON.stringify({ ...data, name: displayName })],
    )
    await pool.query('UPDATE users SET display_name = $2 WHERE id = $1', [claims.sub, displayName])
    res.json({ ok: true })
  }))
}
