import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { DAY_NAMES, formatJalaliDate, formatMinutes, jalaliWeekday, minutesThisWeek, planStatusLabel, studentPace, subjectOf, toISODate } from './utils'
import { COLORS, newId } from './storage'
import type { AdvisorPlanStatus, AppData } from './types'
import {
  createAdvisorInvite,
  loadAdvisorStudents,
  saveAdvisorGuidance,
  saveAdvisorPlan,
  signOutCloud,
  type AdvisorStudent,
  type CloudIdentity,
} from './cloud'

function advisorTimestamp() {
  return new Date().toISOString()
}

function blockMinutes(block: AppData['plan'][number]) {
  const [startHour, startMinute] = block.start.split(':').map(Number)
  const [endHour, endMinute] = block.end.split(':').map(Number)
  return Math.max(0, endHour * 60 + endMinute - startHour * 60 - startMinute)
}

export function AdvisorDashboard({ identity, onSignedOut }: {
  identity: CloudIdentity
  onSignedOut: () => void
}) {
  const [students, setStudents] = useState<AdvisorStudent[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [invite, setInvite] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:30')
  const [planDay, setPlanDay] = useState(jalaliWeekday())
  const [planSubject, setPlanSubject] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    let active = true
    void loadAdvisorStudents(identity.id)
      .then((roster) => {
        if (!active) return
        setStudents(roster)
        setSelectedId((current) => roster.some((student) => student.id === current) ? current : roster[0]?.id ?? '')
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'دریافت دانش‌آموزان ناموفق بود.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [identity.id])

  const selected = students.find((student) => student.id === selectedId) ?? null
  const weeklyMinutes = selected ? minutesThisWeek(selected.data.sessions) : 0
  const plannedMinutes = selected?.data.plan.reduce((sum, block) => sum + blockMinutes(block), 0) ?? 0

  async function generateInvite() {
    setError('')
    try {
      const token = await createAdvisorInvite(identity.id)
      setInvite(token)
      setNotice('کد دعوت تا ۷ روز معتبر است و یک‌بار استفاده می‌شود.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ساخت دعوت‌نامه ناموفق بود.')
    }
  }

  async function addPlanBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    const form = event.currentTarget
    const subjectName = planSubject.trim()
    const day = planDay
    const start = startTime
    const end = endTime
    if (!subjectName || !start || !end) return
    const startMinute = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5))
    const endMinute = Number(end.slice(0, 2)) * 60 + Number(end.slice(3, 5))
    if (endMinute <= startMinute) {
      setError('زمان پایان باید بعد از زمان شروع باشد.')
      return
    }

    let subject = selected.data.subjects.find((item) => !item.archived && item.name.toLocaleLowerCase() === subjectName.toLocaleLowerCase())
    const subjects = [...selected.data.subjects]
    if (!subject) {
      subject = {
        id: newId(),
        name: subjectName,
        color: COLORS[subjects.length % COLORS.length],
        weeklyGoalMinutes: 120,
      }
      subjects.push(subject)
    }

    const plan = [...selected.data.plan, {
      id: newId(),
      day,
      start,
      end,
      subjectId: subject.id,
      title: subject.name,
    }]
    const totalPlanned = plan.reduce((sum, block) => sum + blockMinutes(block), 0)
    const updated = {
      ...selected.data,
      weeklyGoalMinutes: totalPlanned,
      subjects: subjects.map((item) => item.archived ? item : {
        ...item,
        weeklyGoalMinutes: plan
          .filter((block) => block.subjectId === item.id)
          .reduce((sum, block) => sum + blockMinutes(block), 0),
      }),
      plan,
    }

    setSaving(true)
    setError('')
    try {
      await saveAdvisorPlan(selected.id, updated)
      setStudents((current) => current.map((student) => student.id === selected.id ? { ...student, data: updated } : student))
      form.reset()
      setNotice('برنامهٔ هفتگی برای دانش‌آموز ذخیره شد.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ذخیرهٔ برنامه ناموفق بود.')
    } finally {
      setSaving(false)
    }
  }

  async function archiveSubject(subjectId: string) {
    if (!selected) return
    const subject = selected.data.subjects.find((item) => item.id === subjectId)
    if (!subject || !window.confirm(`«${subject.name}» از درس‌های فعال و برنامه حذف شود؟ سوابق مطالعه حفظ می‌شوند.`)) return

    const plan = selected.data.plan.filter((block) => block.subjectId !== subjectId)
    const subjects = selected.data.subjects.map((item) => item.id === subjectId
      ? { ...item, archived: true, weeklyGoalMinutes: 0 }
      : item.archived ? item : {
        ...item,
        weeklyGoalMinutes: plan.filter((block) => block.subjectId === item.id).reduce((sum, block) => sum + blockMinutes(block), 0),
      })
    const updated = {
      ...selected.data,
      plan,
      subjects,
      weeklyGoalMinutes: plan.reduce((sum, block) => sum + blockMinutes(block), 0),
    }

    setSaving(true)
    setError('')
    try {
      await saveAdvisorPlan(selected.id, updated)
      setStudents((current) => current.map((student) => student.id === selected.id ? { ...student, data: updated } : student))
      if (planSubject === subject.name) setPlanSubject('')
      setNotice(`درس «${subject.name}» از برنامه حذف شد؛ سوابق مطالعه حفظ شدند.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'حذف درس انجام نشد.')
    } finally {
      setSaving(false)
    }
  }

  async function saveGuidance(updated: AppData, success: string) {
    if (!selected) return
    setSaving(true)
    setError('')
    try {
      await saveAdvisorGuidance(selected.id, updated)
      setStudents((current) => current.map((student) => student.id === selected.id ? { ...student, data: updated } : student))
      setNotice(success)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ذخیرهٔ بازخورد انجام نشد.')
    } finally {
      setSaving(false)
    }
  }

  async function addAdvisorNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    const text = note.trim()
    if (!text) return
    const updated = {
      ...selected.data,
      advisorNotes: [...(selected.data.advisorNotes ?? []), {
        id: newId(),
        date: toISODate(),
        text,
        createdAt: advisorTimestamp(),
      }],
    }
    await saveGuidance(updated, 'بازخورد برای دانش‌آموز ذخیره شد.')
    setNote('')
  }

  async function updatePlanStatus(status: AdvisorPlanStatus) {
    if (!selected) return
    const updated = {
      ...selected.data,
      advisorPlanStatus: status,
      advisorPlanApprovedAt: status === 'approved' ? advisorTimestamp() : selected.data.advisorPlanApprovedAt,
    }
    await saveGuidance(updated, status === 'approved' ? 'برنامه تأیید شد.' : 'برنامه برای بازبینی علامت خورد.')
  }

  async function logout() {
    await signOutCloud()
    onSignedOut()
  }

  const subjectTotals = selected?.data.subjects.filter((subject) => !subject.archived).map((subject) => ({
    ...subject,
    planned: selected.data.plan.filter((block) => block.subjectId === subject.id).reduce((sum, block) => sum + blockMinutes(block), 0),
    studied: selected.data.sessions
      .filter((session) => session.subjectId === subject.id)
      .reduce((sum, session) => sum + session.minutes, 0),
  })) ?? []
  return (
    <div className="phone advisor-phone">
      <div className="glow glow-a" />
      <div className="glow glow-b" />
      <header className="top advisor-top">
        <div>
          <p className="kicker">پنل مشاور</p>
          <h1>سلام {identity.displayName}</h1>
        </div>
        <button className="ghost" onClick={logout}>خروج</button>
      </header>
      <main className="sheet advisor-sheet">
        <section className="hero-card">
          <div className="card-head"><h2>دانش‌آموزان من</h2><span>{students.length} نفر</span></div>
          <button className="cta" onClick={() => void generateInvite()}>ساخت کد دعوت دانش‌آموز</button>
          {invite && <div className="invite-code"><small>کد دعوت</small><strong>{invite}</strong><button className="ghost" onClick={() => void navigator.clipboard?.writeText(invite)}>کپی</button></div>}
          {notice && <p className="auth-success">{notice}</p>}
        </section>

        {error && <p className="auth-error" role="alert">{error}</p>}
        {loading ? <section className="card">در حال دریافت فهرست...</section> : students.length === 0 ? (
          <section className="card"><h2>هنوز دانش‌آموزی متصل نیست</h2><p className="caption">کد دعوت بسازید و برای دانش‌آموز بفرستید.</p></section>
        ) : (
          <>
            <section className="advisor-student-list">
              {students.map((student) => (
                <button key={student.id} className={`advisor-student pace-${studentPace(student.data)} ${student.id === selectedId ? 'on' : ''}`} onClick={() => setSelectedId(student.id)}>
                  <span>{student.displayName}</span>
                  <small>{formatMinutes(minutesThisWeek(student.data.sessions))} این هفته · {studentPace(student.data) === 'good' ? 'خوب' : studentPace(student.data) === 'inactive' ? 'بدون فعالیت' : 'نیازمند پیگیری'}</small>
                </button>
              ))}
            </section>

            {selected && <>
              <section className="grid-2 advisor-stats">
                <div className="ring"><strong>{formatMinutes(weeklyMinutes)}</strong><span>مطالعهٔ ثبت‌شده</span></div>
                <div className="ring"><strong>{formatMinutes(plannedMinutes)}</strong><span>برنامهٔ هفتگی</span></div>
              </section>

              <section className="card">
                <div className="card-head"><h2>پیشرفت درس‌ها</h2><span>{selected.displayName}</span></div>
                {subjectTotals.length ? <ul className="subject-list">{subjectTotals.map((subject) => (
                  <li key={subject.id}>
                    <div className="sub-top"><b style={{ color: subject.color }}>{subject.name}</b><span>{formatMinutes(subject.studied)} / {subject.planned ? formatMinutes(subject.planned) : 'بدون برنامه'}</span></div>
                    <div className="bar"><i style={{ width: `${Math.min(100, subject.planned ? subject.studied / subject.planned * 100 : 0)}%`, background: subject.color }} /></div>
                    <button className="ghost tiny advisor-delete-subject" type="button" disabled={saving} onClick={() => void archiveSubject(subject.id)}>حذف درس از برنامه</button>
                  </li>
                ))}</ul> : <p className="empty">هنوز درسی برای این دانش‌آموز برنامه‌ریزی نشده است.</p>}
              </section>

              <section className="card">
                <div className="card-head"><h2>بازخورد و تأیید</h2><span>{planStatusLabel(selected.data.advisorPlanStatus)}</span></div>
                {(selected.data.advisorNotes ?? []).length ? <ul className="timeline">{[...(selected.data.advisorNotes ?? [])].slice(-3).reverse().map((item) => (
                  <li key={item.id}><i /><div><strong>{formatJalaliDate(item.date)}</strong><small>{item.text}</small></div></li>
                ))}</ul> : <p className="empty">هنوز بازخوردی ثبت نشده است.</p>}
                <form className="form advisor-guidance-form" onSubmit={(event) => void addAdvisorNote(event)}>
                  <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="یادداشت برای دانش‌آموز" required />
                  <div className="advisor-guidance-actions">
                    <button type="submit" disabled={saving}>{saving ? 'در حال ذخیره...' : 'ثبت بازخورد'}</button>
                    <button className="cta advisor-approve" type="button" disabled={saving} onClick={() => void updatePlanStatus('approved')}>تأیید برنامه</button>
                  </div>
                  <button className="ghost" type="button" disabled={saving} onClick={() => void updatePlanStatus('needs_changes')}>نیازمند بازبینی</button>
                </form>
              </section>

              <section className="card">
                <div className="card-head"><h2>برنامهٔ هفتگی</h2><span>برای {selected.displayName}</span></div>
                {selected.data.plan.length ? <ul className="timeline">{selected.data.plan.map((block) => (
                  <li key={block.id}><i style={{ background: subjectOf(selected.data.subjects, block.subjectId)?.color }} /><div><strong>{DAY_NAMES[block.day]} · {block.title}</strong><small>{block.start} تا {block.end}</small></div></li>
                ))}</ul> : <p className="empty">برنامه‌ای ثبت نشده است.</p>}
                <form className="form advisor-plan-form" onSubmit={addPlanBlock}>
                  <div className="advisor-plan-meta">
                    <AdvisorSubjectPicker subjects={selected.data.subjects.filter((subject) => !subject.archived)} value={planSubject} onChange={setPlanSubject} />
                    <AdvisorDayPicker value={planDay} onChange={setPlanDay} />
                  </div>
                  <input type="hidden" name="subject" value={planSubject} readOnly />
                  <input type="hidden" name="day" value={planDay} readOnly />
                  <div className="advisor-time-row">
                    <ScheduleTimeField label="شروع" value={startTime} onChange={setStartTime} />
                    <ScheduleTimeField label="پایان" value={endTime} onChange={setEndTime} />
                  </div>
                  <button type="submit" disabled={saving}>{saving ? 'در حال ذخیره...' : 'افزودن جلسه به برنامه'}</button>
                </form>
              </section>
            </>}
          </>
        )}
      </main>
    </div>
  )
}

function AdvisorSubjectPicker({ subjects, value, onChange }: {
  subjects: AppData['subjects']
  value: string
  onChange: (subject: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const options = subjects.filter((subject) => subject.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const selected = subjects.find((subject) => subject.name === value)

  useEffect(() => {
    function closeOnOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  function choose(name: string) {
    onChange(name)
    setQuery('')
    setOpen(false)
  }

  const exactMatch = subjects.some((subject) => subject.name.toLocaleLowerCase() === query.trim().toLocaleLowerCase())

  return (
    <div className="advisor-plan-field advisor-picker-wrap" ref={rootRef}>
      <span>درس</span>
      <button className="advisor-picker-trigger" type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <i style={{ background: selected?.color ?? 'var(--mint)' }} />
        <span>{value || 'انتخاب یا افزودن درس'}</span>
        <b className={open ? 'open' : ''} aria-hidden="true">⌄</b>
      </button>
      {open && <div className="advisor-picker-menu" role="listbox" aria-label="انتخاب درس">
        <label className="advisor-picker-search">
          <span>جستجو یا نام درس جدید</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="مثلاً شیمی" autoComplete="off" />
        </label>
        {options.map((subject) => (
          <button key={subject.id} type="button" role="option" aria-selected={value === subject.name} className={value === subject.name ? 'selected' : ''} onClick={() => choose(subject.name)}>
            <i style={{ background: subject.color }} />
            <span>{subject.name}</span>
            <small>{formatMinutes(subject.weeklyGoalMinutes)} در هفته</small>
            {value === subject.name && <b aria-hidden="true">✓</b>}
          </button>
        ))}
        {query.trim() && !exactMatch && <button className="advisor-new-subject" type="button" onClick={() => choose(query.trim())}>＋ افزودن «{query.trim()}»</button>}
        {!options.length && !query.trim() && <p className="empty advisor-picker-empty">نام درس را جستجو کنید یا بنویسید.</p>}
      </div>}
    </div>
  )
}

function AdvisorDayPicker({ value, onChange }: { value: number; onChange: (day: number) => void }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function closeOnOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  return (
    <div className="advisor-plan-field advisor-picker-wrap" ref={rootRef}>
      <span>روز</span>
      <button className="advisor-picker-trigger advisor-day-trigger" type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <i className="advisor-day-number">{new Intl.NumberFormat('fa-IR').format(value + 1)}</i>
        <span>{DAY_NAMES[value]}</span>
        <b className={open ? 'open' : ''} aria-hidden="true">⌄</b>
      </button>
      {open && <div className="advisor-picker-menu advisor-day-menu" role="listbox" aria-label="انتخاب روز هفته">
        {DAY_NAMES.map((day, index) => (
          <button key={day} type="button" role="option" aria-selected={value === index} className={value === index ? 'selected' : ''} onClick={() => { onChange(index); setOpen(false) }}>
            <i className="advisor-day-number">{index + 1}</i>
            <span>{day}</span>
            {value === index && <b aria-hidden="true">✓</b>}
          </button>
        ))}
      </div>}
    </div>
  )
}

function ScheduleTimeField({ label, value, onChange }: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [unit, setUnit] = useState<'hour' | 'minute'>('hour')
  const [hour, setHour] = useState(9)
  const [minute, setMinute] = useState(0)
  const dialRef = useRef<SVGSVGElement>(null)
  const [valueHour, valueMinute] = value.split(':').map(Number)
  const hour12 = hour % 12 || 12
  const period = hour >= 12 ? 'pm' : 'am'
  const formatTime = (hours: number, minutes: number) => new Date(2000, 0, 1, hours, minutes).toLocaleTimeString('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const displayedTime = formatTime(valueHour, valueMinute)
  const selectedTime = formatTime(hour, minute)

  function openPicker() {
    setHour(valueHour)
    setMinute(valueMinute)
    setUnit('hour')
    setOpen(true)
  }

  function angleAtPointer(event: ReactPointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width) * 240 - 120
    const y = ((event.clientY - bounds.top) / bounds.height) * 240 - 120
    return (Math.atan2(x, -y) + Math.PI * 2) % (Math.PI * 2)
  }

  function selectFromDial(event: ReactPointerEvent<SVGSVGElement>) {
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

  return (
    <div className="advisor-time-field">
      <span>{label}</span>
      <button className="advisor-time-trigger" type="button" onClick={openPicker} aria-label={`تنظیم ساعت ${label}: ${displayedTime}`}>
        <strong>{displayedTime}</strong>
        <small>انتخاب با ساعت</small>
      </button>
      {open && createPortal(<div className="clock-backdrop" onClick={() => setOpen(false)}>
        <section className="clock-dialog schedule-clock-dialog" role="dialog" aria-modal="true" aria-labelledby="schedule-clock-title" onClick={(event) => event.stopPropagation()}>
          <div className="card-head"><h2 id="schedule-clock-title">ساعت {label}</h2><button className="ghost" type="button" onClick={() => setOpen(false)} aria-label="بستن">×</button></div>
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
            ref={dialRef}
            className="clock-dial schedule-clock-dial"
            viewBox="0 0 240 240"
            role="slider"
            aria-label={unit === 'hour' ? 'انتخاب ساعت' : 'انتخاب دقیقه'}
            aria-valuemin={unit === 'hour' ? 1 : 0}
            aria-valuemax={unit === 'hour' ? 12 : 59}
            aria-valuenow={unit === 'hour' ? hour12 : minute}
            tabIndex={0}
            onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); selectFromDial(event) }}
            onPointerMove={(event) => { if (event.buttons > 0 && unit === 'minute') selectFromDial(event) }}
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
          <p className="caption">{unit === 'hour' ? 'ساعت و بازهٔ روز را با لمس انتخاب کنید.' : 'برای دقت بیشتر، دقیقه را روی صفحه لمس یا بکشید.'}</p>
          <div className="clock-actions">
            <button className="ghost" type="button" onClick={() => setOpen(false)}>لغو</button>
            <button className="cta" type="button" onClick={() => { onChange(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`); setOpen(false) }}>ثبت ساعت</button>
          </div>
        </section>
      </div>, document.body)}
    </div>
  )
}
