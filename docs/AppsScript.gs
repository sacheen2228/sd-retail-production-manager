const SCRIPT_NAME = 'Atelier Exports'

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties()
  let id = props.getProperty('SPREADSHEET_ID')
  if (!id) {
    const ss = SpreadsheetApp.create(SCRIPT_NAME)
    id = ss.getId()
    props.setProperty('SPREADSHEET_ID', id)
  }
  return SpreadsheetApp.openById(id)
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents)
    if (req.token) {
      const expected = PropertiesService.getScriptProperties().getProperty('TOKEN')
      if (expected && req.token !== expected) {
        return respond({ ok: false, error: 'Invalid token' })
      }
    }
    const ss = getSpreadsheet_()
    const list = req.sheets
      ? req.sheets
      : req.rows
        ? [{ name: req.sheet, cols: req.cols, rows: req.rows }]
        : []
    let written = 0
    for (const s of list) {
      if (!s.rows || !s.rows.length) continue
      let target = s.name ? ss.getSheetByName(s.name) : null
      if (!target) {
        target = s.name ? ss.insertSheet(s.name) : ss.getActiveSheet()
      }
      // Replace (not append): each export overwrites the tab so stale rows
      // and old column layouts never linger below the latest snapshot.
      const header = Array.isArray(s.cols) ? s.cols : []
      const width = Math.max(header.length, s.rows[0].length)
      const values = [header.concat(Array(Math.max(0, width - header.length)).fill(''))]
      for (const r of s.rows) {
        const row = Array.isArray(r) ? r : [r]
        values.push(row.concat(Array(Math.max(0, width - row.length)).fill('')))
      }
      target.clearContents()
      if (width) {
        const range = target.getRange(1, 1, values.length, width)
        range.setValues(values)
        // Any cell whose value starts with "=" is a live formula → apply via setFormula
        for (let r = 0; r < values.length; r++) {
          for (let c = 0; c < values[r].length; c++) {
            const cell = values[r][c]
            if (typeof cell === 'string' && cell.startsWith('=')) {
              range.getCell(r + 1, c + 1).setFormula(cell)
            }
          }
        }
      }
      written += s.rows.length
    }
    return respond({ ok: true, count: written, sheets: list.length, spreadsheet: ss.getUrl() })
  } catch (err) {
    return respond({ ok: false, error: String(err) })
  }
}

function doGet() {
  try {
    const ss = getSpreadsheet_()
    return respond({ ok: true, error: 'Use POST', spreadsheet: ss.getUrl() })
  } catch (err) {
    return respond({ ok: false, error: String(err) })
  }
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}
