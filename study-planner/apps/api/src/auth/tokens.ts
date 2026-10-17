import { createHash, randomBytes } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import type { CookieOptions, Response } from 'express'
import { env } from '../env.ts'

export const REFRESH_COOKIE = 'sp_refresh'
const accessSecret = new TextEncoder().encode(env.jwtAccessSecret)

export type AccessClaims = {
  sub: string
  email: string
  role: 'student' | 'advisor'
}

export async function signAccessToken(claims: AccessClaims) {
  return new SignJWT({ email: claims.email, role: claims.role })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setJti(randomBytes(12).toString('hex'))
    .setIssuedAt()
    .setExpirationTime(`${env.accessTtlSeconds}s`)
    .sign(accessSecret)
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, accessSecret, { algorithms: ['HS256'] })
  const sub = payload.sub
  const email = typeof payload.email === 'string' ? payload.email : ''
  const role = payload.role === 'advisor' ? 'advisor' : payload.role === 'student' ? 'student' : null
  if (!sub || !email || !role) throw new Error('invalid access token')
  return { sub, email, role } satisfies AccessClaims
}

export function createRefreshTokenValue() {
  return randomBytes(32).toString('base64url')
}

export function hashRefreshToken(token: string) {
  return createHash('sha256').update(`${env.jwtRefreshSecret}:${token}`).digest('hex')
}

export function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    path: '/api/auth',
    maxAge: env.refreshTtlSeconds * 1000,
  }
}

export function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions())
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    path: '/api/auth',
  })
}
