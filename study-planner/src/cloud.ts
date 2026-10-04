import { createClient, type Session } from '@supabase/supabase-js'
import type { AppData } from './types'
import { defaultData } from './storage'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const testServerUrl = import.meta.env.VITE_TEST_SERVER_URL?.replace(/\/$/, '')
const DEMO_TOKEN_KEY = 'study-planner-demo-token'

export const testServerEnabled = Boolean(testServerUrl)
export const accountSignupEnabled = Boolean(supabaseUrl && supabaseAnonKey && !testServerEnabled)
export const cloudEnabled = accountSignupEnabled || testServerEnabled
export const supabase = accountSignupEnabled ? createClient(supabaseUrl, supabaseAnonKey) : null

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

type ProfileRow = {
  id: string
  role: AccountRole
  display_name: string
}

type DemoResponse<T> = T & { error?: string }

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
  const result = await response.json() as DemoResponse<T>
  if (!response.ok) throw new Error(result.error ?? `درخواست ناموفق بود (${response.status}).`)
  return result
}

function emptyWorkspace(displayName: string): AppData {
  const empty = defaultData()
  return {
    ...empty,
    name: displayName || 'دانش‌آموز',
    weeklyGoalMinutes: 480,
    subjects: [],
    sessions: [],
    tasks: [],
    plan: [],
  }
}

function isAppData(value: unknown): value is AppData {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'version' in value &&
    (value as AppData).version === 1 &&
    Array.isArray((value as AppData).subjects) &&
    Array.isArray((value as AppData).sessions) &&
    Array.isArray((value as AppData).tasks) &&
    Array.isArray((value as AppData).plan),
  )
}

export async function loadCloudIdentity(session: Session): Promise<CloudIdentity> {
  if (!supabase) throw new Error('تنظیمات اتصال ابری وارد نشده است.')

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, display_name')
    .eq('id', session.user.id)
    .single()

  if (profileError) throw profileError
  const profile = profileData as ProfileRow
  let advisorId: string | null = null
  let advisorName: string | null = null
  let workspace: AppData | null = null

  if (profile.role === 'student') {
    const [{ data: relationData, error: relationError }, { data: workspaceData, error: workspaceError }] =
      await Promise.all([
        supabase
          .from('advisor_students')
          .select('advisor_id')
          .eq('student_id', profile.id)
          .eq('status', 'active')
          .maybeSingle(),
        supabase
          .from('student_workspaces')
          .select('data')
          .eq('owner_id', profile.id)
          .single(),
      ])

    if (relationError) throw relationError
    if (workspaceError) throw workspaceError
    advisorId = relationData?.advisor_id ?? null
    if (advisorId) {
      const { data: advisorData, error: advisorError } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', advisorId)
        .single()
      if (advisorError) throw advisorError
      advisorName = advisorData.display_name as string
    }
    workspace = isAppData(workspaceData?.data) ? workspaceData.data : emptyWorkspace(profile.display_name)
  }

  return {
    id: profile.id,
    email: session.user.email ?? '',
    displayName: profile.display_name,
    role: profile.role,
    advisorId,
    advisorName,
    data: workspace,
  }
}

export async function loadCurrentIdentity(): Promise<CloudIdentity | null> {
  if (supabase) {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    return data.session ? loadCloudIdentity(data.session) : null
  }
  if (testServerEnabled && demoToken()) {
    const result = await demoRequest<{ identity: CloudIdentity }>('/api/auth/me')
    return result.identity
  }
  return null
}

export async function signInAccount(email: string, password: string) {
  if (supabase) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return
  }
  const result = await demoRequest<{ token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setDemoToken(result.token)
}

export async function signUpStudent(email: string, password: string, displayName: string) {
  if (!supabase) throw new Error('ساخت حساب واقعی با Supabase انجام می‌شود؛ در سرور دمو از حساب‌های نمونه استفاده کنید.')
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName.trim() } },
  })
  if (error) throw error
  return Boolean(data.session)
}

export async function saveStudentWorkspace(ownerId: string, data: AppData, advisorManaged: boolean) {
  if (testServerEnabled) {
    await demoRequest('/api/workspace', { method: 'PUT', body: JSON.stringify({ data }) })
    return
  }
  if (!supabase) throw new Error('تنظیمات اتصال ابری وارد نشده است.')
  if (advisorManaged) {
    const { error } = await supabase.rpc('save_linked_student_progress', { workspace_data: data })
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from('student_workspaces')
    .update({ data, updated_at: new Date().toISOString() })
    .eq('owner_id', ownerId)
  if (error) throw error
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ display_name: data.name })
    .eq('id', ownerId)
  if (profileError) throw profileError
}

export async function saveAdvisorPlan(studentId: string, data: AppData) {
  if (testServerEnabled) {
    await demoRequest(`/api/advisor/students/${encodeURIComponent(studentId)}/plan`, {
      method: 'PUT',
      body: JSON.stringify({ plan: data.plan, subjects: data.subjects, weeklyGoalMinutes: data.weeklyGoalMinutes }),
    })
    return
  }
  if (!supabase) throw new Error('تنظیمات اتصال ابری وارد نشده است.')
  const { error } = await supabase.rpc('save_advisor_plan', {
    student_id: studentId,
    plan_data: data.plan,
    subjects_data: data.subjects,
    weekly_goal_minutes: data.weeklyGoalMinutes,
  })
  if (error) throw error
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
  if (!supabase) throw new Error('تنظیمات اتصال ابری وارد نشده است.')
  const { data: links, error: linksError } = await supabase
    .from('advisor_students')
    .select('student_id')
    .eq('advisor_id', advisorId)
    .eq('status', 'active')
  if (linksError) throw linksError

  const ids = (links ?? []).map((link) => link.student_id as string)
  if (!ids.length) return []

  const [{ data: profiles, error: profilesError }, { data: workspaces, error: workspacesError }] =
    await Promise.all([
      supabase.from('profiles').select('id, display_name').in('id', ids),
      supabase.from('student_workspaces').select('owner_id, data').in('owner_id', ids),
    ])
  if (profilesError) throw profilesError
  if (workspacesError) throw workspacesError

  const workspaceById = new Map((workspaces ?? []).map((row) => [row.owner_id as string, row.data]))
  return (profiles ?? []).map((profile) => {
    const candidate = workspaceById.get(profile.id as string)
    return {
      id: profile.id as string,
      displayName: profile.display_name as string,
      email: '',
      data: isAppData(candidate) ? candidate : emptyWorkspace(String(profile.display_name)),
    }
  })
}

export async function createAdvisorInvite(advisorId: string) {
  if (testServerEnabled) {
    const result = await demoRequest<{ token: string }>('/api/advisor/invites', { method: 'POST' })
    return result.token
  }
  if (!supabase) throw new Error('تنظیمات اتصال ابری وارد نشده است.')
  const token = crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await supabase.from('advisor_invites').insert({
    advisor_id: advisorId,
    token,
    expires_at: expiresAt,
  })
  if (error) throw error
  return token
}

export async function joinAdvisor(token: string) {
  if (testServerEnabled) {
    const result = await demoRequest<{ advisorId: string }>('/api/advisor/join', {
      method: 'POST',
      body: JSON.stringify({ code: token.trim().toUpperCase() }),
    })
    return result.advisorId
  }
  if (!supabase) throw new Error('تنظیمات اتصال ابری وارد نشده است.')
  const { data, error } = await supabase.rpc('claim_advisor_invite', {
    invite_code: token.trim().toUpperCase(),
  })
  if (error) throw error
  return data as string
}

export async function signOutCloud() {
  if (supabase) {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  } else if (testServerEnabled) {
    try {
      await demoRequest('/api/auth/logout', { method: 'POST' })
    } finally {
      setDemoToken(null)
    }
  }
}
