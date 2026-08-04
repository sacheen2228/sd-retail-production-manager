import { api } from '../api.js'
import { readSheet } from './sheets.js'

/**
 * Pull data edited in the Google Sheet back into the app.
 *
 * Workflow: user edits the exported tabs (Retailers, Vendors, Fabrics,
 * Purchase Orders, Styles, Ready Stock), then Settings → Sheet Sync →
 * "Read Google Sheet" loads every tab, diffs it against the current database
 * by natural key, and "Apply" upserts the changes through the normal
 * api.* CRUD layer (so both Supabase and the local Express backend work).
 *
 * Derived/calculated columns that the app computes itself (WIP, Days,
 * Opening/Issued/Closing/Value/Status, Sr) are deliberately ignored — only
 * editable source fields are imported. Rows that are blank in the sheet keep
 * their existing app values on update.
 */

export const TAB_ORDER = ['Retailers', 'Vendors', 'Fabrics', 'Purchase Orders', 'Styles', 'Ready Stock']

const COLLECTION = {
  Retailers: 'retailers',
  Vendors: 'vendors',
  Fabrics: 'fabrics',
  'Purchase Orders': 'purchaseOrders',
  Styles: 'styles',
  'Ready Stock': 'readyStock'
}

const STAGES = new Set([
  'Sampling', 'Fabric', 'Trims', 'Embroidery-Kolkata', 'Embroidery-Mumbai',
  'Cutting', 'Stitching', 'Finishing', 'QC', 'Packing', 'Dispatched'
])

const PO_STATUSES = new Set(['Confirmed', 'In Production', 'On Hold', 'Dispatched'])

// Columns the DB rejects below zero (schema `check (... >= 0)`).
const NON_NEGATIVE = ['stock', 'receivedStock', 'quantity', 'costPrice', 'lowStockLevel', 'consumption', 'leadTimeDays', 'value', 'qtyDispatched']

function clean(v) {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function parseNum(v) {
  if (v === '' || v === null || v === undefined) return undefined
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
  const n = parseFloat(String(v).replace(/[,₹]/g, ''))
  return Number.isNaN(n) ? undefined : n
}

function keyOf(a, b, c) {
  return `${a.toLowerCase()}|${b.toLowerCase()}|${c.toLowerCase()}`
}

const READERS = {
  Retailers: {
    parse(r) {
      const name = clean(r[0])
      if (!name) return null
      return { name, city: clean(r[1]), contact: clean(r[2]) }
    },
    key: (e) => e.name.toLowerCase()
  },
  Vendors: {
    parse(r) {
      const name = clean(r[0])
      if (!name) return null
      return { name, type: clean(r[1]), location: clean(r[2]), contact: clean(r[3]) }
    },
    key: (e) => e.name.toLowerCase()
  },
  Fabrics: {
    parse(r) {
      const name = clean(r[0])
      if (!name) return null
      return {
        name,
        type: clean(r[1]),
        stock: parseNum(r[2]),
        uom: clean(r[3]),
        vendor: clean(r[4]),
        leadTimeDays: parseNum(r[5]),
        costPrice: parseNum(r[6]),
        consumption: parseNum(r[7]),
        lowStockLevel: parseNum(r[8])
      }
    },
    key: (e) => e.name.toLowerCase()
  },
  'Purchase Orders': {
    parse(r, ctx) {
      const poNumber = clean(r[0])
      if (!poNumber) return null
      return {
        poNumber,
        retailerId: ctx.retailerIdByName[clean(r[1]).toLowerCase()] || null,
        orderDate: clean(r[2]) || null,
        deliveryDate: clean(r[3]) || null,
        status: clean(r[4]) || 'Pending',
        value: parseNum(r[5]),
        notes: clean(r[6])
      }
    },
    key: (e) => e.poNumber.toLowerCase()
  },
  Styles: {
    parse(r, ctx) {
      const styleCode = clean(r[0])
      if (!styleCode) return null
      const poName = clean(r[6])
      return {
        styleCode,
        styleName: clean(r[1]),
        category: clean(r[2]),
        subCategory: clean(r[3]),
        color: clean(r[4]),
        size: clean(r[5]),
        poId: ctx.poIdByNumber[poName.toLowerCase()] || null,
        quantity: parseNum(r[7]),
        qtyDispatched: parseNum(r[9]),
        stage: clean(r[10])
      }
    },
    key: (e) => keyOf(e.styleCode, e.color || '', e.size || '')
  },
  'Ready Stock': {
    parse(r) {
      const styleCode = clean(r[1])
      if (!styleCode) return null
      return {
        styleCode,
        name: clean(r[2]),
        category: clean(r[3]),
        color: clean(r[4]),
        size: clean(r[5]),
        location: clean(r[6]),
        receivedStock: parseNum(r[8]),
        lowStockLevel: parseNum(r[11]),
        costPrice: parseNum(r[12])
      }
    },
    key: (e) => keyOf(e.styleCode, e.color || '', e.size || '')
  }
}

function stripUndef(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v
  return out
}

/** Drop invalid values the DB schema would reject (bad enums, negatives). */
function sanitize(rec) {
  const out = {}
  for (const [k, v] of Object.entries(rec)) {
    if (NON_NEGATIVE.includes(k) && typeof v === 'number' && v < 0) continue
    if (k === 'stage' && v && !STAGES.has(v)) continue
    if (k === 'status' && v && !PO_STATUSES.has(v)) continue
    out[k] = v
  }
  return out
}

/** Read every exported tab from the Google Sheet. */
export async function readSheetData() {
  const tabs = []
  await Promise.all(
    TAB_ORDER.map(async (name) => {
      try {
        const res = await readSheet(name)
        tabs.push({ name, cols: res.cols || [], rows: res.rows || [], status: 'ok' })
      } catch (err) {
        tabs.push({ name, rows: [], status: 'error', message: err.message })
      }
    })
  )
  return { tabs }
}

/** Build a per-tab plan of records to create/update by matching natural keys. */
export function diffSheetData(db, tabs) {
  const tabByName = Object.fromEntries((tabs || []).map((t) => [t.name, t]))
  const retailerIdByName = Object.fromEntries((db.retailers || []).map((r) => [String(r.name || '').toLowerCase(), r.id]))
  const poIdByNumber = Object.fromEntries((db.purchaseOrders || []).map((p) => [String(p.poNumber || '').toLowerCase(), p.id]))
  const existing = {
    Retailers: new Map((db.retailers || []).map((r) => [String(r.name || '').toLowerCase(), r])),
    Vendors: new Map((db.vendors || []).map((v) => [String(v.name || '').toLowerCase(), v])),
    Fabrics: new Map((db.fabrics || []).map((f) => [String(f.name || '').toLowerCase(), f])),
    'Purchase Orders': new Map((db.purchaseOrders || []).map((p) => [String(p.poNumber || '').toLowerCase(), p])),
    Styles: new Map((db.styles || []).map((s) => [keyOf(s.styleCode || '', s.color || '', s.size || ''), s])),
    'Ready Stock': new Map((db.readyStock || []).map((i) => [keyOf(i.styleCode || '', i.color || '', i.size || ''), i]))
  }
  const ctx = { retailerIdByName, poIdByNumber }

  const plans = {}
  for (const tab of TAB_ORDER) {
    const reader = READERS[tab]
    const tabData = tabByName[tab]
    const plan = { tab, records: [], added: 0, updated: 0, skipped: 0, error: tabData?.status === 'error' ? tabData.message : null }
    for (const row of tabData?.rows || []) {
      let rec
      try {
        rec = reader.parse(row, ctx)
      } catch {
        rec = null
      }
      if (!rec) {
        plan.skipped++
        continue
      }
      const key = reader.key(rec)
      const match = existing[tab].get(key)
      rec = sanitize(rec)
      if (match) {
        plan.records.push({ ...match, ...rec })
        plan.updated++
      } else {
        plan.records.push({ ...rec, __create: true })
        plan.added++
      }
    }
    plans[tab] = plan
  }
  return plans
}

function hasChanges(plans) {
  return TAB_ORDER.some((t) => plans[t] && (plans[t].added > 0 || plans[t].updated > 0))
}

/** Upsert the planned records through api.* CRUD. Returns per-tab counts. */
export async function applyImport(plans) {
  if (!plans || !hasChanges(plans)) throw new Error('Nothing to apply')
  const counts = {}
  const errors = []
  for (const tab of TAB_ORDER) {
    const plan = plans[tab]
    const collection = COLLECTION[tab]
    let created = 0
    let updated = 0
    let failed = 0
    for (const rec of plan.records) {
      const body = stripUndef(rec)
      try {
        if (rec.__create) {
          delete body.__create
          await api.post(`/api/${collection}`, body)
          created++
        } else {
          const id = body.id
          delete body.id
          await api.put(`/api/${collection}/${id}`, body)
          updated++
        }
      } catch (err) {
        failed++
        if (errors.length < 10) errors.push({ tab, key: String(body.poNumber || body.styleCode || body.name || body.id || '?'), message: err.message })
      }
    }
    counts[tab] = { added: created, updated, skipped: plan.skipped, failed, error: plan.error }
  }
  return { ok: true, counts, errors }
}

export function totalChanges(plans) {
  let added = 0
  let updated = 0
  for (const tab of TAB_ORDER) {
    if (!plans[tab]) continue
    added += plans[tab].added
    updated += plans[tab].updated
  }
  return { added, updated }
}
