# Google Sheets Sync (export + import)

The app can push rows (Ready Stock, WIP Report) from any view to a Google Sheet you own, **and** pull edits you make to that sheet back into the app. It works through a small **Google Apps Script web app** — no server, no Google Cloud service account, no cost.

Data flows **both ways**: **app → sheet** (export, replaces each tab) and **sheet → app** (import, matched by key). Supabase stays the source of truth for either direction — the sheet is an editable working copy.

## 1. Create the Apps Script

1. Create a Google Sheet at https://sheets.new — name it e.g. **Atelier Exports**.
2. In the sheet, click **Extensions → Apps Script**.
3. Replace the editor content with the script below, then click **Save** (💾) and give the project a name (e.g. `Atelier Exports`).

```js
function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents)
    if (req.token) {
      const expected = PropertiesService.getScriptProperties().getProperty('TOKEN')
      if (expected && req.token !== expected) {
        return respond({ ok: false, error: 'Invalid token' })
      }
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet()

    // READ — used by the app's Sheet Sync import. Returns a tab's rows.
    if (req.action === 'read') {
      const target = req.sheet ? ss.getSheetByName(req.sheet) : ss.getSheets()[0]
      if (!target) return respond({ ok: false, error: 'Sheet not found: ' + req.sheet })
      const lastRow = target.getLastRow()
      if (lastRow < 1) return respond({ ok: true, sheet: req.sheet, cols: [], rows: [], spreadsheet: ss.getUrl() })
      const lastCol = Math.max(1, target.getLastColumn())
      const values = target.getRange(1, 1, lastRow, lastCol).getValues()
      return respond({
        ok: true,
        sheet: req.sheet,
        cols: values[0] || [],
        rows: values.slice(1).map((row) => row.map((v) => (v instanceof Date ? toDateStr(v) : v))),
        spreadsheet: ss.getUrl()
      })
    }

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
      if (width) target.getRange(1, 1, values.length, width).setValues(values)
      written += s.rows.length
    }
    return respond({ ok: true, count: written, sheets: list.length, spreadsheet: ss.getUrl() })
  } catch (err) {
    return respond({ ok: false, error: String(err) })
  }
}

function doGet() {
  return respond({ ok: true, error: 'Use POST' })
}

function toDateStr(d) {
  const p = (n) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}
```

4. Click **Deploy → New deployment**.
5. For **Type** pick **Web app**:
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
6. Click **Deploy**, then **Authorize access** with your Google account (allow the first time only).
7. Copy the **Web app URL** — it ends in `/exec` and looks like `https://script.google.com/macros/s/AKfycb…/exec`.

## 2. Configure the app

Add the URL to the app's environment variables (name must keep the `VITE_` prefix):

```
VITE_GOOGLE_SHEET_WEB_APP_URL=https://script.google.com/macros/s/AKfycb…/exec
VITE_GOOGLE_SHEET_TOKEN=   # optional; if set, it must match the script's TOKEN property
```

- **Local dev**: put them in `.env` and restart the dev server / rebuild.
- **Vercel**: add them in **Project → Settings → Environment Variables** and redeploy.

If you use the optional token: open the Apps Script editor → **Project Settings → Script properties** → **Add** a `TOKEN` property with the same random value, and redeploy the web app after changing script properties.

## 3. Use it

- **Sidebar → "⇪ Export all data to Sheets"** (visible on every page) pushes the **entire database** — Retailers, Vendors, Fabrics, Ready Stock, Purchase Orders, Styles — each into its own tab of your sheet. Tabs are created on first export.
- **Stock Report** toolbar: **→ Sheet** replaces the **Ready Stock** tab with the filtered ready-stock rows (including Sr No, Style Code, Color, Size, Sold, Sell-thru % and Days of Stock).
- **Reports → WIP** card: **→ Sheet** replaces the **WIP Report** tab with the WIP rows.

A toast confirms how many rows were written. Because the script returns the sheet's URL, the toast now includes an **Open Sheet ↗** button that jumps straight to your Google Sheet.

## 4. Import (sheet → app)

**After editing a sheet tab, you can bring the changes into the app** so Google Sheets becomes an editable working copy:

1. Open the app → **Settings → Sheet Sync**.
2. Click **⇣ Read Google Sheet** — every tab is read back and previewed (rows read, plus how many would be **new** vs **updated**).
3. Review the preview, then click **⇩ Apply changes to app** to write the changes.

How it works:
- Rows are matched to existing records by natural key — Retailers/Vendors/Fabrics by **name**, Purchase Orders by **PO number**, Styles & Ready Stock by **Style Code + Color + Size**. Matches update; unmatch rows are created.
- **Calculated columns are ignored on import** (e.g. WIP, Days, Status, Opening/Issued/Closing/Value, Sr) — the app recomputes those. Only editable source fields are imported.
- **Blank cells are left alone** — an empty cell never overwrites an existing value.
- **Nothing is deleted.** Rows removed from the sheet are skipped (not removed from the app), so you can't lose data by deleting a row by accident.
- Import also needs the updated Apps Script above (the `read` action). If a tab fails to load, redeploy the script and try again.

> Already deployed the script? The **Read** action only exists in the version above. Update your Apps Script editor with the new `doPost` (which branches on `req.action === 'read'`), then **Deploy → Manage deployments → ✎ Edit → New version** and deploy to apply it. The web app URL stays the same.

> **Already deployed the script?** The **Open Sheet** button only appears when the Apps Script returns `spreadsheet: ss.getUrl()`. Update the script to the version above (which includes that line), then **Deploy → Manage deployments → ✎ Edit → New version** to redeploy. The version above also **clears each tab before writing**, so every export is a fresh snapshot — old headers/rows never accumulate. If your sheet already shows stale rows from older exports, redeploying and re-exporting once will replace them.

## Notes

- The web app URL is public; the optional `TOKEN` is a lightweight gate, not real security. Anyone with the URL could write rows, so keep the sheet private to your team.
- Exports **replace** the tab (clear + rewrite) — run them on a schedule by hand, or later add a Vercel cron job that calls the same endpoint.
