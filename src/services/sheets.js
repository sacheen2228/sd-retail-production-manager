const SHEET_URL = import.meta.env.VITE_GOOGLE_SHEET_WEB_APP_URL
const SHEET_TOKEN = import.meta.env.VITE_GOOGLE_SHEET_TOKEN || ''

/**
 * One-way export to a Google Sheet via a Google Apps Script web app.
 * Payload: { token, sheets: [{ name, cols, rows }] } — each entry becomes a tab.
 *
 * `Content-Type: text/plain` keeps the POST a "simple" request so no CORS
 * preflight is needed against the Apps Script endpoint.
 */
async function post(payload) {
  if (!SHEET_URL) throw new Error('Google Sheets export is not configured (VITE_GOOGLE_SHEET_WEB_APP_URL)')
  const res = await fetch(SHEET_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
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
  return [
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
      name: 'Ready Stock',
      cols: ['Name', 'Category', 'Sub-category', 'Quantity', 'Cost Price', 'Selling Price', 'Low Stock Level', 'Location'],
      rows: (db.readyStock || []).map((r) => [r.name, r.category, r.subCategory, num(r.quantity), num(r.costPrice), num(r.sellingPrice), num(r.lowStockLevel), r.location])
    },
    {
      name: 'Purchase Orders',
      cols: ['PO Number', 'Retailer', 'Order Date', 'Delivery Date', 'Status', 'Value', 'Notes'],
      rows: (db.purchaseOrders || []).map((r) => [r.poNumber, retailerById[r.retailerId] || '', escDate(r.orderDate), escDate(r.deliveryDate), r.status, num(r.value), r.notes])
    },
    {
      name: 'Styles',
      cols: ['Style Code', 'Style Name', 'Category', 'Sub-category', 'PO', 'Quantity', 'Price', 'Fabric', 'Trim', 'Stage', 'Stage Entered', 'Qty Dispatched', 'Notes'],
      rows: (db.styles || []).map((r) => [r.styleCode, r.styleName, r.category, r.subCategory, poById[r.poId] || '', num(r.quantity), num(r.price), r.fabric, r.trim, r.stage, escDate(r.stageEnteredAt), num(r.qtyDispatched), r.notes])
    }
  ]
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
