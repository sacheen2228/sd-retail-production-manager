import React, { useMemo, useState } from 'react'
import { api } from '../api.js'
import { Card, StageBadge, DueBadge, Btn, Modal, Field, Input, Select, Textarea, Empty, fmtDate, fmtMoney } from '../components/ui.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../components/ConfirmDialog.jsx'

const PO_STATUSES = ['Confirmed', 'In Production', 'On Hold', 'Dispatched']

export default function Deliveries({ ctx }) {
  const { db, refresh } = ctx
  const { purchaseOrders, styles, retailers } = db
  const [editing, setEditing] = useState(null)
  const { push } = useToast()
  const { confirm, node: confirmNode } = useConfirm()
  const rName = (id) => retailers.find((r) => r.id === id)?.name || '-'

  const rows = useMemo(() => {
    return purchaseOrders
      .map((o) => {
        const s = styles.filter((x) => x.poId === o.id)
        const dispatched = s.filter((x) => x.stage === 'Dispatched').length
        const open = s.length - dispatched
        return { ...o, styleCount: s.length, dispatched, open }
      })
      .sort((a, b) => (a.deliveryDate < b.deliveryDate ? -1 : 1))
  }, [purchaseOrders, styles])

  function dispatchOrder(po) {
    const s = styles.filter((x) => x.poId === po.id && x.stage !== 'Dispatched')
    const tasks = s.map((x) =>
      api.put('/api/styles/' + x.id, {
        stage: 'Dispatched',
        stageEnteredAt: new Date().toISOString().slice(0, 10),
        qtyDispatched: x.quantity
      })
    )
    if (s.length > 0) {
      tasks.push(api.put('/api/purchaseOrders/' + po.id, { status: 'Dispatched' }))
    }
    Promise.all(tasks).then(() => {
      push('Order marked dispatched', 'success')
      refresh()
    })
  }

  function savePO() {
    const body = {
      ...(editing.poNumber ? { poNumber: editing.poNumber } : {}),
      deliveryDate: editing.deliveryDate,
      status: editing.status,
      value: Number(editing.value) || 0,
      notes: editing.notes
    }
    api
      .put('/api/purchaseOrders/' + editing.id, body)
      .then(() => {
        setEditing(null)
        push('Order updated', 'success')
        refresh()
      })
      .catch((e) => push('Save failed: ' + e.message, 'danger'))
  }

  async function deletePO(po) {
    const ok = await confirm({
      title: 'Delete purchase order',
      message: `Delete ${po.poNumber}${po.styleCount ? ` and its ${po.styleCount} style line(s)` : ''}? This cannot be undone.`,
      tone: 'danger',
      confirmLabel: 'Delete'
    })
    if (!ok) return
    const tasks = [api.del('/api/purchaseOrders/' + po.id)]
    styles.filter((x) => x.poId === po.id).forEach((x) => tasks.push(api.del('/api/styles/' + x.id)))
    Promise.all(tasks)
      .then(() => {
        push('Order deleted', 'success')
        refresh()
      })
      .catch((e) => push('Delete failed: ' + e.message, 'danger'))
  }

  return (
    <div>
      <Card title="Delivery Schedule">
        {rows.length === 0 ? (
          <Empty>No deliveries scheduled.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>PO</th>
                <th>Retailer</th>
                <th>Delivery Date</th>
                <th>Due</th>
                <th>Styles</th>
                <th>Dispatched</th>
                <th>Value</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const overdue = new Date(o.deliveryDate + 'T00:00:00') < new Date()
                const allDone = o.styleCount > 0 && o.open === 0
                return (
                  <tr key={o.id} className={allDone ? 'row-done' : ''}>
                    <td className="strong">{o.poNumber}</td>
                    <td>{rName(o.retailerId)}</td>
                    <td>{fmtDate(o.deliveryDate)}</td>
                    <td><DueBadge dateStr={o.deliveryDate} /></td>
                    <td>{o.styleCount}</td>
                    <td>
                      {o.dispatched}/{o.styleCount}
                    </td>
                    <td>{fmtMoney(o.value)}</td>
                    <td>
                      {allDone ? <StageBadge stage="Dispatched" /> : <StageBadge stage="In Production" />}
                      {overdue && !allDone && <div className="cell-sub danger-text">Overdue</div>}
                    </td>
                    <td>
                      <div className="row-actions">
                        {!allDone && o.styleCount > 0 && (
                          <Btn tone="success" onClick={() => dispatchOrder(o)}>
                            Mark Dispatched
                          </Btn>
                        )}
                        <Btn tone="ghost" onClick={() => setEditing({ ...o })}>
                          Edit
                        </Btn>
                        <Btn tone="danger-ghost" onClick={() => deletePO(o)} title="Delete order">
                          ✕
                        </Btn>
                      </div>
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
        title={`Edit ${editing?.poNumber || 'Purchase Order'}`}
        onClose={() => setEditing(null)}
        footer={
          <>
            <div className="spacer" />
            <Btn tone="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Btn>
            <Btn onClick={savePO}>Save Order</Btn>
          </>
        }
      >
        {editing && (
          <div className="form-grid">
            <Field label="Delivery Date">
              <Input type="date" value={editing.deliveryDate || ''} onChange={(e) => setEditing({ ...editing, deliveryDate: e.target.value })} />
            </Field>
            <Field label="Status">
              <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                {PO_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
            <Field label="Order Value (₹)">
              <Input type="number" min="0" value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} />
            </Field>
            <Field label="Notes">
              <Textarea value={editing.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
      {confirmNode}
    </div>
  )
}
