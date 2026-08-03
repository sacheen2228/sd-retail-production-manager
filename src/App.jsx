import React, { lazy, Suspense, useEffect, useState, useCallback } from 'react'
import { api } from './api.js'
import { authEnabled, getSession, getUserRole, onAuthChange, signOut } from './services/auth.js'
import { exportAllToSheet } from './services/sheets.js'
import { can as canDo } from './lib/permissions.js'
import { ToastProvider, useToast } from './context/ToastContext.jsx'
import AuthScreen from './components/AuthScreen.jsx'
import { GlobalSearch, useGlobalSearch } from './components/GlobalSearch.jsx'
import { MobileFAB } from './components/MobileFAB.jsx'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js'

const Dashboard = lazy(() => import('./views/Dashboard.jsx'))
const Orders = lazy(() => import('./views/Orders.jsx'))
const Tracker = lazy(() => import('./views/Tracker.jsx'))
const Calendar = lazy(() => import('./views/Calendar.jsx'))
const Deliveries = lazy(() => import('./views/Deliveries.jsx'))
const Stock = lazy(() => import('./views/Stock.jsx'))
const Reports = lazy(() => import('./views/Reports.jsx'))
const Partners = lazy(() => import('./views/Partners.jsx'))
const Settings = lazy(() => import('./views/Settings.jsx'))

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '◈', key: 'd' },
  { id: 'orders', label: 'Purchase Orders', icon: '▤', key: 'o' },
  { id: 'tracker', label: 'Production Tracker', icon: '▶', key: 't' },
  { id: 'calendar', label: 'Calendar', icon: '▦', key: 'c' },
  { id: 'deliveries', label: 'Deliveries', icon: '❖', key: 'v' },
  { id: 'stock', label: 'Stock Report', icon: '▣', key: 's' },
  { id: 'reports', label: 'Reports', icon: '≡', key: 'r' },
  { id: 'partners', label: 'Partners & Stock', icon: '✦', key: 'p' },
  { id: 'settings', label: 'Settings', icon: '⚙', key: 'g' }
]

const VIEWS = {
  dashboard: Dashboard,
  orders: Orders,
  tracker: Tracker,
  calendar: Calendar,
  deliveries: Deliveries,
  stock: Stock,
  reports: Reports,
  partners: Partners,
  settings: Settings
}

function Shell() {
  const [db, setDb] = useState(null)
  const [role, setRole] = useState(authEnabled ? null : 'admin')
  const [view, setView] = useState('dashboard')
  const [error, setError] = useState(null)
  const [navOpen, setNavOpen] = useState(false)
  const [exportingAll, setExportingAll] = useState(false)
  const { push } = useToast()
  const { isOpen: searchOpen, setIsOpen: setSearchOpen } = useGlobalSearch(db, navigate)

  useEffect(() => {
    api
      .get('/api/data')
      .then(setDb)
      .catch((e) => {
        setError(e.message)
        push('Failed to load data: ' + e.message, 'danger')
      })
    getUserRole()
      .then((r) => setRole(r || 'viewer'))
      .catch(() => setRole('viewer'))
  }, [])

  function refresh() {
    return api.get('/api/data').then(setDb)
  }

  function exportAll() {
    setExportingAll(true)
    exportAllToSheet(db)
      .then((res) => {
        const action = res.spreadsheet ? { label: 'Open Sheet', href: res.spreadsheet } : null
        push(`Exported ${res.sheets} tabs to Google Sheets`, 'success', action ? { action } : {})
      })
      .catch((e) => push(e.message, 'danger'))
      .finally(() => setExportingAll(false))
  }

  function navigate(id) {
    setView(id)
    setNavOpen(false)
  }

  // Keyboard shortcuts
  useKeyboardShortcuts({
    '/': () => setSearchOpen(true),
    'n': () => navigate('orders'),
    't': () => navigate('tracker'),
    'd': () => navigate('deliveries'),
    'c': () => navigate('calendar'),
    's': () => navigate('stock'),
    'r': () => navigate('reports'),
    'p': () => navigate('partners'),
    'Escape': () => { setNavOpen(false); setSearchOpen(false) }
  })

  if (error) return <div className="boot-error">Failed to load data: {error}</div>
  if (!db || role === null) return <div className="boot">Loading production data…</div>

  const ctx = { db, refresh, navigate, role, can: (a) => canDo(role, a) }
  const Active = VIEWS[view]

  const fabActions = canDo(role, 'create')
    ? [
        { label: 'New PO', icon: '▤', onClick: () => navigate('orders') },
        { label: 'New Style', icon: '▶', onClick: () => navigate('tracker') },
        { label: 'New Delivery', icon: '❖', onClick: () => navigate('deliveries') },
        { label: 'New Stock', icon: '▣', onClick: () => navigate('stock') }
      ]
    : []

  return (
    <div className="layout">
      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} db={db} navigate={navigate} />
      <MobileFAB primary={{ label: 'Create', onClick: () => {} }} actions={fabActions} />

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
              title={`${n.label} (${n.key.toUpperCase()})`}
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
          <div className="sidebar-foot-sub" style={{ marginTop: 8, opacity: 0.85 }}>
            build rk-retail v3.2 (color+size+formulas)
          </div>
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