// ---------------------------------------------------------------------------
// Client-side export helpers shared by the dashboard drill-down panels.
// CSV (always), Excel .xlsx (via the bundled xlsx lib) and Print / PDF.
// ---------------------------------------------------------------------------

function esc(v) {
  return String(v ?? '').replace(/"/g, '""')
}

export function downloadCSV(filename, cols, rows) {
  const lines = [
    cols.map(esc).join(','),
    ...rows.map((r) => r.map(esc).join(','))
  ]
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export async function exportXlsx(filename, cols, rows) {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet([cols, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Export')
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export function printReport(title, cols, rows) {
  const escHtml = (v) =>
    String(v ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))
  const head = cols.map((c) => `<th>${escHtml(c)}</th>`).join('')
  const body = rows
    .map(
      (r) =>
        `<tr>${r.map((v) => `<td>${escHtml(v)}</td>`).join('')}</tr>`
    )
    .join('')
  const w = window.open('', '_blank', 'width=980,height=720')
  if (!w) return
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #2b2118; margin: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { color: #8a7f73; font-size: 12px; margin-bottom: 16px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th { background: #7a1f2b; color: #fff; text-align: left; padding: 7px 9px; }
  td { border-bottom: 1px solid #e8e2da; padding: 6px 9px; }
  tr:nth-child(even) td { background: #f7f5f1; }
  @media print { body { margin: 8mm; } }
</style></head><body>
<h1>${escHtml(title)}</h1>
<div class="meta">Generated ${new Date().toLocaleString('en-GB')} · ${rows.length} rows</div>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
<script>window.onload = () => window.print()</script>
</body></html>`)
  w.document.close()
}
