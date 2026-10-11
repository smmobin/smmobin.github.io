import { useState, type FormEvent } from 'react'
import { cloudEnabled, signInAccount, signUpStudent, testServerEnabled } from './cloud'

export function AuthGate({ initialError, onGuest, onAuthenticated }: {
  initialError: string
  onGuest: () => void
  onAuthenticated: () => Promise<void>
}) {
  const [mode, setMode] = useState<'welcome' | 'student' | 'advisor'>('welcome')
  const [isSignUp, setIsSignUp] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')

    try {
      if (mode === 'student' && isSignUp) {
        const cleanInviteCode = inviteCode.trim().toUpperCase()
        if (!cleanInviteCode) {
          setError('برای ساخت حساب دانش‌آموز، کد دعوت مشاور لازم است.')
          return
        }
        const hasSession = await signUpStudent(email, password, displayName, cleanInviteCode)
        if (!hasSession) {
          setMessage('حساب ساخته شد. ایمیل تأیید را بررسی کنید؛ بعد از ورود، اتصال به مشاور فعال است.')
          setIsSignUp(false)
        } else {
          setMessage('حساب ساخته شد و به مشاور متصل شد؛ در حال ورود...')
          await onAuthenticated()
        }
      } else {
        await signInAccount(email, password)
        await onAuthenticated()
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ورود انجام نشد.')
    } finally {
      setBusy(false)
    }
  }

  function choose(mode: 'student' | 'advisor') {
    setMode(mode)
    setIsSignUp(mode === 'student')
    setInviteCode('')
    setError('')
    setMessage('')
  }

  return (
    <div className="phone auth-phone">
      <div className="glow glow-a" />
      <div className="glow glow-b" />
      <main className="auth-content">
        <p className="kicker">درس‌یار · برنامه‌ریز مطالعه</p>
        {mode === 'welcome' ? (
          <>
            <h1>برنامه‌ریزی متناسب با شما</h1>
            <p className="caption">برای شروع، روش استفاده‌تان را انتخاب کنید.</p>
            <div className="auth-choices">
              <button className="auth-choice" onClick={onGuest}>
                <strong>مهمان محلی</strong>
                <span>بدون حساب؛ اطلاعات فقط روی همین دستگاه</span>
              </button>
              <button className="auth-choice" onClick={() => choose('student')}>
                <strong>دانش‌آموز</strong>
                <span>برنامهٔ شخصی یا برنامهٔ مشاور</span>
              </button>
              <button className="auth-choice" onClick={() => choose('advisor')}>
                <strong>مشاور</strong>
                <span>مدیریت برنامه و پیشرفت دانش‌آموزان</span>
              </button>
            </div>
            {initialError && <p className="auth-error" role="alert">{initialError}</p>}
            {initialError && <p className="auth-error" role="alert">{initialError}</p>}
            {testServerEnabled && (
              <p className="auth-notice">
                حساب‌های تست: مشاور <code>advisor@demo.test</code> / <code>advisor123</code>؛ دانش‌آموز با مشاور <code>student@demo.test</code> / <code>student123</code>؛ مستقل <code>solo@demo.test</code> / <code>student123</code>.
              </p>
            )}
            {!cloudEnabled && (
              <p className="auth-notice">
                ورود ابری پس از تنظیم Supabase فعال می‌شود. مهمان محلی همین حالا قابل استفاده است.
              </p>
            )}
          </>
        ) : (
          <section className="auth-card">
            <button className="ghost" onClick={() => setMode('welcome')}>بازگشت</button>
            <h1>{mode === 'advisor' ? 'ورود مشاور' : isSignUp ? 'ساخت حساب دانش‌آموز' : 'ورود دانش‌آموز'}</h1>
            {!cloudEnabled ? (
              <div className="auth-notice">
                <strong>اتصال ابری تنظیم نشده</strong>
                <p>برای فعال‌کردن ورود، مقادیر Supabase را در فایل محیطی محلی وارد کنید.</p>
                <code>VITE_SUPABASE_URL</code><br />
                <code>VITE_SUPABASE_ANON_KEY</code>
              </div>
            ) : (
              <form className="form" onSubmit={submit}>
                {mode === 'student' && isSignUp && (
                  <>
                    <label className="field auth-invite-field">
                      کد دعوت مشاور
                      <input
                        value={inviteCode}
                        onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                        placeholder="ابتدا کد دعوت را وارد کنید"
                        required
                      />
                    </label>
                    <p className="caption">بدون کد دعوت، حساب دانش‌آموز ساخته نمی‌شود.</p>
                    <input disabled={!inviteCode.trim()} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="نام نمایشی" required />
                  </>
                )}
                <input disabled={mode === 'student' && isSignUp && !inviteCode.trim()} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ایمیل" required />
                <input disabled={mode === 'student' && isSignUp && !inviteCode.trim()} type="password" autoComplete={isSignUp ? 'new-password' : 'current-password'} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="گذرواژه، حداقل ۸ نویسه" required />
                {error && <p className="auth-error" role="alert">{error}</p>}
                {message && <p className="auth-success" role="status">{message}</p>}
                <button className="cta" disabled={busy} type="submit">
                  {busy ? 'لطفاً صبر کنید...' : mode === 'advisor' ? 'ورود مشاور' : isSignUp ? 'ساخت حساب دانش‌آموز' : 'ورود دانش‌آموز'}
                </button>
                {mode === 'student' && (
                  <button className="ghost" type="button" onClick={() => { setIsSignUp((value) => !value); setInviteCode(''); setError(''); setMessage('') }}>
                    {isSignUp ? 'قبلاً حساب ساخته‌اید؟ ورود' : 'حساب ندارید؟ ثبت‌نام با کد دعوت'}
                  </button>
                )}
                {mode === 'advisor' && <p className="caption">حساب مشاور باید توسط مدیر سامانه تأیید شده باشد.</p>}
              </form>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
