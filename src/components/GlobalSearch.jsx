import React, { useEffect, useMemo, useState } from 'react'
import { Modal, Btn, Empty, fmtMoney, fmtDate } from './ui.jsx'
import { useToast } from '../context/ToastContext.jsx'

function formatPOResult(po, retailers, styles) {
  const r = retailers.find((x) => x.id === po.retailerId)
  const count = styles.filter((s) => s.poId === po.id).length
  return {
    type: 'po',
    id: po.id,
    title: po.poNumber,
    subtitle: `${r?.name || '—'} · ${count} styles · ${fmtMoney(po.value)}`,
    meta: `Delivery: ${fmtDate(po.deliveryDate)} · ${po.status}`,
    onSelect: () => ({ view: 'orders', id: po.id })
  }
}

function formatStyleResult(style, pos, retailers) {
  const po = pos.find((o) => o.id === style.poId)
  const r = po ? retailers.find((x) => x.id === po.retailerId) : null
  return {
    type: 'style',
    id: style.id,
    title: style.styleCode,
    subtitle: `${style.styleName || '—'} · ${r?.name || '—'}`,
    meta: `Stage: ${style.stage} · Qty: ${style.quantity}`,
    onSelect: () => ({ view: 'tracker', id: style.id })
  }
}

function formatRetailerResult(retailer, pos, styles) {
  const orders = pos.filter((o) => o.retailerId === retailer.id)
  const styleCount = styles.filter((s) => orders.some((o) => o.id === s.poId)).length
  return {
    type: 'retailer',
    id: retailer.id,
    title: retailer.name,
    subtitle: `${retailer.city || '—'} · ${orders.length} orders · ${styleCount} styles`,
    meta: `Contact: ${retailer.contact || '—'}`,
    onSelect: () => ({ view: 'partners', id: retailer.id })
  }
}

export function GlobalSearch({ isOpen, onClose, db, navigate }) {
  const { push } = useToast()
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []

    const { purchaseOrders, styles, retailers } = db
    const all = []

    purchaseOrders.forEach((po) => {
      const r = retailers.find((x) => x.id === po.retailerId)
      const hay = `${po.poNumber} ${r?.name || ''} ${po.notes || ''} ${po.status}`.toLowerCase()
      if (hay.includes(q)) all.push(formatPOResult(po, retailers, styles))
    })

    styles.forEach((s) => {
      const hay = `${s.styleCode} ${s.styleName || ''} ${s.stage} ${s.category} ${s.fabric || ''} ${s.trim || ''}`.toLowerCase()
      if (hay.includes(q)) all.push(formatStyleResult(s, purchaseOrders, retailers))
    })

    retailers.forEach((r) => {
      const hay = `${r.name} ${r.city || ''} ${r.contact || ''}`.toLowerCase()
      if (hay.includes(q)) all.push(formatRetailerResult(r, purchaseOrders, styles))
    })

    return all.slice(0, 12)
  }, [query, db])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIdx(0)
      const input = document.getElementById('global-search-input')
      input?.focus()
    }
  }, [isOpen])

  function handleKey(e) {
    if (!isOpen) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      e.preventDefault()
      const nav = results[selectedIdx].onSelect()
      navigate(nav.view)
      onClose()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  useEffect(() => {
    if (!isOpen) return
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, results, selectedIdx, navigate, onClose])

  if (!isOpen) return null

  return (
    <Modal
      open
      title="Search (⌘K)"
      onClose={onClose}
      wide={false}
      footer={
        <div className="modal-foot">
          <kbd className="search-hint">⌘K</kbd> open · <kbd className="search-hint">↑↓</kbd> navigate · <kbd className="search-hint">Enter</kbd> select
        </div>
      }
    >
      <input
        id="global-search-input"
        className="input"
        placeholder="Search POs, styles, retailers…"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0) }}
        autoFocus
      />
      <div className="search-results">
        {results.length === 0 ? (
          <Empty>No matches for "{query}"</Empty>
        ) : (
          results.map((r, i) => (
            <button
              key={r.id}
              className={`search-result ${i === selectedIdx ? 'selected' : ''}`}
              onClick={() => {
                const nav = r.onSelect()
                navigate(nav.view)
                onClose()
              }}
            >
              <div className="sr-title">{r.title}</div>
              <div className="sr-subtitle">{r.subtitle}</div>
              <div className="sr-meta">{r.meta}</div>
            </button>
          ))
        )}
      </div>
    </Modal>
  )
}

export function useGlobalSearch(db, navigate) {
  const [isOpen, setIsOpen] = useState(false)
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return { isOpen, setIsOpen }
}