import type { AdvisorPlanStatus, AppData, PlanBlock, Session, Subject } from './types'

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

export function minutesInRange(sessions: Session[], start: string, end: string) {
  return sessions
    .filter((session) => session.date >= start && session.date <= end)
    .reduce((sum, session) => sum + session.minutes, 0)
}

export function recentPeriod(sessions: Session[], days: number, end = toISODate()) {
  const start = addDays(end, -(days - 1))
  const previousEnd = addDays(start, -1)
  const previousStart = addDays(previousEnd, -(days - 1))
  const values = Array.from({ length: days }, (_, index) => {
    const date = addDays(start, index)
    return { date, minutes: minutesOnDate(sessions, date) }
  })
  const total = values.reduce((sum, day) => sum + day.minutes, 0)
  const best = values.reduce((current, day) => (day.minutes > current.minutes ? day : current), values[0])
  return {
    start,
    end,
    total,
    previous: minutesInRange(sessions, previousStart, previousEnd),
    best,
    values,
  }
}

export function subjectReports(data: AppData, date = new Date()) {
  const dates = new Set(weekDates(date))
  return data.subjects.filter((subject) => !subject.archived).map((subject) => {
    const minutes = data.sessions
      .filter((session) => session.subjectId === subject.id && dates.has(session.date))
      .reduce((sum, session) => sum + session.minutes, 0)
    const openTasks = data.tasks.filter((task) => task.subjectId === subject.id && !task.done).length
    const goal = subject.weeklyGoalMinutes || 0
    return {
      ...subject,
      minutes,
      openTasks,
      progress: goal ? Math.min(1, minutes / goal) : 0,
      gap: Math.max(0, goal - minutes),
    }
  })
}

export function studyScore(data: AppData) {
  const weekMinutes = minutesThisWeek(data.sessions)
  const goalRate = data.weeklyGoalMinutes ? Math.min(1, weekMinutes / data.weeklyGoalMinutes) : 0
  const completedTasks = data.tasks.filter((task) => task.done).length
  const score = Math.round(weekMinutes / 10 + completedTasks * 20 + goalRate * 50)
  const level = score >= 200 ? 4 : score >= 120 ? 3 : score >= 60 ? 2 : 1
  return { score, level, weekMinutes, goalRate, completedTasks }
}

export type RecoverySuggestion = Omit<PlanBlock, 'id' | 'date'> & { date: string; minutes: number }

function clockFromTotalMinutes(total: number) {
  const safe = ((total % (24 * 60)) + 24 * 60) % (24 * 60)
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

export function recoverySuggestions(data: AppData, today = toISODate()): RecoverySuggestion[] {
  const week = weekDates(new Date(`${today}T12:00:00`))
  const todayIndex = Math.max(0, week.indexOf(today))
  const remainingDates = week.slice(todayIndex)
  if (!remainingDates.length) return []

  const behind = subjectReports(data, new Date(`${today}T12:00:00`))
    .filter((subject) => subject.gap >= 30)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 4)
  const suggestions: RecoverySuggestion[] = []

  behind.forEach((subject, subjectIndex) => {
    let gap = subject.gap
    let slot = 0
    while (gap > 0 && slot < 2 && suggestions.length < 6) {
      const date = remainingDates[(subjectIndex + slot) % remainingDates.length]
      const minutes = Math.min(90, gap)
      const startMinute = (16 + ((subjectIndex + slot) % 3) * 2) * 60
      suggestions.push({
        day: jalaliWeekday(new Date(`${date}T12:00:00`)),
        date,
        start: clockFromTotalMinutes(startMinute),
        end: clockFromTotalMinutes(startMinute + minutes),
        subjectId: subject.id,
        title: `جبران ${subject.name}`,
        minutes,
      })
      gap -= minutes
      slot += 1
    }
  })

  return suggestions
}

export type StudentPace = 'good' | 'follow_up' | 'inactive'

export function studentPace(data: AppData): StudentPace {
  const studied = minutesThisWeek(data.sessions)
  if (studied <= 0) return 'inactive'
  const target = data.weeklyGoalMinutes || 1
  return studied / target >= 0.7 ? 'good' : 'follow_up'
}

export function planStatusLabel(status: AdvisorPlanStatus | undefined) {
  if (status === 'approved') return 'تأییدشده توسط مشاور'
  if (status === 'needs_changes') return 'نیازمند بازبینی مشاور'
  return 'پیش‌نویس برنامه'
}
