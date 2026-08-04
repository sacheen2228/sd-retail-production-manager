// ---------------------------------------------------------------------------
// Print / "Save as PDF" helper. Opens a clean, print-friendly page and calls
// the browser's print dialog (the user chooses "Save as PDF" as the printer).
// No heavy PDF library required.
// ---------------------------------------------------------------------------

/**
 * @param {object} opts
 *   title      - document heading, e.g. "Purchase Order Report"
 *   subtitle   - meta line (date range / generated stamp)
 *   columns    - string[] table headers
 *   rows       - array[] of row cells (values are rendered as text)
 *   totals     - optional string[] row appended as a footer row
 */
export function printDoc({ title, subtitle = '', columns = [], rows = [], totals = null }) {
  const esc = (v) =>
    String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

  const head = `<tr>${columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>`
  const body = rows
    .map(
      (r) =>
        `<tr>${(r.length ? r : Array(columns.length).fill(''))
          .map((c) => `<td>${esc(c)}</td>`)
          .join('')}</tr>`
    )
    .join('')
  const totalsRow = totals
    ? `<tr class="totals">${(totals.length ? totals : []).map((c) => `<th>${esc(c)}</th>`).join('')}</tr>`
    : ''

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#232; margin:28px; }
  h1 { font-size:20px; margin:0 0 4px; }
  .meta { color:#667; font-size:12.5px; margin-bottom:18px; }
  table { width:100%; border-collapse:collapse; font-size:12.5px; }
  th, td { border:1px solid #ccc; padding:6px 8px; text-align:left; vertical-align:top; }
  thead th { background:#f3f1ec; font-weight:700; }
  .num { text-align:right; }
  .totals th { background:#f3f1ec; font-weight:800; border-top:2px solid #999; }
  @media print { body { margin:12mm; } }
</style></head><body>
  <h1>${esc(title)}</h1>
  <div class="meta">${esc(subtitle)}</div>
  <table><thead>${head}</thead><tbody>${body}${totalsRow}</tbody></table>
  <script>window.onload = () => { window.focus(); setTimeout(() => window.print(), 300); }<\/script>
</body></html>`

  const w = window.open('', '_blank', 'width=1000,height=760')
  if (!w) {
    alert('Please allow pop-ups to print the report.')
    return
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
}

/** Build a CSV blob and trigger a download. */
export function downloadCSV(filename, columns, rows) {
  const esc = (v) => `"${String(v === null || v === undefined ? '' : v).replace(/"/g, '""')}"`
  const lines = [columns.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))]
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}