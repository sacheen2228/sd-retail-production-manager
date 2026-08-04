import { describe, it, expect } from 'vitest'
import { diffSheetData, totalChanges, TAB_ORDER } from '../src/services/sheetImport.js'

const db = () => ({
  retailers: [{ id: 'r1', name: 'AZA', city: 'Mumbai', contact: '' }],
  vendors: [{ id: 'v1', name: 'Emb-Hub', type: 'embroidery', location: '', contact: '' }],
  fabrics: [{ id: 'f1', name: 'Silk', type: 'fabric', stock: 10 }],
  purchaseOrders: [{ id: 'po1', poNumber: 'PO-100', retailerId: 'r1', status: 'Pending' }],
  styles: [{ id: 's1', poId: 'po1', styleCode: 'BR-1', color: 'Red', size: 'M', quantity: 5, stage: 'Sampling' }],
  readyStock: [{ id: 'rs1', styleCode: 'SU-1', color: 'Red', size: 'M', name: 'Suit', receivedStock: 2, costPrice: 100 }]
})

function tabs() {
  return {
    Retailers: { name: 'Retailers', rows: [['NewRetailer', 'Delhi', 'x']] },
    Vendors: { name: 'Vendors', rows: [['Emb-Hub', 'embroidery', '', '']] },
    Fabrics: { name: 'Fabrics', rows: [['Silk', 'fabric', 12, '', '', '', '', '', '']] },
    'Purchase Orders': { name: 'Purchase Orders', rows: [['PO-100', 'AZA', '', '', 'Confirmed', 5000, '']] },
    Styles: { name: 'Styles', rows: [['BR-1', 'Blouse', '', '', 'Red', 'M', 'PO-100', 5, '', 0, 'Cutting', '', '']] },
    'Ready Stock': { name: 'Ready Stock', rows: [[1, 'SU-1', 'Suit', '', 'Red', 'M', '', '', 5, '', '', 3, 120, '', '']] }
  }
}

describe('sheet import diff', () => {
  it('produces a plan for every tab', () => {
    const plans = diffSheetData(db(), Object.values(tabs()))
    expect(Object.keys(plans).sort()).toEqual(TAB_ORDER.slice().sort())
  })

  it('marks matched rows as updates and new rows as adds', () => {
    const plans = diffSheetData(db(), Object.values(tabs()))
    expect(plans.Retailers.added).toBe(1) // NewRetailer
    expect(plans.Retailers.updated).toBe(0)
    expect(plans.Vendors.updated).toBe(1) // Emb-Hub matched
    expect(plans.Fabrics.updated).toBe(1) // Silk matched
    expect(plans.Styles.updated).toBe(1) // BR-1 Red M matched
    expect(plans['Ready Stock'].updated).toBe(1) // SU-1 Red M matched
    expect(plans['Purchase Orders'].updated).toBe(1) // PO-100 matched
  })

  it('skips blank/derived rows and empty keys', () => {
    const rows = [{ name: 'Retailers', rows: [['', '', ''], ['Valid', 'Goa', '']] }]
    const plans = diffSheetData(db(), rows)
    expect(plans.Retailers.skipped).toBe(1)
    expect(plans.Retailers.added).toBe(1)
  })

  it('resolves retailer name and PO number to foreign keys', () => {
    const plans = diffSheetData(db(), Object.values(tabs()))
    const po = plans['Purchase Orders'].records[0]
    expect(po.retailerId).toBe('r1')
    const style = plans.Styles.records[0]
    expect(style.poId).toBe('po1')
    expect(style.value).toBeUndefined() // not an editable Styles column
  })

  it('does not import derived columns', () => {
    const plans = diffSheetData(db(), Object.values(tabs()))
    const rs = plans['Ready Stock'].records[0]
    expect(rs.receivedStock).toBe(5)
    expect(rs.quantity).toBeUndefined() // Closing is derived
    expect(rs.costPrice).toBe(120)
  })

  it('counts totals across tabs', () => {
    const plans = diffSheetData(db(), Object.values(tabs()))
    expect(totalChanges(plans)).toEqual({ added: 1, updated: 5 })
  })
})