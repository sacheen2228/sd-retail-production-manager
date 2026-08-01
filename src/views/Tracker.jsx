import React, { useMemo, useState } from 'react'
import { api } from '../api.js'
import ImageUpload from '../components/ImageUpload.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../components/ConfirmDialog.jsx'
import { validateStyle, firstError } from '../lib/validate.js'
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
import { STAGES, stageIndex, CATEGORY_NAMES } from '../lib.js'

const EMPTY_STYLE = {
  poId: '',
  styleCode: '',
  styleName: '',
  category: 'Occasions',
  subCategory: '',
  quantity: 1,
  price: 0,
  fabric: '',
  trim: '',
  stage: 'Sampling',
  stageEnteredAt: new Date().toISOString().slice(0, 10),
  qtyDispatched: 0,
  image: '',
  notes: ''
}

export default function Tracker({ ctx }) {
  const { db, refresh, can } = ctx
  const { styles, purchaseOrders, retailers } = db
  const [editing, setEditing] = useState(null)
  const [stageFilter, setStageFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [bulkStage, setBulkStage] = useState('')
  const { push } = useToast()
  const { confirm, node: confirmNode } = useConfirm()

  const rName = (id) => retailers.find((r) => r.id === id)?.name || '-'
  const poById = Object.fromEntries(purchaseOrders.map((o) => [o.id, o]))

  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return styles
      .filter((s) => stageFilter === 'All' || s.stage === stageFilter)
      .filter((s) => !q || s.styleCode.toLowerCase().includes(q) || s.styleName.toLowerCase().includes(q))
      .sort((a, b) => stageIndex(a.stage) - stageIndex(b.stage))
  }, [styles, stageFilter, search])

  const stageCounts = {}
  STAGES.forEach((st) => (stageCounts[st] = 0))
  styles.forEach((s) => (stageCounts[s.stage] = (stageCounts[s.stage] || 0) + 1))

  function toggleSelect(id) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  function toggleAll() {
    if (selected.size === list.length) setSelected(new Set())
    else setSelected(new Set(list.map((s) => s.id)))
  }

  function clearSelected() {
    setSelected(new Set())
  }

  function moveStage(style, dir) {
    const idx = stageIndex(style.stage)
    const next = Math.min(STAGES.length - 1, Math.max(0, idx + dir))
    if (next === idx) return
    api
      .put('/api/styles/' + style.id, {
        stage: STAGES[next],
        stageEnteredAt: new Date().toISOString().slice(0, 10),
        ...(STAGES[next] === 'Dispatched' ? { qtyDispatched: style.quantity } : {})
      })
      .then(refresh)
  }

  function advanceSelected() {
    const targets = list.filter((s) => selected.has(s.id) && stageIndex(s.stage) < STAGES.length - 1)
    const tasks = targets.map((s) => {
      const next = STAGES[stageIndex(s.stage) + 1]
      return api.put('/api/styles/' + s.id, {
        stage: next,
        stageEnteredAt: new Date().toISOString().slice(0, 10),
        ...(next === 'Dispatched' ? { qtyDispatched: s.quantity } : {})
      })
    })
    if (tasks.length === 0) return
    Promise.all(tasks).then(() => {
      clearSelected()
      refresh()
    })
  }

  function setSelectedStage() {
    if (!bulkStage) return
    const tasks = list
      .filter((s) => selected.has(s.id) && s.stage !== bulkStage)
      .map((s) =>
        api.put('/api/styles/' + s.id, {
          stage: bulkStage,
          stageEnteredAt: new Date().toISOString().slice(0, 10),
          ...(bulkStage === 'Dispatched' ? { qtyDispatched: s.quantity } : {})
        })
      )
    if (tasks.length === 0) return
    Promise.all(tasks).then(() => {
      clearSelected()
      setBulkStage('')
      refresh()
    })
  }

  async function deleteStyle(style) {
    const ok = await confirm({
      title: 'Delete job card',
      message: `Delete "${style.styleCode}"${style.styleName ? ' — ' + style.styleName : ''}? This cannot be undone.`,
      tone: 'danger',
      confirmLabel: 'Delete'
    })
    if (!ok) return
    api
      .del('/api/styles/' + style.id)
      .then(() => {
        push('Job card deleted', 'success')
        refresh()
      })
      .catch((e) => push('Delete failed: ' + e.message, 'danger'))
  }

  async function deleteSelected() {
    if (selected.size === 0) return
    const targets = list.filter((s) => selected.has(s.id))
    const ok = await confirm({
      title: 'Delete job cards',
      message: `Delete ${targets.length} selected job card(s)? This cannot be undone.`,
      tone: 'danger',
      confirmLabel: 'Delete'
    })
    if (!ok) return
    Promise.all(targets.map((s) => api.del('/api/styles/' + s.id)))
      .then(() => {
        clearSelected()
        push(`${targets.length} job card(s) deleted`, 'success')
        refresh()
      })
      .catch((e) => push('Delete failed: ' + e.message, 'danger'))
  }

  function daysInStage(style) {
    if (!style.stageEnteredAt) return 0
    return Math.max(0, Math.ceil((new Date() - new Date(style.stageEnteredAt + 'T00:00:00')) / 86400000))
  }

  function openNew() {
    const firstPo = purchaseOrders[0]
    setEditing({ ...EMPTY_STYLE, poId: firstPo ? firstPo.id : '' })
  }

  function save() {
    const err = firstError(validateStyle(editing))
    if (err) {
      push(err, 'danger')
      return
    }
    const body = {
      ...editing,
      quantity: Number(editing.quantity) || 0,
      price: Number(editing.price) || 0,
      qtyDispatched: Number(editing.qtyDispatched) || 0
    }
    const p = editing.id
      ? api.put('/api/styles/' + editing.id, body)
      : api.post('/api/styles', body)
    p.then(() => {
      setEditing(null)
      return refresh()
    }).catch((e) => push('Save failed: ' + e.message, 'danger'))
  }

  return (
    <div>
      <div className="view-toolbar">
        <div className="toolbar-left">
          <Input
            className="search"
            placeholder="Search style code or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="input input-sm" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
            <option value="All">All stages ({styles.length})</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s} ({stageCounts[s]})
              </option>
            ))}
          </select>
        </div>
        {can('create') && <Btn onClick={openNew}>+ New Style / Job Card</Btn>}
      </div>

      <Card>
        {selected.size > 0 && (
          <div className="bulk-bar">
            <span className="bulk-count">{selected.size} selected</span>
            {can('edit') && (
              <>
                <Btn tone="success" onClick={advanceSelected}>
                  Advance all ▶
                </Btn>
                <select className="input input-sm" value={bulkStage} onChange={(e) => setBulkStage(e.target.value)}>
                  <option value="">Move to stage…</option>
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <Btn tone="ghost" onClick={setSelectedStage} disabled={!bulkStage}>
                  Apply
                </Btn>
              </>
            )}
            {can('delete') && (
              <Btn tone="danger-ghost" onClick={deleteSelected}>
                Delete selected
              </Btn>
            )}
            <Btn tone="ghost" onClick={clearSelected}>
              Clear
            </Btn>
          </div>
        )}
        {list.length === 0 ? (
          <Empty>No styles match this filter.</Empty>
        ) : (
          <table className="table table-tracker">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" checked={selected.size === list.length && list.length > 0} onChange={toggleAll} />
                </th>
                <th>Style</th>
                <th>PO</th>
                <th>Retailer</th>
                <th>Cat.</th>
                <th>Qty</th>                <th>Fabric</th>
                <th>Trim</th>
                <th>Stage</th>
                <th>Days</th>
                <th>Progress</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => {
                const po = poById[s.poId]
                const idx = stageIndex(s.stage)
                return (
                  <tr key={s.id} className={selected.has(s.id) ? 'row-selected' : ''}>
                    <td>
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} />
                    </td>
                    <td className="strong">
                      <div className="style-cell">
                        {s.image && <img className="style-thumb" src={s.image} alt="" />}
                        <div>
                          {s.styleCode}
                          <div className="cell-sub">{s.styleName}</div>
                        </div>
                      </div>
                    </td>
                    <td>{po ? po.poNumber : '-'}</td>
                    <td>{po ? rName(po.retailerId) : '-'}</td>
                    <td>
                      {s.category}
                      {s.subCategory && <div className="cell-sub">{s.subCategory}</div>}
                    </td>
                    <td>
                      {s.quantity}
                      {s.qtyDispatched > 0 && (
                        <div className="cell-sub">dsp {s.qtyDispatched}</div>
                      )}
                    </td>
                    <td>{s.fabric || '-'}</td>
                    <td>{s.trim || '-'}</td>
                    <td><StageBadge stage={s.stage} /></td>
                    <td>{daysInStage(s)}d</td>
                    <td>
                      <div className="prog" title={`${idx + 1}/${STAGES.length}`}>
                        <div className="prog-fill" style={{ width: `${((idx + 1) / STAGES.length) * 100}%` }} />
                      </div>
                    </td>
                    <td className="row-actions">
                      {can('edit') && (
                        <>
                          <Btn tone="ghost" onClick={() => moveStage(s, -1)} disabled={idx === 0} title="Move to previous stage">
                            ◀
                          </Btn>
                          <Btn tone="ghost" onClick={() => setEditing({ ...s })}>
                            Edit
                          </Btn>
                          <Btn tone="ghost" onClick={() => moveStage(s, 1)} disabled={idx === STAGES.length - 1} title="Advance stage">
                            ▶
                          </Btn>
                        </>
                      )}
                      {can('delete') && (
                        <Btn tone="danger-ghost" onClick={() => deleteStyle(s)} title="Delete job card">
                          ✕
                        </Btn>
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
        title={editing?.id ? `Job Card — ${editing.styleCode}` : 'New Style / Job Card'}
        onClose={() => setEditing(null)}
        footer={
          <>
            <div className="spacer" />
            <Btn tone="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Btn>
            <Btn onClick={save}>Save Style</Btn>
          </>
        }
      >
        {editing && (
          <div className="form-grid">
            <Field label="Style Code">
              <Input value={editing.styleCode} onChange={(e) => setEditing({ ...editing, styleCode: e.target.value })} placeholder="BR-2430" />
            </Field>
            <Field label="Style Name">
              <Input value={editing.styleName} onChange={(e) => setEditing({ ...editing, styleName: e.target.value })} placeholder="Red Banarasi Lehenga Set" />
            </Field>
            <Field label="Style Image">
              <ImageUpload value={editing.image} alt={editing.styleCode} onChange={(url) => setEditing({ ...editing, image: url })} />
            </Field>
            <Field label="Purchase Order">
              <Select value={editing.poId} onChange={(e) => setEditing({ ...editing, poId: e.target.value })}>
                <option value="">— No PO —</option>
                {purchaseOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.poNumber}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Category">
              <Select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value, subCategory: '' })}>
                {CATEGORY_NAMES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Sub-category">
              <SubCatField value={editing.subCategory} category={editing.category} onChange={(sub) => setEditing({ ...editing, subCategory: sub })} />
            </Field>
            <Field label="Quantity">
              <Input type="number" min="1" value={editing.quantity} onChange={(e) => setEditing({ ...editing, quantity: e.target.value })} />
            </Field>
            <Field label="Unit Price (₹)">
              <Input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} />
            </Field>
            <Field label="Fabric">
              <Input value={editing.fabric} onChange={(e) => setEditing({ ...editing, fabric: e.target.value })} placeholder="Banarasi Silk" />
            </Field>
            <Field label="Trims">
              <Input value={editing.trim} onChange={(e) => setEditing({ ...editing, trim: e.target.value })} placeholder="Zari Border (gold)" />
            </Field>
            <Field label="Current Stage">
              <Select value={editing.stage} onChange={(e) => setEditing({ ...editing, stage: e.target.value })}>
                {STAGES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
            <Field label="Quantity Dispatched">
              <Input type="number" min="0" value={editing.qtyDispatched} onChange={(e) => setEditing({ ...editing, qtyDispatched: e.target.value })} />
            </Field>
            <Field label="Notes">
              <Textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
            </Field>
          </div>
        )}

        {editing?.id && (
          <div style={{ marginTop: 16 }}>
            <div className="field-label" style={{ marginBottom: 8 }}>
              Stage History
            </div>
            {(editing.history || []).length === 0 ? (
              <div className="muted" style={{ fontSize: 12 }}>
                No stage changes recorded yet.
              </div>
            ) : (
              <div className="timeline">
                {(editing.history || [])
                  .slice()
                  .reverse()
                  .map((h, i) => (
                    <div className="timeline-item" key={i}>
                      <div className="timeline-dot" />
                      <div className="timeline-body">
                        <div className="timeline-date">{h.at}</div>
                        <div className="timeline-event">
                          {h.from ? (
                            <>
                              <StageBadge stage={h.from} /> → <StageBadge stage={h.to} />
                            </>
                          ) : (
                            <StageBadge stage={h.to} />
                          )}
                          {h.note && <span className="timeline-note"> — {h.note}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </Modal>
      {confirmNode}
    </div>
  )
}
