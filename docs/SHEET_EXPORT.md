# One-Way Export to Google Sheets

The app can push rows (Ready Stock, WIP Report) from any view to a Google Sheet you own. It works through a small **Google Apps Script web app** — no server, no Google Cloud service account, no cost.

Data flows one way: **app → sheet**. The sheet is the destination only; Supabase stays the source of truth.

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
  return respond({ ok: true, error: 'Use POST' })
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
- **Stock Report** toolbar: **→ Sheet** appends the filtered ready-stock rows to the **Ready Stock** tab.
- **Reports → WIP** card: **→ Sheet** appends the WIP rows to the **WIP Report** tab.

A toast confirms how many rows were written. Because the script returns the sheet's URL, the toast now includes an **Open Sheet ↗** button that jumps straight to your Google Sheet. If the button shows a warning toast instead, the `VITE_GOOGLE_SHEET_WEB_APP_URL` env var isn't set yet.

> **Already deployed the script?** The **Open Sheet** button only appears when the Apps Script returns `spreadsheet: ss.getUrl()`. Update the script to the version above (which includes that line), then **Deploy → Manage deployments → ✎ Edit → New version** to redeploy.

## Notes

- The web app URL is public; the optional `TOKEN` is a lightweight gate, not real security. Anyone with the URL could append rows, so keep the sheet private to your team.
- Exports **append** — run them on a schedule by hand, or later add a Vercel cron job that calls the same endpoint.
