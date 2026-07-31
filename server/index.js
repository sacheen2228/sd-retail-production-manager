import express from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
import { loadDB, saveDB, uid } from './store.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001
const app = express()
const db = loadDB()

app.use(express.json())

const COLLECTIONS = ['purchaseOrders', 'styles', 'vendors', 'retailers', 'fabrics', 'readyStock']

const ALERT_RULES = {
  LOW_STOCK: 30,
  STUCK_DAYS: 6,
  SAMPLING_DAYS: 7,
  DELIVERY_SOON_DAYS: 7
}

function isValidCollection(name) {
  return COLLECTIONS.includes(name)
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function daysBetween(fromDate, toDate) {
  return Math.ceil((new Date(fromDate + 'T00:00:00') - new Date(toDate + 'T00:00:00')) / 86400000)
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() })
})

app.get('/api/data', (_req, res) => {
  res.json(db)
})

app.get('/api/:collection', (req, res) => {
  const { collection } = req.params
  if (!isValidCollection(collection)) return res.status(404).json({ error: 'Unknown collection' })
  res.json(db[collection])
})

app.post('/api/:collection', (req, res) => {
  const { collection } = req.params
  if (!isValidCollection(collection)) return res.status(404).json({ error: 'Unknown collection' })
  const item = { id: uid(), createdAt: todayStr(), ...req.body }
  if (collection === 'styles') {
    const stage = item.stage || 'Sampling'
    item.stage = stage
    item.history = [{ at: todayStr(), from: null, to: stage, note: 'Order created' }]
  }
  db[collection].push(item)
  saveDB(db)
  res.status(201).json(item)
})

app.put('/api/:collection/:id', (req, res) => {
  const { collection, id } = req.params
  if (!isValidCollection(collection)) return res.status(404).json({ error: 'Unknown collection' })
  const idx = db[collection].findIndex((i) => i.id === id)
  if (idx === -1) return res.status(404).json({ error: 'Not found' })
  const prev = db[collection][idx]
  const next = { ...prev, ...req.body, id }
  if (collection === 'styles') {
    const nextStage = next.stage || prev.stage
    next.stage = nextStage
    if (nextStage !== prev.stage) {
      next.history = [
        ...(prev.history || []),
        {
          at: todayStr(),
          from: prev.stage,
          to: nextStage,
          note: req.body.note || (nextStage === 'Dispatched' ? 'Marked dispatched' : '')
        }
      ]
    } else {
      next.history = prev.history || []
    }
  }
  db[collection][idx] = next
  saveDB(db)
  res.json(next)
})

app.delete('/api/:collection/:id', (req, res) => {
  const { collection, id } = req.params
  if (!isValidCollection(collection)) return res.status(404).json({ error: 'Unknown collection' })
  const idx = db[collection].findIndex((i) => i.id === id)
  if (idx === -1) return res.status(404).json({ error: 'Not found' })
  db[collection].splice(idx, 1)
  saveDB(db)
  res.json({ ok: true })
})

const normalizeKey = (k) => String(k || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const HEADER_MAP = {
  name: ['name', 'item', 'itemname', 'product', 'productname', 'style', 'stylename', 'garment'],
  category: ['category', 'cat'],
  subCategory: ['subcategory', 'subcat', 'sub', 'category2', 'subcategory2'],
  quantity: ['quantity', 'qty', 'qtyonhand', 'stock', 'onhand', 'pieces', 'pcs', 'nos'],
  costPrice: ['costprice', 'cost', 'unitcost', 'costperpiece', 'costpriceinr'],
  sellingPrice: ['sellingprice', 'selling', 'price', 'mrp', 'saleprice', 'sellingpriceinr'],
  lowStockLevel: ['lowstocklevel', 'lowstock', 'reorderlevel', 'minstock', 'alertlevel'],
  location: ['location', 'store', 'city', 'storename', 'retailer']
}

const FLOAT_KEYS = ['quantity', 'costPrice', 'sellingPrice', 'lowStockLevel']

app.post('/api/readyStock/upload', (req, res) => {
  const { file, filename } = req.body || {}
  if (!file || typeof file !== 'string') {
    return res.status(400).json({ error: 'Missing file (base64 expected)' })
  }
  try {
    const buffer = Buffer.from(file, 'base64')
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })
    const ws = wb.Sheets[wb.SheetNames[0]]
    if (!ws) return res.status(400).json({ error: 'Excel file has no sheets' })
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
    if (!rows.length) return res.status(400).json({ error: 'No data rows found in the sheet' })

    const headers = Object.keys(rows[0])
    const col = {}
    for (const h of headers) {
      const key = normalizeKey(h)
      for (const [field, aliases] of Object.entries(HEADER_MAP)) {
        if (aliases.includes(key) && !col[field]) col[field] = h
      }
    }
    if (!col.name) {
      return res.status(400).json({
        error: `Could not find an item name column. Recognised columns: ${Object.keys(col).join(', ') || 'none'}. Expected a header like "Name" / "Item".`
      })
    }

    let created = 0
    let updated = 0
    let skipped = 0
    for (const row of rows) {
      const raw = { name: String(row[col.name] || '').trim() }
      if (!raw.name) { skipped++; continue }
      for (const key of Object.keys(HEADER_MAP)) {
        const h = col[key]
        let v = h ? row[h] : undefined
        if (v === '' || v === undefined || v === null) continue
        if (FLOAT_KEYS.includes(key)) {
          v = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.]/g, ''))
          if (Number.isNaN(v)) continue
        } else {
          v = String(v).trim()
        }
        raw[key] = v
      }
      const existing = db.readyStock.find((i) => String(i.name || '').toLowerCase() === raw.name.toLowerCase())
      if (existing) {
        Object.assign(existing, raw)
        updated++
      } else {
        db.readyStock.push({ id: uid(), createdAt: todayStr(), ...raw })
        created++
      }
    }
    saveDB(db)
    const fileHint = filename ? ` (${filename})` : ''
    res.json({ ok: true, created, updated, skipped, message: `Upload complete${fileHint}: ${created} created, ${updated} updated, ${skipped} rows skipped.` })
  } catch (e) {
    res.status(400).json({ error: 'Failed to parse file: ' + e.message })
  }
})

app.get('/api/reports/alerts', (_req, res) => {
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

  db.fabrics.forEach((f) => {
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
  res.json(alerts)
})

app.get('/api/reports/stock', (_req, res) => {
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
  res.json({ summary, rows })
})

app.get('/api/reports/overview', (_req, res) => {
  const styles = db.styles
  const orders = db.purchaseOrders
  const today = new Date()
  const inProduction = styles.filter((s) => s.stage !== 'Dispatched').length
  const atRisk = orders.filter((o) => {
    if (o.status === 'Dispatched') return false
    const stylesFor = styles.filter((s) => s.poId === o.id)
    const done = stylesFor.length > 0 && stylesFor.every((s) => s.stage === 'Dispatched')
    if (done) return false
    const due = new Date(o.deliveryDate)
    const daysLeft = Math.ceil((due - today) / 86400000)
    return daysLeft <= 7
  })
  const pipelineValue = orders
    .filter((o) => o.status !== 'Dispatched')
    .reduce((sum, o) => sum + (Number(o.value) || 0), 0)

  const byStage = {}
  styles.forEach((s) => {
    byStage[s.stage] = (byStage[s.stage] || 0) + 1
  })

  res.json({
    activeOrders: orders.filter((o) => o.status !== 'Dispatched').length,
    stylesInProduction: inProduction,
    atRiskOrders: atRisk.length,
    pipelineValue,
    byStage
  })
})

app.get('/api/reports/wip', (_req, res) => {
  const orders = db.purchaseOrders
  const retailers = db.retailers
  const rows = db.styles.map((s) => {
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
      quantity: s.quantity,
      qtyDispatched: s.qtyDispatched,
      stage: s.stage,
      daysInStage: s.stageEnteredAt ? Math.max(1, Math.ceil((new Date() - new Date(s.stageEnteredAt)) / 86400000)) : 0,
      deliveryDate: due,
      daysLeft,
      status: s.stage === 'Dispatched' ? 'Dispatched' : 'In Production'
    }
  })
  res.json(rows)
})

const dist = path.join(__dirname, '..', 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`Atelier Production Manager API listening on http://localhost:${PORT}`)
})
