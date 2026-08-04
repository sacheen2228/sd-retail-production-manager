import { useState } from 'react'
import { signIn, signUp, resetPassword, updatePassword, signOut } from '../services/auth.js'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export default function AuthScreen({ recovery = false }) {
  const [mode, setMode] = useState(recovery ? 'reset' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  function switchMode(m) {
    setMode(m)
    setError(null)
    setNotice(null)
    setConfirm('')
  }

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (mode === 'forgot') {
      if (!EMAIL_RE.test(email.trim())) return setError('Enter a valid email address')
    } else if (mode === 'reset') {
      if (password.length < 6) return setError('Password must be at least 6 characters')
      if (password !== confirm) return setError('Passwords do not match')
    } else {
      if (!EMAIL_RE.test(email.trim())) return setError('Enter a valid email address')
      if (password.length < 6) return setError('Password must be at least 6 characters')
      if (mode === 'signup' && password !== confirm) return setError('Passwords do not match')
    }

    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password)
      } else if (mode === 'signup') {
        const res = await signUp(email.trim(), password)
        if (res && res.session === null) {
          setNotice('Account created. Check your email for a confirmation link before signing in.')
          switchMode('signin')
        }
      } else if (mode === 'forgot') {
        await resetPassword(email.trim())
        setNotice('Password reset link sent. Check your email inbox.')
        switchMode('signin')
      } else if (mode === 'reset') {
        await updatePassword(password)
        await signOut()
        switchMode('signin')
        setNotice('Password updated. Sign in with your new password.')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const isAuth = mode === 'signin' || mode === 'signup'

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand">
          <div className="brand-mark">R</div>
          <div>
            <div className="brand-name">SD Retail</div>
            <div className="brand-sub">Production & Merchandising ERP</div>
          </div>
        </div>

        {isAuth && (
          <div className="auth-tabs">
            <button type="button" className={`chip ${mode === 'signin' ? 'active' : ''}`} onClick={() => switchMode('signin')}>
              Sign in
            </button>
            <button type="button" className={`chip ${mode === 'signup' ? 'active' : ''}`} onClick={() => switchMode('signup')}>
              Create account
            </button>
          </div>
        )}

        {mode === 'forgot' && (
          <div className="auth-heading">
            <div className="auth-title">Reset your password</div>
            <div className="muted">Enter your account email and we'll send you a reset link.</div>
          </div>
        )}

        {mode === 'reset' && (
          <div className="auth-heading">
            <div className="auth-title">Set a new password</div>
            <div className="muted">Choose a strong password for your account.</div>
          </div>
        )}

        {isAuth && (
          <label className="field">
            <span className="field-label">Email</span>
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@sdretail.com" />
          </label>
        )}

        {mode === 'forgot' && (
          <label className="field">
            <span className="field-label">Email</span>
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@sdretail.com" />
          </label>
        )}

        {isAuth && (
          <label className="field">
            <span className="field-label">Password</span>
            <input
              className="input"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            {mode === 'signin' && (
              <button type="button" className="auth-link" onClick={() => switchMode('forgot')}>
                Forgot password?
              </button>
            )}
          </label>
        )}

        {mode === 'reset' && (
          <>
            <label className="field">
              <span className="field-label">New password</span>
              <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
            </label>
            <label className="field">
              <span className="field-label">Confirm password</span>
              <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat your password" />
            </label>
          </>
        )}

        {mode === 'signup' && (
          <label className="field">
            <span className="field-label">Confirm password</span>
            <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat your password" />
          </label>
        )}

        {error && <div className="field-error">{error}</div>}
        {notice && <div className="auth-notice">{notice}</div>}

        <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%' }}>
          {busy
            ? 'Please wait…'
            : mode === 'signin'
              ? 'Sign in'
              : mode === 'signup'
                ? 'Create account'
                : mode === 'forgot'
                  ? 'Send reset link'
                  : 'Update password'}
        </button>

        {mode !== 'signin' && (
          <button type="button" className="auth-link-back" onClick={() => switchMode('signin')}>
            ← Back to sign in
          </button>
        )}
      </form>
    </div>
  )
}
