import React from 'react'
import { api } from '../api.js'
import { computeAlerts } from '../services/reports.js'
import { Badge, StageBadge, DueBadge, Kpi, Btn, Empty, fmtMoney, fmtDate } from './ui.jsx'
import { STAGES, CATEGORY_NAMES, stageIndex, daysFromToday } from '../lib.js'
import { downloadCSV } from '../lib/export.js'

const todayStr = () => new Date().toISOString().slice(0, 10)

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const retailerName = (db, id) => db.retailers.find((r) => r.id === id)?.name || '-'

function riskFor(db, po) {
  const s = db.styles.filter((x) => x.poId === po.id)
  const done = s.length > 0 && s.every((x) => x.stage === 'Dispatched')
  const days = po.deliveryDate ? daysFromToday(po.deliveryDate) : null
  if (done || po.status === 'Dispatched') return { label: 'Dispatched', tone: 'success' }
  if (days === null) return { label: 'No date', tone: 'default' }
  if (days < 0) return { label: 'Overdue', tone: 'danger' }
  if (days <= 7) return { label: 'Due soon', tone: 'warn' }
  return { label: 'On track', tone: 'success' }
}

const VENDOR_TYPE_BY_STAGE = {
  'Embroidery-Kolkata': 'Embroidery-Kolkata',
  'Embroidery-Mumbai': 'Embroidery-Mumbai',
  Fabric: 'Fabric',
  Trims: 'Trims',
  Stitching: 'Stitching',
  Finishing: 'Stitching',
  Cutting: 'Stitching'
}

function vendorsForStage(db, stage) {
  const type = VENDOR_TYPE_BY_STAGE[stage]
  return type ? db.vendors.filter((v) => v.type === type) : []
}

const ALERT_TYPE_TONE = { overdue: 'danger', 'due-soon': 'warn', stuck: 'warn', sampling: 'info', stock: 'info' }
const ALERT_TYPE_LABEL = { overdue: 'Overdue', 'due-soon': 'Due Soon', stuck: 'Stuck Stage', sampling: 'Sampling', stock: 'Low Stock' }

function alertRef(db, a) {
  if (a.type === 'stock') {
    const f = db.fabrics.find((x) => a.title === `Low stock: ${x.name}`)
    return f ? { kind: 'fabric', id: f.id } : null
  }
  const code = String(a.detail).match(/^(\S+)/)?.[1]
  const po = db.purchaseOrders.find((o) => o.poNumber === code)
  if (po) return { kind: 'order', id: po.id }
  const style = db.styles.find((s) => s.styleCode === code)
  if (style) return { kind: 'style', id: style.id }
  return null
}

function Bars({ items }) {
  const max = Math.max(1, ...items.map((i) => Number(i.value)))
  return (
    <div className="dd-bars">
      {items.map(({ label, value, tone }) => (
        <div key={label} className="dd-bar-row">
          <div className="dd-bar-label">{label}</div>
          <div className="dd-bar-track">
            <div className={`dd-bar-fill ${tone ? 'dd-bar-' + tone : ''}`} style={{ width: `${(Number(value) / max) * 100}%` }} />
          </div>
          <div className="dd-bar-value">{value}</div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Quick actions (mutate via api, then refresh)
// ---------------------------------------------------------------------------

function markDispatched(db, refresh, po, push) {
  const stylesFor = db.styles.filter((s) => s.poId === po.id)
  const tasks = stylesFor
    .filter((s) => s.stage !== 'Dispatched')
    .map((s) =>
      api.put('/api/styles/' + s.id, {
        stage: 'Dispatched',
        stageEnteredAt: todayStr(),
        qtyDispatched: s.quantity,
        note: 'Marked dispatched from drill-down'
      })
    )
  tasks.push(api.put('/api/purchaseOrders/' + po.id, { status: 'Dispatched' }))
  Promise.all(tasks)
    .then(() => {
      push(`PO ${po.poNumber} marked as dispatched`, 'success')
      refresh()
    })
    .catch((e) => push(e.message, 'danger'))
}

function advanceStyle(db, refresh, style, push) {
  const idx = stageIndex(style.stage)
  if (idx >= STAGES.length - 1) return
  const next = STAGES[idx + 1]
  api
    .put('/api/styles/' + style.id, {
      stage: next,
      stageEnteredAt: todayStr(),
      ...(next === 'Dispatched' ? { qtyDispatched: style.quantity } : {}),
      note: `Advanced to ${next} from drill-down`
    })
    .then(() => {
      push(`Advanced ${style.styleCode} to ${next}`, 'success')
      refresh()
    })
    .catch((e) => push(e.message, 'danger'))
}

function exportPo(db, po) {
  const stylesFor = db.styles.filter((s) => s.poId === po.id)
  const cols = ['PO', 'Retailer', 'Style Code', 'Style Name', 'Category', 'Sub-category', 'Qty', 'Unit Price', 'Stage', 'Fabric', 'Trim', 'Qty Dispatched']
  const rows = stylesFor.map((s) => [
    po.poNumber, retailerName(db, po.retailerId), s.styleCode, s.styleName,
    s.category, s.subCategory || '', s.quantity, s.price, s.stage, s.fabric || '', s.trim || '', s.qtyDispatched || 0
  ])
  downloadCSV(`po-${po.poNumber}.csv`, cols, rows)
}

// ---------------------------------------------------------------------------
// Detail views
// ---------------------------------------------------------------------------

function PoDetail({ row, ctx }) {
  const { db, refresh, navigate, push, openKind } = ctx
  const po = row.po
  const stylesFor = db.styles.filter((s) => s.poId === po.id)
  const r = db.retailers.find((x) => x.id === po.retailerId)
  const risk = row.risk || riskFor(db, po)

  const partners = []
  stylesFor.forEach((s) => vendorsForStage(db, s.stage).forEach((v) => {
    if (!partners.find((p) => p.id === v.id)) partners.push(v)
  }))

  const timeline = []
  stylesFor.forEach((s) =>
    (s.history || []).forEach((h) => timeline.push({ ...h, styleCode: s.styleCode }))
  )
  timeline.sort((a, b) => (a.at < b.at ? 1 : -1))

  const facts = [
    ['PO Number', po.poNumber],
    ['Retailer', r ? `${r.name} · ${r.city} · ${r.contact}` : '-'],
    ['Order Date', fmtDate(po.orderDate)],
    ['Delivery Date', fmtDate(po.deliveryDate)],
    ['Status', <StageBadge stage={po.status} />],
    ['Risk', <Badge tone={risk.tone}>{risk.label}</Badge>],
    ['Value', <span className="strong">{fmtMoney(po.value)}</span>],
    ['Styles', stylesFor.length]
  ]

  return (
    <div className="dd-detail">
      <div className="dd-actions">
        <Btn onClick={() => markDispatched(db, refresh, po, push)} disabled={po.status === 'Dispatched'}>
          ✓ Mark Dispatched
        </Btn>
        <Btn tone="ghost" onClick={() => navigate('orders')}>
          Edit in Purchase Orders
        </Btn>
        <Btn tone="ghost" onClick={() => exportPo(db, po)}>
          ⤓ Export PO
        </Btn>
      </div>

      <div className="dd-facts">
        {facts.map(([k, v]) => (
          <div className="dd-fact" key={k}>
            <div className="dd-fact-label">{k}</div>
            <div className="dd-fact-value">{v}</div>
          </div>
        ))}
      </div>

      {po.notes && <div className="dd-note">Notes: {po.notes}</div>}

      <div className="dd-section">
        <div className="dd-section-title">Order Lines ({stylesFor.length})</div>
        {stylesFor.length === 0 ? (
          <Empty>No style lines for this PO.</Empty>
        ) : (
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Style</th>
                <th>Category</th>
                <th>Sub-category</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Stage</th>
              </tr>
            </thead>
            <tbody>
              {stylesFor.map((s) => (
                <tr key={s.id} className="row-click" onClick={() => openKind('pipeline', s.id)}>
                  <td className="strong">
                    {s.styleCode}
                    <div className="cell-sub">{s.styleName}</div>
                  </td>
                  <td>{s.category}</td>
                  <td>{s.subCategory || '-'}</td>
                  <td>{s.quantity}</td>
                  <td>{fmtMoney(s.price)}</td>
                  <td><StageBadge stage={s.stage} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="dd-section">
        <div className="dd-section-title">Assigned Partners / Factories</div>
        {partners.length === 0 ? (
          <div className="muted" style={{ fontSize: 12 }}>No external partner currently assigned to the open styles.</div>
        ) : (
          <div className="dd-partners">
            {partners.map((v) => (
              <div key={v.id} className="dd-partner">
                <div className="dd-partner-name">{v.name}</div>
                <div className="dd-partner-sub">{v.type} · {v.location}</div>
                <div className="dd-partner-sub muted">{v.contact}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dd-section">
        <div className="dd-section-title">Activity Timeline / Audit Trail</div>
        {timeline.length === 0 ? (
          <div className="muted" style={{ fontSize: 12 }}>No stage movements recorded yet.</div>
        ) : (
          <div className="timeline">
            {timeline.slice(0, 60).map((h, i) => (
              <div className="timeline-item" key={i}>
                <div className="timeline-dot" />
                <div className="timeline-body">
                  <div className="timeline-date">{h.at} · {h.styleCode}</div>
                  <div className="timeline-event">
                    {h.from ? <><StageBadge stage={h.from} /> → <StageBadge stage={h.to} /></> : <StageBadge stage={h.to} />}
                    {h.note && <span className="timeline-note"> — {h.note}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StyleDetail({ row, ctx }) {
  const { db, refresh, navigate, push, openKind } = ctx
  const s = row.style
  const po = db.purchaseOrders.find((o) => o.id === s.poId)
  const nextStage = s.stage === 'Dispatched' ? null : STAGES[stageIndex(s.stage) + 1]
  const partners = vendorsForStage(db, s.stage)

  return (
    <div className="dd-detail">
      <div className="dd-actions">
        <Btn onClick={() => advanceStyle(db, refresh, s, push)} disabled={!nextStage}>
          {nextStage ? `Advance to ${nextStage} ▶` : 'Fully Dispatched'}
        </Btn>
        <Btn tone="ghost" onClick={() => navigate('tracker')}>
          Edit in Production Tracker
        </Btn>
        {po && <Btn tone="ghost" onClick={() => openKind('orders', po.id)}>View Parent PO</Btn>}
      </div>

      {s.image && <img className="dd-image" src={s.image} alt={s.styleCode} />}

      <div className="dd-facts">
        {[
          ['Style Code', <span className="strong">{s.styleCode}</span>],
          ['Style Name', s.styleName || '-'],
          ['PO', po ? po.poNumber : '-'],
          ['Retailer', po ? retailerName(db, po.retailerId) : '-'],
          ['Category', s.category],
          ['Sub-category', s.subCategory || '-'],
          ['Quantity', s.quantity],
          ['Unit Price', fmtMoney(s.price)],
          ['Stage', <StageBadge stage={s.stage} />],
          ['Days in Stage', s.stageEnteredAt ? Math.max(1, Math.ceil((new Date() - new Date(s.stageEnteredAt + 'T00:00:00')) / 86400000)) + 'd' : '-'],
          ['Qty Dispatched', s.qtyDispatched || 0],
          ['Delivery', po ? fmtDate(po.deliveryDate) : '-']
        ].map(([k, v]) => (
          <div className="dd-fact" key={k}>
            <div className="dd-fact-label">{k}</div>
            <div className="dd-fact-value">{v}</div>
          </div>
        ))}
      </div>

      {(s.fabric || s.trim) && (
        <div className="dd-facts">
          <div className="dd-fact"><div className="dd-fact-label">Fabric</div><div className="dd-fact-value">{s.fabric || '-'}</div></div>
          <div className="dd-fact"><div className="dd-fact-label">Trims</div><div className="dd-fact-value">{s.trim || '-'}</div></div>
        </div>
      )}

      {s.notes && <div className="dd-note">Notes: {s.notes}</div>}

      <div className="dd-section">
        <div className="dd-section-title">Assigned Partner — {s.stage}</div>
        {partners.length === 0 ? (
          <div className="muted" style={{ fontSize: 12 }}>No external partner assigned for this stage.</div>
        ) : (
          <div className="dd-partners">
            {partners.map((v) => (
              <div key={v.id} className="dd-partner">
                <div className="dd-partner-name">{v.name}</div>
                <div className="dd-partner-sub">{v.type} · {v.location} · {v.contact}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dd-section">
        <div className="dd-section-title">Stage History / Audit Trail</div>
        {(s.history || []).length === 0 ? (
          <div className="muted" style={{ fontSize: 12 }}>No stage changes recorded yet.</div>
        ) : (
          <div className="timeline">
            {s.history.slice().reverse().map((h, i) => (
              <div className="timeline-item" key={i}>
                <div className="timeline-dot" />
                <div className="timeline-body">
                  <div className="timeline-date">{h.at}</div>
                  <div className="timeline-event">
                    {h.from ? <><StageBadge stage={h.from} /> → <StageBadge stage={h.to} /></> : <StageBadge stage={h.to} />}
                    {h.note && <span className="timeline-note"> — {h.note}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RetailerDetail({ row, ctx }) {
  const { db, openKind } = ctx
  const r = row.retailer
  const orders = db.purchaseOrders.filter((o) => o.retailerId === r.id)
  return (
    <div className="dd-detail">
      <div className="dd-facts">
        {[
          ['Retailer', <span className="strong">{r.name}</span>],
          ['City', r.city || '-'],
          ['Contact', r.contact || '-'],
          ['Orders', orders.length],
          ['Styles', row.styles],
          ['Order Value', <span className="strong">{fmtMoney(row.value)}</span>],
          ['At Risk', <Badge tone={row.atRisk > 0 ? 'danger' : 'success'}>{row.atRisk > 0 ? `${row.atRisk} at risk` : 'None'}</Badge>]
        ].map(([k, v]) => (
          <div className="dd-fact" key={k}>
            <div className="dd-fact-label">{k}</div>
            <div className="dd-fact-value">{v}</div>
          </div>
        ))}
      </div>

      <div className="dd-section">
        <div className="dd-section-title">Orders for {r.name} ({orders.length})</div>
        {orders.length === 0 ? (
          <Empty>No purchase orders for this retailer.</Empty>
        ) : (
          <table className="table table-sm">
            <thead>
              <tr>
                <th>PO</th>
                <th>Order Date</th>
                <th>Delivery</th>
                <th>Value</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="strong">{o.poNumber}</td>
                  <td>{fmtDate(o.orderDate)}</td>
                  <td>{fmtDate(o.deliveryDate)}</td>
                  <td>{fmtMoney(o.value)}</td>
                  <td><StageBadge stage={o.status} /></td>
                  <td className="row-actions">
                    <Btn tone="ghost" onClick={() => openKind('orders', o.id)}>Open</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function AlertDetail({ row, ctx }) {
  const { db, navigate, openKind } = ctx
  const a = row
  const ref = alertRef(db, a)
  return (
    <div className="dd-detail">
      <div className={`alert alert-${a.severity}`} style={{ marginBottom: 16 }}>
        <span className={`badge badge-${a.severity === 'critical' ? 'danger' : a.severity === 'warning' ? 'warn' : 'info'}`}>
          {ALERT_TYPE_LABEL[a.type] || a.type}
        </span>
        <div className="alert-text">
          <div className="alert-title">{a.title}</div>
          <div className="alert-detail">{a.detail}</div>
        </div>
        {a.date && <div className="alert-date">{fmtDate(a.date)}</div>}
      </div>
      <div className="dd-facts">
        {[
          ['Severity', <Badge tone={a.severity === 'critical' ? 'danger' : a.severity === 'warning' ? 'warn' : 'info'}>{a.severity}</Badge>],
          ['Type', ALERT_TYPE_LABEL[a.type] || a.type],
          ['Date', a.date ? fmtDate(a.date) : '-']
        ].map(([k, v]) => (
          <div className="dd-fact" key={k}>
            <div className="dd-fact-label">{k}</div>
            <div className="dd-fact-value">{v}</div>
          </div>
        ))}
      </div>
      {ref && (
        <div className="dd-actions">
          {ref.kind === 'order' && <Btn onClick={() => openKind('orders', ref.id)}>Open Purchase Order</Btn>}
          {ref.kind === 'style' && <Btn onClick={() => openKind('pipeline', ref.id)}>Open Job Card</Btn>}
          {ref.kind === 'fabric' && <Btn onClick={() => navigate('partners')}>Open Fabric Stock</Btn>}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Kind configurations (5 dashboard widgets)
// ---------------------------------------------------------------------------

const poRow = (db, po) => {
  const styles = db.styles.filter((s) => s.poId === po.id)
  const risk = riskFor(db, po)
  return {
    _id: po.id,
    po,
    retailer: retailerName(db, po.retailerId),
    styleCount: styles.length,
    value: Number(po.value) || 0,
    risk
  }
}

const retailerOptions = (db) => db.retailers.map((r) => ({ value: r.id, label: `${r.name} — ${r.city}` }))

export const KINDS = {
  alerts: {
    title: 'Alerts & Reminders',
    icon: '⚠',
    getRows: (db) => computeAlerts(db).map((a, i) => ({ _id: i, ...a })),
    columns: [
      { key: 'severity', label: 'Severity', value: (r) => r.severity, render: (r) => <Badge tone={toneBySeverity(r.severity)}>{r.severity}</Badge> },
      { key: 'type', label: 'Type', value: (r) => ALERT_TYPE_LABEL[r.type] || r.type, render: (r) => <Badge tone={ALERT_TYPE_TONE[r.type]}>{ALERT_TYPE_LABEL[r.type] || r.type}</Badge> },
      { key: 'title', label: 'Alert', value: (r) => r.title, render: (r) => <span className="strong">{r.title}</span> },
      { key: 'detail', label: 'Details', value: (r) => r.detail, render: (r) => <span className="cell-sub">{r.detail}</span> },
      { key: 'date', label: 'Date', value: (r) => r.date || '', render: (r) => (r.date ? fmtDate(r.date) : '-') }
    ],
    filters: [
      { key: 'severity', label: 'Severity', options: () => [{ value: 'critical', label: 'Critical' }, { value: 'warning', label: 'Warning' }, { value: 'info', label: 'Info' }], match: (r, v) => r.severity === v },
      { key: 'type', label: 'Type', options: () => Object.entries(ALERT_TYPE_LABEL).map(([v, l]) => ({ value: v, label: l })), match: (r, v) => r.type === v }
    ],
    groupOptions: [
      { value: 'severity', label: 'Group by severity' },
      { value: 'type', label: 'Group by type' }
    ],
    groupValue: (r, g) => (g === 'type' ? ALERT_TYPE_LABEL[r.type] || r.type : r.severity),
    matchQuery: (r, q) => (r.title + ' ' + r.detail).toLowerCase().includes(q),
    renderAnalytics: (rows) => (
      <div className="dd-kpis">
        <Kpi label="Critical" value={rows.filter((r) => r.severity === 'critical').length} tone="danger" />
        <Kpi label="Warning" value={rows.filter((r) => r.severity === 'warning').length} tone="warn" />
        <Kpi label="Info" value={rows.filter((r) => r.severity === 'info').length} tone="gold" />
        <Kpi label="Total Alerts" value={rows.length} tone="ink" />
      </div>
    ),
    renderDetail: (row, ctx) => <AlertDetail row={row} ctx={ctx} />
  },

  deliveries: {
    title: 'Upcoming Deliveries',
    icon: '❖',
    getRows: (db) => db.purchaseOrders.map((po) => poRow(db, po)),
    columns: [
      { key: 'po', label: 'PO', value: (r) => r.po.poNumber, render: (r) => <span className="strong">{r.po.poNumber}</span> },
      { key: 'retailer', label: 'Retailer', value: (r) => r.retailer },
      { key: 'styleCount', label: 'Styles', value: (r) => r.styleCount },
      { key: 'value', label: 'Value', value: (r) => r.value, render: (r) => fmtMoney(r.value) },
      { key: 'delivery', label: 'Delivery', value: (r) => r.po.deliveryDate || '', render: (r) => fmtDate(r.po.deliveryDate) },
      { key: 'due', label: 'Due', value: (r) => (r.po.deliveryDate ? daysFromToday(r.po.deliveryDate) : null), render: (r) => (r.po.deliveryDate ? <DueBadge dateStr={r.po.deliveryDate} /> : <span className="muted">—</span>) },
      { key: 'status', label: 'Status', value: (r) => r.po.status, render: (r) => <StageBadge stage={r.po.status} /> }
    ],
    filters: [
      { key: 'retailer', label: 'Retailers', options: retailerOptions, match: (r, v) => r.po.retailerId === v },
      { key: 'risk', label: 'Risk', options: () => [
        { value: 'Overdue', label: 'Overdue' }, { value: 'Due soon', label: 'Due soon' },
        { value: 'On track', label: 'On track' }, { value: 'Dispatched', label: 'Dispatched' }
      ], match: (r, v) => r.risk.label === v }
    ],
    groupOptions: [
      { value: 'risk', label: 'Group by risk' },
      { value: 'retailer', label: 'Group by retailer' },
      { value: 'status', label: 'Group by status' }
    ],
    groupValue: (r, g) => (g === 'risk' ? r.risk.label : g === 'retailer' ? r.retailer : r.po.status),
    matchQuery: (r, q) => (r.po.poNumber + ' ' + r.retailer).toLowerCase().includes(q),
    renderAnalytics: (rows) => {
      const overdue = rows.filter((r) => r.risk.label === 'Overdue')
      const dueSoon = rows.filter((r) => r.risk.label === 'Due soon')
      const atRiskValue = [...overdue, ...dueSoon].reduce((s, r) => s + r.value, 0)
      return (
        <div>
          <div className="dd-kpis">
            <Kpi label="Overdue" value={overdue.length} tone={overdue.length ? 'danger' : 'ok'} />
            <Kpi label="Due ≤ 7d" value={dueSoon.length} tone={dueSoon.length ? 'warn' : 'ok'} />
            <Kpi label="On Track" value={rows.filter((r) => r.risk.label === 'On track').length} tone="ok" />
            <Kpi label="At-Risk Value" value={fmtMoney(atRiskValue)} tone="ink" />
          </div>
          <Bars items={['Overdue', 'Due soon', 'On track', 'Dispatched'].map((l) => ({
            label: l,
            value: rows.filter((r) => r.risk.label === l).length,
            tone: l === 'Overdue' ? 'danger' : l === 'Due soon' ? 'warn' : 'ok'
          }))} />
        </div>
      )
    },
    renderDetail: (row, ctx) => <PoDetail row={row} ctx={ctx} />
  },

  pipeline: {
    title: 'Production Pipeline',
    icon: '▶',
    getRows: (db) =>
      db.styles.map((s) => {
        const po = db.purchaseOrders.find((o) => o.id === s.poId)
        const retailer = po ? retailerName(db, po.retailerId) : '-'
        const daysInStage = s.stageEnteredAt ? Math.max(1, Math.ceil((new Date() - new Date(s.stageEnteredAt + 'T00:00:00')) / 86400000)) : 0
        return {
          _id: s.id,
          style: s,
          poNumber: po ? po.poNumber : '-',
          retailer,
          category: s.category,
          subCategory: s.subCategory || '',
          stage: s.stage,
          qty: Number(s.quantity) || 0,
          qtyDispatched: s.qtyDispatched || 0,
          daysInStage,
          deliveryDate: po ? po.deliveryDate : null
        }
      }),
    columns: [
      { key: 'style', label: 'Style', value: (r) => r.style.styleCode, render: (r) => (
        <div className="style-cell">
          {r.style.image && <img className="style-thumb" src={r.style.image} alt="" />}
          <div>
            <span className="strong">{r.style.styleCode}</span>
            <div className="cell-sub">{r.style.styleName}</div>
          </div>
        </div>
      ) },
      { key: 'poNumber', label: 'PO', value: (r) => r.poNumber },
      { key: 'retailer', label: 'Retailer', value: (r) => r.retailer },
      { key: 'category', label: 'Category', value: (r) => r.category + (r.subCategory ? ' / ' + r.subCategory : ''), render: (r) => (
        <span>{r.category}{r.subCategory && <div className="cell-sub">{r.subCategory}</div>}</span>
      ) },
      { key: 'qty', label: 'Qty', value: (r) => r.qty },
      { key: 'stage', label: 'Stage', value: (r) => r.stage, render: (r) => <StageBadge stage={r.stage} /> },
      { key: 'daysInStage', label: 'Days', value: (r) => r.daysInStage, render: (r) => <span>{r.daysInStage}d</span> },
      { key: 'deliveryDate', label: 'Delivery', value: (r) => r.deliveryDate || '', render: (r) => (r.deliveryDate ? fmtDate(r.deliveryDate) : '-') }
    ],
    filters: [
      { key: 'stage', label: 'Stages', options: () => STAGES.map((s) => ({ value: s, label: s })), match: (r, v) => r.stage === v },
      { key: 'category', label: 'Categories', options: () => CATEGORY_NAMES.map((c) => ({ value: c, label: c })), match: (r, v) => r.category === v }
    ],
    groupOptions: [
      { value: 'stage', label: 'Group by stage' },
      { value: 'category', label: 'Group by category' },
      { value: 'retailer', label: 'Group by retailer' }
    ],
    groupValue: (r, g) => (g === 'stage' ? r.stage : g === 'category' ? r.category : r.retailer),
    matchQuery: (r, q) => (r.style.styleCode + ' ' + r.style.styleName + ' ' + r.poNumber + ' ' + r.retailer).toLowerCase().includes(q),
    renderAnalytics: (rows) => {
      const counts = {}
      STAGES.forEach((s) => (counts[s] = 0))
      rows.forEach((r) => (counts[r.stage] = (counts[r.stage] || 0) + 1))
      const inProduction = rows.filter((r) => r.stage !== 'Dispatched').length
      return (
        <div>
          <div className="dd-kpis">
            <Kpi label="Total Job Cards" value={rows.length} tone="ink" />
            <Kpi label="In Production" value={inProduction} tone="gold" />
            <Kpi label="Dispatched" value={rows.length - inProduction} tone="ok" />
            <Kpi label="Stages Active" value={STAGES.filter((s) => counts[s] > 0).length} tone="maroon" />
          </div>
          <div className="pipeline">
            {STAGES.map((s) => (
              <div key={s} className="pipeline-row">
                <div className="pipeline-label">{s}</div>
                <div className="pipeline-track">
                  <div className={`pipeline-fill ${s === 'Dispatched' ? 'fill-done' : ''}`} style={{ width: `${(counts[s] / Math.max(1, ...STAGES.map((x) => counts[x]))) * 100}%` }} />
                </div>
                <div className="pipeline-count">{counts[s]}</div>
              </div>
            ))}
          </div>
        </div>
      )
    },
    renderDetail: (row, ctx) => <StyleDetail row={row} ctx={ctx} />
  },

  orders: {
    title: 'Recent Purchase Orders',
    icon: '▤',
    getRows: (db) => db.purchaseOrders.map((po) => poRow(db, po)),
    columns: [
      { key: 'po', label: 'PO', value: (r) => r.po.poNumber, render: (r) => <span className="strong">{r.po.poNumber}</span> },
      { key: 'retailer', label: 'Retailer', value: (r) => r.retailer },
      { key: 'orderDate', label: 'Order Date', value: (r) => r.po.orderDate || '', render: (r) => fmtDate(r.po.orderDate) },
      { key: 'delivery', label: 'Delivery', value: (r) => r.po.deliveryDate || '', render: (r) => fmtDate(r.po.deliveryDate) },
      { key: 'value', label: 'Value', value: (r) => r.value, render: (r) => fmtMoney(r.value) },
      { key: 'styleCount', label: 'Styles', value: (r) => r.styleCount },
      { key: 'status', label: 'Status', value: (r) => r.po.status, render: (r) => <StageBadge stage={r.po.status} /> }
    ],
    filters: [
      { key: 'status', label: 'Statuses', options: () => ['Confirmed', 'In Production', 'On Hold', 'Dispatched'].map((s) => ({ value: s, label: s })), match: (r, v) => r.po.status === v },
      { key: 'retailer', label: 'Retailers', options: retailerOptions, match: (r, v) => r.po.retailerId === v }
    ],
    groupOptions: [
      { value: 'status', label: 'Group by status' },
      { value: 'retailer', label: 'Group by retailer' }
    ],
    groupValue: (r, g) => (g === 'status' ? r.po.status : r.retailer),
    matchQuery: (r, q) => (r.po.poNumber + ' ' + r.retailer + ' ' + r.po.notes).toLowerCase().includes(q),
    renderAnalytics: (rows) => {
      const openValue = rows.filter((o) => o.po.status !== 'Dispatched').reduce((s, r) => s + r.value, 0)
      const byStatus = {}
      rows.forEach((r) => (byStatus[r.po.status] = (byStatus[r.po.status] || 0) + 1))
      return (
        <div>
          <div className="dd-kpis">
            <Kpi label="Total Orders" value={rows.length} tone="ink" />
            <Kpi label="Open Orders" value={rows.filter((o) => o.po.status !== 'Dispatched').length} tone="gold" />
            <Kpi label="Open Value" value={fmtMoney(openValue)} tone="maroon" />
            <Kpi label="Dispatched" value={rows.filter((o) => o.po.status === 'Dispatched').length} tone="ok" />
          </div>
          <Bars items={['Confirmed', 'In Production', 'On Hold', 'Dispatched'].map((s) => ({
            label: s, value: byStatus[s] || 0,
            tone: s === 'Dispatched' ? 'ok' : s === 'On Hold' ? 'warn' : 'accent'
          }))} />
        </div>
      )
    },
    renderDetail: (row, ctx) => <PoDetail row={row} ctx={ctx} />
  },

  retailers: {
    title: 'Order Value by Retailer',
    icon: '✦',
    getRows: (db) =>
      db.retailers.map((r) => {
        const orders = db.purchaseOrders.filter((o) => o.retailerId === r.id)
        const stylesCount = db.styles.filter((s) => orders.some((o) => o.id === s.poId)).length
        return {
          _id: r.id,
          retailer: r,
          name: r.name,
          city: r.city || '-',
          orders: orders.length,
          styles: stylesCount,
          value: orders.reduce((s, o) => s + (Number(o.value) || 0), 0),
          atRisk: orders.filter((o) => ['Overdue', 'Due soon'].includes(riskFor(db, o).label)).length
        }
      }),
    columns: [
      { key: 'name', label: 'Retailer', value: (r) => r.name, render: (r) => <span className="strong">{r.name}</span> },
      { key: 'city', label: 'City', value: (r) => r.city },
      { key: 'orders', label: 'Orders', value: (r) => r.orders },
      { key: 'styles', label: 'Styles', value: (r) => r.styles },
      { key: 'value', label: 'Order Value', value: (r) => r.value, render: (r) => fmtMoney(r.value) },
      { key: 'atRisk', label: 'At Risk', value: (r) => r.atRisk, render: (r) => <Badge tone={r.atRisk > 0 ? 'danger' : 'success'}>{r.atRisk}</Badge> }
    ],
    filters: [
      { key: 'city', label: 'Cities', options: (db) => [...new Set(db.retailers.map((r) => r.city).filter(Boolean))].map((c) => ({ value: c, label: c })), match: (r, v) => r.city === v }
    ],
    groupOptions: [
      { value: 'city', label: 'Group by city' }
    ],
    groupValue: (r, g) => r.city,
    matchQuery: (r, q) => (r.name + ' ' + r.city).toLowerCase().includes(q),
    renderAnalytics: (rows) => {
      const total = rows.reduce((s, r) => s + r.value, 0)
      const sorted = [...rows].sort((a, b) => b.value - a.value)
      return (
        <div>
          <div className="dd-kpis">
            <Kpi label="Retailers" value={rows.length} tone="ink" />
            <Kpi label="Total Orders" value={rows.reduce((s, r) => s + r.orders, 0)} tone="gold" />
            <Kpi label="Total Styles" value={rows.reduce((s, r) => s + r.styles, 0)} tone="maroon" />
            <Kpi label="Order Value" value={fmtMoney(total)} tone="accent" />
          </div>
          <Bars items={sorted.slice(0, 8).map((r) => ({
            label: r.name, value: r.value,
            tone: r.atRisk > 0 ? 'danger' : 'accent'
          }))} />
        </div>
      )
    },
    renderDetail: (row, ctx) => <RetailerDetail row={row} ctx={ctx} />
  }
}

function toneBySeverity(sev) {
  return sev === 'critical' ? 'danger' : sev === 'warning' ? 'warn' : 'info'
}
