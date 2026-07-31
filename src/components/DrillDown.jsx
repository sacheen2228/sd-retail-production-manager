import React, { useEffect, useMemo, useState } from 'react'
import { Btn, Empty } from './ui.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { KINDS } from './DrillDownKinds.jsx'
import { downloadCSV, exportXlsx, printReport } from '../lib/export.js'

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const today = () => new Date().toISOString().slice(0, 10)

function cmp(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a ?? '').localeCompare(String(b ?? ''))
}

export default function DrillDown({ panel, onClose, db, refresh, navigate }) {
  const { push } = useToast()
  const [state, setState] = useState(null)
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({})
  const [sort, setSort] = useState({ key: null, dir: 1 })
  const [group, setGroup] = useState('none')
  const [exporting, setExporting] = useState(null)

  const kind = state?.kind || 'alerts'
  const cfg = KINDS[kind] || KINDS.orders

  useEffect(() => {
    if (!panel) return
    setState({ kind: panel.kind, id: panel.id || null })
    setQuery('')
    setFilters({})
    setGroup('none')
    const c = KINDS[panel.kind] || KINDS.orders
    setSort({ key: c.columns[0]?.key || null, dir: 1 })
  }, [panel])

  const ctx = useMemo(
    () => ({
      db,
      refresh,
      navigate,
      push,
      openKind: (k, id) => setState({ kind: k, id })
    }),
    [db, refresh, navigate, push]
  )

  const allRows = useMemo(() => cfg.getRows(db), [cfg, db])

  const filtered = useMemo(() => {
    let rows = allRows
    ;(cfg.filters || []).forEach((f) => {
      const v = filters[f.key]
      if (v && v !== 'All') rows = rows.filter((r) => f.match(r, v))
    })
    const q = query.trim().toLowerCase()
    if (q) rows = rows.filter((r) => cfg.matchQuery(r, q))
    if (sort.key) {
      const col = cfg.columns.find((c) => c.key === sort.key)
      if (col && col.value) rows = [...rows].sort((a, b) => sort.dir * cmp(col.value(a), col.value(b)))
    }
    return rows
  }, [allRows, filters, query, sort, cfg])

  const grouped = useMemo(() => {
    if (group === 'none' || !cfg.groupValue) return null
    const m = {}
    filtered.forEach((r) => {
      const k = cfg.groupValue(r, group)
      ;(m[k] = m[k] || []).push(r)
    })
    return Object.entries(m).sort((a, b) => cmp(a[0], b[0]))
  }, [filtered, group, cfg])

  const selected = state?.id != null ? allRows.find((r) => String(r._id) === String(state.id)) : null

  const exportData = useMemo(
    () => ({
      cols: cfg.columns.map((c) => c.label),
      rows: filtered.map((r) => cfg.columns.map((c) => (c.value ? c.value(r) : r[c.key])))
    }),
    [filtered, cfg]
  )

  function toggleSort(col) {
    setSort((s) => (s.key === col.key ? { key: col.key, dir: -s.dir } : { key: col.key, dir: 1 }))
  }

  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }))
  }

  function exportCSV() {
    downloadCSV(`${slug(cfg.title)}-${today()}.csv`, exportData.cols, exportData.rows)
    push(`Exported ${filtered.length} rows to CSV`, 'success')
  }

  function exportExcel() {
    setExporting('excel')
    exportXlsx(`${slug(cfg.title)}-${today()}.xlsx`, exportData.cols, exportData.rows)
      .then(() => push(`Exported ${filtered.length} rows to Excel`, 'success'))
      .catch((e) => push(e.message, 'danger'))
      .finally(() => setExporting(null))
  }

  function exportPrint() {
    printReport(`${cfg.title} — ${today()}`, exportData.cols, exportData.rows)
  }

  if (!panel) return null

  return (
    <div className="dd-root">
      <div className="dd-overlay" onClick={onClose} />
      <div className="dd-panel" role="dialog" aria-modal="true" aria-label={cfg.title}>
        <div className="dd-head">
          <div>
            <div className="dd-eyebrow">Dashboard drill-down</div>
            <h2 className="dd-title">
              {cfg.icon} {cfg.title}
              <span className="dd-total">{allRows.length}</span>
            </h2>
          </div>
          <button className="btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="dd-body">
          {selected ? (
            <div>
              <button className="link-btn" style={{ fontSize: 13, marginBottom: 12 }} onClick={() => setState({ ...state, id: null })}>
                ← Back to {cfg.title}
              </button>
              {cfg.renderDetail(selected, ctx)}
            </div>
          ) : (
            <div>
              {cfg.renderAnalytics ? <div className="dd-analytics">{cfg.renderAnalytics(allRows, ctx)}</div> : null}

              <div className="dd-toolbar">
                <input
                  className="input search"
                  placeholder={`Search ${cfg.title.toLowerCase()}…`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {(cfg.filters || []).map((f) => (
                  <select key={f.key} className="input input-sm" value={filters[f.key] || 'All'} onChange={(e) => setFilter(f.key, e.target.value)}>
                    <option value="All">All {f.label}</option>
                    {f.options(db).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ))}
                {cfg.groupOptions && (
                  <select className="input input-sm" value={group} onChange={(e) => setGroup(e.target.value)}>
                    <option value="none">No grouping</option>
                    {cfg.groupOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
                <span className="dd-count">{filtered.length} record{filtered.length === 1 ? '' : 's'}</span>
                <span className="dd-spacer" />
                <Btn tone="ghost" onClick={exportCSV} disabled={!filtered.length} title="Export current view as CSV">
                  CSV
                </Btn>
                <Btn tone="ghost" onClick={exportExcel} disabled={!filtered.length || exporting === 'excel'} title="Export current view as Excel (.xlsx)">
                  {exporting === 'excel' ? 'Exporting…' : 'Excel'}
                </Btn>
                <Btn tone="ghost" onClick={exportPrint} disabled={!filtered.length} title="Open print-ready view (save as PDF)">
                  Print / PDF
                </Btn>
              </div>

              {filtered.length === 0 ? (
                <Empty>No records match the current filters.</Empty>
              ) : (
                <table className="table dd-table">
                  <thead>
                    <tr>
                      {cfg.columns.map((c) => (
                        <th key={c.key}>
                          {c.value && c.sortable !== false ? (
                            <button className={`dd-sort ${sort.key === c.key ? 'active' : ''}`} onClick={() => toggleSort(c)}>
                              {c.label}
                              {sort.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
                            </button>
                          ) : (
                            c.label
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grouped
                      ? grouped.map(([g, rows]) => (
                          <React.Fragment key={g}>
                            <tr className="dd-group-row">
                              <td colSpan={cfg.columns.length}>
                                {g} <span className="dd-group-count">{rows.length}</span>
                              </td>
                            </tr>
                            {rows.map((r) => (
                              <tr key={String(r._id)} className="row-click dd-row" onClick={() => setState({ ...state, id: r._id })}>
                                {cfg.columns.map((c) => (
                                  <td key={c.key}>{c.render ? c.render(r) : c.value ? c.value(r) : r[c.key]}</td>
                                ))}
                              </tr>
                            ))}
                          </React.Fragment>
                        ))
                      : filtered.map((r) => (
                          <tr key={String(r._id)} className="row-click dd-row" onClick={() => setState({ ...state, id: r._id })}>
                            {cfg.columns.map((c) => (
                              <td key={c.key}>{c.render ? c.render(r) : c.value ? c.value(r) : r[c.key]}</td>
                            ))}
                          </tr>
                        ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
