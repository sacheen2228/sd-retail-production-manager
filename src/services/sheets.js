const SHEET_URL = '/api/export'
const SHEET_TOKEN = import.meta.env.VITE_GOOGLE_SHEET_TOKEN || ''

/**
 * One-way export to a Google Sheet via the same-origin proxy (/api/export),
 * which forwards to the Google Apps Script web app server-side.
 * Payload: { token, sheets: [{ name, cols, rows }] } — each entry becomes a tab.
 */
async function post(payload) {
  const res = await fetch(SHEET_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: SHEET_TOKEN, ...payload })
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('Sheet responded unexpectedly: ' + text.slice(0, 200))
  }
  if (!json.ok) throw new Error(json.error || 'Sheet export failed')
  return json
}

function num(v) {
  const n = Number(v)
  return Number.isNaN(n) ? '' : n
}

function buildAllSheets(db) {
  const escDate = (d) => d || ''
  const retailerById = Object.fromEntries((db.retailers || []).map((r) => [r.id, r.name]))
  const poById = Object.fromEntries((db.purchaseOrders || []).map((p) => [p.id, p.poNumber]))
  const soldByStyle = {}
  for (const s of db.styles || []) {
    if (s.stage !== 'Dispatched') continue
    const code = String(s.styleCode || '').trim().toLowerCase()
    if (!code) continue
    soldByStyle[code] = (soldByStyle[code] || 0) + (Number(s.qtyDispatched) || Number(s.quantity) || 0)
  }
  const sheets = [
    {
      name: 'Retailers',
      cols: ['Name', 'City', 'Contact'],
      rows: (db.retailers || []).map((r) => [r.name, r.city, r.contact])
    },
    {
      name: 'Vendors',
      cols: ['Name', 'Type', 'Location', 'Contact'],
      rows: (db.vendors || []).map((r) => [r.name, r.type, r.location, r.contact])
    },
    {
      name: 'Fabrics',
      cols: ['Name', 'Type', 'Stock', 'UOM', 'Vendor', 'Lead Time (days)', 'Cost Price', 'Consumption', 'Low Stock Level'],
      rows: (db.fabrics || []).map((r) => [r.name, r.type, num(r.stock), r.uom, r.vendor, num(r.leadTimeDays), num(r.costPrice), num(r.consumption), num(r.lowStockLevel)])
    },
    {
      name: 'Styles',
      cols: ['Style Code', 'Style Name', 'Category', 'Sub-category', 'Color', 'Size', 'PO', 'Order Qty', 'WIP', 'Dispatch', 'Stage', 'Days', 'Status'],
      rows: (db.styles || []).map((r, i) => {
        const qty = num(r.quantity)
        const dispatched = num(r.qtyDispatched)
        const row = i + 2
        return [
          r.styleCode, r.styleName, r.category, r.subCategory, r.color || '', r.size || '',
          poById[r.poId] || '', qty, `=H${row}-J${row}`, dispatched,
          r.stage, r.stageEnteredAt ? Math.max(1, Math.ceil((new Date() - new Date(r.stageEnteredAt)) / 86400000)) : 0,
          `=IF(J${i + 2}>0,"Dispatched","In Production")`
        ]
      })
    },
    {
      name: 'Ready Stock',
      cols: ['Sr', 'SKU Code', 'Item Name', 'Category', 'Color', 'Size', 'Warehouse', 'Opening', 'Received', 'Issued', 'Closing', 'Min', 'Cost', 'Value', 'Status'],
      rows: (db.readyStock || []).map((r, i) => {
        const closing = num(r.quantity)
        const received = num(r.receivedStock)
        const issued = soldByStyle[String(r.styleCode || '').trim().toLowerCase()] || 0
        const opening = Math.max(0, closing + issued - received)
        const cost = num(r.costPrice)
        const st = closing <= 0 ? 'Out of Stock' : closing <= num(r.lowStockLevel) ? 'Low Stock' : 'In Stock'
        const row = i + 2
        return [
          i + 1,
          r.styleCode || '',
          r.name,
          r.category,
          r.color || '',
          r.size || '',
          r.location,
          `=MAX(0,K${row}+J${row}-I${row})`,
          received,
          `=IFERROR(SUMIF(Styles!$A:$A,B${row},Styles!$J:$J),0)`,
          closing,
          num(r.lowStockLevel),
          cost,
          `=K${row}*M${row}`,
          `=IF(K${row}<=0,"Out of Stock",IF(K${row}<=L${row},"Low Stock","In Stock"))`
        ]
      })
    },
    {
      name: 'Purchase Orders',
      cols: ['PO Number', 'Retailer', 'Order Date', 'Delivery Date', 'Status', 'Value', 'Notes'],
      rows: (db.purchaseOrders || []).map((r) => [r.poNumber, retailerById[r.retailerId] || '', escDate(r.orderDate), escDate(r.deliveryDate), r.status, num(r.value), r.notes])
    }
  ]
  return sheets
}

export async function exportAllToSheet(db) {
  const sheets = buildAllSheets(db).filter((s) => s.rows.length)
  if (!sheets.length) throw new Error('No data to export')
  return post({ sheets })
}

export async function exportToSheet({ sheet = '', cols, rows }) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('Nothing to export')
  return post({ sheets: [{ name: sheet || 'Export', cols, rows }] })
}

/**
 * Pull a named tab back from the Google Sheet (reverse of export).
 * The Apps Script must expose a `read` action (see docs/SHEET_EXPORT.md).
 * Returns { cols, rows, spreadsheet }.
 */
export async function readSheet(name) {
  if (!name) throw new Error('No sheet name given')
  return post({ action: 'read', sheet: name })
}
