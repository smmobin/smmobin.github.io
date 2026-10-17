export type WorkspaceData = {
  version: 1
  name: string
  weeklyGoalMinutes: number
  focusMinutes: number
  breakMinutes: number
  subjects: unknown[]
  sessions: unknown[]
  tasks: unknown[]
  plan: unknown[]
}

export function emptyWorkspace(displayName: string): WorkspaceData {
  return {
    version: 1,
    name: displayName.trim() || 'دانش‌آموز',
    weeklyGoalMinutes: 480,
    focusMinutes: 25,
    breakMinutes: 5,
    subjects: [],
    sessions: [],
    tasks: [],
    plan: [],
  }
}

export function isWorkspaceData(value: unknown): value is WorkspaceData {
  if (!value || typeof value !== 'object') return false
  const data = value as WorkspaceData
  return data.version === 1
    && typeof data.name === 'string'
    && typeof data.weeklyGoalMinutes === 'number'
    && typeof data.focusMinutes === 'number'
    && typeof data.breakMinutes === 'number'
    && Array.isArray(data.subjects)
    && Array.isArray(data.sessions)
    && Array.isArray(data.tasks)
    && Array.isArray(data.plan)
}
