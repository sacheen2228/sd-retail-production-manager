import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createFake } from './fakeSupabase.js'

let fake

vi.mock('../src/services/supabaseClient.js', () => ({
  supabaseClient: {
    USE_SUPABASE: true,
    get supabase() {
      return fake
    }
  }
}))

async function loadApi() {
  return (await import('../src/api.js')).api
}

beforeEach(() => {
  fake = createFake()
})

describe('data layer routing & mapping', () => {
  it('loads a full db object in app shape', async () => {
    fake
      ._seed('retailers', [{ name: 'AZA Fashion', city: 'Mumbai', contact: 'x' }])
      ._seed('ready_stock', [{ name: 'Ivory Lehenga', quantity: 3, cost_price: 1000, selling_price: 2500, low_stock_level: 2 }])
    const api = await loadApi()
    const db = await api.get('/api/data')
    expect(db.retailers[0].name).toBe('AZA Fashion')
    expect(db.readyStock[0].quantity).toBe(3)
    expect(db.readyStock[0].costPrice).toBe(1000)
    expect(typeof db.readyStock[0].id).toBe('string')
  })

  it('creates a style with initial history and default stage', async () => {
    fake._seed('purchase_orders', [{ po_number: 'PO-1', retailer_id: null }])
    const api = await loadApi()
    const db = await api.get('/api/data')
    const po = db.purchaseOrders[0]
    const created = await api.post('/api/styles', { poId: po.id, styleCode: 'BR-1', quantity: 5 })
    expect(created.id).toBeTruthy()
    expect(created.stage).toBe('Sampling')
    expect(created.history).toHaveLength(1)
    expect(created.history[0].note).toBe('Order created')
    expect(created.poId).toBe(po.id)
  })

  it('appends history when a style stage changes via update', async () => {
    fake._seed('styles', [{ po_id: null, style_code: 'BR-2', stage: 'Sampling', stage_entered_at: '2026-07-01', history: [] }])
    const api = await loadApi()
    const db = await api.get('/api/data')
    const s = db.styles[0]
    const updated = await api.put('/api/styles/' + s.id, { stage: 'Cutting' })
    expect(updated.stage).toBe('Cutting')
    expect(updated.history).toHaveLength(1)
    expect(updated.history[0].from).toBe('Sampling')
    expect(updated.history[0].to).toBe('Cutting')
    expect(updated.history[0].note).toBe('')
  })

  it('keeps history when stage is unchanged', async () => {
    fake._seed('styles', [{ po_id: null, style_code: 'BR-3', stage: 'QC', stage_entered_at: '2026-07-01', history: [{ at: '2026-07-01', from: null, to: 'QC', note: 'x' }] }])
    const api = await loadApi()
    const db = await api.get('/api/data')
    const s = db.styles[0]
    const updated = await api.put('/api/styles/' + s.id, { notes: 'ok' })
    expect(updated.history).toHaveLength(1)
  })

  it('maps ready stock style/color/size fields both ways', async () => {
    const api = await loadApi()
    const created = await api.post('/api/readyStock', {
      name: 'Test Suit',
      styleCode: 'SU-999',
      color: 'Teal',
      size: 'M',
      quantity: 3
    })
    expect(created.styleCode).toBe('SU-999')
    expect(created.color).toBe('Teal')
    expect(created.size).toBe('M')
    const db = await api.get('/api/data')
    const item = db.readyStock.find((i) => i.id === created.id)
    expect(item.styleCode).toBe('SU-999')
    expect(item.size).toBe('M')
  })

  it('coerces numeric strings and empties foreign keys', async () => {
    const api = await loadApi()
    const po = await api.post('/api/purchaseOrders', {
      poNumber: 'PO-9',
      retailerId: '',
      value: '5000',
      orderDate: '',
      deliveryDate: '2026-12-01'
    })
    expect(po.retailerId).toBeNull()
    expect(po.value).toBe(5000)
    expect(po.orderDate).toBeNull()
  })

  it('supports delete', async () => {
    fake._seed('vendors', [{ name: 'V1' }])
    const api = await loadApi()
    const db = await api.get('/api/data')
    const v = db.vendors[0]
    await api.del('/api/vendors/' + v.id)
    const db2 = await api.get('/api/data')
    expect(db2.vendors).toHaveLength(0)
  })

  it('rejects unknown routes', async () => {
    const api = await loadApi()
    await expect(api.get('/api/nonsense')).rejects.toThrow()
  })
})

describe('profiles & roles', () => {
  it('lists and updates a user profile role', async () => {
    fake._seed('profiles', [{ id: 'u-1', email: 'a@b.com', role: 'admin' }])
    const api = await loadApi()
    const profiles = await api.get('/api/profiles')
    expect(profiles).toHaveLength(1)
    expect(profiles[0].role).toBe('admin')
    const updated = await api.put('/api/profiles/u-1', { role: 'manager' })
    expect(updated.role).toBe('manager')
  })
})

describe('backup & restore', () => {
  it('exports a full backup in app shape', async () => {
    fake._seed('retailers', [{ name: 'AZA', city: 'Mumbai', contact: '' }])
    fake._seed('styles', [{ po_id: null, style_code: 'BR-1', stage: 'Sampling', history: [] }])
    const api = await loadApi()
    const backup = await api.get('/api/backup')
    expect(backup.retailers[0].name).toBe('AZA')
    expect(backup.styles[0].styleCode).toBe('BR-1')
  })

  it('restores a backup by replacing all collections', async () => {
    fake._seed('retailers', [{ name: 'Old', city: 'Delhi', contact: '' }])
    const api = await loadApi()
    const res = await api.post('/api/backup/restore', {
      retailers: [{ name: 'New', city: 'Mumbai', contact: '' }],
      vendors: [],
      fabrics: [],
      readyStock: [],
      purchaseOrders: [],
      styles: []
    })
    expect(res.ok).toBe(true)
    expect(res.counts.retailers).toBe(1)
    const db = await api.get('/api/data')
    expect(db.retailers[0].name).toBe('New')
  })

  it('rejects a malformed backup', async () => {
    const api = await loadApi()
    await expect(api.post('/api/backup/restore', { retailers: [] })).rejects.toThrow()
  })
})

describe('audit log', () => {
  it('lists audit entries newest first', async () => {
    fake._seed('audit_log', [
      { action: 'update', entity: 'styles', entity_id: 's-1', created_at: '2026-07-01T10:00:00Z' },
      { action: 'insert', entity: 'purchase_orders', entity_id: 'po-1', created_at: '2026-07-02T10:00:00Z' }
    ])
    const api = await loadApi()
    const entries = await api.get('/api/audit')
    expect(entries).toHaveLength(2)
    expect(entries[0].action).toBe('update')
    expect(entries[0].entity).toBe('styles')
  })
})
