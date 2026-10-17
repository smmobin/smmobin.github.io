import type { AppData, Session, Subject } from './types'

export const DAY_NAMES = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']

export function jalaliWeekday(date = new Date()) {
  // JS: 0 Sun ... 6 Sat. Iranian week starts Saturday.
  return (date.getDay() + 1) % 7
}

export function toISODate(date = new Date()) {
  const d = new Date(date)
  d.setHours(12, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

function dateFromISO(iso: string) {
  return new Date(`${iso}T12:00:00`)
}

export function jalaliDateParts(iso: string) {
  const parts = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(dateFromISO(iso))
  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
    day: Number(parts.find((part) => part.type === 'day')?.value),
  }
}

export function formatJalaliDate(iso: string, options: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}) {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', options).format(dateFromISO(iso))
}

export function jalaliMonthGrid(anchorISO: string) {
  const anchorParts = jalaliDateParts(anchorISO)
  let firstDate = anchorISO
  while (true) {
    const previousDate = addDays(firstDate, -1)
    const previousParts = jalaliDateParts(previousDate)
    if (previousParts.year !== anchorParts.year || previousParts.month !== anchorParts.month) break
    firstDate = previousDate
  }

  const dates: string[] = []
  let currentDate = firstDate
  while (true) {
    const currentParts = jalaliDateParts(currentDate)
    if (currentParts.year !== anchorParts.year || currentParts.month !== anchorParts.month) break
    dates.push(currentDate)
    currentDate = addDays(currentDate, 1)
  }

  return {
    firstDate,
    year: new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' }).format(dateFromISO(anchorISO)),
    month: new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'long' }).format(dateFromISO(anchorISO)),
    dates,
    leadingDays: jalaliWeekday(dateFromISO(firstDate)),
  }
}

export function addDays(iso: string, days: number) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

export function startOfWeek(date = new Date()) {
  const wd = jalaliWeekday(date)
  return addDays(toISODate(date), -wd)
}

export function weekDates(date = new Date()) {
  const start = startOfWeek(date)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function formatMinutes(total: number) {
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} دقیقه`
  if (m === 0) return `${h} ساعت`
  return `${h}س ${m}د`
}

export function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function minutesOnDate(sessions: Session[], date: string) {
  return sessions.filter((s) => s.date === date).reduce((a, s) => a + s.minutes, 0)
}

export function minutesThisWeek(sessions: Session[], date = new Date()) {
  const dates = new Set(weekDates(date))
  return sessions.filter((s) => dates.has(s.date)).reduce((a, s) => a + s.minutes, 0)
}

export function bySubjectThisWeek(data: AppData) {
  const dates = new Set(weekDates())
  return data.subjects.filter((sub) => !sub.archived).map((sub) => ({
    ...sub,
    minutes: data.sessions
      .filter((s) => s.subjectId === sub.id && dates.has(s.date))
      .reduce((a, s) => a + s.minutes, 0),
  }))
}

export function streakDays(sessions: Session[]) {
  const set = new Set(sessions.filter((s) => s.minutes > 0).map((s) => s.date))
  let streak = 0
  let cursor = toISODate()
  if (!set.has(cursor)) {
    cursor = addDays(cursor, -1)
  }
  while (set.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function heatmapDays(sessions: Session[], weeks = 4) {
  const today = toISODate()
  const start = addDays(today, -(weeks * 7 - 1))
  const map = new Map<string, number>()
  for (const s of sessions) map.set(s.date, (map.get(s.date) ?? 0) + s.minutes)
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const date = addDays(start, i)
    return { date, minutes: map.get(date) ?? 0 }
  })
}

export function subjectOf(subjects: Subject[], id: string) {
  return subjects.find((s) => s.id === id)
}
