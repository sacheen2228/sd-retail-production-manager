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
      if (target.getLastRow() === 0) target.appendRow(s.cols || [])
      target.getRange(target.getLastRow() + 1, 1, s.rows.length, s.rows[0].length).setValues(s.rows)
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
