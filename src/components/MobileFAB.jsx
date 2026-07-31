import React, { useState } from 'react'
import { Btn } from '../components/ui.jsx'

export function MobileFAB({ primary, actions }) {
  const [open, setOpen] = useState(false)

  if (!primary && !actions?.length) return null

  return (
    <div className={`fab-container ${open ? 'open' : ''}`}>
      <button className="fab-main" onClick={() => setOpen(!open)} aria-label={open ? 'Close actions' : 'Quick actions'}>
        {open ? '✕' : '+'}
      </button>
      {open && actions?.map((a, i) => (
        <button key={i} className="fab-action" onClick={(e) => { e.stopPropagation(); a.onClick(); setOpen(false) }}>
          {a.icon}
          <span>{a.label}</span>
        </button>
      ))}
    </div>
  )
}

export function useMobileFAB(primary, actions) {
  const [open, setOpen] = useState(false)
  return { open, setOpen, toggle: () => setOpen(!open) }
}