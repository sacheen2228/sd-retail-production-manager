import React, { useState } from 'react'
import { api } from '../api.js'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../components/ConfirmDialog.jsx'
import ImageUpload from '../components/ImageUpload.jsx'
import { validatePurchaseOrder, firstError } from '../lib/validate.js'
import {
  Card,
  Modal,
  Field,
  Input,
  Select,
  Textarea,
  Btn,
  StageBadge,
  Empty,
  SubCatField,
  fmtDate,
  fmtMoney
} from '../components/ui.jsx'
import { STAGES, CATEGORY_NAMES } from '../lib.js'

const todayStr = () => new Date().toISOString().slice(0, 10)
const key = () => crypto.randomUUID()

const emptyLine = () => ({
  _key: key(),
  id: null,
  styleCode: '',
  styleName: '',
  category: 'Occasions',
  subCategory: '',
  color: '',
  size: '',
  quantity: '',
  price: '',
  costPrice: '',
  fabric: '',
  trim: '',
  stage: 'Sampling',
  notes: ''
})

const EMPTY_PO = { poNumber: '', retailerId: '', orderDate: '', deliveryDate: '', status: 'Confirmed', value: 0, notes: '', image: '' }

export default function Orders({ ctx }) {
  const { db, refresh, can } = ctx
  const { purchaseOrders, retailers, styles } = db
  const { push } = useToast()
  const { confirm, node: confirmNode } = useConfirm()
  const [editing, setEditing] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [filter, setFilter] = useState('All')

  const statuses = ['All', 'Confirmed', 'In Production', 'On Hold', 'Dispatched']
  const list = purchaseOrders
    .filter((o) => filter === 'All' || o.status === filter)
    .sort((a, b) => (a.deliveryDate < b.deliveryDate ? -1 : 1))

  const rName = (id) => retailers.find((r) => r.id === id)?.name || '-'

  function openNew() {
    setEditing({
      ...EMPTY_PO,
      orderDate: todayStr(),
      retailerIsNew: false,
      newRetailer: { name: '', city: '', contact: '' },
      lineItems: [emptyLine()],
      removedLineIds: []
    })
  }

  function openEdit(o) {
    setEditing({
      ...o,
      retailerIsNew: false,
      newRetailer: { name: '', city: '', contact: '' },
      lineItems: styles
        .filter((s) => s.poId === o.id)
        .map((s) => ({
          _key: s.id,
          id: s.id,
          styleCode: s.styleCode,
          styleName: s.styleName,
          category: s.category,
          subCategory: s.subCategory || '',
          color: s.color || '',
          size: s.size || '',
          quantity: s.quantity,
          price: s.price,
          costPrice: s.costPrice || '',
          fabric: s.fabric || '',
          trim: s.trim || '',
          stage: s.stage,
          notes: s.notes || ''
        })),
      removedLineIds: []
    })
  }

  const computedValue = (editing?.lineItems || [])
    .filter((l) => l.styleCode.trim())
    .reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.price) || 0), 0)
  const orderValue = computedValue > 0 ? computedValue : Number(editing?.value) || 0

  function setLine(i, patch) {
    const lineItems = editing.lineItems.map((l, idx) => (idx === i ? { ...l, ...patch } : l))
    setEditing({ ...editing, lineItems })
  }

  function addLine() {
    setEditing({ ...editing, lineItems: [...editing.lineItems, emptyLine()] })
  }

  function removeLine(i) {
    const line = editing.lineItems[i]
    const removedLineIds = line.id ? [...editing.removedLineIds, line.id] : editing.removedLineIds
    setEditing({ ...editing, lineItems: editing.lineItems.filter((_, idx) => idx !== i), removedLineIds })
  }

  async function save() {
    const err = firstError(validatePurchaseOrder(editing))
    if (err) {
      push(err, 'danger')
      return
    }
    const lines = editing.lineItems.filter((l) => l.styleCode.trim())
    let retailerId = editing.retailerId
    if (editing.retailerIsNew) {
      const nr = await api.post('/api/retailers', {
        name: editing.newRetailer.name,
        city: editing.newRetailer.city,
        contact: editing.newRetailer.contact
      })
      retailerId = nr.id
    }
    const poBody = {
      poNumber: editing.poNumber,
      retailerId,
      orderDate: editing.orderDate,
      deliveryDate: editing.deliveryDate,
      status: editing.status,
      value: orderValue,
      notes: editing.notes,
      image: editing.image || ''
    }
    const po = editing.id
      ? await api.put('/api/purchaseOrders/' + editing.id, poBody)
      : await api.post('/api/purchaseOrders', poBody)

    const upsert = lines.map((l) => {
      const lineBody = {
        poId: po.id,
        styleCode: l.styleCode,
        styleName: l.styleName,
        category: l.category,
        subCategory: l.subCategory,
        color: l.color,
        size: l.size,
        quantity: Number(l.quantity) || 0,
        price: Number(l.price) || 0,
        costPrice: Number(l.costPrice) || 0,
        fabric: l.fabric,
        trim: l.trim,
        stage: l.stage,
        stageEnteredAt: todayStr(),
        qtyDispatched: 0,
        notes: l.notes
      }
      return l.id ? api.put('/api/styles/' + l.id, lineBody) : api.post('/api/styles', lineBody)
    })
    const removed = (editing.removedLineIds || []).map((id) => api.del('/api/styles/' + id))
    await Promise.all([...upsert, ...removed])
    setEditing(null)
    await refresh()
  }

  async function removePO() {
    const ok = await confirm({
      title: 'Delete purchase order',
      message: `Delete PO ${editing.poNumber || '#' + String(editing.id).slice(0, 6)}? Its style lines will also be removed.`,
      tone: 'danger',
      confirmLabel: 'Delete'
    })
    if (!ok) return
    api.del('/api/purchaseOrders/' + editing.id).then(() => {
      setEditing(null)
      return refresh()
    })
  }

  return (
    <div>
      <div className="view-toolbar">
        <div className="chips">
          {statuses.map((s) => (
            <button key={s} className={`chip ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
              {s}
            </button>
          ))}
        </div>
        {can('create') && <Btn onClick={openNew}>+ New Purchase Order</Btn>}
      </div>

      <Card>
        {list.length === 0 ? (
          <Empty>No purchase orders found.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>PO</th>
                <th>Retailer</th>
                <th>Order Date</th>
                <th>Delivery Date</th>
                <th>Value</th>
                <th>Styles</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => {
                const styleCount = db.styles.filter((s) => s.poId === o.id).length
                return (
                  <React.Fragment key={o.id}>
                    <tr onClick={() => setExpanded(expanded === o.id ? null : o.id)} className="row-click">
                      <td className="strong">
                        <div className="style-cell">
                          {o.image && <img className="style-thumb" src={o.image} alt="" />}
                          {o.poNumber}
                        </div>
                      </td>
                      <td>{rName(o.retailerId)}</td>
                      <td>{fmtDate(o.orderDate)}</td>
                      <td>{fmtDate(o.deliveryDate)}</td>
                      <td>{fmtMoney(o.value)}</td>
                      <td>{styleCount}</td>
                      <td><StageBadge stage={o.status} /></td>
                      <td>
                        {can('edit') && (
                          <Btn tone="ghost" onClick={(e) => { e.stopPropagation(); openEdit(o) }}>
                            Edit
                          </Btn>
                        )}
                      </td>
                    </tr>
                    {expanded === o.id && (
                      <tr className="expanded-row">
                        <td colSpan="8">
                          <div className="expanded-inner">
                            <div className="expanded-meta">
                              {o.image && (
                                <img className="po-image" src={o.image} alt={`PO ${o.poNumber}`} />
                              )}
                              {o.notes ? <div className="muted">Notes: {o.notes}</div> : null}
                            </div>
                            <table className="table table-sm">
                              <thead>
                                <tr>
                                  <th>Style</th>
                                  <th>Color</th>
                                  <th>Size</th>
                                  <th>Category</th>
                                  <th>Qty</th>
                                  <th>Unit Price</th>
                                  <th>Stage</th>
                                </tr>
                              </thead>
                              <tbody>
                                {db.styles
                                  .filter((s) => s.poId === o.id)
                                  .map((s) => (
                                    <tr key={s.id}>
                                      <td className="strong">
                                        {s.styleCode} — {s.styleName}
                                      </td>
                                      <td>{s.color || '-'}</td>
                                      <td>{s.size || '-'}</td>
                                      <td>{s.category}</td>
                                      <td>{s.quantity}</td>
                                      <td>{fmtMoney(s.price)}</td>
                                      <td><StageBadge stage={s.stage} /></td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={!!editing}
        title={editing?.id ? `Edit Purchase Order — ${editing.poNumber}` : 'New Purchase Order'}
        onClose={() => setEditing(null)}
        wide
        footer={
          <>
            {editing?.id && can('delete') && (
              <Btn tone="danger-ghost" onClick={removePO}>
                Delete PO
              </Btn>
            )}
            <div className="spacer" />
            <div className="computed-total">Total: {fmtMoney(orderValue)}</div>
            <Btn tone="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Btn>
            <Btn onClick={save}>Save Order</Btn>
          </>
        }
      >
        {editing && (
          <div>
            <div className="form-grid">
              <Field label="PO Number">
                <Input value={editing.poNumber} onChange={(e) => setEditing({ ...editing, poNumber: e.target.value })} placeholder="PO-2410" />
              </Field>
              <Field label="Order Date">
                <Input type="date" value={editing.orderDate} onChange={(e) => setEditing({ ...editing, orderDate: e.target.value })} />
              </Field>
              <Field label="Delivery Date">
                <Input type="date" value={editing.deliveryDate} onChange={(e) => setEditing({ ...editing, deliveryDate: e.target.value })} />
              </Field>
              <Field label="Status">
                <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  {['Confirmed', 'In Production', 'On Hold', 'Dispatched'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="field" style={{ marginTop: 14 }}>
              <span className="field-label">Product Image</span>
              <ImageUpload value={editing.image} alt={editing.poNumber || 'product'} onChange={(url) => setEditing({ ...editing, image: url })} />
            </div>

            <div className="field" style={{ marginTop: 14 }}>
              <span className="field-label">Retailer / Brand Partner</span>
              {!editing.retailerIsNew ? (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Select value={editing.retailerId} onChange={(e) => setEditing({ ...editing, retailerId: e.target.value })}>
                    <option value="">Select retailer</option>
                    {retailers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} — {r.city}
                      </option>
                    ))}
                  </Select>
                  <button className="link-btn" type="button" onClick={() => setEditing({ ...editing, retailerIsNew: true })}>
                    + Register new retailer
                  </button>
                </div>
              ) : (
                <div className="new-retailer-box">
                  <div className="form-grid">
                    <Field label="New Retailer Name">
                      <Input value={editing.newRetailer.name} onChange={(e) => setEditing({ ...editing, newRetailer: { ...editing.newRetailer, name: e.target.value } })} placeholder="e.g. Sabyasachi Store" />
                    </Field>
                    <Field label="City">
                      <Input value={editing.newRetailer.city} onChange={(e) => setEditing({ ...editing, newRetailer: { ...editing.newRetailer, city: e.target.value } })} placeholder="e.g. Mumbai" />
                    </Field>
                    <Field label="Contact">
                      <Input value={editing.newRetailer.contact} onChange={(e) => setEditing({ ...editing, newRetailer: { ...editing.newRetailer, contact: e.target.value } })} placeholder="Phone or email" />
                    </Field>
                  </div>
                  <button className="link-btn" type="button" style={{ marginTop: 8 }} onClick={() => setEditing({ ...editing, retailerIsNew: false })}>
                    Use existing retailer instead
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '18px 0 8px' }}>
              <div className="field-label">Styles / Order Lines</div>
              <Btn tone="ghost" btn-sm onClick={addLine}>
                + Add Style
              </Btn>
            </div>

            {editing.lineItems.length === 0 && <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>No styles yet — add at least one so it shows in the Production Tracker.</div>}

            {editing.lineItems.map((l, i) => (
              <div className="line-card" key={l._key}>
                <div className="line-card-head">
                  <div className="line-card-title">Style #{i + 1}</div>
                  <button className="link-btn" type="button" onClick={() => removeLine(i)}>
                    Remove
                  </button>
                </div>
                <div className="form-grid">
                  <Field label="Style Code">
                    <Input value={l.styleCode} onChange={(e) => setLine(i, { styleCode: e.target.value })} placeholder="BR-2430" />
                  </Field>
                  <Field label="Style Name">
                    <Input value={l.styleName} onChange={(e) => setLine(i, { styleName: e.target.value })} placeholder="Red Banarasi Lehenga Set" />
                  </Field>
                  <Field label="Category">
                    <Select value={l.category} onChange={(e) => setLine(i, { category: e.target.value, subCategory: '' })}>
                      {CATEGORY_NAMES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Sub-category">
                    <SubCatField value={l.subCategory} category={l.category} onChange={(sub) => setLine(i, { subCategory: sub })} />
                  </Field>
                  <Field label="Color">
                    <Input value={l.color} onChange={(e) => setLine(i, { color: e.target.value })} placeholder="Red" />
                  </Field>
                  <Field label="Size">
                    <Input value={l.size} onChange={(e) => setLine(i, { size: e.target.value })} placeholder="S / M / L / XL / Free" />
                  </Field>
                  <Field label="Order Qty">
                    <Input type="number" min="1" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} placeholder="12" />
                  </Field>
                  <Field label="Unit Price (₹)">
                    <Input type="number" value={l.price} onChange={(e) => setLine(i, { price: e.target.value })} placeholder="95000" />
                  </Field>
                  <Field label="Unit Cost (₹)" hint="for profit reports">
                    <Input type="number" min="0" value={l.costPrice} onChange={(e) => setLine(i, { costPrice: e.target.value })} placeholder="60000" />
                  </Field>
                  <Field label="Starting Stage">
                    <Select value={l.stage} onChange={(e) => setLine(i, { stage: e.target.value })}>
                      {STAGES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Fabric">
                    <Input value={l.fabric} onChange={(e) => setLine(i, { fabric: e.target.value })} placeholder="Banarasi Silk" />
                  </Field>
                  <Field label="Trims">
                    <Input value={l.trim} onChange={(e) => setLine(i, { trim: e.target.value })} placeholder="Zari Border (gold)" />
                  </Field>
                  <Field label="Notes" hint="">
                    <Textarea value={l.notes} onChange={(e) => setLine(i, { notes: e.target.value })} />
                  </Field>
                </div>
              </div>
            ))}

            <Field label="Order Notes">
              <Textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
      {confirmNode}
    </div>
  )
}
