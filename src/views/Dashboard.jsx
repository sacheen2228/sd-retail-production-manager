import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { Kpi, Card, StageBadge, DueBadge, Empty, fmtMoney } from '../components/ui.jsx'
import DrillDown from '../components/DrillDown.jsx'
import { STAGES, stageIndex, daysFromToday, fmtDate } from '../lib.js'

const ALERT_TONE = { critical: 'danger', warning: 'warn', info: 'info' }

function WidgetAction({ onClick, children }) {
  return (
    <button
      className="dd-link"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      {children} →
    </button>
  )
}

export default function Dashboard({ ctx }) {
  const { db, refresh, navigate } = ctx
  const [overview, setOverview] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [panel, setPanel] = useState(null)
  const goTo = navigate || (() => {})

  useEffect(() => {
    api.get('/api/reports/overview').then(setOverview).catch(() => {})
    api.get('/api/reports/alerts').then(setAlerts).catch(() => {})
  }, [db])

  const { purchaseOrders, styles, retailers } = db
  const rName = (id) => retailers.find((r) => r.id === id)?.name || '-'

  const upcoming = useMemo(() => {
    return purchaseOrders
      .map((o) => {
        const s = styles.filter((x) => x.poId === o.id)
        const allDone = s.length > 0 && s.every((x) => x.stage === 'Dispatched')
        return { ...o, allDone, styleCount: s.length }
      })
      .filter((o) => !o.allDone)
      .sort((a, b) => (a.deliveryDate < b.deliveryDate ? -1 : 1))
      .slice(0, 6)
  }, [purchaseOrders, styles])

  const recentOrders = useMemo(
    () =>
      [...purchaseOrders]
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 5),
    [purchaseOrders]
  )

  const stageCounts = useMemo(() => {
    const m = {}
    STAGES.forEach((s) => (m[s] = 0))
    styles.forEach((s) => (m[s.stage] = (m[s.stage] || 0) + 1))
    return m
  }, [styles])

  const maxStage = Math.max(1, ...Object.values(stageCounts))

  const byRetailer = useMemo(() => {
    const m = {}
    purchaseOrders.forEach((o) => {
      const key = rName(o.retailerId)
      m[key] = (m[key] || 0) + (Number(o.value) || 0)
    })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [purchaseOrders, retailers])

  return (
    <div className="dashboard">
      <div className="kpi-row">
        <Kpi label="Active Orders" value={overview ? overview.activeOrders : '…'} tone="maroon" sub="not yet dispatched" />
        <Kpi label="Styles in Production" value={overview ? overview.stylesInProduction : '…'} tone="gold" sub="across all hubs" />
        <Kpi label="At-Risk Deliveries" value={overview ? overview.atRiskOrders : '…'} tone={overview && overview.atRiskOrders > 0 ? 'danger' : 'ok'} sub="due within 7 days" />
        <Kpi label="Pipeline Value" value={overview ? fmtMoney(overview.pipelineValue) : '…'} tone="ink" sub="open orders" />
      </div>

      {alerts.length > 0 && (
        <Card
          title={`Alerts & Reminders (${alerts.length})`}
          className="alerts-card"
          onClick={() => setPanel({ kind: 'alerts' })}
          action={<WidgetAction onClick={() => setPanel({ kind: 'alerts' })}>View all</WidgetAction>}
        >
          <div className="alert-list">
            {alerts.map((a, i) => (
              <div key={i} className={`alert alert-${a.severity}`}>
                <span className={`badge badge-${ALERT_TONE[a.severity]}`}>{a.type}</span>
                <div className="alert-text">
                  <div className="alert-title">{a.title}</div>
                  <div className="alert-detail">{a.detail}</div>
                </div>
                {a.date && <div className="alert-date">{fmtDate(a.date)}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid-2">
        <Card
          title="Upcoming Deliveries"
          onClick={() => setPanel({ kind: 'deliveries' })}
          action={<WidgetAction onClick={() => setPanel({ kind: 'deliveries' })}>View all</WidgetAction>}
        >
          {upcoming.length === 0 ? (
            <Empty>No open deliveries.</Empty>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>PO</th>
                  <th>Retailer</th>
                  <th>Styles</th>
                  <th>Value</th>
                  <th>Delivery</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((o) => (
                  <tr key={o.id}>
                    <td className="strong">{o.poNumber}</td>
                    <td>{rName(o.retailerId)}</td>
                    <td>{o.styleCount}</td>
                    <td>{fmtMoney(o.value)}</td>
                    <td>{fmtDate(o.deliveryDate)}</td>
                    <td><DueBadge dateStr={o.deliveryDate} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card
          title="Production Pipeline"
          onClick={() => setPanel({ kind: 'pipeline' })}
          action={<WidgetAction onClick={() => setPanel({ kind: 'pipeline' })}>View all</WidgetAction>}
        >
          <div className="pipeline">
            {STAGES.map((s) => (
              <div key={s} className="pipeline-row">
                <div className="pipeline-label">
                  {s}
                  {s === 'Dispatched' && <StageBadge stage={s} />}
                </div>
                <div className="pipeline-track">
                  <div
                    className={`pipeline-fill ${s === 'Dispatched' ? 'fill-done' : ''}`}
                    style={{ width: `${(stageCounts[s] / maxStage) * 100}%` }}
                  />
                </div>
                <div className="pipeline-count">{stageCounts[s]}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid-2">
        <Card
          title="Recent Purchase Orders"
          onClick={() => setPanel({ kind: 'orders' })}
          action={<WidgetAction onClick={() => setPanel({ kind: 'orders' })}>View all</WidgetAction>}
        >
          <table className="table">
            <thead>
              <tr>
                <th>PO</th>
                <th>Retailer</th>
                <th>Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o.id}>
                  <td className="strong">{o.poNumber}</td>
                  <td>{rName(o.retailerId)}</td>
                  <td>{fmtMoney(o.value)}</td>
                  <td><StageBadge stage={o.status === 'Dispatched' ? 'Dispatched' : o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card
          title="Order Value by Retailer"
          onClick={() => setPanel({ kind: 'retailers' })}
          action={<WidgetAction onClick={() => setPanel({ kind: 'retailers' })}>View all</WidgetAction>}
        >
          {byRetailer.length === 0 ? (
            <Empty>No orders yet.</Empty>
          ) : (
            <div className="retailer-list">
              {byRetailer.map(([name, val]) => {
                const total = byRetailer.reduce((s, [, v]) => s + v, 0)
                return (
                  <div key={name} className="retailer-row">
                    <div className="retailer-name">{name}</div>
                    <div className="retailer-bar">
                      <div className="retailer-fill" style={{ width: `${(val / total) * 100}%` }} />
                    </div>
                    <div className="retailer-val">{fmtMoney(val)}</div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      <DrillDown
        panel={panel}
        onClose={() => setPanel(null)}
        db={db}
        refresh={refresh}
        navigate={goTo}
      />
    </div>
  )
}
