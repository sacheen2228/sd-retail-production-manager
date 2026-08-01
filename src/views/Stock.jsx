import React, { useMemo, useRef, useState } from 'react'
import { api } from '../api.js'
import ImageUpload from '../components/ImageUpload.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../components/ConfirmDialog.jsx'
import { exportToSheet } from '../services/sheets.js'
import { validateStockItem, firstError } from '../lib/validate.js'
import { Card, Kpi, Btn, Badge, Modal, Field, Input, Select, Textarea, SubCatField, Empty, fmtMoney } from '../components/ui.jsx'
import { CATEGORIES, CATEGORY_NAMES } from '../lib.js'

const EMPTY = {
  name: '',
  styleCode: '',
  color: '',
  size: '',
  category: 'Occasions',
  subCategory: '',
  quantity: 0,
  costPrice: 0,
  sellingPrice: 0,
  lowStockLevel: 2,
  location: '',
  image: '',
  notes: ''
}

function statusFor(r) {
  const qty = Number(r.quantity) || 0
  const low = Number(r.lowStockLevel) || 0
  if (qty <= 0) return { tone: 'danger', label: 'Out of Stock' }
  if (qty <= low) return { tone: 'warn', label: 'Low Stock' }
  return { tone: 'success', label: 'In Stock' }
}

const COL_COUNT = 16

export default function Stock({ ctx }) {
  const { db, refresh, can } = ctx
  const items = db.readyStock || []
  const [editing, setEditing] = useState(null)
  const [addQty, setAddQty] = useState(null)
  const [category, setCategory] = useState('All')
  const [sub, setSub] = useState('All')
  const [search, setSearch] = useState('')
  const [styleFilter, setStyleFilter] = useState('')
  const [colorFilter, setColorFilter] = useState('')
  const [sizeFilter, setSizeFilter] = useState('')
  const [outOnly, setOutOnly] = useState(false)
  const [groupMode, setGroupMode] = useState(false)
  const [scanActive, setScanActive] = useState(false)
  const [scanValue, setScanValue] = useState('')
  const [highlight, setHighlight] = useState(null)
  const [uploadMsg, setUploadMsg] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const fileRef = useRef(null)
  const { push } = useToast()
  const { confirm, node: confirmNode } = useConfirm()

  const subs = category === 'All' ? [] : CATEGORIES[category] || []

  const colors = useMemo(() => [...new Set(items.map((i) => String(i.color || '').trim()).filter(Boolean))].sort(), [items])
  const sizes = useMemo(() => [...new Set(items.map((i) => String(i.size || '').trim()).filter(Boolean))].sort(), [items])

  const soldByStyle = useMemo(() => {
    const map = {}
    for (const s of db.styles || []) {
      if (s.stage !== 'Dispatched') continue
      const code = String(s.styleCode || '').trim().toLowerCase()
      if (!code) continue
      const qty = Number(s.qtyDispatched) || Number(s.quantity) || 0
      const at = s.stageEnteredAt || s.createdAt
      const cur = map[code] || { sold: 0, first: null }
      cur.sold += qty
      if (at && (!cur.first || at < cur.first)) cur.first = at
      map[code] = cur
    }
    return map
  }, [db.styles])

  function ledger(r) {
    const closing = Number(r.quantity) || 0
    const cost = Number(r.costPrice) || 0
    const issued = soldByStyle[String(r.styleCode || '').trim().toLowerCase()]?.sold || 0
    const received = Number(r.receivedStock) || 0
    const opening = Math.max(0, closing + issued - received)
    return { opening, received, issued, closing, cost, value: closing * cost }
  }

  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    const sc = styleFilter.trim().toLowerCase()
    const col = colorFilter.toLowerCase()
    const sz = sizeFilter.toLowerCase()
    return items
      .filter((i) => category === 'All' || i.category === category)
      .filter((i) => sub === 'All' || i.subCategory === sub)
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.subCategory.toLowerCase().includes(q) || String(i.styleCode || '').toLowerCase().includes(q))
      .filter((i) => !sc || String(i.styleCode || '').trim().toLowerCase() === sc)
      .filter((i) => !col || String(i.color || '').trim().toLowerCase() === col)
      .filter((i) => !sz || String(i.size || '').trim().toLowerCase() === sz)
      .filter((i) => !outOnly || (Number(i.quantity) || 0) <= 0)
      .sort((a, b) => String(a.styleCode || '').localeCompare(String(b.styleCode || '')) || String(a.category).localeCompare(String(b.category)))
  }, [items, category, sub, search, styleFilter, colorFilter, sizeFilter, outOnly])

  const groups = useMemo(() => {
    const map = new Map()
    for (const r of list) {
      const key = String(r.styleCode || '').trim().toLowerCase() || '#' + String(r.name || '').trim().toLowerCase()
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(r)
    }
    return [...map.values()]
  }, [list])

  const totalPieces = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)
  const totalValue = items.reduce((s, i) => s + (Number(i.costPrice) || 0) * (Number(i.quantity) || 0), 0)
  const lowCount = items.filter((i) => statusFor(i).tone !== 'success').length

  function openNew() {
    setEditing({ ...EMPTY })
  }

  function duplicateExists(item) {
    const code = String(item.styleCode || '').trim().toLowerCase()
    if (!code) return false
    const color = String(item.color || '').trim().toLowerCase()
    const size = String(item.size || '').trim().toLowerCase()
    return items.some(
      (x) =>
        x.id !== item.id &&
        String(x.styleCode || '').trim().toLowerCase() === code &&
        String(x.color || '').trim().toLowerCase() === color &&
        String(x.size || '').trim().toLowerCase() === size
    )
  }

  function saveItem() {
    const err = firstError(validateStockItem(editing))
    if (err) {
      push(err, 'danger')
      return
    }
    if (duplicateExists(editing)) {
      push('This Style Code + Color + Size variant already exists', 'danger')
      return
    }
    const body = {
      ...editing,
      quantity: Number(editing.quantity) || 0,
      receivedStock: Number(editing.receivedStock) || 0,
      costPrice: Number(editing.costPrice) || 0,
      sellingPrice: Number(editing.sellingPrice) || 0,
      lowStockLevel: Number(editing.lowStockLevel) || 0
    }
    const p = editing.id ? api.put('/api/readyStock/' + editing.id, body) : api.post('/api/readyStock', body)
    p.then(() => {
      setEditing(null)
      refresh()
    }).catch((e) => push('Save failed: ' + e.message, 'danger'))
  }

  async function removeItem() {
    const ok = await confirm({
      title: 'Remove stock item',
      message: `Remove "${editing.name}" from ready stock? This cannot be undone.`,
      tone: 'danger',
      confirmLabel: 'Remove'
    })
    if (!ok) return
    api.del('/api/readyStock/' + editing.id).then(() => {
      setEditing(null)
      refresh()
    })
  }

  function saveAddStock() {
    const add = Number(addQty.qty)
    if (!add || add <= 0) return
    api
      .put('/api/readyStock/' + addQty.item.id, {
        quantity: (Number(addQty.item.quantity) || 0) + add,
        receivedStock: (Number(addQty.item.receivedStock) || 0) + add
      })
      .then(() => {
        setAddQty(null)
        refresh()
      })
  }

  const exportData = useMemo(() => {
    const cols = ['Sr', 'SKU Code', 'Item Name', 'Category', 'Color', 'Size', 'Warehouse', 'Opening', 'Received', 'Issued', 'Closing', 'Min', 'Cost', 'Value', 'Status']
    const rows = list.map((r, i) => {
      const st = statusFor(r)
      const l = ledger(r)
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
        l.received,
        `=IFERROR(SUMIF(Styles!$A:$A,B${row},Styles!$J:$J),0)`,
        l.closing,
        r.lowStockLevel,
        l.cost,
        `=K${row}*M${row}`,
        `=IF(K${row}<=0,"Out of Stock",IF(K${row}<=L${row},"Low Stock","In Stock"))`
      ]
    })
    return { cols, rows }
  }, [list, soldByStyle])

  function handleScan() {
    const code = scanValue.trim().toLowerCase()
    if (!code) return
    const match = items.find((i) => String(i.styleCode || '').trim().toLowerCase() === code || String(i.name || '').toLowerCase() === code)
    if (!match) {
      push(`No ready-stock item found for "${scanValue.trim()}"`, 'danger')
      return
    }
    setCategory('All')
    setSub('All')
    setSearch('')
    setStyleFilter('')
    setColorFilter('')
    setSizeFilter('')
    setOutOnly(false)
    setScanValue('')
    setScanActive(false)
    requestAnimationFrame(() => {
      setHighlight(match.id)
      document.getElementById('stock-row-' + match.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    setTimeout(() => setHighlight(null), 2600)
  }

  function exportCSV() {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = [
      exportData.cols.map(esc).join(','),
      ...exportData.rows.map((r) => r.map(esc).join(','))
    ]
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ready-stock-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function exportSheet() {
    setExporting(true)
    exportToSheet({ sheet: 'Ready Stock', ...exportData })
      .then((res) => {
        const action = res.spreadsheet ? { label: 'Open Sheet', href: res.spreadsheet } : null
        push(`Exported ${res.count} rows to Google Sheets`, 'success', action ? { action } : {})
      })
      .catch((e) => push(e.message, 'danger'))
      .finally(() => setExporting(false))
  }

  function onFileSelected(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setUploadMsg(null)
    file.arrayBuffer().then((buf) => {
      let binary = ''
      const bytes = new Uint8Array(buf)
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
      return api.post('/api/readyStock/upload', { file: btoa(binary), filename: file.name })
    }).then((res) => {
      setUploadMsg({ tone: 'success', text: res.message })
      refresh()
    }).catch((err) => {
      setUploadMsg({ tone: 'danger', text: err.message || 'Upload failed' })
    }).finally(() => setUploading(false))
  }

  return (
    <div>
      <div className="kpi-row">
        <Kpi label="Ready Stock Items" value={items.length} tone="ink" sub="finished garments" />
        <Kpi label="Pieces on Hand" value={totalPieces} tone="maroon" sub="garments in inventory" />
        <Kpi label="Stock Value" value={fmtMoney(totalValue)} tone="gold" sub="at cost price" />
        <Kpi label="Low / Out" value={lowCount} tone={lowCount > 0 ? 'danger' : 'ok'} sub="need attention" />
      </div>

      <div className="view-toolbar">
        <div className="toolbar-left">
          <Input className="search" placeholder="Search item…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input input-sm" value={category} onChange={(e) => { setCategory(e.target.value); setSub('All') }}>
            <option value="All">All categories</option>
            {CATEGORY_NAMES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select className="input input-sm" value={sub} onChange={(e) => setSub(e.target.value)} disabled={category === 'All'}>
            <option value="All">All sub-categories</option>
            {subs.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <Btn tone="ghost" onClick={exportCSV}>Export CSV</Btn>
          <Btn tone="ghost" onClick={exportSheet} disabled={exporting || !exportData.rows.length}>
            {exporting ? 'Exporting…' : '→ Sheet'}
          </Btn>
          {can('edit') && (
            <Btn tone="ghost" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload Excel'}
            </Btn>
          )}
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={onFileSelected} />
        </div>
        {can('create') && <Btn onClick={openNew}>+ Add Stock Item</Btn>}
      </div>

      <div className="view-toolbar">
        <div className="toolbar-left">
          {scanActive ? (
            <input
              className="input input-sm scan-input"
              autoFocus
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleScan()
                else if (e.key === 'Escape') { setScanActive(false); setScanValue('') }
              }}
              placeholder="Scan barcode / type SKU, press Enter…"
            />
          ) : (
            <Btn tone="ghost" onClick={() => setScanActive(true)} title="Look up an item by barcode / SKU">
              Scan
            </Btn>
          )}
          <select className="input input-sm" value={styleFilter} onChange={(e) => setStyleFilter(e.target.value)}>
            <option value="">All style codes</option>
            {[...new Set(items.map((i) => String(i.styleCode || '').trim()).filter(Boolean))].sort().map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select className="input input-sm" value={colorFilter} onChange={(e) => setColorFilter(e.target.value)}>
            <option value="">All colors</option>
            {colors.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select className="input input-sm" value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)}>
            <option value="">All sizes</option>
            {sizes.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <label className="filter-check">
            <input type="checkbox" checked={outOnly} onChange={(e) => setOutOnly(e.target.checked)} />
            Out of stock only
          </label>
          <label className="filter-check">
            <input type="checkbox" checked={groupMode} onChange={(e) => setGroupMode(e.target.checked)} />
            Group by style
          </label>
        </div>
      </div>

      {uploadMsg && (
        <div className={`upload-msg ${uploadMsg.tone === 'danger' ? 'upload-msg-danger' : ''}`}>
          {uploadMsg.text}
        </div>
      )}

      <Card>
        {list.length === 0 ? (
          <Empty>No stock items found. Click "+ Add Stock Item" to add ready garments.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Sr</th>
                <th>SKU Code</th>
                <th>Item Name</th>
                <th>Category</th>
                <th>Color</th>
                <th>Size</th>
                <th>Warehouse</th>
                <th>Opening</th>
                <th>Received</th>
                <th>Issued</th>
                <th>Closing</th>
                <th>Min</th>
                <th>Cost</th>
                <th>Value</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {groupMode
                ? groups.map((g) => {
                    const sum = g.reduce(
                      (a, v) => {
                        const l = ledger(v)
                        a.opening += l.opening
                        a.received += l.received
                        a.issued += l.issued
                        a.closing += l.closing
                        a.value += l.value
                        return a
                      },
                      { opening: 0, received: 0, issued: 0, closing: 0, value: 0 }
                    )
                    return (
                      <React.Fragment key={g[0].id}>
                        <tr className="group-row">
                          <td colSpan={COL_COUNT}>
                            <div className="group-head">
                              <span className="strong">{g[0].styleCode || 'No code'}</span>
                              <span className="group-name">{g[0].name}</span>
                              <span className="badge badge-default">{g.length} variant{g.length > 1 ? 's' : ''}</span>
                              <span className="group-stats">
                                Opening {sum.opening} · Received {sum.received} · Issued {sum.issued} · Closing {sum.closing} · {fmtMoney(sum.value)}
                              </span>
                            </div>
                          </td>
                        </tr>
                        {g.map((v, vi) => {
                          const st = statusFor(v)
                          const l = ledger(v)
                          return (
                            <tr key={v.id} id={'stock-row-' + v.id} className={highlight === v.id ? 'row-flash' : ''}>
                              <td className="muted">{vi + 1}</td>
                              <td className="muted">↳</td>
                              <td className="strong">{v.name}</td>
                              <td>{v.category}</td>
                              <td>{v.color || '-'}</td>
                              <td>{v.size || '-'}</td>
                              <td>{v.location || '-'}</td>
                              <td>{l.opening}</td>
                              <td>{l.received}</td>
                              <td>{l.issued > 0 ? l.issued : '-'}</td>
                              <td className="strong">{l.closing}</td>
                              <td>{v.lowStockLevel}</td>
                              <td>{fmtMoney(l.cost)}</td>
                              <td>{fmtMoney(l.value)}</td>
                              <td><Badge tone={st.tone}>{st.label}</Badge></td>
                              <td className="row-actions">
                                {can('edit') && (
                                  <>
                                    <Btn tone="success" onClick={() => setAddQty({ item: v, qty: '' })} title="Add stock on hand">
                                      + Stock
                                    </Btn>
                                    <Btn tone="ghost" onClick={() => setEditing({ ...v })}>
                                      Edit
                                    </Btn>
                                  </>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </React.Fragment>
                    )
                  })
                : list.map((r, i) => {
                    const st = statusFor(r)
                    const l = ledger(r)
                    return (
                      <tr key={r.id} id={'stock-row-' + r.id} className={highlight === r.id ? 'row-flash' : ''}>
                        <td className="muted">{i + 1}</td>
                        <td className="strong">{r.styleCode || '-'}</td>
                        <td className="strong">
                          <div className="style-cell">
                            {r.image && <img className="style-thumb" src={r.image} alt="" />}
                            <div>{r.name}</div>
                          </div>
                        </td>
                        <td>{r.category}</td>
                        <td>{r.color || '-'}</td>
                        <td>{r.size || '-'}</td>
                        <td>{r.location || '-'}</td>
                        <td>{l.opening}</td>
                        <td>{l.received}</td>
                        <td>{l.issued > 0 ? l.issued : '-'}</td>
                        <td className="strong">{l.closing}</td>
                        <td>{r.lowStockLevel}</td>
                        <td>{fmtMoney(l.cost)}</td>
                        <td>{fmtMoney(l.value)}</td>
                        <td><Badge tone={st.tone}>{st.label}</Badge></td>
                        <td className="row-actions">
                          {can('edit') && (
                            <>
                              <Btn tone="success" onClick={() => setAddQty({ item: r, qty: '' })} title="Add stock on hand">
                                + Stock
                              </Btn>
                              <Btn tone="ghost" onClick={() => setEditing({ ...r })}>
                                Edit
                              </Btn>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={!!editing}
        title={editing?.id ? `Edit Stock Item — ${editing.name}` : 'Add Stock Item'}
        onClose={() => setEditing(null)}
        footer={
          <>
            {editing?.id && can('delete') && (
              <Btn tone="danger-ghost" onClick={removeItem}>
                Remove Item
              </Btn>
            )}
            <div className="spacer" />
            <Btn tone="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Btn>
            <Btn onClick={saveItem}>{editing?.id ? 'Save Changes' : 'Add Item'}</Btn>
          </>
        }
      >
        {editing && (
          <div className="form-grid">
            <Field label="Item Name" hint="e.g. Red Banarasi Lehenga Set">
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label="Style Code" hint="unique code, e.g. LEH-101">
              <Input value={editing.styleCode} onChange={(e) => setEditing({ ...editing, styleCode: e.target.value })} placeholder="LEH-101" />
            </Field>
            <Field label="Color">
              <Input value={editing.color} onChange={(e) => setEditing({ ...editing, color: e.target.value })} placeholder="Red" />
            </Field>
            <Field label="Size">
              <Input value={editing.size} onChange={(e) => setEditing({ ...editing, size: e.target.value })} placeholder="Free / S / M / L / XL" />
            </Field>
            <Field label="Item Image">
              <ImageUpload value={editing.image} alt={editing.name} onChange={(url) => setEditing({ ...editing, image: url })} />
            </Field>
            <Field label="Warehouse">
              <Input value={editing.location} onChange={(e) => setEditing({ ...editing, location: e.target.value })} placeholder="Mumbai / Delhi / Kolkata" />
            </Field>
            <Field label="Category">
              <Select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value, subCategory: '' })}>
                {CATEGORY_NAMES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Sub-category">
              <SubCatField value={editing.subCategory} category={editing.category} onChange={(sub) => setEditing({ ...editing, subCategory: sub })} />
            </Field>
            <Field label="Closing Stock" hint="pieces currently on hand">
              <Input type="number" min="0" value={editing.quantity} onChange={(e) => setEditing({ ...editing, quantity: e.target.value })} />
            </Field>
            <Field label="Stock Received" hint="total received this period (used for Opening)">
              <Input type="number" min="0" value={editing.receivedStock ?? 0} onChange={(e) => setEditing({ ...editing, receivedStock: e.target.value })} />
            </Field>
            <Field label="Cost Price (₹)">
              <Input type="number" min="0" value={editing.costPrice} onChange={(e) => setEditing({ ...editing, costPrice: e.target.value })} />
            </Field>
            <Field label="Selling Price (₹)">
              <Input type="number" min="0" value={editing.sellingPrice} onChange={(e) => setEditing({ ...editing, sellingPrice: e.target.value })} />
            </Field>
            <Field label="Low Stock Level" hint="alerts when qty is at or below this">
              <Input type="number" min="0" value={editing.lowStockLevel} onChange={(e) => setEditing({ ...editing, lowStockLevel: e.target.value })} />
            </Field>
            <Field label="Notes">
              <Textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>

      <Modal
        open={!!addQty}
        title={`Add Stock — ${addQty?.item?.name}`}
        onClose={() => setAddQty(null)}
        footer={
          <>
            <div className="spacer" />
            <Btn tone="ghost" onClick={() => setAddQty(null)}>
              Cancel
            </Btn>
            <Btn onClick={saveAddStock} disabled={!(Number(addQty?.qty) > 0)}>
              Add to Stock
            </Btn>
          </>
        }
      >
        <Field label="Quantity received / added">
          <Input type="number" min="1" autoFocus value={addQty?.qty || ''} onChange={(e) => setAddQty({ ...addQty, qty: e.target.value })} placeholder="e.g. 10" />
        </Field>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Current on hand: {addQty?.item?.quantity} → will become {Number(addQty?.item?.quantity || 0) + (Number(addQty?.qty) || 0)}
        </div>
      </Modal>
      {confirmNode}
    </div>
  )
}
