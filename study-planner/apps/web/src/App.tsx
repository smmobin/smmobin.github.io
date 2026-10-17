import { useEffect, useState } from 'react'
import { AdvisorDashboard } from './AdvisorDashboard'
import { AuthGate } from './AuthGate'
import {
  cloudEnabled,
  joinAdvisor,
  loadCurrentIdentity,
  signOutCloud,
  type CloudIdentity,
} from './cloud'
import { PlannerApp } from './features/planner/PlannerApp'

export default function App() {
  const [identity, setIdentity] = useState<CloudIdentity | null>(null)
  const [guestMode, setGuestMode] = useState(false)
  const [authLoading, setAuthLoading] = useState(cloudEnabled)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    let active = true
    void loadCurrentIdentity()
      .then((nextIdentity) => {
        if (!active) return
        setIdentity(nextIdentity)
        if (nextIdentity) setGuestMode(false)
      })
      .catch((cause: unknown) => {
        if (active) setAuthError(cause instanceof Error ? cause.message : 'اتصال به سرویس حساب ناموفق بود.')
      })
      .finally(() => {
        if (active) setAuthLoading(false)
      })
    return () => { active = false }
  }, [])

  if (authLoading) {
    return <div className="auth-loading">در حال بررسی حساب کاربری...</div>
  }

  if (identity?.role === 'advisor') {
    return <AdvisorDashboard key={identity.id} identity={identity} onSignedOut={() => setIdentity(null)} />
  }

  if (!identity && !guestMode) {
    return (
      <AuthGate
        initialError={authError}
        onGuest={() => { setAuthError(''); setGuestMode(true) }}
        onAuthenticated={async () => {
          setIdentity(await loadCurrentIdentity())
          setGuestMode(false)
        }}
      />
    )
  }

  return (
    <PlannerApp
      key={identity?.id ?? 'local-guest'}
      identity={identity}
      authError={authError}
      onSignOut={async () => {
        if (identity) await signOutCloud()
        setIdentity(null)
        setGuestMode(false)
      }}
      onJoinAdvisor={async (token) => {
        await joinAdvisor(token)
        setIdentity(await loadCurrentIdentity())
      }}
    />
  )
}
