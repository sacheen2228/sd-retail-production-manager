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

export default function Stock({ ctx }) {
  const { db, refresh } = ctx
  const items = db.readyStock || []
  const [editing, setEditing] = useState(null)
  const [addQty, setAddQty] = useState(null)
  const [category, setCategory] = useState('All')
  const [sub, setSub] = useState('All')
  const [search, setSearch] = useState('')
  const [uploadMsg, setUploadMsg] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const fileRef = useRef(null)
  const { push } = useToast()
  const { confirm, node: confirmNode } = useConfirm()

  const subs = category === 'All' ? [] : CATEGORIES[category] || []

  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items
      .filter((i) => category === 'All' || i.category === category)
      .filter((i) => sub === 'All' || i.subCategory === sub)
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.subCategory.toLowerCase().includes(q))
      .sort((a, b) => String(a.category).localeCompare(String(b.category)))
  }, [items, category, sub, search])

  const totalPieces = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)
  const totalValue = items.reduce((s, i) => s + (Number(i.costPrice) || 0) * (Number(i.quantity) || 0), 0)
  const lowCount = items.filter((i) => statusFor(i).tone !== 'success').length

  function openNew() {
    setEditing({ ...EMPTY })
  }

  function saveItem() {
    const err = firstError(validateStockItem(editing))
    if (err) {
      push(err, 'danger')
      return
    }
    const body = {
      ...editing,
      quantity: Number(editing.quantity) || 0,
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
      .put('/api/readyStock/' + addQty.item.id, { quantity: (Number(addQty.item.quantity) || 0) + add })
      .then(() => {
        setAddQty(null)
        refresh()
      })
  }

  const exportData = useMemo(() => {
    const cols = ['Item', 'Category', 'Sub-category', 'Qty on Hand', 'Cost', 'Selling', 'Value', 'Status', 'Location']
    const rows = list.map((r) => {
      const st = statusFor(r)
      return [r.name, r.category, r.subCategory, r.quantity, r.costPrice, r.sellingPrice, (Number(r.costPrice) || 0) * (Number(r.quantity) || 0), st.label, r.location]
    })
    return { cols, rows }
  }, [list])

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
      .then((res) => push(`Exported ${res.count} rows to Google Sheets`, 'success'))
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
          <Btn tone="ghost" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading…' : 'Upload Excel'}
          </Btn>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={onFileSelected} />
        </div>
        <Btn onClick={openNew}>+ Add Stock Item</Btn>
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
                <th>Item</th>
                <th>Category</th>
                <th>Sub-category</th>
                <th>Qty on Hand</th>
                <th>Cost</th>
                <th>Selling</th>
                <th>Value</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const st = statusFor(r)
                return (
                  <tr key={r.id}>
                    <td className="strong">
                      <div className="style-cell">
                        {r.image && <img className="style-thumb" src={r.image} alt="" />}
                        <div>
                          {r.name}
                          {r.location && <div className="cell-sub">{r.location}</div>}
                        </div>
                      </div>
                    </td>
                    <td>{r.category}</td>
                    <td>{r.subCategory || '-'}</td>
                    <td className="strong">{r.quantity}</td>
                    <td>{fmtMoney(r.costPrice)}</td>
                    <td>{fmtMoney(r.sellingPrice)}</td>
                    <td>{fmtMoney((Number(r.costPrice) || 0) * (Number(r.quantity) || 0))}</td>
                    <td><Badge tone={st.tone}>{st.label}</Badge></td>
                    <td className="row-actions">
                      <Btn tone="success" onClick={() => setAddQty({ item: r, qty: '' })} title="Add stock on hand">
                        + Stock
                      </Btn>
                      <Btn tone="ghost" onClick={() => setEditing({ ...r })}>
                        Edit
                      </Btn>
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
            {editing?.id && (
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
            <Field label="Item Image">
              <ImageUpload value={editing.image} alt={editing.name} onChange={(url) => setEditing({ ...editing, image: url })} />
            </Field>
            <Field label="Location / Store">
              <Input value={editing.location} onChange={(e) => setEditing({ ...editing, location: e.target.value })} placeholder="Showroom / Store" />
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
            <Field label="Qty on Hand">
              <Input type="number" min="0" value={editing.quantity} onChange={(e) => setEditing({ ...editing, quantity: e.target.value })} />
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
