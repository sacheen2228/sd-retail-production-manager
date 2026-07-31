import { supabaseClient } from './services/supabaseClient.js'
import { computeOverview, computeAlerts, computeWip, computeFabricStock } from './services/reports.js'

// ---------------------------------------------------------------------------
// Data access layer.
//
// Two backends behind one contract:
//  - Supabase (production on Vercel): Postgres + Auth + RLS, column snake_case
//  - Legacy Express JSON API (local development): keeps the demo working
//
// Views only ever speak to `api.*` with the same path shape as before.
// ---------------------------------------------------------------------------

const COLLECTIONS = {
  retailers: {
    table: 'retailers',
    map: { name: 'name', city: 'city', contact: 'contact' }
  },
  vendors: {
    table: 'vendors',
    map: { name: 'name', type: 'type', location: 'location', contact: 'contact' }
  },
  fabrics: {
    table: 'fabrics',
    map: {
      name: 'name', type: 'type', stock: 'stock', uom: 'uom', vendor: 'vendor',
      leadTimeDays: 'lead_time_days', costPrice: 'cost_price', consumption: 'consumption',
      lowStockLevel: 'low_stock_level'
    }
  },
  readyStock: {
    table: 'ready_stock',
    map: {
      name: 'name', category: 'category', subCategory: 'sub_category', quantity: 'quantity',
      costPrice: 'cost_price', sellingPrice: 'selling_price', lowStockLevel: 'low_stock_level',
      location: 'location', image: 'image', notes: 'notes'
    }
  },
  purchaseOrders: {
    table: 'purchase_orders',
    map: {
      poNumber: 'po_number', retailerId: 'retailer_id', orderDate: 'order_date',
      deliveryDate: 'delivery_date', status: 'status', value: 'value', notes: 'notes'
    }
  },
  styles: {
    table: 'styles',
    map: {
      poId: 'po_id', styleCode: 'style_code', styleName: 'style_name', category: 'category',
      subCategory: 'sub_category', quantity: 'quantity', price: 'price', fabric: 'fabric',
      trim: 'trim', stage: 'stage', stageEnteredAt: 'stage_entered_at', qtyDispatched: 'qty_dispatched',
      image: 'image', notes: 'notes', history: 'history'
    }
  }
}

const NUMERIC_COLS = new Set([
  'stock', 'lead_time_days', 'cost_price', 'consumption', 'low_stock_level',
  'quantity', 'selling_price', 'value', 'price', 'qty_dispatched'
])

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function emptyToNull(v) {
  return v === '' || v === null || v === undefined ? null : v
}

function toDB(collection, app) {
  const { map } = COLLECTIONS[collection]
  const out = {}
  for (const [appKey, col] of Object.entries(map)) {
    if (!(appKey in app)) continue
    let v = app[appKey]
    if (NUMERIC_COLS.has(col)) {
      v = v === '' || v === null || v === undefined ? 0 : Number(v)
      if (Number.isNaN(v)) v = 0
    } else if (col === 'retailer_id' || col === 'po_id') {
      v = emptyToNull(v)
    } else if (col === 'order_date' || col === 'delivery_date' || col === 'stage_entered_at') {
      v = emptyToNull(v)
    }
    out[col] = v
  }
  if (app.id) out.id = app.id
  return out
}

function fromDB(collection, row) {
  if (!row) return null
  const { map } = COLLECTIONS[collection]
  const out = {}
  for (const [appKey, col] of Object.entries(map)) {
    out[appKey] = row[col]
  }
  out.id = row.id
  out.createdAt = row.created_at
  return out
}

// ----- Supabase helpers -----------------------------------------------------

const COL = Object.fromEntries(Object.entries(COLLECTIONS).map(([k, v]) => [k, v.table]))

async function sbList(collection) {
  const { data, error } = await supabaseClient.supabase.from(COL[collection]).select('*')
  if (error) throw new Error(error.message)
  return (data || []).map((r) => fromDB(collection, r))
}

async function sbGet(collection, id) {
  const { data, error } = await supabaseClient.supabase.from(COL[collection]).select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return fromDB(collection, data)
}

async function sbCreate(collection, app) {
  const body = toDB(collection, app)
  if (collection === 'styles') {
    const stage = body.stage || 'Sampling'
    body.stage = stage
    body.history = [{ at: todayStr(), from: null, to: stage, note: 'Order created' }]
  }
  const { data, error } = await supabaseClient.supabase.from(COL[collection]).insert(body).select().single()
  if (error) throw new Error(error.message)
  return fromDB(collection, data)
}

async function sbUpdate(collection, id, app) {
  const body = toDB(collection, app)
  if (collection === 'styles') {
    const prev = await sbGet('styles', id)
    const nextStage = body.stage || (prev && prev.stage)
    body.stage = nextStage
    const history = prev && Array.isArray(prev.history) ? prev.history : []
    if (prev && nextStage !== prev.stage) {
      body.history = [
        ...history,
        {
          at: todayStr(),
          from: prev.stage,
          to: nextStage,
          note: app.note || (nextStage === 'Dispatched' ? 'Marked dispatched' : '')
        }
      ]
    } else {
      body.history = history
    }
  }
  const { data, error } = await supabaseClient.supabase.from(COL[collection]).update(body).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return fromDB(collection, data)
}

async function sbRemove(collection, id) {
  const { error } = await supabaseClient.supabase.from(COL[collection]).delete().eq('id', id)
  if (error) throw new Error(error.message)
  return { ok: true }
}

async function sbData() {
  const [retailers, vendors, fabrics, readyStock, purchaseOrders, styles] = await Promise.all([
    sbList('retailers'),
    sbList('vendors'),
    sbList('fabrics'),
    sbList('readyStock'),
    sbList('purchaseOrders'),
    sbList('styles')
  ])
  return { retailers, vendors, fabrics, readyStock, purchaseOrders, styles }
}

// ----- Excel upload (Supabase mode) ----------------------------------------

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

async function sbUploadReadyStock(body) {
  if (!body || typeof body.file !== 'string') throw new Error('Missing file')
  const XLSX = await import('xlsx')
  const binary = atob(body.file)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  const wb = XLSX.read(bytes, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) throw new Error('Excel file has no sheets')
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
  if (!rows.length) throw new Error('No data rows found in the sheet')

  const headers = Object.keys(rows[0])
  const col = {}
  for (const h of headers) {
    const key = normalizeKey(h)
    for (const [field, aliases] of Object.entries(HEADER_MAP)) {
      if (aliases.includes(key) && !col[field]) col[field] = h
    }
  }
  if (!col.name) {
    throw new Error(`Could not find an item name column. Recognised columns: ${Object.keys(col).join(', ') || 'none'}. Expected a header like "Name" / "Item".`)
  }

  const existing = (await sbList('readyStock')) || []
  let created = 0
  let updated = 0
  let skipped = 0
  const tasks = []
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
    const match = existing.find((i) => String(i.name || '').toLowerCase() === raw.name.toLowerCase())
    if (match) {
      tasks.push(sbUpdate('readyStock', match.id, raw))
      updated++
    } else {
      tasks.push(sbCreate('readyStock', raw))
      created++
    }
  }
  await Promise.all(tasks)
  const fileHint = body.filename ? ` (${body.filename})` : ''
  return {
    ok: true,
    created,
    updated,
    skipped,
    message: `Upload complete${fileHint}: ${created} created, ${updated} updated, ${skipped} rows skipped.`
  }
}

// ----- Legacy (Express) backend --------------------------------------------

async function handleLegacy(r) {
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(`Request failed (${r.status}) ${text}`)
  }
  return r.json()
}

const legacy = {
  get(path) {
    return fetch(path).then(handleLegacy)
  },
  post(path, body) {
    return fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(handleLegacy)
  },
  put(path, body) {
    return fetch(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(handleLegacy)
  },
  del(path) {
    return fetch(path, { method: 'DELETE' }).then(handleLegacy)
  }
}

// ----- Shared routing -------------------------------------------------------

const VALID = new Set(Object.keys(COLLECTIONS))

function route(method, path) {
  const parts = path.split('/').filter(Boolean).slice(1)
  if (parts[0] === 'data') return { type: 'data' }
  if (parts[0] === 'reports') return { type: 'report', name: parts[1] }
  if (parts[0] === 'readyStock' && parts[1] === 'upload') return { type: 'upload' }
  if (VALID.has(parts[0])) {
    return { type: 'collection', name: parts[0], id: parts[1] }
  }
  throw new Error(`Unknown route ${method} ${path}`)
}

async function supabaseApi(method, path, body) {
  const r = route(method, path)
  switch (r.type) {
    case 'data':
      return sbData()
    case 'upload':
      return sbUploadReadyStock(body || {})
    case 'report': {
      const db = await sbData()
      switch (r.name) {
        case 'overview': return computeOverview(db)
        case 'alerts': return computeAlerts(db)
        case 'wip': return computeWip(db)
        case 'stock': return computeFabricStock(db)
        default: throw new Error('Unknown report ' + r.name)
      }
    }
    case 'collection':
      if (method === 'GET') return r.id ? sbGet(r.name, r.id) : sbList(r.name)
      if (method === 'POST') return sbCreate(r.name, body)
      if (method === 'PUT') return sbUpdate(r.name, r.id, body)
      if (method === 'DELETE') return sbRemove(r.name, r.id)
      throw new Error('Unsupported method ' + method)
    default:
      throw new Error('Unknown route')
  }
}

export const api = {
  get(path) {
    if (supabaseClient.USE_SUPABASE) return supabaseApi('GET', path)
    return legacy.get(path)
  },
  post(path, body) {
    if (supabaseClient.USE_SUPABASE) return supabaseApi('POST', path, body)
    return legacy.post(path, body)
  },
  put(path, body) {
    if (supabaseClient.USE_SUPABASE) return supabaseApi('PUT', path, body)
    return legacy.put(path, body)
  },
  del(path) {
    if (supabaseClient.USE_SUPABASE) return supabaseApi('DELETE', path)
    return legacy.del(path)
  }
}
