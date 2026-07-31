import { useState } from 'react'
import { signIn, signUp } from '../services/auth.js'

export default function AuthScreen() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError('Enter a valid email address')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password)
      } else {
        const res = await signUp(email.trim(), password)
        if (res && res.session === null) {
          setNotice('Account created. Check your email for a confirmation link before signing in.')
          setMode('signin')
        }
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand">
          <div className="brand-mark">R</div>
          <div>
            <div className="brand-name">RK Atelier</div>
            <div className="brand-sub">Production & Merchandising ERP</div>
          </div>
        </div>

        <div className="auth-tabs">
          <button type="button" className={`chip ${mode === 'signin' ? 'active' : ''}`} onClick={() => { setMode('signin'); setError(null); setNotice(null) }}>
            Sign in
          </button>
          <button type="button" className={`chip ${mode === 'signup' ? 'active' : ''}`} onClick={() => { setMode('signup'); setError(null); setNotice(null) }}>
            Create account
          </button>
        </div>

        <label className="field">
          <span className="field-label">Email</span>
          <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@atelier.com" />
        </label>

        <label className="field">
          <span className="field-label">Password</span>
          <input className="input" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </label>

        {error && <div className="field-error">{error}</div>}
        {notice && <div className="auth-notice">{notice}</div>}

        <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </div>
  )
}
