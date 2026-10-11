import type { AppData } from './types'

export const STORAGE_KEY = 'study-planner-v1'

const COLORS = ['#7c5cff', '#3ee0b5', '#ff8a5b', '#5bb8ff', '#ff6b9d', '#f5d76e']

function id() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage
  } catch {
    return null
  }
}

function iso(offsetDays = 0) {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

export function defaultData(): AppData {
  const subjects = [
    { id: id(), name: 'ریاضی', color: COLORS[0], weeklyGoalMinutes: 240 },
    { id: id(), name: 'فیزیک', color: COLORS[1], weeklyGoalMinutes: 180 },
    { id: id(), name: 'زبان', color: COLORS[2], weeklyGoalMinutes: 150 },
    { id: id(), name: 'برنامه‌نویسی', color: COLORS[3], weeklyGoalMinutes: 300 },
  ]

  const sessions = [
    { id: id(), subjectId: subjects[0].id, date: iso(-3), minutes: 75 },
    { id: id(), subjectId: subjects[3].id, date: iso(-3), minutes: 90 },
    { id: id(), subjectId: subjects[1].id, date: iso(-2), minutes: 50 },
    { id: id(), subjectId: subjects[2].id, date: iso(-2), minutes: 40 },
    { id: id(), subjectId: subjects[3].id, date: iso(-1), minutes: 120 },
    { id: id(), subjectId: subjects[0].id, date: iso(-1), minutes: 45 },
    { id: id(), subjectId: subjects[0].id, date: iso(0), minutes: 30 },
  ]

  const tasks = [
    { id: id(), subjectId: subjects[0].id, title: 'تمرین فصل مشتق', done: false, dueDate: iso(0) },
    { id: id(), subjectId: subjects[1].id, title: 'مرور قوانین نیوتن', done: true, dueDate: iso(-1) },
    { id: id(), subjectId: subjects[2].id, title: '۱۰ لغت جدید + جمله', done: false, dueDate: iso(0) },
    { id: id(), subjectId: subjects[3].id, title: 'پروژه تمرین React', done: false, dueDate: iso(1) },
  ]

  const plan: AppData['plan'] = [
    { id: id(), day: 6, start: '09:00', end: '10:30', subjectId: subjects[0].id, title: 'ریاضی صبح' },
    { id: id(), day: 6, start: '18:00', end: '20:00', subjectId: subjects[3].id, title: 'کدنویسی' },
    { id: id(), day: 0, start: '17:00', end: '18:30', subjectId: subjects[1].id, title: 'فیزیک' },
    { id: id(), day: 1, start: '19:00', end: '20:00', subjectId: subjects[2].id, title: 'زبان' },
    { id: id(), day: 2, start: '16:00', end: '18:00', subjectId: subjects[3].id, title: 'پروژه' },
    { id: id(), day: 3, start: '18:30', end: '20:00', subjectId: subjects[0].id, title: 'تمرین' },
    { id: id(), day: 4, start: '10:00', end: '11:30', subjectId: subjects[1].id, title: 'آزمایشگاه ذهنی' },
  ]

  return {
    version: 1,
    name: 'دانشجو',
    weeklyGoalMinutes: 870,
    focusMinutes: 25,
    breakMinutes: 5,
    subjects,
    sessions,
    tasks,
    plan,
    advisorNotes: [],
    advisorPlanStatus: 'draft',
  }
}

export function loadData(): AppData {
  const storage = getStorage()
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return defaultData()
    const parsed = JSON.parse(raw) as AppData
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.subjects)) {
      return defaultData()
    }
    return parsed
  } catch {
    return defaultData()
  }
}

export function saveData(data: AppData) {
  const storage = getStorage()
  if (!storage) return
  storage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export { id as newId, COLORS }
