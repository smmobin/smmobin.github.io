export type Subject = {
  id: string
  name: string
  color: string
  weeklyGoalMinutes: number
  archived?: boolean
}

export type Session = {
  id: string
  subjectId: string
  date: string
  minutes: number
  note?: string
}

export type TaskPriority = 'low' | 'normal' | 'high'

export type Task = {
  id: string
  subjectId: string
  title: string
  done: boolean
  dueDate?: string
  priority?: TaskPriority
}

export type PlanBlock = {
  id: string
  day: number
  date?: string
  start: string
  end: string
  subjectId: string
  title: string
}

export type AdvisorNote = {
  id: string
  date: string
  text: string
  createdAt: string
}

export type AdvisorPlanStatus = 'draft' | 'approved' | 'needs_changes'

export type AppData = {
  version: 1
  name: string
  weeklyGoalMinutes: number
  focusMinutes: number
  breakMinutes: number
  subjects: Subject[]
  sessions: Session[]
  tasks: Task[]
  plan: PlanBlock[]
  advisorNotes?: AdvisorNote[]
  advisorPlanStatus?: AdvisorPlanStatus
  advisorPlanApprovedAt?: string
}

export type Tab = 'home' | 'plan' | 'timer' | 'subjects' | 'more'
