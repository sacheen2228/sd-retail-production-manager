import { describe, it, expect } from 'vitest'
import { computeOverview, computeAlerts, computeWip, computeFabricStock } from '../src/services/reports.js'

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
})
