import { STAGES } from '../lib.js'

const ALERT_RULES = {
  LOW_STOCK: 30,
  STUCK_DAYS: 6,
  SAMPLING_DAYS: 7,
  DELIVERY_SOON_DAYS: 7
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function daysBetween(fromDate, toDate) {
  return Math.ceil((new Date(fromDate + 'T00:00:00') - new Date(toDate + 'T00:00:00')) / 86400000)
}

export function computeOverview(db) {
  const styles = db.styles
  const orders = db.purchaseOrders
  const inProduction = styles.filter((s) => s.stage !== 'Dispatched').length
  const atRisk = orders.filter((o) => {
    if (o.status === 'Dispatched') return false
    const stylesFor = styles.filter((s) => s.poId === o.id)
    const done = stylesFor.length > 0 && stylesFor.every((s) => s.stage === 'Dispatched')
    if (done) return false
    const daysLeft = Math.ceil((new Date(o.deliveryDate) - new Date()) / 86400000)
    return daysLeft <= 7
  })
  const pipelineValue = orders
    .filter((o) => o.status !== 'Dispatched')
    .reduce((sum, o) => sum + (Number(o.value) || 0), 0)
  const byStage = {}
  styles.forEach((s) => {
    byStage[s.stage] = (byStage[s.stage] || 0) + 1
  })
  return {
    activeOrders: orders.filter((o) => o.status !== 'Dispatched').length,
    stylesInProduction: inProduction,
    atRiskOrders: atRisk.length,
    pipelineValue,
    byStage
  }
}

export function computeAlerts(db) {
  const styles = db.styles
  const orders = db.purchaseOrders
  const retailers = db.retailers
  const rName = (id) => (retailers.find((r) => r.id === id) || {}).name || '-'
  const alerts = []
  const push = (a) => alerts.push(a)

  const stageDays = (s) =>
    s.stageEnteredAt ? Math.max(0, daysBetween(todayStr(), s.stageEnteredAt)) : 0

  orders.forEach((o) => {
    const s = styles.filter((x) => x.poId === o.id)
    const done = s.length > 0 && s.every((x) => x.stage === 'Dispatched')
    if (done || !o.deliveryDate) return
    const daysLeft = daysBetween(o.deliveryDate, todayStr())
    if (daysLeft < 0) {
      push({
        type: 'overdue',
        severity: 'critical',
        title: `Delivery overdue by ${-daysLeft}d`,
        detail: `${o.poNumber} — ${rName(o.retailerId)}`,
        date: o.deliveryDate
      })
    } else if (daysLeft <= ALERT_RULES.DELIVERY_SOON_DAYS) {
      push({
        type: 'due-soon',
        severity: 'warning',
        title: `Delivery due in ${daysLeft}d`,
        detail: `${o.poNumber} — ${rName(o.retailerId)}`,
        date: o.deliveryDate
      })
    }
  })

  styles
    .filter((s) => s.stage !== 'Dispatched')
    .forEach((s) => {
      const days = stageDays(s)
      if (days > ALERT_RULES.STUCK_DAYS) {
        push({
          type: 'stuck',
          severity: 'warning',
          title: `Stuck in ${s.stage} (${days}d)`,
          detail: `${s.styleCode} — ${s.styleName}`,
          date: s.stageEnteredAt
        })
      }
    })

  styles
    .filter((s) => s.stage === 'Sampling')
    .forEach((s) => {
      const days = stageDays(s)
      if (days > ALERT_RULES.SAMPLING_DAYS) {
        push({
          type: 'sampling',
          severity: 'info',
          title: `Sample awaiting approval (${days}d)`,
          detail: `${s.styleCode} — ${s.styleName}`,
          date: s.stageEnteredAt
        })
      }
    })

  ;(db.fabrics || []).forEach((f) => {
    if (Number(f.stock) <= ALERT_RULES.LOW_STOCK) {
      push({
        type: 'stock',
        severity: 'info',
        title: `Low stock: ${f.name}`,
        detail: `${f.stock} ${f.uom} left — lead time ${f.leadTimeDays || '?'}d`,
        date: null
      })
    }
  })

  const sevOrder = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity] || String(a.date).localeCompare(String(b.date)))
  return alerts
}

export function computeWip(db) {
  const orders = db.purchaseOrders
  const retailers = db.retailers
  return db.styles.map((s) => {
    const po = orders.find((o) => o.id === s.poId)
    const retailer = po ? retailers.find((r) => r.id === po.retailerId) : null
    const due = po ? po.deliveryDate : null
    let daysLeft = null
    if (due) daysLeft = Math.ceil((new Date(due) - new Date()) / 86400000)
    return {
      styleCode: s.styleCode,
      styleName: s.styleName,
      poNumber: po ? po.poNumber : '-',
      retailer: retailer ? retailer.name : '-',
      category: s.category,
      subCategory: s.subCategory || '',
      color: s.color || '',
      size: s.size || '',
      quantity: s.quantity,
      qtyDispatched: s.qtyDispatched,
      wip: (Number(s.quantity) || 0) - (Number(s.qtyDispatched) || 0),
      stage: s.stage,
      daysInStage: s.stageEnteredAt ? Math.max(1, Math.ceil((new Date() - new Date(s.stageEnteredAt)) / 86400000)) : 0,
      deliveryDate: due,
      daysLeft,
      status: s.stage === 'Dispatched' ? 'Dispatched' : 'In Production'
    }
  })
}

export function computeFabricStock(db) {
  const open = db.styles.filter((s) => s.stage !== 'Dispatched')
  const rows = db.fabrics.map((f) => {
    const name = String(f.name || '').toLowerCase()
    const cons = Number(f.consumption) || 0
    let allocated = 0
    open.forEach((s) => {
      const qty = Number(s.quantity) || 0
      if (String(s.fabric || '').toLowerCase() === name) allocated += qty * cons
      if (String(s.trim || '').toLowerCase() === name) allocated += qty * cons
    })
    const stock = Number(f.stock) || 0
    const available = stock - allocated
    let status = 'ok'
    if (available < 0) status = 'reorder'
    else if (available <= 0 || stock <= (Number(f.lowStockLevel) || 30)) status = 'low'
    return {
      id: f.id,
      name: f.name,
      type: f.type,
      stock,
      uom: f.uom,
      costPrice: Number(f.costPrice) || 0,
      consumption: cons,
      allocated: Math.round(allocated),
      available: Math.round(available),
      status,
      value: Math.round(stock * (Number(f.costPrice) || 0)),
      vendor: f.vendor,
      leadTimeDays: f.leadTimeDays
    }
  })
  const summary = {
    items: rows.length,
    stockValue: rows.reduce((s, r) => s + r.value, 0),
    lowItems: rows.filter((r) => r.status === 'low').length,
    reorderItems: rows.filter((r) => r.status === 'reorder').length
  }
  return { summary, rows }
}

export { STAGES }
