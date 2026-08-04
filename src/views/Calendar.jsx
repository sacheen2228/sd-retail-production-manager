import React, { useMemo, useState } from 'react'
import { Card, Btn, DueBadge, Empty, fmtDate, fmtMoney } from '../components/ui.jsx'
import { daysFromToday } from '../lib.js'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function monthMatrix(year, month) {
  const first = new Date(year, month, 1)
  const startOffset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  const rows = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
}

export default function Calendar({ ctx }) {
  const { db, navigate } = ctx
  const { purchaseOrders, styles, retailers } = db
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selected, setSelected] = useState(null)

  const rName = (id) => retailers.find((r) => r.id === id)?.name || '-'

  const events = useMemo(() => {
    const map = {}
    const add = (date, ev) => {
      if (!date) return
      if (!map[date]) map[date] = []
      map[date].push(ev)
    }
    purchaseOrders.forEach((o) => {
      const s = styles.filter((x) => x.poId === o.id)
      const done = s.length > 0 && s.every((x) => x.stage === 'Dispatched')
      add(o.deliveryDate, {
        kind: 'delivery',
        label: o.poNumber,
        sub: rName(o.retailerId),
        value: Number(o.value) || 0,
        done,
        date: o.deliveryDate
      })
    })
    styles
      .filter((s) => s.stage === 'Sampling')
      .forEach((s) =>
        add(s.stageEnteredAt, {
          kind: 'sample',
          label: 'Sample ' + s.styleCode,
          sub: s.styleName,
          date: s.stageEnteredAt
        })
      )
    return map
  }, [purchaseOrders, styles, retailers])

  function nav(delta) {
    let m = month + delta
    let y = year
    if (m < 0) {
      m = 11
      y -= 1
    } else if (m > 11) {
      m = 0
      y += 1
    }
    setMonth(m)
    setYear(y)
    setSelected(null)
  }

  function goToday() {
    setYear(now.getFullYear())
    setMonth(now.getMonth())
    setSelected(null)
  }

  const rows = monthMatrix(year, month)
  const dateKey = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const todayKey = dateKey(now.getFullYear(), now.getMonth(), now.getDate())
  const monthTotal = Object.entries(events)
    .filter(([k]) => k.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`))
    .filter(([, evs]) => evs.some((e) => e.kind === 'delivery' && !e.done))
    .reduce((sum, [, evs]) => sum + evs.filter((e) => e.kind === 'delivery' && !e.done).reduce((a, e) => a + e.value, 0), 0)

  const monthDeliveries = Object.keys(events)
    .filter((k) => k.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`))
    .filter((k) => events[k].some((e) => e.kind === 'delivery'))
    .sort()
    .map((k) => ({ date: k, deliveries: events[k].filter((e) => e.kind === 'delivery') }))

  const selectedEvents = selected ? events[selected] || [] : []
  const selectedDeliveries = selectedEvents.filter((e) => e.kind === 'delivery')
  const selectedValue = selectedDeliveries.filter((e) => !e.done).reduce((a, e) => a + (Number(e.value) || 0), 0)

  function openEvent(e) {
    navigate(e.kind === 'sample' ? 'tracker' : 'deliveries')
  }

  function renderEvent(e, j, clickable) {
    let tone = 'ok'
    if (e.kind === 'sample') tone = 'sample'
    else if (e.done) tone = 'dispatched'
    else {
      const dl = daysFromToday(e.date)
      if (dl < 0) tone = 'danger'
      else if (dl <= 7) tone = 'warn'
    }
    return (
      <div
        key={j}
        className={`cal-ev ev-${tone}${clickable ? ' cal-ev-click' : ''}`}
        onClick={clickable ? (ev) => { ev.stopPropagation(); openEvent(e) } : undefined}
      >
        <span className="cal-ev-label">{e.kind === 'sample' ? '✂' : '◈'} {e.label}</span>
        <span className="cal-ev-sub">{e.sub}</span>
      </div>
    )
  }

  return (
    <div>
      <div className="cal-head">
        <div className="cal-nav">
          <Btn tone="ghost" onClick={() => nav(-1)}>
            ◀
          </Btn>
          <div className="cal-title">
            {MONTHS[month]} {year}
          </div>
          <Btn tone="ghost" onClick={() => nav(1)}>
            ▶
          </Btn>
          <Btn tone="ghost" onClick={goToday} className="cal-today">
            Today
          </Btn>
        </div>
        <div className="cal-summary">
          Open deliveries this month: <strong>{monthDeliveries.length}</strong> · value {fmtMoney(monthTotal)}
        </div>
      </div>

      <Card>
        <div className="cal-legend">
          <span><span className="legend-dot dot-danger" /> Overdue</span>
          <span><span className="legend-dot dot-warn" /> Due ≤ 7d</span>
          <span><span className="legend-dot dot-ok" /> On track</span>
          <span><span className="legend-dot dot-dispatched" /> Dispatched</span>
          <span><span className="legend-dot dot-sample" /> Sampling</span>
        </div>
        <div className="cal-grid">
          {DOW.map((d) => (
            <div key={d} className="cal-dow">
              {d}
            </div>
          ))}
          {rows.flat().map((d, i) => {
            if (d === null) return <div key={i} className="cal-cell empty-cell" />
            const key = dateKey(year, month, d)
            const evs = events[key] || []
            const isToday = key === todayKey
            const isSelected = key === selected
            return (
              <div
                key={i}
                className={`cal-cell${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}${evs.length ? ' has-events' : ''}`}
                onClick={() => setSelected(key)}
              >
                <div className="cal-day-num">{d}</div>
                <div className="cal-events">
                  {evs.slice(0, 3).map((e, j) => renderEvent(e, j, true))}
                  {evs.length > 3 && <div className="cal-more">+{evs.length - 3} more</div>}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {selected && (
        <Card>
          <div className="cal-day-head">
            <div>
              <div className="cal-day-title">{fmtDate(selected)}</div>
              {selectedDeliveries.length > 0 && (
                <div className="cal-day-sub">
                  {selectedDeliveries.length} delivery{selectedDeliveries.length === 1 ? '' : 's'}
                  {selectedValue > 0 && <> · open value {fmtMoney(selectedValue)}</>}
                </div>
              )}
            </div>
            <Btn tone="ghost" onClick={() => setSelected(null)}>✕ Close</Btn>
          </div>
          {selectedEvents.length === 0 ? (
            <Empty>No deliveries or samples scheduled on this day.</Empty>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Detail</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {selectedEvents.map((e, i) => (
                  <tr key={i} className="row-click" onClick={() => openEvent(e)}>
                    <td className="strong">
                      {e.kind === 'sample' ? '✂ Sample' : '◈ Delivery'} — {e.label}
                    </td>
                    <td>{e.sub}</td>
                    <td>
                      {e.kind === 'sample'
                        ? 'Sampling'
                        : e.done
                          ? 'Dispatched'
                          : <DueBadge dateStr={e.date} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      <Card title={`Deliveries in ${MONTHS[month]} ${year}`}>
        {monthDeliveries.length === 0 ? (
          <Empty>No deliveries scheduled this month.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>PO</th>
                <th>Retailer</th>
                <th>Value</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {monthDeliveries.map(({ date, deliveries }) =>
                deliveries.map((e, i) => (
                  <tr key={date + i}>
                    <td>{fmtDate(date)}</td>
                    <td className="strong">{e.label}</td>
                    <td>{e.sub}</td>
                    <td>{fmtMoney(e.value)}</td>
                    <td>{e.done ? 'Dispatched' : <DueBadge dateStr={date} />}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
