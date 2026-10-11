import { createServer } from 'node:http'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dataDirectory = join(root, '.data')
const dataFile = join(dataDirectory, 'test-server.json')
const port = Number(process.env.TEST_SERVER_PORT || 8787)
const today = new Date().toISOString().slice(0, 10)
const day = (new Date().getDay() + 1) % 7
const subjectIds = {
  math: '10000000-0000-4000-8000-000000000001',
  physics: '10000000-0000-4000-8000-000000000002',
  biology: '10000000-0000-4000-8000-000000000003',
}
const profileIds = {
  advisor: '20000000-0000-4000-8000-000000000001',
  linked: '20000000-0000-4000-8000-000000000002',
  independent: '20000000-0000-4000-8000-000000000003',
}

const demoProfiles = [
  { id: profileIds.advisor, display_name: 'مشاور آزمایشی', role: 'advisor', email: 'advisor@demo.test' },
  { id: profileIds.linked, display_name: 'سارا رضایی', role: 'student', email: 'student@demo.test' },
  { id: profileIds.independent, display_name: 'علی محمدی', role: 'student', email: 'solo@demo.test' },
]
const credentials = new Map([
  ['advisor@demo.test', { password: 'advisor123', profileId: profileIds.advisor }],
  ['student@demo.test', { password: 'student123', profileId: profileIds.linked }],
  ['solo@demo.test', { password: 'student123', profileId: profileIds.independent }],
])

function starterWorkspace(name, advised) {
  const subjects = [
    { id: subjectIds.math, name: 'ریاضی', color: '#7c5cff', weeklyGoalMinutes: 240 },
    { id: subjectIds.physics, name: 'فیزیک', color: '#3ee0b5', weeklyGoalMinutes: 180 },
    { id: subjectIds.biology, name: 'زیست‌شناسی', color: '#ff8a5b', weeklyGoalMinutes: 120 },
  ]
  return {
    version: 1,
    name,
    weeklyGoalMinutes: advised ? 540 : 480,
    focusMinutes: 25,
    breakMinutes: 5,
    subjects,
    sessions: [
      { id: randomUUID(), subjectId: subjectIds.math, date: today, minutes: 75, note: 'تمرین مبحث تابع' },
      { id: randomUUID(), subjectId: subjectIds.physics, date: today, minutes: 45 },
      { id: randomUUID(), subjectId: subjectIds.math, date: today, minutes: 60 },
    ],
    tasks: [
      { id: randomUUID(), subjectId: subjectIds.math, title: 'حل تمرین‌های تابع', done: true, dueDate: today },
      { id: randomUUID(), subjectId: subjectIds.physics, title: 'مرور حرکت‌شناسی', done: false, dueDate: today },
      { id: randomUUID(), subjectId: subjectIds.biology, title: 'مرور گفتار دوم', done: false, dueDate: today },
    ],
    plan: advised ? [
      { id: randomUUID(), day, start: '09:00', end: '10:30', subjectId: subjectIds.math, title: 'ریاضی · تابع' },
      { id: randomUUID(), day, start: '11:00', end: '12:00', subjectId: subjectIds.physics, title: 'فیزیک · حرکت' },
      { id: randomUUID(), day: (day + 1) % 7, start: '16:00', end: '17:30', subjectId: subjectIds.biology, title: 'زیست‌شناسی' },
      { id: randomUUID(), day: (day + 2) % 7, start: '18:00', end: '19:00', subjectId: subjectIds.math, title: 'حل تمرین ریاضی' },
    ] : [
      { id: randomUUID(), day, start: '09:00', end: '10:30', subjectId: subjectIds.math, title: 'ریاضی صبح' },
      { id: randomUUID(), day: (day + 1) % 7, start: '17:00', end: '18:00', subjectId: subjectIds.physics, title: 'فیزیک' },
    ],
  }
}

function seedState() {
  return {
    profiles: demoProfiles,
    workspaces: {
      [profileIds.linked]: starterWorkspace('سارا رضایی', true),
      [profileIds.independent]: starterWorkspace('علی محمدی', false),
    },
    relations: [{ advisorId: profileIds.advisor, studentId: profileIds.linked, status: 'active' }],
    invites: [],
  }
}

await mkdir(dataDirectory, { recursive: true })
let state = seedState()
try {
  const stored = JSON.parse(await readFile(dataFile, 'utf8'))
  state = {
    ...state,
    ...stored,
    profiles: [...demoProfiles.map((seed) => stored.profiles?.find((item) => item.id === seed.id) ?? seed)],
    workspaces: { ...seedState().workspaces, ...stored.workspaces },
  }
} catch {
  // A new demo database starts from the sample accounts above.
}

const sessions = new Map()
const invites = new Map((state.invites ?? []).map((invite) => [invite.token, invite]))
for (const account of state.accounts ?? []) {
  credentials.set(account.email, { password: account.password, profileId: account.profileId })
}
let writeQueue = Promise.resolve()

function persist() {
  const snapshot = JSON.stringify({ ...state, invites: [...invites.values()] }, null, 2)
  writeQueue = writeQueue.then(async () => {
    const temporary = `${dataFile}.tmp`
    await writeFile(temporary, snapshot, 'utf8')
    await rename(temporary, dataFile)
  })
  return writeQueue
}

function send(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  })
  response.end(JSON.stringify(payload))
}

async function readJson(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 1_000_000) throw new Error('حجم درخواست بیش از حد مجاز است.')
  }
  return body ? JSON.parse(body) : {}
}

function requireUser(request, response) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
  const profileId = token ? sessions.get(token) : null
  const profile = state.profiles.find((candidate) => candidate.id === profileId)
  if (!profile) {
    send(response, 401, { error: 'برای ادامه وارد حساب آزمایشی شوید.' })
    return null
  }
  return profile
}

function identityFor(profile) {
  const relation = state.relations.find((item) => item.studentId === profile.id && item.status === 'active')
  const advisor = relation ? state.profiles.find((item) => item.id === relation.advisorId) : null
  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.display_name,
    role: profile.role,
    advisorId: advisor?.id ?? null,
    advisorName: advisor?.display_name ?? null,
    data: profile.role === 'student' ? state.workspaces[profile.id] : null,
  }
}

function minutesForWeek(workspace) {
  const dates = new Set(Array.from({ length: 7 }, (_, offset) => {
    const date = new Date()
    date.setDate(date.getDate() - ((date.getDay() + 1) % 7) + offset)
    return date.toISOString().slice(0, 10)
  }))
  return workspace.sessions.filter((session) => dates.has(session.date)).reduce((sum, session) => sum + session.minutes, 0)
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    })
    response.end()
    return
  }

  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
  try {
    if (request.method === 'GET' && url.pathname === '/api/health') {
      send(response, 200, { ok: true, mode: 'local-test-only' })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/login') {
      const body = await readJson(request)
      const email = String(body.email ?? '').trim().toLowerCase()
      const credential = credentials.get(email)
      if (!credential || credential.password !== body.password) {
        send(response, 401, { error: 'ایمیل یا گذرواژهٔ آزمایشی نادرست است.' })
        return
      }
      const token = randomBytes(32).toString('hex')
      sessions.set(token, credential.profileId)
      const profile = state.profiles.find((item) => item.id === credential.profileId)
      send(response, 200, { token, identity: identityFor(profile) })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
      const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
      if (token) sessions.delete(token)
      send(response, 200, { ok: true })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/signup') {
      const body = await readJson(request)
      const email = String(body.email ?? '').trim().toLowerCase()
      const password = String(body.password ?? '')
      const displayName = String(body.displayName ?? '').trim()
      const code = String(body.inviteCode ?? '').trim().toUpperCase()
      if (!displayName || !email || password.length < 8 || !code) {
        send(response, 400, { error: 'برای ساخت حساب، کد دعوت، نام، ایمیل و گذرواژهٔ حداقل ۸ نویسه‌ای لازم است.' })
        return
      }
      if (credentials.has(email)) {
        send(response, 409, { error: 'این ایمیل قبلاً ثبت شده است. از ورود استفاده کنید.' })
        return
      }
      const invite = invites.get(code)
      if (!invite || invite.redeemed || invite.expiresAt <= Date.now()) {
        send(response, 400, { error: 'کد دعوت نامعتبر، منقضی یا استفاده‌شده است.' })
        return
      }
      const profile = { id: randomUUID(), display_name: displayName, role: 'student', email }
      state.profiles.push(profile)
      state.workspaces[profile.id] = {
        version: 1,
        name: displayName,
        weeklyGoalMinutes: 480,
        focusMinutes: 25,
        breakMinutes: 5,
        subjects: [],
        sessions: [],
        tasks: [],
        plan: [],
        advisorNotes: [],
        advisorPlanStatus: 'draft',
      }
      state.accounts = [...(state.accounts ?? []), { email, password, profileId: profile.id }]
      credentials.set(email, { password, profileId: profile.id })
      invite.redeemed = true
      state.relations.push({ advisorId: invite.advisorId, studentId: profile.id, status: 'active' })
      await persist()
      const token = randomBytes(32).toString('hex')
      sessions.set(token, profile.id)
      send(response, 200, { token, identity: identityFor(profile) })
      return
    }

    const profile = requireUser(request, response)
    if (!profile) return

    if (request.method === 'GET' && url.pathname === '/api/auth/me') {
      send(response, 200, { identity: identityFor(profile) })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/advisor/students') {
      if (profile.role !== 'advisor') {
        send(response, 403, { error: 'این بخش مخصوص مشاور است.' })
        return
      }
      const students = state.relations
        .filter((relation) => relation.advisorId === profile.id && relation.status === 'active')
        .map((relation) => state.profiles.find((item) => item.id === relation.studentId))
        .filter(Boolean)
        .map((student) => ({
          id: student.id,
          displayName: student.display_name,
          email: student.email,
          data: state.workspaces[student.id],
          minutesThisWeek: minutesForWeek(state.workspaces[student.id]),
        }))
      send(response, 200, { students })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/advisor/invites') {
      if (profile.role !== 'advisor') {
        send(response, 403, { error: 'فقط مشاور می‌تواند دعوت‌نامه بسازد.' })
        return
      }
      const token = randomBytes(5).toString('hex').toUpperCase()
      invites.set(token, { token, advisorId: profile.id, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, redeemed: false })
      await persist()
      send(response, 200, { token })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/advisor/join') {
      if (profile.role !== 'student') {
        send(response, 403, { error: 'فقط دانش‌آموز می‌تواند به مشاور متصل شود.' })
        return
      }
      if (state.relations.some((relation) => relation.studentId === profile.id && relation.status === 'active')) {
        send(response, 409, { error: 'این دانش‌آموز از قبل مشاور دارد.' })
        return
      }
      const body = await readJson(request)
      const invite = invites.get(String(body.code ?? '').trim().toUpperCase())
      if (!invite || invite.redeemed || invite.expiresAt <= Date.now()) {
        send(response, 400, { error: 'کد دعوت نامعتبر، منقضی یا استفاده‌شده است.' })
        return
      }
      invite.redeemed = true
      state.relations.push({ advisorId: invite.advisorId, studentId: profile.id, status: 'active' })
      await persist()
      send(response, 200, { advisorId: invite.advisorId })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/workspace') {
      if (profile.role !== 'student') {
        send(response, 403, { error: 'این حساب workspace دانش‌آموزی ندارد.' })
        return
      }
      send(response, 200, { data: state.workspaces[profile.id] })
      return
    }

    if (request.method === 'PUT' && url.pathname === '/api/workspace') {
      if (profile.role !== 'student') {
        send(response, 403, { error: 'فقط دانش‌آموز می‌تواند عملکردش را ثبت کند.' })
        return
      }
      const body = await readJson(request)
      const submitted = body.data
      if (!submitted || submitted.version !== 1) {
        send(response, 400, { error: 'ساختار workspace نامعتبر است.' })
        return
      }
      const current = state.workspaces[profile.id]
      const linked = state.relations.some((relation) => relation.studentId === profile.id && relation.status === 'active')
      if (linked) {
        const submittedTasks = new Map((submitted.tasks ?? []).map((task) => [task.id, Boolean(task.done)]))
        current.name = String(submitted.name ?? current.name)
        current.focusMinutes = Number(submitted.focusMinutes ?? current.focusMinutes)
        current.breakMinutes = Number(submitted.breakMinutes ?? current.breakMinutes)
        current.sessions = Array.isArray(submitted.sessions) ? submitted.sessions : current.sessions
        current.tasks = current.tasks.map((task) => ({ ...task, done: submittedTasks.get(task.id) ?? task.done }))
      } else {
        state.workspaces[profile.id] = submitted
      }
      profile.display_name = String(submitted.name ?? profile.display_name)
      await persist()
      send(response, 200, { ok: true })
      return
    }

    const planMatch = url.pathname.match(/^\/api\/advisor\/students\/([^/]+)\/plan$/)
    if (request.method === 'PUT' && planMatch) {
      const studentId = planMatch[1]
      const relation = state.relations.some((item) => item.advisorId === profile.id && item.studentId === studentId && item.status === 'active')
      if (profile.role !== 'advisor' || !relation) {
        send(response, 403, { error: 'مشاور به این دانش‌آموز دسترسی ندارد.' })
        return
      }
      const body = await readJson(request)
      if (!Array.isArray(body.plan) || !Array.isArray(body.subjects)) {
        send(response, 400, { error: 'برنامه یا فهرست درس‌ها نامعتبر است.' })
        return
      }
      state.workspaces[studentId].plan = body.plan
      state.workspaces[studentId].subjects = body.subjects
      state.workspaces[studentId].weeklyGoalMinutes = Number(body.weeklyGoalMinutes) || 0
      await persist()
      send(response, 200, { ok: true })
      return
    }

    const guidanceMatch = url.pathname.match(/^\/api\/advisor\/students\/([^/]+)\/guidance$/)
    if (request.method === 'PUT' && guidanceMatch) {
      const studentId = guidanceMatch[1]
      const relation = state.relations.some((item) => item.advisorId === profile.id && item.studentId === studentId && item.status === 'active')
      if (profile.role !== 'advisor' || !relation) {
        send(response, 403, { error: 'مشاور به این دانش‌آموز دسترسی ندارد.' })
        return
      }
      const body = await readJson(request)
      const allowed = new Set(['draft', 'approved', 'needs_changes'])
      if (!Array.isArray(body.advisorNotes) || !allowed.has(body.advisorPlanStatus)) {
        send(response, 400, { error: 'بازخورد یا وضعیت برنامه نامعتبر است.' })
        return
      }
      state.workspaces[studentId].advisorNotes = body.advisorNotes
      state.workspaces[studentId].advisorPlanStatus = body.advisorPlanStatus
      state.workspaces[studentId].advisorPlanApprovedAt = body.advisorPlanApprovedAt ?? null
      await persist()
      send(response, 200, { ok: true })
      return
    }

    send(response, 404, { error: 'مسیر API پیدا نشد.' })
  } catch (error) {
    console.error(error)
    send(response, 500, { error: error instanceof Error ? error.message : 'خطای سرور آزمایشی.' })
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Local test API listening at http://localhost:${port}`)
  console.log('Demo users: advisor@demo.test / advisor123, student@demo.test / student123, solo@demo.test / student123')
  console.log('TEST ONLY: passwords are static; this server is not for production or network exposure.')
})
