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
