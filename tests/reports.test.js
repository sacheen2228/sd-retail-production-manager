import { describe, it, expect } from 'vitest'
import { computeOverview, computeAlerts, computeWip, computeFabricStock, computeMerchandising } from '../src/services/reports.js'

const base = {
  retailers: [{ id: 'r1', name: 'AZA Fashion' }],
  purchaseOrders: [{ id: 'p1', poNumber: 'PO-1', retailerId: 'r1', deliveryDate: '2026-12-01', status: 'In Production', value: 100000 }],
  styles: [{ id: 's1', poId: 'p1', styleCode: 'BR-1', styleName: 'Lehenga', stage: 'Stitching', stageEnteredAt: '2026-07-25', quantity: 10, fabric: 'Silk', trim: 'Zari' }],
  fabrics: [{ id: 'f1', name: 'Silk', stock: 100, uom: 'mtr', costPrice: 100, consumption: 5, lowStockLevel: 30 }],
  readyStock: []
}

describe('reports', () => {
  it('computes overview KPIs', () => {
    const o = computeOverview(base)
    expect(o.activeOrders).toBe(1)
    expect(o.stylesInProduction).toBe(1)
    expect(o.pipelineValue).toBe(100000)
  })

  it('flags overdue deliveries as critical', () => {
    const db = {
      ...base,
      purchaseOrders: [{ id: 'p1', poNumber: 'PO-1', retailerId: 'r1', deliveryDate: '2020-01-01', status: 'In Production', value: 100 }],
      styles: [{ id: 's1', poId: 'p1', styleCode: 'BR-1', styleName: 'L', stage: 'Stitching', stageEnteredAt: '2026-07-25', quantity: 1 }]
    }
    const alerts = computeAlerts(db)
    expect(alerts.some((a) => a.type === 'overdue' && a.severity === 'critical')).toBe(true)
  })

  it('computes wip rows with retailer names', () => {
    const wip = computeWip(base)
    expect(wip[0].retailer).toBe('AZA Fashion')
    expect(wip[0].poNumber).toBe('PO-1')
  })

  it('computes fabric allocation and availability', () => {
    const db = {
      ...base,
      styles: [{ id: 's1', poId: 'p1', styleCode: 'BR-1', stage: 'Stitching', quantity: 10, fabric: 'Silk', trim: 'Zari' }]
    }
    const { rows } = computeFabricStock(db)
    const silk = rows.find((r) => r.name === 'Silk')
    expect(silk.allocated).toBe(50)
    expect(silk.available).toBe(50)
  })

  it('computes merchandising sell-through, GMROI and turn', () => {
    const db = {
      retailers: [{ id: 'r1', name: 'AZA Fashion' }],
      purchaseOrders: [{ id: 'p1', poNumber: 'PO-1', retailerId: 'r1', deliveryDate: '2026-12-01', status: 'Dispatched', value: 200000 }],
      styles: [
        { id: 's1', poId: 'p1', styleCode: 'BR-1', styleName: 'Lehenga', stage: 'Dispatched', quantity: 10, qtyDispatched: 6, price: 20000, costPrice: 12000, history: [{ at: '2026-07-01', from: null, to: 'Sampling' }, { at: '2026-07-20', from: 'Stitching', to: 'Dispatched' }] }
      ],
      fabrics: [],
      vendors: [],
      readyStock: [{ id: 'rs1', name: 'Lehenga', styleCode: 'BR-1', quantity: 4, costPrice: 12000, createdAt: '2026-07-10' }]
    }
    const m = computeMerchandising(db)
    // 6 sold, 4 on hand => 60% sell-through
    expect(m.summary.sellThroughPct).toBeCloseTo(60)
    expect(m.summary.totalSold).toBe(6)
    expect(m.summary.totalOnHand).toBe(4)
    // gross profit = 6 * (20000 - 12000) = 48000; inventory = 4 * 12000 = 48000 => GMROI 1x
    expect(m.summary.grossProfit).toBe(48000)
    expect(m.summary.inventoryValue).toBe(48000)
    expect(m.summary.gmroi).toBeCloseTo(1)
    // avg production time 19 days
    expect(m.summary.avgProductionDays).toBe(19)
    expect(m.bestSellers[0].styleCode).toBe('BR-1')
    expect(m.stockAging[0].pieces).toBe(4)
  })

  it('flags unsold on-hand stock as slow sellers', () => {
    const db = {
      retailers: [],
      purchaseOrders: [],
      styles: [],
      fabrics: [],
      vendors: [],
      readyStock: [{ id: 'rs1', name: 'Old Saree', styleCode: 'SR-9', quantity: 8, costPrice: 5000, createdAt: '2026-06-01' }]
    }
    const m = computeMerchandising(db)
    expect(m.slowSellers.length).toBe(1)
    expect(m.slowSellers[0].styleCode).toBe('SR-9')
    expect(m.summary.sellThroughPct).toBe(0)
  })
})
