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

function inRange(dateStr, from, to) {
  if (!dateStr) return false
  const d = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return false
  if (from && d < new Date(from + 'T00:00:00')) return false
  if (to && d > new Date(to + 'T00:00:00')) return false
  return true
}

function monthKey(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Cost vs. selling profit, joined through each style's PO for order date/retailer.
 * `range` = { from?: 'YYYY-MM-DD', to?: 'YYYY-MM-DD' } filtering by PO order date.
 * `opts` = { retailer?: string, category?: string } additional filters.
 */
export function computeProfit(db, range = {}, opts = {}) {
  const { from, to } = range || {}
  const { retailer, category } = opts || {}
  const rows = []
  ;(db.styles || []).forEach((s) => {
    const po = (db.purchaseOrders || []).find((o) => o.id === s.poId)
    if (!po) return
    if (!inRange(po.orderDate, from, to)) return
    const retailerName = ((db.retailers || []).find((r) => r.id === po.retailerId) || {}).name || '-'
    if (retailer && retailerName !== retailer) return
    if (category && s.category !== category) return
    const qty = Number(s.quantity) || 0
    const sell = qty * (Number(s.price) || 0)
    const cost = qty * (Number(s.costPrice) || 0)
    rows.push({
      styleCode: s.styleCode,
      styleName: s.styleName,
      category: s.category,
      poId: po.id,
      poNumber: po.poNumber,
      retailer: retailerName,
      orderDate: po.orderDate,
      month: monthKey(po.orderDate),
      qty,
      sell,
      cost,
      profit: sell - cost,
      margin: sell > 0 ? ((sell - cost) / sell) * 100 : 0
    })
  })

  const group = (keyFn, labelFn) => {
    const m = {}
    rows.forEach((r) => {
      const k = keyFn(r)
      if (k === null || k === undefined) return
      const g = (m[k] = m[k] || { label: labelFn(r), qty: 0, sell: 0, cost: 0, profit: 0 })
      g.qty += r.qty
      g.sell += r.sell
      g.cost += r.cost
      g.profit += r.profit
    })
    return Object.values(m)
      .map((g) => ({ ...g, margin: g.sell > 0 ? (g.profit / g.sell) * 100 : 0 }))
      .sort((a, b) => b.profit - a.profit)
  }

  const totals = rows.reduce(
    (a, r) => ({ qty: a.qty + r.qty, sell: a.sell + r.sell, cost: a.cost + r.cost, profit: a.profit + r.profit }),
    { qty: 0, sell: 0, cost: 0, profit: 0 }
  )
  totals.margin = totals.sell > 0 ? (totals.profit / totals.sell) * 100 : 0

  return {
    byStyle: group((r) => r.styleCode, (r) => `${r.styleCode} — ${r.styleName}`),
    byOrder: group((r) => r.poId, (r) => `${r.poNumber} (${r.retailer})`),
    byMonth: group((r) => r.month, (r) => r.month),
    totals
  }
}

/** Fabric requirement for open (non-dispatched) styles: required vs. stock. */
export function computeFabricRequirement(db) {
  const open = db.styles.filter((s) => s.stage !== 'Dispatched')
  const req = {}
  const add = (name, qty) => {
    if (!name) return
    const k = String(name).trim().toLowerCase()
    req[k] = (req[k] || 0) + (Number(qty) || 0)
  }
  open.forEach((s) => {
    const qty = Number(s.quantity) || 0
    const cons = Number(s.consumption) || 0
    add(s.fabric, qty * cons)
    add(s.trim, qty * cons)
  })
  return (db.fabrics || []).map((f) => {
    const k = String(f.name || '').trim().toLowerCase()
    const required = Math.round(req[k] || 0)
    const stock = Number(f.stock) || 0
    const available = stock - required
    return {
      name: f.name,
      type: f.type,
      uom: f.uom,
      vendor: f.vendor,
      leadTimeDays: f.leadTimeDays,
      stock,
      required,
      available,
      status: available < 0 ? 'reorder' : available === 0 ? 'short' : 'ok'
    }
  })
}

export { STAGES }

/**
 * Data-driven merchandising analytics for the Merchandising tab.
 * Returns sell-through, GMROI, inventory turn, best/slow sellers, fabric
 * consumption, vendor performance, avg production time and stock aging.
 */
export function computeMerchandising(db) {
  const styles = db.styles || []
  const orders = db.purchaseOrders || []
  const retailers = db.retailers || []
  const readyStock = db.readyStock || []
  const fabrics = db.fabrics || []
  const vendors = db.vendors || []
  const rName = (id) => (retailers.find((r) => r.id === id) || {}).name || '-'

  // ---- aggregate sold + on-hand by style code ----
  const byCode = {}
  const ensure = (code) => {
    if (!byCode[code]) byCode[code] = { sold: 0, onHand: 0, sellValue: 0, costValue: 0, name: '', category: '', color: '', size: '' }
    return byCode[code]
  }
  styles.forEach((s) => {
    const code = String(s.styleCode || '').trim()
    if (!code) return
    const g = ensure(code)
    g.sold += Number(s.qtyDispatched) || 0
    g.sellValue += (Number(s.qtyDispatched) || 0) * (Number(s.price) || 0)
    g.costValue += (Number(s.qtyDispatched) || 0) * (Number(s.costPrice) || 0)
    if (!g.name) g.name = s.styleName
    if (!g.category) g.category = s.category
    if (!g.color) g.color = s.color || ''
    if (!g.size) g.size = s.size || ''
  })
  readyStock.forEach((r) => {
    const code = String(r.styleCode || '').trim()
    if (!code) return
    const g = ensure(code)
    g.onHand += Number(r.quantity) || 0
    if (!g.name) g.name = r.name
    if (!g.category) g.category = r.category
    if (!g.color) g.color = r.color || ''
    if (!g.size) g.size = r.size || ''
  })

  const codeRows = Object.entries(byCode).map(([code, g]) => {
    const total = g.sold + g.onHand
    return {
      styleCode: code,
      name: g.name,
      category: g.category,
      color: g.color,
      size: g.size,
      sold: g.sold,
      onHand: g.onHand,
      total,
      sellThrough: total > 0 ? (g.sold / total) * 100 : 0,
      sellValue: g.sellValue,
      costValue: g.costValue
    }
  })

  const totalSold = codeRows.reduce((s, r) => s + r.sold, 0)
  const totalOnHand = codeRows.reduce((s, r) => s + r.onHand, 0)
  const sellThroughPct = totalSold + totalOnHand > 0 ? (totalSold / (totalSold + totalOnHand)) * 100 : 0

  // ---- gross profit + COGS from dispatched styles ----
  const dispatched = styles.filter((s) => s.stage === 'Dispatched')
  const grossProfit = dispatched.reduce((sum, s) => sum + (Number(s.qtyDispatched) || 0) * ((Number(s.price) || 0) - (Number(s.costPrice) || 0)), 0)
  const cogs = dispatched.reduce((sum, s) => sum + (Number(s.qtyDispatched) || 0) * (Number(s.costPrice) || 0), 0)
  const inventoryValue = readyStock.reduce((sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.costPrice) || 0), 0)

  const gmroi = inventoryValue > 0 ? grossProfit / inventoryValue : 0
  const inventoryTurn = inventoryValue > 0 ? cogs / inventoryValue : 0

  // ---- average production time (first stage entry -> dispatched) ----
  const prodTimes = []
  dispatched.forEach((s) => {
    const h = Array.isArray(s.history) ? s.history : []
    const firstAt = h.length ? h[0].at : s.createdAt
    const disp = h.find((e) => e.to === 'Dispatched')
    const endAt = disp ? disp.at : s.stageEnteredAt
    if (!firstAt || !endAt) return
    const start = new Date(String(firstAt).slice(0, 10) + 'T00:00:00')
    const end = new Date(String(endAt).slice(0, 10) + 'T00:00:00')
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return
    const days = Math.round((end - start) / 86400000)
    if (days >= 0) prodTimes.push(days)
  })
  const avgProductionDays = prodTimes.length ? Math.round(prodTimes.reduce((a, b) => a + b, 0) / prodTimes.length) : null

  // ---- best / slow sellers ----
  const withDemand = codeRows.filter((r) => r.sold > 0).sort((a, b) => b.sold - a.sold)
  const bestSellers = withDemand.slice(0, 5)
  const slowSellers = codeRows
    .filter((r) => r.onHand > 0 && r.sold === 0)
    .sort((a, b) => b.onHand - a.onHand)
    .slice(0, 5)

  // ---- vendor performance (from fabrics/trims supplied) ----
  const vendorMap = {}
  fabrics.forEach((f) => {
    const v = String(f.vendor || '').trim()
    if (!v) return
    const g = (vendorMap[v] = vendorMap[v] || { name: v, items: 0, stockValue: 0, avgLead: 0, leadSum: 0, lowItems: 0, reorderItems: 0 })
    g.items++
    g.stockValue += (Number(f.stock) || 0) * (Number(f.costPrice) || 0)
    g.leadSum += Number(f.leadTimeDays) || 0
    const stock = Number(f.stock) || 0
    const low = Number(f.lowStockLevel) || 30
    if (stock <= low) g.lowItems++
    const cons = Number(f.consumption) || 0
    const allocated = styles
      .filter((s) => s.stage !== 'Dispatched' && (String(s.fabric || '').trim().toLowerCase() === f.name.toLowerCase() || String(s.trim || '').trim().toLowerCase() === f.name.toLowerCase()))
      .reduce((sum, s) => sum + (Number(s.quantity) || 0) * cons, 0)
    if (stock - allocated < 0) g.reorderItems++
  })
  const vendorPerformance = Object.values(vendorMap)
    .map((v) => ({ ...v, avgLead: v.items ? Math.round(v.leadSum / v.items) : 0 }))
    .sort((a, b) => b.stockValue - a.stockValue)

  // ---- stock aging buckets ----
  const buckets = [
    { bucket: '0–30 days', min: 0, max: 30 },
    { bucket: '31–60 days', min: 31, max: 60 },
    { bucket: '61–90 days', min: 61, max: 90 },
    { bucket: '90+ days', min: 91, max: Infinity }
  ]
  const aging = buckets.map((b) => ({ bucket: b.bucket, items: 0, pieces: 0, value: 0 }))
  readyStock.forEach((r) => {
    const created = r.createdAt ? new Date(String(r.createdAt).slice(0, 10) + 'T00:00:00') : null
    const ageDays = created && !Number.isNaN(created.getTime()) ? Math.floor((new Date() - created) / 86400000) : null
    if (ageDays === null) return
    const bucket = buckets.find((b) => ageDays >= b.min && ageDays <= b.max)
    if (!bucket) return
    const row = aging[buckets.indexOf(bucket)]
    row.items++
    row.pieces += Number(r.quantity) || 0
    row.value += (Number(r.quantity) || 0) * (Number(r.costPrice) || 0)
  })

  // ---- fabric consumption (allocated vs stock) ----
  const fabricConsumption = fabrics.map((f) => {
    const cons = Number(f.consumption) || 0
    const allocated = styles
      .filter((s) => s.stage !== 'Dispatched' && (String(s.fabric || '').trim().toLowerCase() === f.name.toLowerCase() || String(s.trim || '').trim().toLowerCase() === f.name.toLowerCase()))
      .reduce((sum, s) => sum + (Number(s.quantity) || 0) * cons, 0)
    const stock = Number(f.stock) || 0
    const available = stock - allocated
    return {
      name: f.name,
      type: f.type,
      uom: f.uom,
      vendor: f.vendor,
      stock,
      allocated,
      available,
      status: available < 0 ? 'reorder' : available === 0 ? 'short' : 'ok'
    }
  })

  return {
    summary: {
      sellThroughPct,
      totalSold,
      totalOnHand,
      gmroi,
      inventoryTurn,
      inventoryValue,
      grossProfit,
      avgProductionDays,
      bestSellerCount: withDemand.length
    },
    sellThroughRows: codeRows.sort((a, b) => b.total - a.total),
    bestSellers,
    slowSellers,
    fabricConsumption,
    vendorPerformance,
    stockAging: aging,
    topOrders: orders
      .slice()
      .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
      .slice(0, 5)
      .map((o) => ({
        poNumber: o.poNumber,
        retailer: rName(o.retailerId),
        value: Number(o.value) || 0,
        status: o.status,
        deliveryDate: o.deliveryDate
      }))
  }
}
