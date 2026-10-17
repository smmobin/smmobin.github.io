import type { AppData } from './types'

const apiBase = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const testServerUrl = import.meta.env.VITE_TEST_SERVER_URL?.replace(/\/$/, '')
const DEMO_TOKEN_KEY = 'study-planner-demo-token'

export const testServerEnabled = Boolean(testServerUrl)
export const accountSignupEnabled = !testServerEnabled
export const cloudEnabled = true

let accessToken: string | null = null

export type AccountRole = 'student' | 'advisor'

export type CloudIdentity = {
  id: string
  email: string
  displayName: string
  role: AccountRole
  advisorId: string | null
  advisorName: string | null
  data: AppData | null
}

type ApiResponse<T> = T & { error?: string }

function demoToken() {
  try {
    return window.localStorage.getItem(DEMO_TOKEN_KEY)
  } catch {
    return null
  }
}

function setDemoToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(DEMO_TOKEN_KEY, token)
    else window.localStorage.removeItem(DEMO_TOKEN_KEY)
  } catch {
    throw new Error('دسترسی به حافظهٔ مرورگر برای نشست آزمایشی ممکن نیست.')
  }
}

function setAccessToken(token: string | null) {
  accessToken = token
}

async function parseError(response: Response) {
  try {
    const result = await response.json() as { error?: string }
    return result.error ?? `درخواست ناموفق بود (${response.status}).`
  } catch {
    return `درخواست ناموفق بود (${response.status}).`
  }
}

async function demoRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!testServerUrl) throw new Error('سرور دمو فعال نیست. با npm run dev:demo اجرا کنید.')
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const token = demoToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`${testServerUrl}${path}`, { ...init, headers })
  } catch {
    throw new Error('سرور دمو در دسترس نیست؛ هر دو سرویس frontend و test API را اجرا کنید.')
  }
  const result = await response.json() as ApiResponse<T>
  if (!response.ok) throw new Error(result.error ?? `درخواست ناموفق بود (${response.status}).`)
  return result
}

async function refreshAccess() {
  let response: Response
  try {
    response = await fetch(`${apiBase}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    throw new Error('API در دسترس نیست. با npm run dev:app هر دو سرویس را اجرا کنید.')
  }
  if (response.status === 401) {
    setAccessToken(null)
    return false
  }
  if (!response.ok) throw new Error(await parseError(response))
  const result = await response.json() as { accessToken?: string }
  if (!result.accessToken) {
    setAccessToken(null)
    return false
  }
  setAccessToken(result.accessToken)
  return true
}

async function apiRequest<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  let response: Response
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    })
  } catch {
    throw new Error('API در دسترس نیست. با npm run dev:app هر دو سرویس را اجرا کنید.')
  }

  if (response.status === 401 && retry && path !== '/api/auth/refresh') {
    const refreshed = await refreshAccess()
    if (refreshed) return apiRequest<T>(path, init, false)
  }

  if (!response.ok) throw new Error(await parseError(response))
  if (response.status === 204) return undefined as T
  return await response.json() as T
}

function advisorNotReady(): never {
  throw new Error('قابلیت مشاور روی API جدید در موج B فعال می‌شود.')
}

export async function loadCurrentIdentity(): Promise<CloudIdentity | null> {
  if (testServerEnabled) {
    if (!demoToken()) return null
    const result = await demoRequest<{ identity: CloudIdentity }>('/api/auth/me')
    return result.identity
  }
  if (!accessToken) {
    const refreshed = await refreshAccess()
    if (!refreshed) return null
  }
  const result = await apiRequest<{ identity: CloudIdentity }>('/api/auth/me')
  return result.identity
}

export async function signInAccount(email: string, password: string) {
  if (testServerEnabled) {
    const result = await demoRequest<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setDemoToken(result.token)
    return
  }
  const result = await apiRequest<{ accessToken: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setAccessToken(result.accessToken)
}

export async function signUpStudent(email: string, password: string, displayName: string) {
  if (testServerEnabled) {
    throw new Error('ساخت حساب واقعی با API انجام می‌شود؛ در سرور دمو از حساب‌های نمونه استفاده کنید.')
  }
  const result = await apiRequest<{ accessToken: string }>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName }),
  })
  setAccessToken(result.accessToken)
  return Boolean(result.accessToken)
}

export async function saveStudentWorkspace(ownerId: string, data: AppData, advisorManaged: boolean) {
  if (testServerEnabled) {
    await demoRequest('/api/workspace', { method: 'PUT', body: JSON.stringify({ data }) })
    return
  }
  if (!ownerId) throw new Error('شناسهٔ کاربر برای ذخیره لازم است.')
  void advisorManaged
  await apiRequest('/api/workspace', { method: 'PUT', body: JSON.stringify({ data }) })
}

export async function saveAdvisorPlan(studentId: string, data: AppData) {
  if (testServerEnabled) {
    await demoRequest(`/api/advisor/students/${encodeURIComponent(studentId)}/plan`, {
      method: 'PUT',
      body: JSON.stringify({ plan: data.plan, subjects: data.subjects, weeklyGoalMinutes: data.weeklyGoalMinutes }),
    })
    return
  }
  advisorNotReady()
}

export type AdvisorStudent = {
  id: string
  displayName: string
  email: string
  data: AppData
}

export async function loadAdvisorStudents(advisorId: string): Promise<AdvisorStudent[]> {
  if (testServerEnabled) {
    const result = await demoRequest<{ students: AdvisorStudent[] }>('/api/advisor/students')
    return result.students
  }
  void advisorId
  advisorNotReady()
}

export async function createAdvisorInvite(advisorId: string) {
  if (testServerEnabled) {
    const result = await demoRequest<{ token: string }>('/api/advisor/invites', { method: 'POST' })
    return result.token
  }
  void advisorId
  advisorNotReady()
}

export async function joinAdvisor(token: string) {
  if (testServerEnabled) {
    const result = await demoRequest<{ advisorId: string }>('/api/advisor/join', {
      method: 'POST',
      body: JSON.stringify({ code: token.trim().toUpperCase() }),
    })
    return result.advisorId
  }
  void token
  advisorNotReady()
}

export async function signOutCloud() {
  if (testServerEnabled) {
    try {
      await demoRequest('/api/auth/logout', { method: 'POST' })
    } finally {
      setDemoToken(null)
    }
    return
  }
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' })
  } finally {
    setAccessToken(null)
  }
}
