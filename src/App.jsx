import React, { lazy, Suspense, useEffect, useState } from 'react'
import { api } from './api.js'
import { authEnabled, getSession, onAuthChange, signOut } from './services/auth.js'
import { exportAllToSheet } from './services/sheets.js'
import { ToastProvider, useToast } from './context/ToastContext.jsx'
import AuthScreen from './components/AuthScreen.jsx'

const Dashboard = lazy(() => import('./views/Dashboard.jsx'))
const Orders = lazy(() => import('./views/Orders.jsx'))
const Tracker = lazy(() => import('./views/Tracker.jsx'))
const Calendar = lazy(() => import('./views/Calendar.jsx'))
const Deliveries = lazy(() => import('./views/Deliveries.jsx'))
const Stock = lazy(() => import('./views/Stock.jsx'))
const Reports = lazy(() => import('./views/Reports.jsx'))
const Partners = lazy(() => import('./views/Partners.jsx'))

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '◈' },
  { id: 'orders', label: 'Purchase Orders', icon: '▤' },
  { id: 'tracker', label: 'Production Tracker', icon: '▶' },
  { id: 'calendar', label: 'Calendar', icon: '▦' },
  { id: 'deliveries', label: 'Deliveries', icon: '❖' },
  { id: 'stock', label: 'Stock Report', icon: '▣' },
  { id: 'reports', label: 'Reports', icon: '≡' },
  { id: 'partners', label: 'Partners & Stock', icon: '✦' }
]

const VIEWS = {
  dashboard: Dashboard,
  orders: Orders,
  tracker: Tracker,
  calendar: Calendar,
  deliveries: Deliveries,
  stock: Stock,
  reports: Reports,
  partners: Partners
}

function Shell() {
  const [db, setDb] = useState(null)
  const [view, setView] = useState('dashboard')
  const [error, setError] = useState(null)
  const [navOpen, setNavOpen] = useState(false)
  const [exportingAll, setExportingAll] = useState(false)
  const { push } = useToast()

  useEffect(() => {
    api
      .get('/api/data')
      .then(setDb)
      .catch((e) => {
        setError(e.message)
        push('Failed to load data: ' + e.message, 'danger')
      })
  }, [])

  function refresh() {
    return api.get('/api/data').then(setDb)
  }

  function exportAll() {
    setExportingAll(true)
    exportAllToSheet(db)
      .then((res) => push(`Exported ${res.sheets} tabs to Google Sheets`, 'success'))
      .catch((e) => push(e.message, 'danger'))
      .finally(() => setExportingAll(false))
  }

  function navigate(id) {
    setView(id)
    setNavOpen(false)
  }

  if (error) return <div className="boot-error">Failed to load data: {error}</div>
  if (!db) return <div className="boot">Loading production data…</div>

  const ctx = { db, refresh, navigate }
  const Active = VIEWS[view]

  return (
    <div className="layout">
      <div className={`nav-scrim ${navOpen ? 'show' : ''}`} onClick={() => setNavOpen(false)} />
      <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">R</div>
          <div>
            <div className="brand-name">RK</div>
            <div className="brand-sub">Production & Merchandising</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${view === n.id ? 'active' : ''}`}
              onClick={() => navigate(n.id)}
            >
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', marginBottom: 8 }}
            onClick={exportAll}
            disabled={exportingAll}
          >
            {exportingAll ? 'Exporting…' : '⇪ Export all data to Sheets'}
          </button>
          {authEnabled && (
            <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginBottom: 8 }} onClick={() => signOut()}>
              Sign out
            </button>
          )}
          <div className="sidebar-foot-title">Daily WIP report</div>
          <div className="sidebar-foot-sub">Data refreshes automatically on save</div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <button className="nav-burger" onClick={() => setNavOpen(true)} aria-label="Open menu">
            ☰
          </button>
          <h1>{NAV.find((n) => n.id === view)?.label}</h1>
          <div className="topbar-right">
            <span className="today">{new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        </header>
        <div className="content">
          <Suspense fallback={<div className="boot">Loading view…</div>}>
            <Active ctx={ctx} />
          </Suspense>
        </div>
      </main>
    </div>
  )
}

function Root() {
  const [session, setSession] = useState(authEnabled ? undefined : 'none')

  useEffect(() => {
    if (!authEnabled) return
    getSession().then((s) => setSession(s))
    const unsub = onAuthChange((_event, s) => setSession(s))
    return unsub
  }, [])

  if (authEnabled && session === undefined) return <div className="boot">Loading…</div>
  if (authEnabled && !session) return <AuthScreen />
  return <Shell />
}

export default function App() {
  return (
    <ToastProvider>
      <Root />
    </ToastProvider>
  )
}
