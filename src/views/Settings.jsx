import React, { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { authEnabled, getCurrentUser, updatePassword } from '../services/auth.js'
import { Card, Btn, Badge, Select, Empty } from '../components/ui.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../components/ConfirmDialog.jsx'
import { ROLES, roleLabel } from '../lib/permissions.js'

const ACTION_TONE = { insert: 'success', update: 'warn', delete: 'danger' }
const ENTITY_LABEL = {
  retailers: 'Retailer',
  vendors: 'Vendor',
  fabrics: 'Fabric/Trim',
  readyStock: 'Ready Stock',
  purchaseOrders: 'Purchase Order',
  styles: 'Style',
  backup: 'System'
}

function fmtTime(ts) {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Settings({ ctx }) {
  const { db, refresh, role, can } = ctx
  const { push } = useToast()
  const { confirm, node: confirmNode } = useConfirm()
  const [tab, setTab] = useState('backup')
  const [me, setMe] = useState(null)
  const [audit, setAudit] = useState([])
  const [profiles, setProfiles] = useState([])
  const [entityFilter, setEntityFilter] = useState('All')
  const [busy, setBusy] = useState(false)
  const [pwState, setPwState] = useState({ pw: '', confirm: '' })
  const [pwBusy, setPwBusy] = useState(false)
  const restoreRef = useRef(null)

  useEffect(() => {
    getCurrentUser().then(setMe).catch(() => {})
  }, [])

  useEffect(() => {
    if (tab === 'audit') api.get('/api/audit').then(setAudit).catch(() => setAudit([]))
    if (tab === 'roles' && can('manage')) {
      api.get('/api/profiles').then(setProfiles).catch((e) => push(e.message, 'danger'))
    }
  }, [tab])

  function downloadBackup() {
    setBusy(true)
    api
      .get('/api/backup')
      .then((data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `rk-atelier-backup-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(a.href)
        push('Backup downloaded', 'success')
      })
      .catch((e) => push('Backup failed: ' + e.message, 'danger'))
      .finally(() => setBusy(false))
  }

  function onRestoreFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      let data
      try {
        data = JSON.parse(reader.result)
      } catch {
        push('Not a valid JSON backup file', 'danger')
        return
      }
      confirm({
        title: 'Restore backup',
        message:
          'This will replace ALL current data with the backup file. This cannot be undone. Continue?',
        tone: 'danger',
        confirmLabel: 'Restore'
      }).then((ok) => {
        if (!ok) return
        setBusy(true)
        api
          .post('/api/backup/restore', data)
          .then((res) => {
            const counts = res.counts ? ` (${Object.values(res.counts).reduce((a, b) => a + b, 0)} records)` : ''
            push('Data restored from backup' + counts, 'success')
            refresh()
          })
          .catch((err) => push('Restore failed: ' + err.message, 'danger'))
          .finally(() => setBusy(false))
      })
    }
    reader.readAsText(file)
  }

  async function changeRole(profile, roleId) {
    if (!can('manage')) return
    if (profile.id === me?.id) {
      push('You cannot change your own role', 'danger')
      return
    }
    try {
      await api.put('/api/profiles/' + profile.id, { role: roleId })
      push(`${profile.email || profile.id} is now ${roleLabel(roleId)}`, 'success')
      setProfiles((p) => p.map((x) => (x.id === profile.id ? { ...x, role: roleId } : x)))
    } catch (err) {
      push('Role update failed: ' + err.message, 'danger')
    }
  }

  async function changePassword(e) {
    e.preventDefault()
    if (pwState.pw.length < 6) return push('Password must be at least 6 characters', 'danger')
    if (pwState.pw !== pwState.confirm) return push('Passwords do not match', 'danger')
    setPwBusy(true)
    try {
      await updatePassword(pwState.pw)
      setPwState({ pw: '', confirm: '' })
      push('Password updated successfully', 'success')
    } catch (err) {
      push('Password update failed: ' + err.message, 'danger')
    } finally {
      setPwBusy(false)
    }
  }

  const tabs = [
    { id: 'backup', label: 'Backup & Restore' },
    { id: 'audit', label: 'Audit Log' }
  ]
  if (can('manage')) tabs.push({ id: 'roles', label: 'Roles & Permissions' })
  if (authEnabled) tabs.push({ id: 'account', label: 'My Account' })

  const entityOptions = ['All', 'retailers', 'vendors', 'fabrics', 'readyStock', 'purchaseOrders', 'styles']
  const shownAudit = entityFilter === 'All' ? audit : audit.filter((a) => a.entity === entityFilter)

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
      </div>

      {tab === 'backup' && (
        <div className="grid-2">
          <Card title="Backup">
            <p className="muted" style={{ marginTop: 0 }}>
              Download a complete JSON snapshot of every record (orders, styles, stock, partners). Keep regular
              backups so you can always recover.
            </p>
            <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
              Includes {db.retailers.length} retailers · {db.purchaseOrders.length} orders · {db.styles.length} styles ·{' '}
              {db.readyStock.length} stock items · {db.fabrics.length} fabrics/trims
            </div>
            <Btn onClick={downloadBackup} disabled={busy}>
              {busy ? 'Working…' : '⇩ Download backup (.json)'}
            </Btn>
          </Card>

          <Card title="Restore">
            <p className="muted" style={{ marginTop: 0 }}>
              Replace all current data with a previously downloaded backup. Restoring is irreversible and only
              available to admins.
            </p>
            {can('restore') ? (
              <>
                <Btn tone="danger" onClick={() => restoreRef.current?.click()} disabled={busy}>
                  ⇧ Restore from file
                </Btn>
                <input ref={restoreRef} type="file" accept=".json" hidden onChange={onRestoreFile} />
              </>
            ) : (
              <div className="muted" style={{ fontSize: 12 }}>
                Only admins can restore backups.
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'audit' && (
        <Card
          title="Audit Log"
          action={
            <Select
              className="input-sm"
              style={{ maxWidth: 180 }}
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
            >
              {entityOptions.map((o) => (
                <option key={o} value={o}>
                  {o === 'All' ? 'All entities' : ENTITY_LABEL[o] || o}
                </option>
              ))}
            </Select>
          }
        >
          {shownAudit.length === 0 ? (
            <Empty>No activity recorded yet.</Empty>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Record</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {shownAudit.map((a) => (
                  <tr key={a.id}>
                    <td>{fmtTime(a.createdAt)}</td>
                    <td>
                      <Badge tone={ACTION_TONE[a.action] || 'accent'}>{a.action}</Badge>
                    </td>
                    <td>{ENTITY_LABEL[a.entity] || a.entity}</td>
                    <td className="strong">{a.detail || a.entityId || '-'}</td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {a.user || (a.userId ? String(a.userId).slice(0, 8) : '-')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === 'roles' && can('manage') && (
        <Card title="Roles & Permissions">
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
            Admin — full access including delete, restore, and role changes. Manager — create and edit records, no
            deletions. Viewer — read-only.
          </p>
          {profiles.length === 0 ? (
            <Empty>No user accounts yet.</Empty>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => {
                  const isMe = p.id === me?.id
                  return (
                    <tr key={p.id}>
                      <td className="strong">
                        {p.email || String(p.id).slice(0, 12)}
                        {isMe && <span className="cell-sub muted">(you)</span>}
                      </td>
                      <td style={{ maxWidth: 220 }}>
                        <Select
                          value={p.role}
                          disabled={isMe}
                          onChange={(e) => changeRole(p, e.target.value)}
                        >
                          {ROLES.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.label}
                            </option>
                          ))}
                        </Select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}

{tab === 'account' && authEnabled && (
        <div className="grid-2">
          <Card title="Change Password">
            <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
              Update the password for your SD Retail account. You'll stay signed in on this device.
            </p>
            <form className="form-stack" onSubmit={changePassword}>
              <label className="field">
                <span className="field-label">New password</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={pwState.pw}
                  onChange={(e) => setPwState((s) => ({ ...s, pw: e.target.value }))}
                  placeholder="At least 6 characters"
                />
              </label>
              <label className="field">
                <span className="field-label">Confirm password</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={pwState.confirm}
                  onChange={(e) => setPwState((s) => ({ ...s, confirm: e.target.value }))}
                  placeholder="Repeat your password"
                />
              </label>
              <Btn type="submit" disabled={pwBusy}>
                {pwBusy ? 'Updating…' : 'Update password'}
              </Btn>
            </form>
          </Card>
        </div>
      )}

      {confirmNode}
    </div>
  )
}
