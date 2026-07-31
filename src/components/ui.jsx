import React, { useEffect } from 'react'
import { fmtMoney, fmtDate, daysFromToday, subsFor } from '../lib.js'

export function SubCatField({ value, category, onChange }) {
  const subs = subsFor(category)
  const isCustom = value && !subs.includes(value)
  const selectVal = isCustom ? '__custom__' : value || ''
  return (
    <div>
      <select
        className="input"
        value={selectVal}
        onChange={(e) => onChange(e.target.value === '__custom__' ? '' : e.target.value)}
      >
        <option value="">Select sub-category</option>
        {subs.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
        <option value="__custom__">Custom…</option>
      </select>
      {selectVal === '__custom__' && (
        <input
          className="input"
          style={{ marginTop: 6 }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type sub-category"
        />
      )}
    </div>
  )
}

export function Badge({ children, tone = 'default' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function StageBadge({ stage }) {
  const done = stage === 'Dispatched'
  const qc = stage === 'QC'
  return (
    <Badge tone={done ? 'success' : qc ? 'warn' : 'accent'}>{stage}</Badge>
  )
}

export function DueBadge({ dateStr }) {
  const days = daysFromToday(dateStr)
  if (days === null) return <span className="muted">—</span>
  const overdue = days < 0
  const soon = days <= 7
  const label = overdue ? `Overdue by ${-days}d` : `Due in ${days}d`
  return <Badge tone={overdue ? 'danger' : soon ? 'warn' : 'success'}>{label}</Badge>
}

export function Stat({ label, value, sub, tone }) {
  return (
    <div className={`stat ${tone ? 'stat-' + tone : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub ? <div className="stat-sub">{sub}</div> : null}
    </div>
  )
}

export function Card({ title, action, children, className = '', onClick }) {
  return (
    <div
      className={`card ${className} ${onClick ? 'card-click' : ''}`}
      {...(onClick ? { onClick, role: 'button', tabIndex: 0 } : {})}
    >
      {(title || action) && (
        <div className="card-head">
          <h3>{title}</h3>
          {action}
        </div>
      )}
      <div className="card-body">{children}</div>
    </div>
  )
}

export function Modal({ open, title, onClose, children, footer, wide }) {
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className={`modal ${wide ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Dialog'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn-ghost btn-sm" onClick={onClose} aria-label="Close" autoFocus>
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function Input(props) {
  return <input className="input" {...props} />
}

export function Select({ children, ...props }) {
  return (
    <select className="input" {...props}>
      {children}
    </select>
  )
}

export function Textarea(props) {
  return <textarea className="input" rows="3" {...props} />
}

export function Btn({ children, tone = 'primary', className = '', ...props }) {
  return (
    <button className={`btn btn-${tone} ${className}`.trim()} {...props}>
      {children}
    </button>
  )
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>
}

export function Kpi({ label, value, sub, tone = '' }) {
  return (
    <div className={`kpi kpi-${tone}`}>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}

export function fmtMoneyExport(n) {
  return fmtMoney(n)
}
export { fmtDate, fmtMoney, daysFromToday }
