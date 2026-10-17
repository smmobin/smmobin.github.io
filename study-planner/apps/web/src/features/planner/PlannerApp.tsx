import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { BarWeek, Donut, Heatmap, Ring } from '../../Charts'
import { COLORS, loadData, newId, saveData } from '../../storage'
import { saveStudentWorkspace, type CloudIdentity } from '../../cloud'
import type { AppData, Tab } from '../../types'
import {
  DAY_NAMES,
  addDays,
  bySubjectThisWeek,
  formatClock,
  formatJalaliDate,
  formatMinutes,
  heatmapDays,
  jalaliMonthGrid,
  jalaliWeekday,
  minutesOnDate,
  minutesThisWeek,
  startOfWeek,
  subjectOf,
  toISODate,
  weekDates,
} from '../../utils'

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </svg>
  )
}
function IconPlan() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </svg>
  )
}
function IconTimer() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 1.5M9 3h6" />
    </svg>
  )
}
function IconBook() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v18H7.5A2.5 2.5 0 0 0 5 22.5z" />
      <path d="M5 4.5v18" />
    </svg>
  )
}
function IconMore() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
    </svg>
  )
}

export function PlannerApp({
  identity,
  authError,
  onSignOut,
  onJoinAdvisor,
}: {
  identity: CloudIdentity | null
  authError: string
  onSignOut: () => Promise<void>
  onJoinAdvisor: (token: string) => Promise<void>
}) {
  const [data, setData] = useState<AppData>(() => identity?.data ?? loadData())
  const [tab, setTab] = useState<Tab>('home')
  const [toast, setToast] = useState('')
  const sheetRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!identity) {
      saveData(data)
      return
    }
    const timer = window.setTimeout(() => {
      void saveStudentWorkspace(identity.id, data, Boolean(identity.advisorId)).catch((cause: unknown) => {
        setToast(cause instanceof Error ? cause.message : 'ذخیره‌سازی ابری انجام نشد')
      })
    }, 350)
    return () => window.clearTimeout(timer)
  }, [data, identity])

  useEffect(() => {
    sheetRef.current?.scrollTo(0, 0)
  }, [tab])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  const today = toISODate()
  const week = weekDates()
  const todayMin = minutesOnDate(data.sessions, today)
  const weekMin = minutesThisWeek(data.sessions)
  const subjectWeek = bySubjectThisWeek(data)
  const todayTasks = data.tasks.filter((t) => t.dueDate === today || (!t.dueDate && !t.done))

  function patch(partial: Partial<AppData>) {
    setData((d) => ({ ...d, ...partial }))
  }

  return (
    <div className="phone">
      <div className="glow glow-a" />
      <div className="glow glow-b" />

      <header className="top">
        <div>
          <p className="kicker">پلنر درس‌خوانی</p>
          <h1>
            سلام {data.name}
            <span> آماده‌ای؟</span>
          </h1>
        </div>
        <button className="avatar" onClick={() => setTab('more')} aria-label="پروفایل">
          {data.name.slice(0, 1)}
        </button>
      </header>

      <main ref={sheetRef} className="sheet">
        {authError && <p className="auth-error" role="alert">{authError}</p>}
        {tab === 'home' && (
          <Home
            data={data}
            week={week}
            todayMin={todayMin}
            weekMin={weekMin}
            subjectWeek={subjectWeek}
            todayTasks={todayTasks}
            onDone={(id) =>
              patch({
                tasks: data.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
              })
            }
            onQuickLog={(subjectId, minutes) => {
              patch({
                sessions: [
                  ...data.sessions,
                  { id: newId(), subjectId, date: today, minutes },
                ],
              })
              setToast(`${minutes} دقیقه ثبت شد`)
            }}
            goTimer={() => setTab('timer')}
          />
        )}
        {tab === 'plan' && (
          <PlanView
            data={data}
            readOnly={Boolean(identity?.advisorId)}
            onAdd={(block) => patch({ plan: [...data.plan, block] })}
            onRemove={(id) => patch({ plan: data.plan.filter((p) => p.id !== id) })}
            onAddTask={(task) => patch({ tasks: [...data.tasks, task] })}
            onToggleTask={(id) =>
              patch({
                tasks: data.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
              })
            }
            onRemoveTask={(id) => patch({ tasks: data.tasks.filter((t) => t.id !== id) })}
          />
        )}
        {tab === 'timer' && (
          <TimerView
            data={data}
            onUpdateDuration={(mode, minutes) =>
              patch(mode === 'focus' ? { focusMinutes: minutes } : { breakMinutes: minutes })
            }
            onSave={(subjectId, minutes) => {
              if (minutes < 1) return
              patch({
                sessions: [
                  ...data.sessions,
                  { id: newId(), subjectId, date: today, minutes },
                ],
              })
              setToast(`${minutes} دقیقه برای ${subjectOf(data.subjects, subjectId)?.name} ذخیره شد`)
            }}
          />
        )}
        {tab === 'subjects' && (
          <SubjectsView
            data={data}
            readOnly={Boolean(identity?.advisorId)}
            onChange={(subjects) => patch({ subjects })}
            onManual={(session) => {
              patch({ sessions: [...data.sessions, session] })
              setToast('جلسه ذخیره شد')
            }}
          />
        )}
        {tab === 'more' && (
          <MoreView
            data={data}
            onChange={patch}
            onReset={() => {
              const fresh = {
                ...data,
                sessions: [],
                tasks: data.tasks.map((t) => ({ ...t, done: false })),
              }
              setData(fresh)
              setToast('جلسات این دوره پاک شد')
            }}
            onToast={setToast}
            identity={identity}
            onSignOut={onSignOut}
            onJoinAdvisor={onJoinAdvisor}
            onMigrateLocal={() => {
              if (window.confirm('اطلاعات محلی این دستگاه با داده‌های حساب جایگزین شود؟')) {
                setData(loadData())
                setToast('انتقال دادهٔ محلی آغاز شد')
              }
            }}
          />
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}

      <nav className="dock">
        {(
          [
            ['home', 'خانه', <IconHome key="h" />],
            ['plan', 'برنامه', <IconPlan key="p" />],
            ['timer', 'تایمر', <IconTimer key="t" />],
            ['subjects', 'دروس', <IconBook key="s" />],
            ['more', 'بیشتر', <IconMore key="m" />],
          ] as const
        ).map(([id, label, icon]) => (
          <button
            key={id}
            className={tab === id ? 'on' : ''}
            onClick={() => setTab(id)}
          >
            {icon}
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}

function Home({
  data,
  week,
  todayMin,
  weekMin,
  subjectWeek,
  todayTasks,
  onDone,
  onQuickLog,
  goTimer,
}: {
  data: AppData
  week: string[]
  todayMin: number
  weekMin: number
  subjectWeek: ReturnType<typeof bySubjectThisWeek>
  todayTasks: AppData['tasks']
  onDone: (id: string) => void
  onQuickLog: (subjectId: string, minutes: number) => void
  goTimer: () => void
}) {
  const todayDate = toISODate()
  const bars = week.map((d) => minutesOnDate(data.sessions, d))
  const labels = DAY_NAMES.map((n) => n.slice(0, 1))
  const heat = heatmapDays(data.sessions)
  const wd = jalaliWeekday()

  return (
    <>
      <section className="hero-card">
        <div className="hero-stats">
          <div>
            <small className="home-date">{formatJalaliDate(todayDate, { weekday: 'long' })}، {formatJalaliDate(todayDate)}</small>
            <strong>{formatMinutes(todayMin)}</strong>
          </div>
          <div>
            <small>این هفته</small>
            <strong>{formatMinutes(weekMin)}</strong>
          </div>
        </div>
        <button className="cta" onClick={goTimer}>
          شروع جلسه تمرکز
        </button>
      </section>

      <section className="grid-2">
        <Ring value={weekMin} max={data.weeklyGoalMinutes} label="هدف هفتگی" />
        <Ring
          value={todayMin}
          max={Math.max(60, Math.round(data.weeklyGoalMinutes / 7))}
          label="ریتم امروز"
          color="#7c5cff"
        />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>نمودار هفته</h2>
          <span>{DAY_NAMES[wd]}</span>
        </div>
        <BarWeek labels={labels} values={bars} />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>سهم هر درس</h2>
        </div>
        <Donut
          slices={subjectWeek.map((s) => ({
            name: s.name,
            value: s.minutes,
            color: s.color,
          }))}
        />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>نقشه چهار هفته</h2>
        </div>
        <Heatmap days={heat} />
        <p className="caption">از کم‌رنگ تا پررنگ = دقیقه مطالعه‌ی هر روز</p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>ثبت سریع</h2>
        </div>
        <div className="chips">
          {data.subjects.filter((subject) => !subject.archived).map((s) => (
            <button
              key={s.id}
              className="chip"
              style={{ '--c': s.color } as CSSProperties}
              onClick={() => onQuickLog(s.id, 25)}
            >
              +۲۵ {s.name}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>کارهای امروز</h2>
          <span>
            {todayTasks.filter((t) => t.done).length}/{todayTasks.length || 0}
          </span>
        </div>
        {todayTasks.length === 0 ? (
          <p className="empty">برای امروز کاری ثبت نشده. از تب برنامه اضافه کن.</p>
        ) : (
          <ul className="tasks">
            {todayTasks.map((t) => {
              const sub = subjectOf(data.subjects, t.subjectId)
              return (
                <li key={t.id}>
                  <button
                    className={t.done ? 'check on' : 'check'}
                    onClick={() => onDone(t.id)}
                    aria-label="انجام شد"
                  />
                  <div>
                    <p className={t.done ? 'strike' : ''}>{t.title}</p>
                    <small style={{ color: sub?.color }}>{sub?.name}</small>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}

function PlanView({
  data,
  readOnly,
  onAdd,
  onRemove,
  onAddTask,
  onToggleTask,
  onRemoveTask,
}: {
  data: AppData
  readOnly: boolean
  onAdd: (b: AppData['plan'][number]) => void
  onRemove: (id: string) => void
  onAddTask: (t: AppData['tasks'][number]) => void
  onToggleTask: (id: string) => void
  onRemoveTask: (id: string) => void
}) {
  const [view, setView] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [selectedDate, setSelectedDate] = useState(toISODate())
  const [weekOffset, setWeekOffset] = useState(0)
  const [weekDay, setWeekDay] = useState(jalaliWeekday())
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [startTime, setStartTime] = useState('18:00')
  const [endTime, setEndTime] = useState('19:30')
  const dates = Array.from({ length: 7 }, (_, index) =>
    addDays(startOfWeek(), weekOffset * 7 + index),
  )
  const monthStart = toISODate(monthDate)
  const monthGrid = jalaliMonthGrid(monthStart)
  const activeDate = view === 'weekly' ? dates[weekDay] : selectedDate
  const activeDay = jalaliWeekday(new Date(`${activeDate}T12:00:00`))
  const blocks = data.plan
    .filter((block) => block.date === activeDate || (!block.date && block.day === activeDay))
    .sort((a, b) => a.start.localeCompare(b.start))
  const dayTasks = data.tasks.filter((task) => task.dueDate === activeDate)
  const monthLabel = `${monthGrid.month} ${monthGrid.year}`

  function submitBlock(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const subjectId = String(fd.get('subjectId'))
    const start = String(fd.get('start'))
    const end = String(fd.get('end'))
    const title = String(fd.get('title') || subjectOf(data.subjects, subjectId)?.name || 'جلسه')
    onAdd({
      id: newId(),
      day: activeDay,
      ...(view === 'weekly' ? {} : { date: activeDate }),
      start,
      end,
      subjectId,
      title,
    })
    setStartTime('18:00')
    setEndTime('19:30')
    e.currentTarget.reset()
  }

  function submitTask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    onAddTask({
      id: newId(),
      subjectId: String(fd.get('subjectId')),
      title: String(fd.get('title')),
      done: false,
      dueDate: activeDate,
    })
    e.currentTarget.reset()
  }

  return (
    <>
      <div className="plan-tabs" role="tablist" aria-label="نمای برنامه‌ریزی">
        {([['daily', 'روزانه'], ['weekly', 'هفتگی'], ['monthly', 'ماهانه']] as const).map(
          ([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              className={view === id ? 'on' : ''}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ),
        )}
      </div>

      {view === 'daily' && (
        <div className="date-nav">
          <button className="ghost" type="button" aria-label="روز قبل" onClick={() => setSelectedDate((date) => addDays(date, -1))}>‹</button>
          <JalaliDatePicker label="تاریخ برنامه" value={selectedDate} onChange={setSelectedDate} />
          <button className="ghost" type="button" aria-label="روز بعد" onClick={() => setSelectedDate((date) => addDays(date, 1))}>›</button>
        </div>
      )}

      {view === 'weekly' && (
        <>
          <div className="period-nav">
            <button className="ghost" type="button" aria-label="هفته قبل" onClick={() => setWeekOffset((offset) => offset - 1)}>‹</button>
            <span>{formatJalaliDate(dates[0], { month: 'short', day: 'numeric' })} تا {formatJalaliDate(dates[6], { month: 'short', day: 'numeric' })}</span>
            <button className="ghost" type="button" aria-label="هفته بعد" onClick={() => setWeekOffset((offset) => offset + 1)}>›</button>
          </div>
          <div className="days">
            {DAY_NAMES.map((name, index) => (
              <button key={name} className={weekDay === index ? 'on' : ''} onClick={() => setWeekDay(index)}>
                <small>{name}</small>
                <b>{formatJalaliDate(dates[index], { day: 'numeric' })}</b>
              </button>
            ))}
          </div>
        </>
      )}

      {view === 'monthly' && (
        <section className="card month-card">
          <div className="period-nav">
            <button
              className="ghost"
              type="button"
              aria-label="ماه قبل"
              onClick={() => {
                const previousMonth = addDays(monthGrid.firstDate, -1)
                setMonthDate(new Date(`${previousMonth}T12:00:00`))
                setSelectedDate(previousMonth)
              }}
            >‹</button>
            <strong>{monthLabel}</strong>
            <button
              className="ghost"
              type="button"
              aria-label="ماه بعد"
              onClick={() => {
                const nextMonth = addDays(monthGrid.dates[monthGrid.dates.length - 1], 1)
                setMonthDate(new Date(`${nextMonth}T12:00:00`))
                setSelectedDate(nextMonth)
              }}
            >›</button>
          </div>
          <div className="month-grid">
            {DAY_NAMES.map((name) => <span key={name} className="month-weekday">{name.slice(0, 1)}</span>)}
            {Array.from({ length: monthGrid.leadingDays }, (_, index) => <span key={`blank-${index}`} />)}
            {monthGrid.dates.map((date) => {
              const taskCount = data.tasks.filter((task) => task.dueDate === date).length
              const blockCount = data.plan.filter((block) => block.date === date || (!block.date && block.day === jalaliWeekday(new Date(`${date}T12:00:00`)))).length
              return (
                <button
                  key={date}
                  type="button"
                  className={selectedDate === date ? 'selected' : ''}
                  aria-label={`${formatJalaliDate(date)}: ${taskCount} کار، ${blockCount} جلسه`}
                  onClick={() => setSelectedDate(date)}
                >
                  <span>{formatJalaliDate(date, { day: 'numeric' })}</span>
                  {(taskCount > 0 || blockCount > 0) && <i aria-hidden="true" />}
                </button>
              )
            })}
          </div>
          <p className="caption">نقطه نشان‌دهنده‌ی برنامه یا کار ثبت‌شده است.</p>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>جلسه‌های {DAY_NAMES[activeDay]}</h2>
          <span>{formatJalaliDate(activeDate)}</span>
        </div>
        {readOnly && <p className="caption">این برنامه توسط مشاور تعیین شده و قابل ویرایش نیست.</p>}
        {blocks.length === 0 ? (
          <p className="empty">برای این روز بلوکی نیست. پایین فرم را پر کن.</p>
        ) : (
          <ul className="timeline">
            {blocks.map((b) => {
              const sub = subjectOf(data.subjects, b.subjectId)
              return (
                <li key={b.id}>
                  <i style={{ background: sub?.color }} />
                  <div>
                    <strong>{b.title}</strong>
                    <small>
                      {b.start} تا {b.end} · {sub?.name}
                    </small>
                  </div>
                  {!readOnly && <button className="ghost" onClick={() => onRemove(b.id)}>حذف</button>}
                </li>
              )
            })}
          </ul>
        )}
        {!readOnly && <form className="form" onSubmit={submitBlock}>
          <SubjectPicker name="subjectId" subjects={data.subjects.filter((subject) => !subject.archived)} />
          <div className="row">
            <ScheduleTimeField label="شروع" name="start" value={startTime} onChange={setStartTime} />
            <ScheduleTimeField label="پایان" name="end" value={endTime} onChange={setEndTime} />
          </div>
          <input name="title" placeholder="عنوان جلسه (اختیاری)" />
          <button type="submit">{view === 'weekly' ? 'افزودن برنامه هفتگی' : 'افزودن جلسه این روز'}</button>
        </form>}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>کارهای این روز</h2>
          <span>{dayTasks.filter((task) => task.done).length}/{dayTasks.length}</span>
        </div>
        {dayTasks.length === 0 ? (
          <p className="empty">برای این روز کاری ثبت نشده است.</p>
        ) : (
          <ul className="tasks">
          {dayTasks.map((t) => (
            <li key={t.id}>
              <button
                className={t.done ? 'check on' : 'check'}
                onClick={() => onToggleTask(t.id)}
              />
              <p className={t.done ? 'strike' : ''}>{t.title}</p>
              {!readOnly && <button className="ghost" onClick={() => onRemoveTask(t.id)}>حذف</button>}
            </li>
          ))}
          </ul>
        )}
        {!readOnly && <form className="form" onSubmit={submitTask}>
          <SubjectPicker name="subjectId" subjects={data.subjects.filter((subject) => !subject.archived)} />
          <input name="title" placeholder="مثلاً: حل ۲۰ تست" required />
          <button type="submit">افزودن کار</button>
        </form>}
      </section>
    </>
  )
}

function minutesFromClock(value: string) {
  const [hours, minutes] = value.split(':').map((part) => Number(part))
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0)
}

function clockFromMinutes(total: number) {
  const safe = Math.max(0, Math.min(total, 23 * 60 + 59))
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

function subjectPartMinutes(data: AppData, subjectId: string) {
  const blocks = data.plan.filter((block) => block.subjectId === subjectId)
  const today = toISODate()
  const weekday = jalaliWeekday()
  const block = blocks.find((item) => item.date === today || (!item.date && item.day === weekday)) ?? blocks[0]
  if (!block) return Math.max(1, data.focusMinutes)
  const start = minutesFromClock(block.start)
  const end = minutesFromClock(block.end)
  const duration = end >= start ? end - start : end + 24 * 60 - start
  return Math.max(1, duration)
}

function TimerView({
  data,
  onUpdateDuration,
  onSave,
}: {
  data: AppData
  onUpdateDuration: (mode: 'focus' | 'break', minutes: number) => void
  onSave: (subjectId: string, minutes: number) => void
}) {
  const initialSubjectId = data.subjects.find((subject) => !subject.archived)?.id ?? data.subjects[0]?.id ?? ''
  const initialPart = subjectPartMinutes(data, initialSubjectId)
  const [subjectId, setSubjectId] = useState(initialSubjectId)
  const [mode, setMode] = useState<'focus' | 'break'>('focus')
  const [running, setRunning] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [focusDuration, setFocusDuration] = useState(initialPart)
  const [left, setLeft] = useState(initialPart * 60)
  const saveRef = useRef(onSave)
  useEffect(() => {
    saveRef.current = onSave
  }, [onSave])
  const durationMinutes = mode === 'focus' ? focusDuration : data.breakMinutes
  const target = durationMinutes * 60

  useEffect(() => {
    if (!running) return
    const tick = setTimeout(() => {
      if (left <= 1) {
        setRunning(false)
        if (mode === 'focus') {
          saveRef.current(subjectId, focusDuration)
          setMode('break')
          setLeft(data.breakMinutes * 60)
        } else {
          setMode('focus')
          setLeft(focusDuration * 60)
        }
      } else {
        setLeft(left - 1)
      }
    }, 1000)
    return () => clearTimeout(tick)
  }, [running, left, mode, subjectId, focusDuration, data.breakMinutes])

  function chooseSubject(id: string) {
    setSubjectId(id)
    if (running) return
    const minutes = subjectPartMinutes(data, id)
    setFocusDuration(minutes)
    if (mode === 'focus') setLeft(minutes * 60)
  }

  function reset() {
    setRunning(false)
    setLeft(target)
  }

  function updateDuration(minutes: number) {
    const safe = Math.max(1, minutes)
    if (mode === 'focus') setFocusDuration(safe)
    else onUpdateDuration('break', safe)
    setLeft(safe * 60)
  }

  const pct = target > 0 ? 1 - left / target : 0
  const sub = subjectOf(data.subjects, subjectId)
  const timeLabel = formatClock(left)
  const timeFontSize = Math.max(12, Math.min(30, 270 / timeLabel.length))

  return (
    <section className="timer-card">
      <div className="seg timer-modes" role="tablist" aria-label="حالت تایمر">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'focus'}
          className={mode === 'focus' ? 'on' : ''}
          onClick={() => {
            setRunning(false)
            setMode('focus')
            setLeft(focusDuration * 60)
          }}
        >
          تمرکز
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'break'}
          className={mode === 'break' ? 'on' : ''}
          onClick={() => {
            setRunning(false)
            setMode('break')
            setLeft(data.breakMinutes * 60)
          }}
        >
          استراحت
        </button>
      </div>
      <SubjectPicker subjects={data.subjects.filter((subject) => !subject.archived)} value={subjectId} onChange={chooseSubject} />
      <button
        className="timer-ring"
        type="button"
        style={{
          '--p': String(pct),
          '--c': sub?.color ?? '#7c5cff',
          '--time-font-size': `${timeFontSize}px`,
        } as CSSProperties}
        onClick={() => !running && setPickerOpen(true)}
        disabled={running}
        aria-label={`تغییر زمان ${mode === 'focus' ? 'تمرکز' : 'استراحت'}، ${formatClock(left)}`}
        title={running ? 'برای تغییر زمان ابتدا تایمر را متوقف کنید' : 'برای تغییر زمان کلیک کنید'}
      >
        <strong className="timer-time">{timeLabel}</strong>
        <small>{mode === 'focus' ? (sub?.name ?? 'تمرکز') : 'زمان استراحت'}</small>
      </button>
      <div className="timer-actions">
        <button className="cta" onClick={() => setRunning((v) => !v)}>
          {running ? 'توقف' : 'شروع'}
        </button>
        <button className="ghost" onClick={reset}>
          از نو
        </button>
      </div>
      <p className="caption">
        برای تنظیم زمان روی ساعت بزنید. با پایان تمرکز، جلسه ذخیره می‌شود و تایمر به استراحت می‌رود.
      </p>
      {pickerOpen && (
        <ClockTimeDialog
          title={mode === 'focus' ? 'زمان تمرکز' : 'زمان استراحت'}
          value={clockFromMinutes(durationMinutes)}
          onCancel={() => setPickerOpen(false)}
          onSave={(time) => {
            updateDuration(minutesFromClock(time))
            setPickerOpen(false)
          }}
        />
      )}
    </section>
  )
}

function ClockPicker({
  title,
  initialMinutes,
  onCancel,
  onSave,
}: {
  title: string
  initialMinutes: number
  onCancel: () => void
  onSave: (minutes: number) => void
}) {
  const safeInitial = Math.max(1, initialMinutes)
  const [hours, setHours] = useState(Math.floor(safeInitial / 60))
  const [minutes, setMinutes] = useState(safeInitial % 60)
  const [unit, setUnit] = useState<'hours' | 'minutes'>('minutes')
  const lastAngleRef = useRef<number | null>(null)
  const rotationRef = useRef(0)
  const repeatTimeoutRef = useRef<number | null>(null)
  const repeatIntervalRef = useRef<number | null>(null)

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onCancel])

  useEffect(() => () => {
    if (repeatTimeoutRef.current !== null) window.clearTimeout(repeatTimeoutRef.current)
    if (repeatIntervalRef.current !== null) window.clearInterval(repeatIntervalRef.current)
  }, [])

  function angleAtPointer(event: React.PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width) * 240 - 120
    const y = ((event.clientY - bounds.top) / bounds.height) * 240 - 120
    return (Math.atan2(x, -y) + Math.PI * 2) % (Math.PI * 2)
  }

  function pickValue(event: React.PointerEvent<SVGSVGElement>) {
    const angle = angleAtPointer(event)
    setMinutes(Math.round((angle / (Math.PI * 2)) * 60) % 60)
  }

  function adjustHours(amount: number) {
    setHours((value) => Math.max(0, value + amount))
  }

  function stopHourRepeat() {
    if (repeatTimeoutRef.current !== null) window.clearTimeout(repeatTimeoutRef.current)
    if (repeatIntervalRef.current !== null) window.clearInterval(repeatIntervalRef.current)
    repeatTimeoutRef.current = null
    repeatIntervalRef.current = null
  }

  function beginHourAdjust(amount: number, event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    adjustHours(amount)
    stopHourRepeat()
    repeatTimeoutRef.current = window.setTimeout(() => {
      repeatIntervalRef.current = window.setInterval(() => adjustHours(amount), 120)
    }, 400)
  }

  function rotateHourDial(event: React.PointerEvent<SVGSVGElement>) {
    if (unit !== 'hours' || lastAngleRef.current === null) return
    const angle = angleAtPointer(event)
    let delta = angle - lastAngleRef.current
    if (delta > Math.PI) delta -= Math.PI * 2
    if (delta < -Math.PI) delta += Math.PI * 2
    rotationRef.current += delta
    lastAngleRef.current = angle

    const turns = rotationRef.current >= Math.PI * 2
      ? Math.floor(rotationRef.current / (Math.PI * 2))
      : rotationRef.current <= -Math.PI * 2
        ? Math.ceil(rotationRef.current / (Math.PI * 2))
        : 0
    if (turns) {
      adjustHours(turns)
      rotationRef.current -= turns * Math.PI * 2
    }
  }

  const dialValue = unit === 'hours' ? hours % 12 : minutes
  const dialSteps = unit === 'hours' ? 12 : 60
  const angle = (dialValue / dialSteps) * Math.PI * 2
  const handX = 120 + Math.sin(angle) * 78
  const handY = 120 - Math.cos(angle) * 78
  const totalMinutes = hours * 60 + minutes
  const durationLabel = `${hours ? `${hours} ساعت` : ''}${hours && minutes ? ' و ' : ''}${minutes ? `${minutes} دقیقه` : ''}` || 'کمتر از یک دقیقه'

  return (
    <div className="clock-backdrop" onClick={onCancel}>
      <section
        className="clock-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clock-picker-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="card-head">
          <h2 id="clock-picker-title">{title}</h2>
          <button className="ghost" type="button" onClick={onCancel} aria-label="بستن">×</button>
        </div>
        <strong className="clock-value">{durationLabel}</strong>
        <div className="clock-units" role="tablist" aria-label="واحد زمان">
          <button
            type="button"
            role="tab"
            aria-selected={unit === 'hours'}
            className={unit === 'hours' ? 'on' : ''}
            onClick={() => setUnit('hours')}
          >
            ساعت
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={unit === 'minutes'}
            className={unit === 'minutes' ? 'on' : ''}
            onClick={() => setUnit('minutes')}
          >
            دقیقه
          </button>
        </div>
        <svg
          className="clock-dial"
          viewBox="0 0 240 240"
          role="slider"
          aria-label={unit === 'hours' ? 'ساعت' : 'دقیقه'}
          aria-valuemin={unit === 'hours' ? 0 : 0}
          aria-valuenow={unit === 'hours' ? hours : minutes}
          tabIndex={0}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            if (unit === 'hours') {
              lastAngleRef.current = angleAtPointer(event)
              rotationRef.current = 0
            } else {
              pickValue(event)
            }
          }}
          onPointerMove={(event) => {
            if (event.buttons > 0) {
              if (unit === 'hours') rotateHourDial(event)
              else pickValue(event)
            }
          }}
          onPointerUp={() => {
            lastAngleRef.current = null
            rotationRef.current = 0
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
              if (unit === 'hours') adjustHours(1)
              else setMinutes((value) => (value + 1) % 60)
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
              if (unit === 'hours') adjustHours(-1)
              else setMinutes((value) => (value + 59) % 60)
            }
          }}
        >
          <circle cx="120" cy="120" r="103" className="dial-face" />
          {Array.from({ length: 60 }, (_, index) => {
            const tickAngle = (index / 60) * Math.PI * 2
            const major = unit === 'hours' ? index % 12 === 0 : index % 5 === 0
            const inner = major ? 87 : 94
            const x1 = 120 + Math.sin(tickAngle) * inner
            const y1 = 120 - Math.cos(tickAngle) * inner
            const x2 = 120 + Math.sin(tickAngle) * 99
            const y2 = 120 - Math.cos(tickAngle) * 99
            return (
              <line
                key={index}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                className={major ? 'dial-tick major' : 'dial-tick'}
              />
            )
          })}
          {(unit === 'hours' ? [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]).map((value) => {
            const labelAngle = unit === 'hours' ? ((value % 12) / 12) * Math.PI * 2 : (value / 60) * Math.PI * 2
            return (
              <text
                key={value}
                x={120 + Math.sin(labelAngle) * 72}
                y={124 - Math.cos(labelAngle) * 72}
                className={unit === 'hours' ? dialValue === value % 12 ? 'dial-label selected' : 'dial-label' : dialValue === value ? 'dial-label selected' : 'dial-label'}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {unit === 'hours' ? value : String(value).padStart(2, '0')}
              </text>
            )
          })}
          <line x1="120" y1="120" x2={handX} y2={handY} className="dial-hand" />
          <circle cx={handX} cy={handY} r="7" className="dial-knob" />
          <circle cx="120" cy="120" r="5" className="dial-center" />
        </svg>
        {unit === 'hours' && (
          <div className="hour-adjuster" aria-label="تنظیم تعداد ساعت">
            <button
              type="button"
              aria-label="یک ساعت کمتر"
              onPointerDown={(event) => beginHourAdjust(-1, event)}
              onPointerUp={stopHourRepeat}
              onPointerLeave={stopHourRepeat}
              onPointerCancel={stopHourRepeat}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  adjustHours(-1)
                }
              }}
            >
              −
            </button>
            <strong>{hours} ساعت</strong>
            <button
              type="button"
              aria-label="یک ساعت بیشتر"
              onPointerDown={(event) => beginHourAdjust(1, event)}
              onPointerUp={stopHourRepeat}
              onPointerLeave={stopHourRepeat}
              onPointerCancel={stopHourRepeat}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  adjustHours(1)
                }
              }}
            >
              +
            </button>
          </div>
        )}
        <p className="caption">
          {unit === 'hours' ? 'برای هر دور کامل عقربه، یک ساعت اضافه یا کم می‌شود؛ دکمه‌ها را هم می‌توانید نگه دارید.' : 'برای انتخاب دقیقه، عقربه را روی دقیقه دلخواه بکشید.'}
        </p>
        <div className="clock-actions">
          <button className="ghost" type="button" onClick={onCancel}>لغو</button>
          <button className="cta" type="button" onClick={() => onSave(Math.max(1, totalMinutes))}>ذخیره زمان</button>
        </div>
      </section>
    </div>
  )
}

function ClockTimeDialog({
  title,
  value,
  onCancel,
  onSave,
}: {
  title: string
  value: string
  onCancel: () => void
  onSave: (time: string) => void
}) {
  const [valueHour, valueMinute] = value.split(':').map((part) => Number(part))
  const safeValueHour = Number.isFinite(valueHour) ? valueHour : 0
  const safeValueMinute = Number.isFinite(valueMinute) ? valueMinute : 0
  const [unit, setUnit] = useState<'hour' | 'minute'>('hour')
  const [hour, setHour] = useState(safeValueHour)
  const [minute, setMinute] = useState(safeValueMinute)
  const hour12 = hour % 12 || 12
  const period = hour >= 12 ? 'pm' : 'am'
  const formatTime = (hours: number, minutes: number) => new Date(2000, 0, 1, hours, minutes).toLocaleTimeString('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const selectedTime = formatTime(hour, minute)

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onCancel])

  function angleAtPointer(event: React.PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width) * 240 - 120
    const y = ((event.clientY - bounds.top) / bounds.height) * 240 - 120
    return (Math.atan2(x, -y) + Math.PI * 2) % (Math.PI * 2)
  }

  function selectFromDial(event: React.PointerEvent<SVGSVGElement>) {
    const angle = angleAtPointer(event)
    if (unit === 'hour') {
      const hourIndex = Math.round((angle / (Math.PI * 2)) * 12) % 12
      const selectedHour = hourIndex || 12
      setHour((period === 'pm' ? 12 : 0) + (selectedHour % 12))
      setUnit('minute')
    } else {
      setMinute(Math.round((angle / (Math.PI * 2)) * 60) % 60)
    }
  }

  const dialValue = unit === 'hour' ? hour12 % 12 : minute
  const dialAngle = unit === 'hour' ? (dialValue / 12) * Math.PI * 2 : (minute / 60) * Math.PI * 2
  const handX = 120 + Math.sin(dialAngle) * 76
  const handY = 120 - Math.cos(dialAngle) * 76

  return createPortal(
    <div className="clock-backdrop" onClick={onCancel}>
        <section className="clock-dialog schedule-clock-dialog" role="dialog" aria-modal="true" aria-labelledby="schedule-clock-title" onClick={(event) => event.stopPropagation()}>
          <div className="card-head"><h2 id="schedule-clock-title">{title}</h2><button className="ghost" type="button" onClick={onCancel} aria-label="بستن">×</button></div>
          <strong className="clock-value">{selectedTime}</strong>
          <div className="clock-units" role="tablist" aria-label="بخش زمان">
            <button type="button" role="tab" aria-selected={unit === 'hour'} className={unit === 'hour' ? 'on' : ''} onClick={() => setUnit('hour')}>ساعت</button>
            <button type="button" role="tab" aria-selected={unit === 'minute'} className={unit === 'minute' ? 'on' : ''} onClick={() => setUnit('minute')}>دقیقه</button>
          </div>
          {unit === 'hour' && <div className="clock-units period-units" role="group" aria-label="قبل یا بعدازظهر">
            <button type="button" className={period === 'am' ? 'on' : ''} onClick={() => setHour(hour % 12)}>ق.ظ</button>
            <button type="button" className={period === 'pm' ? 'on' : ''} onClick={() => setHour((hour % 12) + 12)}>ب.ظ</button>
          </div>}
          <svg
            className="clock-dial schedule-clock-dial"
            viewBox="0 0 240 240"
            role="slider"
            aria-label={unit === 'hour' ? 'انتخاب ساعت' : 'انتخاب دقیقه'}
            aria-valuemin={unit === 'hour' ? 1 : 0}
            aria-valuemax={unit === 'hour' ? 12 : 59}
            aria-valuenow={unit === 'hour' ? hour12 : minute}
            tabIndex={0}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId)
              selectFromDial(event)
            }}
            onPointerMove={(event) => {
              if (event.buttons > 0 && unit === 'minute') selectFromDial(event)
            }}
            onKeyDown={(event) => {
              if (unit === 'hour' && (event.key === 'ArrowUp' || event.key === 'ArrowRight')) setHour((current) => (current + 1) % 24)
              if (unit === 'hour' && (event.key === 'ArrowDown' || event.key === 'ArrowLeft')) setHour((current) => (current + 23) % 24)
              if (unit === 'minute' && (event.key === 'ArrowUp' || event.key === 'ArrowRight')) setMinute((current) => (current + 1) % 60)
              if (unit === 'minute' && (event.key === 'ArrowDown' || event.key === 'ArrowLeft')) setMinute((current) => (current + 59) % 60)
            }}
          >
            <circle cx="120" cy="120" r="103" className="dial-face" />
            {Array.from({ length: 60 }, (_, index) => {
              const angle = (index / 60) * Math.PI * 2
              const major = index % 5 === 0
              const inner = major ? 87 : 95
              return <line key={index} x1={120 + Math.sin(angle) * inner} y1={120 - Math.cos(angle) * inner} x2={120 + Math.sin(angle) * 99} y2={120 - Math.cos(angle) * 99} className={major ? 'dial-tick major' : 'dial-tick'} />
            })}
            {(unit === 'hour' ? [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]).map((number) => {
              const angle = (number / (unit === 'hour' ? 12 : 60)) * Math.PI * 2
              const selected = unit === 'hour' ? hour12 === number : Math.round(minute / 5) * 5 % 60 === number
              return <text key={number} x={120 + Math.sin(angle) * 72} y={124 - Math.cos(angle) * 72} className={selected ? 'dial-label selected' : 'dial-label'} textAnchor="middle" dominantBaseline="middle">{unit === 'minute' ? String(number).padStart(2, '0') : number}</text>
            })}
            <line x1="120" y1="120" x2={handX} y2={handY} className="dial-hand" />
            <circle cx={handX} cy={handY} r="7" className="dial-knob" />
            <circle cx="120" cy="120" r="5" className="dial-center" />
          </svg>
          <p className="caption">{unit === 'hour' ? 'ساعت و بازهٔ روز را با لمس یا کلیک انتخاب کنید.' : 'برای دقت بیشتر، دقیقه را روی صفحه لمس یا بکشید.'}</p>
          <div className="clock-actions">
            <button className="ghost" type="button" onClick={onCancel}>لغو</button>
            <button className="cta" type="button" onClick={() => onSave(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)}>ثبت ساعت</button>
          </div>
        </section>
    </div>,
    document.body,
  )
}

function ScheduleTimeField({
  label,
  name,
  value,
  onChange,
}: {
  label: string
  name: string
  value: string
  onChange: (time: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [valueHour, valueMinute] = value.split(':').map((part) => Number(part))
  const displayedTime = new Date(
    2000,
    0,
    1,
    Number.isFinite(valueHour) ? valueHour : 0,
    Number.isFinite(valueMinute) ? valueMinute : 0,
  ).toLocaleTimeString('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })

  return (
    <div className="advisor-time-field">
      <span>{label}</span>
      {name && <input type="hidden" name={name} value={value} />}
      <button className="advisor-time-trigger" type="button" onClick={() => setOpen(true)} aria-label={`تنظیم ساعت ${label}: ${displayedTime}`}>
        <strong>{displayedTime}</strong>
        <small>انتخاب با ساعت</small>
      </button>
      {open && (
        <ClockTimeDialog
          title={`ساعت ${label}`}
          value={value}
          onCancel={() => setOpen(false)}
          onSave={(time) => {
            onChange(time)
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}

function DurationField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (minutes: number) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="duration-field">
      <span>{label}</span>
      <button className="duration-trigger" type="button" onClick={() => setOpen(true)}>
        <span>{formatMinutes(value)}</span>
        <span className="duration-trigger-hint">تنظیم با ساعت</span>
      </button>
      {open && (
        <ClockPicker
          title={label}
          initialMinutes={value}
          onCancel={() => setOpen(false)}
          onSave={(minutes) => {
            onChange(minutes)
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}

function JalaliDatePicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (isoDate: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [calendarAnchor, setCalendarAnchor] = useState(value)
  const month = jalaliMonthGrid(calendarAnchor)

  function moveMonth(direction: -1 | 1) {
    const anchor = direction > 0
      ? addDays(month.dates[month.dates.length - 1], 1)
      : addDays(month.firstDate, -1)
    setCalendarAnchor(anchor)
  }

  return (
    <div className="jalali-date-field">
      {label && <span>{label}</span>}
      <button className="duration-trigger jalali-date-trigger" type="button" onClick={() => { setCalendarAnchor(value); setOpen(true) }}>
        <span>{formatJalaliDate(value)}</span>
        <span className="duration-trigger-hint">انتخاب تاریخ</span>
      </button>
      {open && (
        <div className="clock-backdrop" onClick={() => setOpen(false)}>
          <section
            className="clock-dialog jalali-calendar-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="jalali-calendar-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="card-head">
              <h2 id="jalali-calendar-title">{label}</h2>
              <button className="ghost" type="button" onClick={() => setOpen(false)} aria-label="بستن">×</button>
            </div>
            <div className="period-nav calendar-month-nav">
              <button className="ghost" type="button" aria-label="ماه قبل" onClick={() => moveMonth(-1)}>‹</button>
              <strong>{month.month} {month.year}</strong>
              <button className="ghost" type="button" aria-label="ماه بعد" onClick={() => moveMonth(1)}>›</button>
            </div>
            <div className="month-grid jalali-calendar-grid">
              {DAY_NAMES.map((dayName) => <span key={dayName} className="month-weekday">{dayName.slice(0, 1)}</span>)}
              {Array.from({ length: month.leadingDays }, (_, index) => <span key={`blank-${index}`} />)}
              {month.dates.map((date) => (
                <button
                  key={date}
                  type="button"
                  className={value === date ? 'selected' : ''}
                  aria-label={formatJalaliDate(date)}
                  aria-pressed={value === date}
                  onClick={() => {
                    onChange(date)
                    setOpen(false)
                  }}
                >
                  {formatJalaliDate(date, { day: 'numeric' })}
                </button>
              ))}
            </div>
            <div className="clock-actions">
              <button className="ghost" type="button" onClick={() => setOpen(false)}>لغو</button>
              <button className="cta" type="button" onClick={() => { onChange(toISODate()); setOpen(false) }}>امروز</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function SubjectPicker({
  subjects,
  name,
  value,
  onChange,
}: {
  subjects: AppData['subjects']
  name?: string
  value?: string
  onChange?: (id: string) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [internalValue, setInternalValue] = useState(subjects[0]?.id ?? '')
  const selectedId = value ?? internalValue
  const selected = subjects.find((subject) => subject.id === selectedId)

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  function selectSubject(id: string) {
    setInternalValue(id)
    onChange?.(id)
    setOpen(false)
  }

  return (
    <div className="subject-picker" ref={rootRef}>
      {name && <input type="hidden" name={name} value={selectedId} />}
      <button
        className="subject-picker-trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={subjects.length === 0}
        onClick={() => setOpen((current) => !current)}
      >
        {selected ? <i style={{ background: selected.color }} /> : <i />}
        <span>{selected?.name ?? 'ابتدا یک درس اضافه کنید'}</span>
        <b className={open ? 'open' : ''} aria-hidden="true">⌄</b>
      </button>
      {open && (
        <div className="subject-picker-menu" role="listbox" aria-label="انتخاب درس">
          {subjects.map((subject) => (
            <button
              key={subject.id}
              type="button"
              role="option"
              aria-selected={subject.id === selectedId}
              className={subject.id === selectedId ? 'selected' : ''}
              onClick={() => selectSubject(subject.id)}
            >
              <i style={{ background: subject.color }} />
              <span>{subject.name}</span>
              {subject.id === selectedId && <b aria-hidden="true">✓</b>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SubjectsView({
  data,
  readOnly,
  onChange,
  onManual,
}: {
  data: AppData
  readOnly: boolean
  onChange: (s: AppData['subjects']) => void
  onManual: (s: AppData['sessions'][number]) => void
}) {
  const week = bySubjectThisWeek(data)
  const [newSubjectGoal, setNewSubjectGoal] = useState(120)
  const [sessionMinutes, setSessionMinutes] = useState(45)
  const [sessionDate, setSessionDate] = useState(toISODate())
  const [goalPickerSubjectId, setGoalPickerSubjectId] = useState('')

  function addSubject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const name = String(fd.get('name')).trim()
    if (!name) return
    onChange([
      ...data.subjects,
      {
        id: newId(),
        name,
        color: COLORS[data.subjects.length % COLORS.length],
        weeklyGoalMinutes: newSubjectGoal,
      },
    ])
    e.currentTarget.reset()
  }

  function log(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    onManual({
      id: newId(),
      subjectId: String(fd.get('subjectId')),
      date: sessionDate,
      minutes: Number(fd.get('minutes')),
      note: String(fd.get('note') || ''),
    })
    e.currentTarget.reset()
  }

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2>دروس و هدف هفته</h2>
        </div>
        <ul className="subject-list">
          {week.map((s) => {
            const pct = s.weeklyGoalMinutes ? Math.min(1, s.minutes / s.weeklyGoalMinutes) : 0
            return (
              <li key={s.id}>
                <div className="sub-top">
                  <b style={{ color: s.color }}>{s.name}</b>
                  <div className="subject-goal-summary">
                    <span>{formatMinutes(s.minutes)} /</span>
                    {readOnly ? <span>{formatMinutes(s.weeklyGoalMinutes)}</span> : (
                      <button
                        className="goal-edit-button"
                        type="button"
                        onClick={() => setGoalPickerSubjectId(s.id)}
                        aria-label={`تغییر هدف هفتگی ${s.name}`}
                      >
                        {formatMinutes(s.weeklyGoalMinutes)}
                      </button>
                    )}
                  </div>
                </div>
                <div className="bar">
                  <i style={{ width: `${pct * 100}%`, background: s.color }} />
                </div>
                {!readOnly && <button className="ghost tiny" onClick={() => onChange(data.subjects.filter((x) => x.id !== s.id))}>حذف درس</button>}
              </li>
            )
          })}
        </ul>
        {!readOnly && <form className="form compact-subject-form" onSubmit={addSubject}>
          <div className="subject-create-row">
            <label className="field">
              نام درس
              <input name="name" placeholder="مثلاً ریاضی" required />
            </label>
            <DurationField
              label="هدف هفتگی درس"
              value={newSubjectGoal}
              onChange={setNewSubjectGoal}
            />
          </div>
          <input name="goal" type="hidden" value={newSubjectGoal} readOnly />
          <button type="submit">افزودن درس</button>
        </form>}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>ثبت دستی جلسه</h2>
        </div>
        <form className="form manual-session-form" onSubmit={log}>
          <SubjectPicker name="subjectId" subjects={data.subjects.filter((subject) => !subject.archived)} />
          <input name="date" type="hidden" value={sessionDate} readOnly />
          <input name="minutes" type="hidden" value={sessionMinutes} readOnly />
          <JalaliDatePicker label="تاریخ جلسه" value={sessionDate} onChange={setSessionDate} />
          <DurationField label="مدت جلسه" value={sessionMinutes} onChange={setSessionMinutes} />
          <input name="note" placeholder="یادداشت (اختیاری)" />
          <button type="submit">ذخیره جلسه</button>
        </form>
      </section>
      {goalPickerSubjectId && (
        <ClockPicker
          title={`هدف هفتگی ${subjectOf(data.subjects, goalPickerSubjectId)?.name ?? 'درس'}`}
          initialMinutes={subjectOf(data.subjects, goalPickerSubjectId)?.weeklyGoalMinutes ?? 120}
          onCancel={() => setGoalPickerSubjectId('')}
          onSave={(minutes) => {
            onChange(data.subjects.map((subject) =>
              subject.id === goalPickerSubjectId
                ? { ...subject, weeklyGoalMinutes: minutes }
                : subject,
            ))
            setGoalPickerSubjectId('')
          }}
        />
      )}
    </>
  )
}

function MoreView({
  data,
  onChange,
  onReset,
  onToast,
  identity,
  onSignOut,
  onJoinAdvisor,
  onMigrateLocal,
}: {
  data: AppData
  onChange: (p: Partial<AppData>) => void
  onReset: () => void
  onToast: (s: string) => void
  identity: CloudIdentity | null
  onSignOut: () => Promise<void>
  onJoinAdvisor: (token: string) => Promise<void>
  onMigrateLocal: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [weeklyGoalPickerOpen, setWeeklyGoalPickerOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const totalAll = useMemo(
    () => data.sessions.reduce((a, s) => a + s.minutes, 0),
    [data.sessions],
  )

  function exportJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'study-planner.json'
    a.click()
    URL.revokeObjectURL(url)
    onToast('فایل پشتیبان دانلود شد')
  }

  function importJson(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as AppData
        if (parsed.version !== 1 || !parsed.subjects) throw new Error('bad')
        onChange(parsed)
        onToast('اطلاعات بازیابی شد')
      } catch {
        onToast('فایل نامعتبر بود')
      }
    }
    reader.readAsText(file)
  }

  async function submitAdvisorInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setInviteBusy(true)
    try {
      await onJoinAdvisor(inviteCode)
      setInviteCode('')
      onToast('اتصال به مشاور انجام شد')
    } catch (cause) {
      onToast(cause instanceof Error ? cause.message : 'کد دعوت پذیرفته نشد')
    } finally {
      setInviteBusy(false)
    }
  }

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2>پروفایل</h2>
        </div>
        {identity && <p className="caption">حساب ابری · {identity.email} · {identity.advisorId ? `مشاور: ${identity.advisorName ?? 'متصل'}` : 'دانش‌آموز مستقل'}</p>}
        <label className="field">
          اسم نمایشی
          <input
            value={data.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </label>
        <div className="field">
          هدف هفتگی
          {identity?.advisorId ? <div className="duration-trigger"><span>{formatMinutes(data.weeklyGoalMinutes)}</span><span className="duration-trigger-hint">تعیین‌شده توسط مشاور</span></div> : (
            <button className="duration-trigger" type="button" onClick={() => setWeeklyGoalPickerOpen(true)}>
              <span>{formatMinutes(data.weeklyGoalMinutes)}</span>
              <span className="duration-trigger-hint">تنظیم با ساعت</span>
            </button>
          )}
        </div>
        <p className="caption">مجموع کل جلسات ذخیره‌شده: {formatMinutes(totalAll)}</p>
      </section>

      <section className="card">
        <div className="card-head"><h2>{identity ? 'حساب و مشاور' : 'حساب ابری'}</h2></div>
        {identity ? <>
          {identity.advisorId ? (
            <p className="caption">مشاور شما: {identity.advisorName ?? 'متصل'}؛ برنامه و درس‌ها فقط از سمت مشاور ویرایش می‌شوند.</p>
          ) : (
            <form className="form" onSubmit={submitAdvisorInvite}>
              <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} placeholder="کد دعوت مشاور" required />
              <button type="submit" disabled={inviteBusy}>{inviteBusy ? 'در حال اتصال...' : 'اتصال به مشاور'}</button>
            </form>
          )}
          {!identity.advisorId && <button className="ghost" onClick={onMigrateLocal}>انتقال داده‌های مهمان به این حساب</button>}
          <button className="danger" onClick={() => void onSignOut()}>خروج از حساب ابری</button>
        </> : <>
          <p className="caption">شما در حالت مهمان هستید؛ اطلاعات فقط روی همین دستگاه ذخیره می‌شود.</p>
          <button className="cta" onClick={() => void onSignOut()}>ساخت حساب یا ورود به حساب ابری</button>
        </>}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>ذخیره و پشتیبان</h2>
        </div>
        <p className="caption">
          {identity ? 'داده‌های این حساب در فضای ابری ذخیره می‌شوند. برای خروجی گرفتن از اطلاعات، نسخهٔ JSON دریافت کنید.' : 'اطلاعات مهمان فقط روی همین دستگاه در حافظهٔ مرورگر می‌ماند.'}
        </p>
        <div className="stack">
          <button className="cta" onClick={exportJson}>
            دانلود پشتیبان
          </button>
          {!identity?.advisorId && <button className="ghost" onClick={() => fileRef.current?.click()}>بازیابی از فایل</button>}
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importJson(f)
            }}
          />
          {!identity?.advisorId && <button className="danger" onClick={onReset}>پاک کردن جلسات</button>}
        </div>
      </section>
      {weeklyGoalPickerOpen && (
        <ClockPicker
          title="تنظیم هدف هفتگی"
          initialMinutes={data.weeklyGoalMinutes}
          onCancel={() => setWeeklyGoalPickerOpen(false)}
          onSave={(minutes) => {
            onChange({ weeklyGoalMinutes: minutes })
            setWeeklyGoalPickerOpen(false)
          }}
        />
      )}
    </>
  )
}
