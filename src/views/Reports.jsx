import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { Card, StageBadge, DueBadge, Btn, Empty, Field, Input, Select, fmtMoney } from '../components/ui.jsx'
import { STAGES } from '../lib.js'
import { exportToSheet } from '../services/sheets.js'
import { computeProfit, computeFabricRequirement } from '../services/reports.js'
import { printDoc, downloadCSV } from '../services/print.js'
import { useToast } from '../context/ToastContext.jsx'

const isod = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const PRESETS = [
  { id: 'all', label: 'All time' },
  { id: 'month', label: 'This month' },
  { id: 'quarter', label: 'This quarter' },
  { id: 'year', label: 'This year' },
  { id: 'custom', label: 'Custom range' }
]

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthLabel = (k) => {
  if (!k) return '-'
  const [y, m] = k.split('-')
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`
}

export default function Reports({ ctx }) {
  const { db } = ctx
  const { push } = useToast()
  const [wip, setWip] = useState(null)
  const [exporting, setExporting] = useState(false)

  const [tab, setTab] = useState('production')
  const [rangePreset, setRangePreset] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [groupBy, setGroupBy] = useState('style')
  const [challanPo, setChallanPo] = useState('')
  const [wipSearch, setWipSearch] = useState('')
  const [wipStage, setWipStage] = useState('All')
  const [wipRetailer, setWipRetailer] = useState('All')
  const [wipCategory, setWipCategory] = useState('All')
  const [wipStuckDays, setWipStuckDays] = useState('')
  const [poStatus, setPoStatus] = useState('All')
  const [profitRetailer, setProfitRetailer] = useState('All')
  const [profitCategory, setProfitCategory] = useState('All')

  const purchaseOrders = db.purchaseOrders || []
  const retailers = db.retailers || []
  const styles = db.styles || []

  const wipRetailers = useMemo(() => [...new Set((wip || []).map((r) => r.retailer).filter(Boolean))].sort(), [wip])
  const wipCategories = useMemo(() => [...new Set((wip || []).map((r) => r.category).filter(Boolean))].sort(), [wip])
  const profitRetailers = useMemo(() => [...new Set(retailers.map((r) => r.name))].sort(), [retailers])
  const profitCategories = useMemo(() => [...new Set(styles.map((s) => s.category).filter(Boolean))].sort(), [styles])

  const filteredWip = useMemo(() => {
    if (!wip) return []
    const q = wipSearch.trim().toLowerCase()
    const minDays = wipStuckDays === '' ? null : Number(wipStuckDays)
    return wip.filter((r) => {
      if (wipStage !== 'All' && r.stage !== wipStage) return false
      if (wipRetailer !== 'All' && r.retailer !== wipRetailer) return false
      if (wipCategory !== 'All' && r.category !== wipCategory) return false
      if (minDays !== null && r.daysInStage < minDays) return false
      if (q && !`${r.styleCode} ${r.styleName} ${r.poNumber}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [wip, wipSearch, wipStage, wipRetailer, wipCategory, wipStuckDays])

  useEffect(() => {
    api.get('/api/reports/wip').then(setWip).catch(() => {})
  }, [db])

  const rName = (id) => retailers.find((r) => r.id === id)?.name || '-'

  const range = useMemo(() => {
    const now = new Date()
    switch (rangePreset) {
      case 'month':
        return { from: isod(new Date(now.getFullYear(), now.getMonth(), 1)), to: isod(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }
      case 'quarter': {
        const q = Math.floor(now.getMonth() / 3)
        return { from: isod(new Date(now.getFullYear(), q * 3, 1)), to: isod(new Date(now.getFullYear(), q * 3 + 3, 0)) }
      }
      case 'year':
        return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` }
      case 'custom':
        return { from: from || null, to: to || null }
      default:
        return { from: null, to: null }
    }
  }, [rangePreset, from, to])

  const rangeLabel = useMemo(() => {
    if (!range.from && !range.to) return 'All time'
    return `${range.from ? range.from.slice(8, 10) + ' ' + monthLabel(range.from.slice(0, 7)) : 'start'} → ${range.to ? range.to.slice(8, 10) + ' ' + monthLabel(range.to.slice(0, 7)) : 'today'}`
  }, [range])

  const profit = useMemo(
    () => computeProfit(db, range, { retailer: profitRetailer === 'All' ? null : profitRetailer, category: profitCategory === 'All' ? null : profitCategory }),
    [db, range, profitRetailer, profitCategory]
  )
  const fabricReq = useMemo(() => computeFabricRequirement(db), [db])

  const posInRange = useMemo(
    () =>
      purchaseOrders
        .filter((o) => {
          if (range.from && o.orderDate && o.orderDate < range.from) return false
          if (range.to && o.orderDate && o.orderDate > range.to) return false
          return true
        })
        .sort((a, b) => (String(a.orderDate || '') > String(b.orderDate || '') ? -1 : 1)),
    [purchaseOrders, range]
  )

  const posInRangeFiltered = useMemo(
    () => (poStatus === 'All' ? posInRange : posInRange.filter((o) => o.status === poStatus)),
    [posInRange, poStatus]
  )

  useEffect(() => {
    if (posInRange.length && !challanPo) setChallanPo(posInRange[0].id)
    if (!posInRange.length) setChallanPo('')
  }, [posInRange]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Production (WIP) ----------
  const byStage = useMemo(() => {
    if (!filteredWip) return []
    const m = {}
    filteredWip.forEach((r) => (m[r.stage] = (m[r.stage] || 0) + 1))
    return STAGES.filter((s) => m[s]).map((s) => ({ stage: s, count: m[s] }))
  }, [filteredWip])

  const byRetailer = useMemo(() => {
    if (!filteredWip) return []
    const m = {}
    filteredWip.forEach((r) => (m[r.retailer] = (m[r.retailer] || 0) + r.quantity))
    return Object.entries(m)
      .map(([retailer, qty]) => ({ retailer, qty }))
      .sort((a, b) => b.qty - a.qty)
  }, [filteredWip])

  const atRisk = useMemo(() => (filteredWip || []).filter((r) => r.status !== 'Dispatched' && r.daysLeft !== null && r.daysLeft <= 7), [filteredWip])

  const wipExport = useMemo(() => {
    if (!filteredWip) return null
    const cols = ['Sr', 'PO', 'Buyer', 'Style', 'Color', 'Size', 'Order Qty', 'WIP', 'Stage', 'Days', 'Dispatch', 'Status']
    const rows = filteredWip.map((r, i) => {
      const row = i + 2
      return [i + 1, r.poNumber, r.retailer, r.styleCode, r.color, r.size, r.quantity, `=G${row}-K${row}`, r.stage, r.daysInStage, r.qtyDispatched, `=IF(K${row}>0,"Dispatched","In Production")`]
    })
    return { cols, rows }
  }, [filteredWip])

  function exportCSV() {
    if (!wipExport) return
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const blob = new Blob(['\ufeff' + wipExport.cols.map(esc).join(',') + '\n' + wipExport.rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `wip-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function exportSheet() {
    if (!wipExport) return
    setExporting(true)
    exportToSheet({ sheet: 'WIP Report', ...wipExport })
      .then((res) => {
        const action = res.spreadsheet ? { label: 'Open Sheet', href: res.spreadsheet } : null
        push(`Exported ${res.count} rows to Google Sheets`, 'success', action ? { action } : {})
      })
      .catch((e) => push(e.message, 'danger'))
      .finally(() => setExporting(false))
  }

  // ---- Profit ----------
  const profitGroup = { style: profit.byStyle, order: profit.byOrder, month: profit.byMonth }[groupBy] || []
  const pCols = ['Group', 'Pieces', 'Selling', 'Cost', 'Profit', 'Margin']
  const pRows = profitGroup.map((g) => [g.label, g.qty, fmtMoney(g.sell), fmtMoney(g.cost), fmtMoney(g.profit), `${g.margin.toFixed(1)}%`])

  function profitCSV() {
    const cols = ['Group', 'Pieces', 'Selling', 'Cost', 'Profit', 'Margin%']
    const rows = profitGroup.map((g) => [g.label, g.qty, g.sell.toFixed(2), g.cost.toFixed(2), g.profit.toFixed(2), g.margin.toFixed(1)])
    downloadCSV(`profit-${groupBy}-${new Date().toISOString().slice(0, 10)}.csv`, cols, rows)
  }

  // ---- Documents ----------
  const poDocCols = ['PO', 'Retailer', 'Order Date', 'Delivery Date', 'Styles', 'Value', 'Status']
  const poDocRows = posInRangeFiltered.map((o) => [
    o.poNumber,
    rName(o.retailerId),
    o.orderDate || '-',
    o.deliveryDate || '-',
    styles.filter((s) => s.poId === o.id).length,
    fmtMoney(o.value),
    o.status
  ])

  const challan = posInRangeFiltered.find((o) => o.id === challanPo)
  const challanLines = challan ? styles.filter((s) => s.poId === challan.id) : []
  const challanCols = ['Style', 'Name', 'Color', 'Size', 'Order Qty', 'Dispatched', 'Balance', 'Line Value']
  const challanDocRows = challanLines.map((s) => [
    s.styleCode,
    s.styleName,
    s.color || '-',
    s.size || '-',
    s.quantity,
    s.qtyDispatched || 0,
    (Number(s.quantity) || 0) - (Number(s.qtyDispatched) || 0),
    fmtMoney(Number(s.quantity) * (Number(s.price) || 0))
  ])

  const frCols = ['Material', 'Type', 'UOM', 'Vendor', 'Stock', 'Required', 'Available', 'Status']
  const frRows = fabricReq.map((f) => [
    f.name,
    f.type,
    f.uom,
    f.vendor || '-',
    f.stock,
    f.required,
    f.available,
    f.status === 'reorder' ? 'Reorder' : f.status === 'short' ? 'Short' : 'OK'
  ])

  function poReportCSV() {
    downloadCSV(`po-report-${new Date().toISOString().slice(0, 10)}.csv`, poDocCols, posInRangeFiltered.map((o) => [
      o.poNumber, rName(o.retailerId), o.orderDate || '', o.deliveryDate || '',
      styles.filter((s) => s.poId === o.id).length, Number(o.value) || 0, o.status
    ]))
  }

  return (
    <div>
      <Card>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field label="Period">
            <Select value={rangePreset} onChange={(e) => setRangePreset(e.target.value)}>
              {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </Select>
          </Field>
          {rangePreset === 'custom' && (
            <>
              <Field label="From">
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="To">
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </Field>
            </>
          )}
          <div className="toolbar-tabs">
            {[
              ['production', 'Production'],
              ['profit', 'Profit'],
              ['documents', 'Documents']
            ].map(([id, label]) => (
              <button key={id} className={`chip ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {tab === 'production' && (
        <div className="grid-2">
          <Card
            title={`Work-in-Progress Report${atRisk.length ? ` — ${atRisk.length} at risk` : ''}`}
            action={
              <>
                <Btn tone="ghost" onClick={exportSheet} disabled={exporting || !wipExport} style={{ marginRight: 8 }}>
                  {exporting ? 'Exporting…' : '→ Sheet'}
                </Btn>
                <Btn tone="ghost" onClick={exportCSV} disabled={!wipExport}>
                  Export CSV
                </Btn>
              </>
            }
          >
            <div className="report-filters">
              <Input className="search" placeholder="Search style / PO…" value={wipSearch} onChange={(e) => setWipSearch(e.target.value)} />
              <Select value={wipStage} onChange={(e) => setWipStage(e.target.value)} className="input-sm" style={{ maxWidth: 190 }}>
                <option value="All">All stages</option>
                {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              <Select value={wipRetailer} onChange={(e) => setWipRetailer(e.target.value)} className="input-sm" style={{ maxWidth: 190 }}>
                <option value="All">All retailers</option>
                {wipRetailers.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              <Select value={wipCategory} onChange={(e) => setWipCategory(e.target.value)} className="input-sm" style={{ maxWidth: 190 }}>
                <option value="All">All categories</option>
                {wipCategories.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              <Input className="input-sm range-input" type="number" min="0" placeholder="Stuck ≥ days" value={wipStuckDays} onChange={(e) => setWipStuckDays(e.target.value)} />
              <Btn tone="ghost" onClick={() => { setWipSearch(''); setWipStage('All'); setWipRetailer('All'); setWipCategory('All'); setWipStuckDays('') }}>Clear</Btn>
            </div>
            {!wip ? (
              <Empty>Loading…</Empty>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Sr</th><th>PO</th><th>Buyer</th><th>Style</th><th>Color</th><th>Size</th>
                    <th>Order Qty</th><th>WIP</th><th>Stage</th><th>Days</th><th>Dispatch</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWip.length === 0 ? (
                    <tr><td colSpan="12"><div className="muted" style={{ padding: 12 }}>No styles match the current filters.</div></td></tr>
                  ) : (
                    filteredWip.map((r, i) => (
                      <tr key={i}>
                        <td className="muted">{i + 1}</td>
                        <td>{r.poNumber}</td>
                        <td>{r.retailer}</td>
                        <td className="strong">
                          {r.styleCode}
                          <div className="cell-sub">{r.styleName}</div>
                        </td>
                        <td>{r.color || '-'}</td>
                        <td>{r.size || '-'}</td>
                        <td className="strong">{r.quantity}</td>
                        <td>{r.wip}</td>
                        <td><StageBadge stage={r.stage} /></td>
                        <td>{r.daysInStage}d</td>
                        <td>{r.qtyDispatched > 0 ? r.qtyDispatched : '-'}</td>
                        <td>
                          {r.status === 'Dispatched' ? <StageBadge stage="Dispatched" /> : <span className="muted">In Production</span>}
                          {r.daysLeft !== null && r.status !== 'Dispatched' && r.daysLeft <= 7 && <div className="cell-sub danger-text">Due in {r.daysLeft}d</div>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </Card>

          <div>
            <Card title="Styles by Stage">
              {byStage.length === 0 ? (
                <Empty>No data.</Empty>
              ) : (
                <div className="pipeline">
                  {byStage.map(({ stage, count }) => (
                    <div key={stage} className="pipeline-row">
                      <div className="pipeline-label">{stage}</div>
                      <div className="pipeline-track">
                        <div className={`pipeline-fill ${stage === 'Dispatched' ? 'fill-done' : ''}`} style={{ width: `${(count / Math.max(...byStage.map((b) => b.count))) * 100}%` }} />
                      </div>
                      <div className="pipeline-count">{count}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Order Quantity by Retailer">
              {byRetailer.length === 0 ? (
                <Empty>No data.</Empty>
              ) : (
                <table className="table table-sm">
                  <thead><tr><th>Retailer</th><th>Pieces</th></tr></thead>
                  <tbody>
                    {byRetailer.map((r) => (
                      <tr key={r.retailer}><td>{r.retailer}</td><td className="strong">{r.qty}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card title="Delivery Risk">
              {atRisk.length === 0 ? (
                <Empty>No deliveries at risk. Good.</Empty>
              ) : (
                <table className="table table-sm">
                  <thead><tr><th>Style</th><th>Delivery</th><th>Due</th></tr></thead>
                  <tbody>
                    {atRisk.map((r, i) => (
                      <tr key={i}><td className="strong">{r.styleCode}</td><td>{r.deliveryDate}</td><td><DueBadge dateStr={r.deliveryDate} /></td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === 'profit' && (
        <Card
          title={`Profit Report — ${rangeLabel}`}
          action={
            <>
              <Btn tone="ghost" onClick={() => setGroupBy('style')} style={groupBy === 'style' ? { fontWeight: 800 } : {}}>By Style</Btn>
              <Btn tone="ghost" onClick={() => setGroupBy('order')} style={groupBy === 'order' ? { fontWeight: 800 } : {}}>By Order</Btn>
              <Btn tone="ghost" onClick={() => setGroupBy('month')} style={groupBy === 'month' ? { fontWeight: 800 } : {}}>By Month</Btn>
              <span className="spacer" />
              <Btn tone="ghost" onClick={profitCSV}>Export CSV</Btn>
              <Btn tone="ghost" onClick={() => printDoc({ title: 'Profit Report', subtitle: `Cost vs. selling · ${rangeLabel} · by ${groupBy}`, columns: pCols, rows: pRows, totals: ['Total', profit.totals.qty, fmtMoney(profit.totals.sell), fmtMoney(profit.totals.cost), fmtMoney(profit.totals.profit), `${profit.totals.margin.toFixed(1)}%`] })}>Print / PDF</Btn>
            </>
          }
        >
          <div className="report-filters">
            <Select value={profitRetailer} onChange={(e) => setProfitRetailer(e.target.value)} className="input-sm" style={{ maxWidth: 190 }}>
              <option value="All">All retailers</option>
              {profitRetailers.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Select value={profitCategory} onChange={(e) => setProfitCategory(e.target.value)} className="input-sm" style={{ maxWidth: 190 }}>
              <option value="All">All categories</option>
              {profitCategories.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Btn tone="ghost" onClick={() => { setProfitRetailer('All'); setProfitCategory('All') }}>Clear</Btn>
          </div>
          {profitGroup.length === 0 ? (
            <Empty>No orders in this period. Add a Unit Cost on order styles to see profit.</Empty>
          ) : (
            <table className="table">
              <thead>
                <tr>{pCols.map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {profitGroup.map((g, i) => (
                  <tr key={i}>
                    <td className="strong">{g.label}</td>
                    <td>{g.qty}</td>
                    <td>{fmtMoney(g.sell)}</td>
                    <td>{fmtMoney(g.cost)}</td>
                    <td className={g.profit >= 0 ? 'pos' : 'neg'}>{fmtMoney(g.profit)}</td>
                    <td>{g.margin.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="totals-row">
                  <th>Total</th>
                  <th>{profit.totals.qty}</th>
                  <th>{fmtMoney(profit.totals.sell)}</th>
                  <th>{fmtMoney(profit.totals.cost)}</th>
                  <th className={profit.totals.profit >= 0 ? 'pos' : 'neg'}>{fmtMoney(profit.totals.profit)}</th>
                  <th>{profit.totals.margin.toFixed(1)}%</th>
                </tr>
              </tfoot>
            </table>
          )}
        </Card>
      )}

      {tab === 'documents' && (
        <div className="grid-2">
          <Card
            title={`Purchase Order Report — ${rangeLabel}`}
            action={
              <>
                <Select value={poStatus} onChange={(e) => setPoStatus(e.target.value)} className="input-sm" style={{ maxWidth: 180, marginRight: 8 }}>
                  <option value="All">All statuses</option>
                  {['Confirmed', 'In Production', 'On Hold', 'Dispatched'].map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
                <Btn tone="ghost" onClick={poReportCSV}>Export CSV</Btn>
                <Btn tone="ghost" onClick={() => printDoc({ title: 'Purchase Order Report', subtitle: `${rangeLabel} · ${posInRangeFiltered.length} orders`, columns: poDocCols, rows: poDocRows })}>Print / PDF</Btn>
              </>
            }
          >
            {posInRangeFiltered.length === 0 ? (
              <Empty>No POs in this period.</Empty>
            ) : (
              <table className="table">
                <thead><tr>{poDocCols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {posInRangeFiltered.map((o) => (
                    <tr key={o.id}>
                      <td className="strong">{o.poNumber}</td>
                      <td>{rName(o.retailerId)}</td>
                      <td>{o.orderDate || '-'}</td>
                      <td>{o.deliveryDate || '-'}</td>
                      <td>{styles.filter((s) => s.poId === o.id).length}</td>
                      <td>{fmtMoney(o.value)}</td>
                      <td><StageBadge stage={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Fabric Requirement" action={
            <>
              <Btn tone="ghost" onClick={() => downloadCSV(`fabric-requirement-${new Date().toISOString().slice(0, 10)}.csv`, frCols, fabricReq.map((f) => [f.name, f.type, f.uom, f.vendor || '', f.stock, f.required, f.available, f.status]))}>Export CSV</Btn>
              <Btn tone="ghost" onClick={() => printDoc({ title: 'Fabric Requirement', subtitle: 'Required for current work-in-progress (open styles)', columns: frCols, rows: frRows })}>Print / PDF</Btn>
            </>
          }>
            {fabricReq.length === 0 ? (
              <Empty>No fabrics in stock.</Empty>
            ) : (
              <table className="table">
                <thead><tr>{frCols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {fabricReq.map((f, i) => (
                    <tr key={i}>
                      <td className="strong">{f.name}</td>
                      <td>{f.type}</td>
                      <td>{f.uom}</td>
                      <td>{f.vendor || '-'}</td>
                      <td>{f.stock}</td>
                      <td>{f.required}</td>
                      <td className={f.available < 0 ? 'neg' : ''}>{f.available}</td>
                      <td>{f.status === 'reorder' ? 'Reorder' : f.status === 'short' ? 'Short' : 'OK'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Delivery Challan" action={
            <>
              <Field label="Order">
                <Select value={challanPo} onChange={(e) => setChallanPo(e.target.value)}>
                  {posInRangeFiltered.map((o) => <option key={o.id} value={o.id}>{o.poNumber} — {rName(o.retailerId)}</option>)}
                </Select>
              </Field>
              <Btn tone="ghost" disabled={!challan} onClick={() => printDoc({ title: `Delivery Challan — ${challan ? challan.poNumber : ''}`, subtitle: `${challan ? rName(challan.retailerId) + ' · due ' + (challan.deliveryDate ? challan.deliveryDate : '-') : ''}`, columns: challanCols, rows: challanDocRows })}>Print / PDF</Btn>
            </>
          }>
            {!challan ? (
              <Empty>No orders in this period. Pick an order above.</Empty>
            ) : (
              <table className="table">
                <thead><tr>{challanCols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {challanLines.map((s) => (
                    <tr key={s.id}>
                      <td className="strong">{s.styleCode}</td>
                      <td>{s.styleName}</td>
                      <td>{s.color || '-'}</td>
                      <td>{s.size || '-'}</td>
                      <td>{s.quantity}</td>
                      <td>{s.qtyDispatched || 0}</td>
                      <td>{(Number(s.quantity) || 0) - (Number(s.qtyDispatched) || 0)}</td>
                      <td>{fmtMoney(Number(s.quantity) * (Number(s.price) || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}