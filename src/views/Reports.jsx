import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { Card, StageBadge, DueBadge, Btn, Empty, fmtMoney } from '../components/ui.jsx'
import { STAGES } from '../lib.js'
import { exportToSheet } from '../services/sheets.js'
import { useToast } from '../context/ToastContext.jsx'

export default function Reports({ ctx }) {
  const { db } = ctx
  const { push } = useToast()
  const [wip, setWip] = useState(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    api.get('/api/reports/wip').then(setWip).catch(() => {})
  }, [db])

  const byStage = useMemo(() => {
    if (!wip) return []
    const m = {}
    wip.forEach((r) => (m[r.stage] = (m[r.stage] || 0) + 1))
    return STAGES.filter((s) => m[s]).map((s) => ({ stage: s, count: m[s] }))
  }, [wip])

  const byRetailer = useMemo(() => {
    if (!wip) return []
    const m = {}
    wip.forEach((r) => (m[r.retailer] = (m[r.retailer] || 0) + r.quantity))
    return Object.entries(m)
      .map(([retailer, qty]) => ({ retailer, qty }))
      .sort((a, b) => b.qty - a.qty)
  }, [wip])

  const atRisk = useMemo(() => (wip || []).filter((r) => r.status !== 'Dispatched' && r.daysLeft !== null && r.daysLeft <= 7), [wip])

  const wipExport = useMemo(() => {
    if (!wip) return null
    const cols = ['Style Code', 'Style Name', 'Category', 'Sub-category', 'PO', 'Retailer', 'Qty', 'Dispatched', 'Stage', 'Days in Stage', 'Delivery Date', 'Days Left', 'Status']
    const rows = wip.map((r) => [r.styleCode, r.styleName, r.category, r.subCategory, r.poNumber, r.retailer, r.quantity, r.qtyDispatched, r.stage, r.daysInStage, r.deliveryDate, r.daysLeft, r.status])
    return { cols, rows }
  }, [wip])

  function exportCSV() {
    if (!wipExport) return
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = [
      wipExport.cols.map(esc).join(','),
      ...wipExport.rows.map((r) => r.map(esc).join(','))
    ]
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
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
      .then((res) => push(`Exported ${res.count} rows to Google Sheets`, 'success'))
      .catch((e) => push(e.message, 'danger'))
      .finally(() => setExporting(false))
  }

  return (
    <div className="grid-2">
      <div>
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
          {!wip ? (
            <Empty>Loading…</Empty>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Style</th>
                  <th>PO</th>
                  <th>Retailer</th>
                  <th>Qty</th>
                  <th>Stage</th>
                  <th>Delivery</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {wip.map((r, i) => (
                  <tr key={i}>
                    <td className="strong">
                      {r.styleCode}
                      <div className="cell-sub">
                        {r.styleName} · {r.category}
                        {r.subCategory ? ` / ${r.subCategory}` : ''}
                      </div>
                    </td>
                    <td>{r.poNumber}</td>
                    <td>{r.retailer}</td>
                    <td>
                      {r.quantity}
                      {r.qtyDispatched > 0 && <div className="cell-sub">dsp {r.qtyDispatched}</div>}
                    </td>
                    <td>
                      <StageBadge stage={r.stage} />
                      <div className="cell-sub">{r.daysInStage}d in stage</div>
                    </td>
                    <td>{r.deliveryDate || '-'}</td>
                    <td>{r.daysLeft === null ? '—' : <DueBadge dateStr={r.deliveryDate} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

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
                    <div
                      className={`pipeline-fill ${stage === 'Dispatched' ? 'fill-done' : ''}`}
                      style={{ width: `${(count / Math.max(...byStage.map((b) => b.count))) * 100}%` }}
                    />
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
              <thead>
                <tr>
                  <th>Retailer</th>
                  <th>Pieces</th>
                </tr>
              </thead>
              <tbody>
                {byRetailer.map((r) => (
                  <tr key={r.retailer}>
                    <td>{r.retailer}</td>
                    <td className="strong">{r.qty}</td>
                  </tr>
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
              <thead>
                <tr>
                  <th>Style</th>
                  <th>Delivery</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {atRisk.map((r, i) => (
                  <tr key={i}>
                    <td className="strong">{r.styleCode}</td>
                    <td>{r.deliveryDate}</td>
                    <td><DueBadge dateStr={r.deliveryDate} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  )
}
