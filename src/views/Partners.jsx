import React, { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../components/ConfirmDialog.jsx'
import { validatePartner, firstError } from '../lib/validate.js'
import { Card, Modal, Field, Input, Select, Btn, Badge, Empty, fmtMoney } from '../components/ui.jsx'

const VENDOR_TYPES = ['Embroidery-Kolkata', 'Embroidery-Mumbai', 'Fabric', 'Trims', 'Cutting', 'Stitching', 'Finishing', 'Vendor']

const EMPTY = {
  vendor: { name: '', type: 'Embroidery-Kolkata', location: '', contact: '' },
  retailer: { name: '', city: '', contact: '' },
  fabric: { name: '', type: 'Silk', stock: 0, uom: 'mtr', vendor: '', leadTimeDays: 0, costPrice: 0, consumption: 0, lowStockLevel: 30 }
}

export default function Partners({ ctx }) {
  const { db, refresh } = ctx
  const { vendors, retailers, fabrics } = db
  const [tab, setTab] = useState('vendors')
  const [editing, setEditing] = useState(null)
  const [fabricReport, setFabricReport] = useState(null)
  const { push } = useToast()
  const { confirm, node: confirmNode } = useConfirm()

  useEffect(() => {
    if (tab === 'fabricStock') {
      api.get('/api/reports/stock').then(setFabricReport).catch(() => {})
    }
  }, [tab, db])

  function save() {
    const col = tab
    const type = col === 'fabrics' ? 'fabric' : col
    const err = firstError(validatePartner(type, editing))
    if (err) {
      push(err, 'danger')
      return
    }
    const p = editing.id
      ? api.put('/api/' + col + '/' + editing.id, editing)
      : api.post('/api/' + col, editing)
    p.then(() => {
      setEditing(null)
      return refresh()
    }).catch((e) => push('Save failed: ' + e.message, 'danger'))
  }

  async function remove() {
    const ok = await confirm({
      title: 'Delete record',
      message: `Delete this ${tab === 'vendors' ? 'vendor' : tab === 'retailers' ? 'retailer' : 'fabric/trim'} record? This cannot be undone.`,
      tone: 'danger',
      confirmLabel: 'Delete'
    })
    if (!ok) return
    api.del('/api/' + tab + '/' + editing.id).then(() => {
      setEditing(null)
      return refresh()
    })
  }

  const tabs = [
    { id: 'vendors', label: `Vendors (${vendors.length})` },
    { id: 'retailers', label: `Retailers (${retailers.length})` },
    { id: 'fabrics', label: `Fabrics & Trims (${fabrics.length})` },
    { id: 'fabricStock', label: 'Fabric Stock Report' }
  ]

  return (
    <div>
      <div className="view-toolbar">
        <div className="chips">
          {tabs.map((t) => (
            <button key={t.id} className={`chip ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <Btn onClick={() => setEditing({ ...EMPTY[tab] })}>+ Add {tab === 'vendors' ? 'Vendor' : tab === 'retailers' ? 'Retailer' : 'Fabric/Trim'}</Btn>
      </div>

      {tab === 'vendors' && (
        <Card>
          {vendors.length === 0 ? (
            <Empty>No vendors.</Empty>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Contact</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id}>
                    <td className="strong">{v.name}</td>
                    <td>{v.type}</td>
                    <td>{v.location}</td>
                    <td>{v.contact}</td>
                    <td>
                      <Btn tone="ghost" onClick={() => setEditing({ ...v })}>
                        Edit
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === 'retailers' && (
        <Card>
          {retailers.length === 0 ? (
            <Empty>No retailers.</Empty>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Retailer</th>
                  <th>City</th>
                  <th>Contact</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {retailers.map((r) => (
                  <tr key={r.id}>
                    <td className="strong">{r.name}</td>
                    <td>{r.city}</td>
                    <td>{r.contact}</td>
                    <td>
                      <Btn tone="ghost" onClick={() => setEditing({ ...r })}>
                        Edit
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === 'fabrics' && (
        <Card>
          {fabrics.length === 0 ? (
            <Empty>No fabrics or trims.</Empty>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Type</th>
                  <th>Stock</th>
                  <th>UOM</th>
                  <th>Cost/unit</th>
                  <th>Value</th>
                  <th>Vendor</th>
                  <th>Lead Time</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {fabrics.map((f) => (
                  <tr key={f.id}>
                    <td className="strong">{f.name}</td>
                    <td>{f.type}</td>
                    <td>{f.stock}</td>
                    <td>{f.uom}</td>
                    <td>{fmtMoney(f.costPrice)}</td>
                    <td>{fmtMoney((Number(f.costPrice) || 0) * (Number(f.stock) || 0))}</td>
                    <td>{f.vendor || '-'}</td>
                    <td>{f.leadTimeDays}d</td>
                    <td>
                      <Btn tone="ghost" onClick={() => setEditing({ ...f })}>
                        Edit
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === 'fabricStock' && (
        <Card title="Fabric & Trim Stock — allocated vs available">
          {!fabricReport ? (
            <Empty>Loading…</Empty>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>On Hand</th>
                  <th>Allocated</th>
                  <th>Available</th>
                  <th>Status</th>
                  <th>Value</th>
                  <th>Vendor</th>
                </tr>
              </thead>
              <tbody>
                {fabricReport.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="strong">{r.name}</td>
                    <td>{r.stock} {r.uom}</td>
                    <td>{r.allocated} {r.uom}</td>
                    <td className={r.available < 0 ? 'danger-text strong' : 'strong'}>{r.available} {r.uom}</td>
                    <td>
                      <Badge tone={r.status === 'reorder' ? 'danger' : r.status === 'low' ? 'warn' : 'success'}>
                        {r.status === 'reorder' ? 'Reorder Now' : r.status === 'low' ? 'Low' : 'In Stock'}
                      </Badge>
                    </td>
                    <td>{fmtMoney(r.value)}</td>
                    <td>{r.vendor || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      <Modal
        open={!!editing}
        title={`${editing?.id ? 'Edit' : 'Add'} ${tab === 'vendors' ? 'Vendor' : tab === 'retailers' ? 'Retailer' : 'Fabric/Trim'}`}
        onClose={() => setEditing(null)}
        footer={
          <>
            {editing?.id && (
              <Btn tone="danger-ghost" onClick={remove}>
                Delete
              </Btn>
            )}
            <div className="spacer" />
            <Btn tone="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Btn>
            <Btn onClick={save}>Save</Btn>
          </>
        }
      >
        {editing &&
          (tab === 'vendors' ? (
            <div className="form-grid">
              <Field label="Vendor Name">
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </Field>
              <Field label="Type">
                <Select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })}>
                  {VENDOR_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Location">
                <Input value={editing.location} onChange={(e) => setEditing({ ...editing, location: e.target.value })} />
              </Field>
              <Field label="Contact">
                <Input value={editing.contact} onChange={(e) => setEditing({ ...editing, contact: e.target.value })} />
              </Field>
            </div>
          ) : tab === 'retailers' ? (
            <div className="form-grid">
              <Field label="Retailer Name">
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </Field>
              <Field label="City">
                <Input value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })} />
              </Field>
              <Field label="Contact">
                <Input value={editing.contact} onChange={(e) => setEditing({ ...editing, contact: e.target.value })} />
              </Field>
            </div>
          ) : (
            <div className="form-grid">
              <Field label="Item Name">
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </Field>
              <Field label="Type">
                <Select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })}>
                  {['Silk', 'Georgette', 'Velvet', 'Cotton', 'Trim', 'Other'].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Stock on Hand">
                <Input type="number" min="0" value={editing.stock} onChange={(e) => setEditing({ ...editing, stock: e.target.value })} />
              </Field>
              <Field label="UOM">
                <Select value={editing.uom} onChange={(e) => setEditing({ ...editing, uom: e.target.value })}>
                  {['mtr', 'pcs', 'kg', 'sets'].map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Cost Price (₹/unit)" hint="used for stock value">
                <Input type="number" min="0" value={editing.costPrice} onChange={(e) => setEditing({ ...editing, costPrice: e.target.value })} />
              </Field>
              <Field label="Consumption per piece" hint="used for allocation">
                <Input type="number" min="0" value={editing.consumption} onChange={(e) => setEditing({ ...editing, consumption: e.target.value })} />
              </Field>
              <Field label="Low Stock Level" hint="alert threshold">
                <Input type="number" min="0" value={editing.lowStockLevel} onChange={(e) => setEditing({ ...editing, lowStockLevel: e.target.value })} />
              </Field>
              <Field label="Vendor">
                <Input value={editing.vendor} onChange={(e) => setEditing({ ...editing, vendor: e.target.value })} />
              </Field>
              <Field label="Lead Time (days)">
                <Input type="number" min="0" value={editing.leadTimeDays} onChange={(e) => setEditing({ ...editing, leadTimeDays: e.target.value })} />
              </Field>
            </div>
          ))}
      </Modal>
      {confirmNode}
    </div>
  )
}
