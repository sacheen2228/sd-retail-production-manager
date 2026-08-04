import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { Card, Kpi, Badge, Empty, fmtMoney } from '../components/ui.jsx'

function pct(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return n.toFixed(1) + '%'
}

function num(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return n.toFixed(digits)
}

function statusBadge(status) {
  if (status === 'reorder') return <Badge tone="danger">Reorder</Badge>
  if (status === 'short') return <Badge tone="warn">Short</Badge>
  return <Badge tone="success">OK</Badge>
}

export default function Merchandising({ ctx }) {
  const { db } = ctx
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get('/api/reports/merchandising').then(setData).catch(() => setData(null))
  }, [db])

  const summary = data?.summary
  const rows = data?.sellThroughRows || []
  const best = data?.bestSellers || []
  const slow = data?.slowSellers || []
  const fabric = data?.fabricConsumption || []
  const vendors = data?.vendorPerformance || []
  const aging = data?.stockAging || []

  const bestCodes = useMemo(() => new Set(best.map((b) => b.styleCode)), [best])
  const slowCodes = useMemo(() => new Set(slow.map((s) => s.styleCode)), [slow])

  return (
    <div>
      <div className="kpi-row">
        <Kpi label="Sell Through" value={summary ? pct(summary.sellThroughPct) : '…'} sub={`${summary ? summary.totalSold : '–'} sold / ${summary ? summary.totalOnHand : '–'} on hand`} tone={summary && summary.sellThroughPct > 50 ? 'ok' : 'gold'} />
        <Kpi label="GMROI" value={summary ? num(summary.gmroi) + '×' : '…'} sub="gross margin return on inventory" tone="maroon" />
        <Kpi label="Inventory Turn" value={summary ? num(summary.inventoryTurn) + '×' : '…'} sub="COGS ÷ inventory value" tone="ink" />
        <Kpi label="Avg Production Time" value={summary ? (summary.avgProductionDays !== null ? summary.avgProductionDays + 'd' : '—') : '…'} sub="first stage → dispatched" tone="gold" />
      </div>

      {!data && <Empty>Loading merchandising analytics…</Empty>}
      {data && (
        <div className="grid-2">
          <Card title={`Best Sellers (${summary.bestSellerCount} styles with sales)`}>
            {best.length === 0 ? (
              <Empty>No styles have dispatched sales yet.</Empty>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Style</th>
                    <th>Name</th>
                    <th>Sold</th>
                    <th>On Hand</th>
                    <th>Sell Through</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {best.map((r) => (
                    <tr key={r.styleCode}>
                      <td className="strong">{r.styleCode}</td>
                      <td>{r.name || '-'}</td>
                      <td className="strong">{r.sold}</td>
                      <td>{r.onHand}</td>
                      <td>{pct(r.sellThrough)}</td>
                      <td>{fmtMoney(r.sellValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Slow Sellers (stock on hand, no sales)">
            {slow.length === 0 ? (
              <Empty>No slow-moving stock.</Empty>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Style</th>
                    <th>Name</th>
                    <th>On Hand</th>
                    <th>Color / Size</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {slow.map((r) => (
                    <tr key={r.styleCode}>
                      <td className="strong">{r.styleCode}</td>
                      <td>{r.name || '-'}</td>
                      <td className="strong">{r.onHand}</td>
                      <td>{[r.color, r.size].filter(Boolean).join(' / ') || '-'}</td>
                      <td>{fmtMoney(r.costValue || r.sellValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Sell-Through by Style">
            {rows.length === 0 ? (
              <Empty>No style codes yet. Add ready stock or styles to see sell-through.</Empty>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Style</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Sold</th>
                    <th>On Hand</th>
                    <th>Total</th>
                    <th>Sell Through</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.styleCode}>
                      <td className="strong">{r.styleCode}</td>
                      <td>{r.name || '-'}</td>
                      <td>{r.category || '-'}</td>
                      <td>{r.sold}</td>
                      <td>{r.onHand}</td>
                      <td>{r.total}</td>
                      <td>{pct(r.sellThrough)}</td>
                      <td>
                        {bestCodes.has(r.styleCode) && <Badge tone="success">Best</Badge>}
                        {slowCodes.has(r.styleCode) && <Badge tone="danger">Slow</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <div>
            <Card title="Fabric Consumption (allocated vs stock)">
              {fabric.length === 0 ? (
                <Empty>No fabrics in stock.</Empty>
              ) : (
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Type</th>
                      <th>Stock</th>
                      <th>Allocated</th>
                      <th>Available</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fabric.map((f) => (
                      <tr key={f.name}>
                        <td className="strong">{f.name}</td>
                        <td>{f.type}</td>
                        <td>{f.stock} {f.uom}</td>
                        <td>{f.allocated} {f.uom}</td>
                        <td className={f.available < 0 ? 'neg' : ''}>{f.available} {f.uom}</td>
                        <td>{statusBadge(f.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card title="Vendor Performance">
              {vendors.length === 0 ? (
                <Empty>No vendors linked to fabrics/trims.</Empty>
              ) : (
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Vendor</th>
                      <th>Items</th>
                      <th>Stock Value</th>
                      <th>Avg Lead</th>
                      <th>Low / Reorder</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendors.map((v) => (
                      <tr key={v.name}>
                        <td className="strong">{v.name}</td>
                        <td>{v.items}</td>
                        <td>{fmtMoney(v.stockValue)}</td>
                        <td>{v.avgLead}d</td>
                        <td>{v.lowItems} / {v.reorderItems}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card title="Stock Aging (ready stock)">
              {aging.every((a) => a.items === 0) ? (
                <Empty>No aging data. Add ready stock items to see aging.</Empty>
              ) : (
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Age</th>
                      <th>Items</th>
                      <th>Pieces</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aging.map((a) => (
                      <tr key={a.bucket} className={a.bucket === '90+ days' ? 'row-done' : ''}>
                        <td className="strong">{a.bucket}</td>
                        <td>{a.items}</td>
                        <td>{a.pieces}</td>
                        <td>{fmtMoney(a.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>

          <Card title="Top Orders by Value">
            {(data.topOrders || []).length === 0 ? (
              <Empty>No purchase orders yet.</Empty>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>PO</th>
                    <th>Retailer</th>
                    <th>Value</th>
                    <th>Delivery</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.topOrders || []).map((o) => (
                    <tr key={o.poNumber}>
                      <td className="strong">{o.poNumber}</td>
                      <td>{o.retailer}</td>
                      <td>{fmtMoney(o.value)}</td>
                      <td>{o.deliveryDate || '-'}</td>
                      <td><Badge tone={o.status === 'Dispatched' ? 'success' : 'accent'}>{o.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
