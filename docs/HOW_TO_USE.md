# How to Use — SD Retail Production & Merchandising Manager

A step-by-step guide to running the app in daily production. The app has **9 tabs** in the left sidebar. Use the suggested order below — each tab feeds the next.

---

## Getting started (first 10 minutes)

1. **Log in** with your account (Admin, Manager, or Viewer).
   - *Admin* — everything: create, edit, delete, restore backups, manage roles.
   - *Manager* — create & edit records, **no deletions**.
   - *Viewer* — read-only.
2. **Review your roles** — go to **Settings → Roles & Permissions** (Admin only) and make sure each team member has the right role.
3. **Keyboard shortcuts** (saves time daily):
   - `/` — global search
   - `N` — go to Purchase Orders
   - `T` — go to Production Tracker
   - `D` — go to Deliveries
   - `C` — go to Calendar
   - `S` — go to Stock Report
   - `R` — go to Reports
   - `P` — go to Partners & Stock
   - `Esc` — close dialogs / menus

---

## 1. Dashboard — the daily snapshot

**Purpose:** see at a glance what needs your attention today.

1. Open the app → you land on the **Dashboard**.
2. Read the four KPIs at the top:
   - **Active Orders** — orders not yet dispatched.
   - **Styles in Production** — job cards moving through stages.
   - **At-Risk Deliveries** — deliveries due within 7 days (red if any).
   - **Pipeline Value** — total value of open orders.
3. Check the **Alerts & Reminders** feed: overdue deliveries, stuck stages, pending sampling approvals, low fabric/trim stock.
4. Scan **Upcoming Deliveries** and the **Production Pipeline** to plan the day.
5. Click **"View all →"** on any card to open a full drill-down panel with filters, timelines and quick actions.

---

## 2. Purchase Orders — book the order

**Purpose:** record an order from a retailer, with every style line.

### Create a new PO

1. Go to **Purchase Orders** → click **"+ New Purchase Order"**.
2. Fill the order header:
   - **PO Number** (e.g. `PO-2410`)
   - **Order Date** and **Delivery Date**
   - **Status** — usually *Confirmed* when booking.
   - Optional **Product Image**.
3. Choose a **Retailer / Brand Partner** from the list, or click **"+ Register new retailer"** to create one on the spot (name, city, contact).
4. Under **Styles / Order Lines**, add one line per style:
   - **Style Code** (e.g. `BR-2430`) — required.
   - **Style Name**, **Category** and **Sub-category** (dropdowns).
   - **Color**, **Size** (e.g. S/M/L/XL/Free).
   - **Order Qty** and **Unit Price (₹)** — the order total auto-computes.
   - **Unit Cost (₹)** — optional, but needed for the Profit report.
   - **Starting Stage** — usually *Sampling*.
   - **Fabric**, **Trims**, **Notes**.
5. Add more lines with **"+ Add Style"**.
6. Click **Save Order**. Every style line now becomes a **job card** in the Production Tracker.

### View / edit an order

- Click a **PO row** to expand and see its styles.
- Click **Edit** to change the order or its lines (add/remove styles).
- **Delete PO** (Admin only) removes the order and its style lines.

> **Tip:** The expanded view shows each style's color, size, qty, price and current stage — a handy one-page order summary.

---

## 3. Production Tracker — move work through the pipeline

**Purpose:** track each style/job card through the 11 production stages:

```
Sampling → Fabric → Trims → Embroidery-Kolkata → Embroidery-Mumbai
→ Cutting → Stitching → Finishing → QC → Packing → Dispatched
```

### Two views

- **List** (default) — rows with Stage, Days in stage, Progress bar.
- **Board** — kanban columns; **drag a card** to another stage to move it.

### Move a single style

- In **List**: use the **◀ / ▶** buttons to move to previous/next stage, or **Edit** → change *Current Stage*.
- In **Board**: drag the card and drop it on the target stage column.

### Move many styles at once (bulk)

1. **Tick the checkboxes** of the styles you want to move (or the top checkbox for all).
2. Choose an action:
   - **Advance all ▶** — each selected style moves one stage forward.
   - **Move to stage…** — pick a stage, then **Apply** to jump all selected styles there.
3. Use **Delete selected** (Admin only) to remove job cards.

### Every style has a **Stage History timeline**

Open **Edit** on any style → the **Stage History** section shows every stage change with date and who/what moved it — a full audit trail of that garment.

> **Tip:** Use the **stage filter** and **search box** to focus on one stage (e.g. only *Embroidery-Mumbai*).

---

## 4. Calendar — visual delivery plan

**Purpose:** see all deliveries and sampling milestones on a month grid.

1. Go to **Calendar**.
2. **◀ / ▶** to change month, **Today** to jump back.
3. Events are colour-coded:
   - **Red** — overdue delivery
   - **Amber** — due within 7 days
   - **Green** — on track
   - **Grey** — already dispatched
   - **Purple (✂)** — sampling milestone
4. **Click a day** to open its detail panel — deliveries + value + sampling for that date.
5. Click a row in the day panel to jump straight to the **Deliveries** or **Tracker** view.
6. The bottom table lists all deliveries scheduled that month with due status.

---

## 5. Deliveries — dispatch orders on time

**Purpose:** manage the delivery schedule and mark orders dispatched.

1. Go to **Deliveries** — rows are sorted by delivery date; overdue orders are flagged.
2. For each order you see: **Styles**, **Dispatched (x/y)** and a **Due** badge.
3. When the order ships:
   - Click **Mark Dispatched** — this sets every open style to *Dispatched* and marks the PO *Dispatched* automatically.
4. Use **Edit** to change delivery date / status / value, or **✕** (Admin only) to delete the order and its styles.

> **Tip:** Dispatched styles also flow into the **Stock Report** as "Issued" units automatically.

---

## 6. Stock Report — ready garments on hand

**Purpose:** a row-wise ledger of finished garments in the warehouse.

| Column | Meaning |
|--------|---------|
| Opening | Derived: `Closing + Issued − Received` |
| Received | Stock you added via **+ Stock** or the edit form |
| Issued | Units from dispatched deliveries (auto) |
| Closing | Current pieces on hand |
| Min | Low-stock alert level |
| Value | `Closing × Cost` |

### Add a stock item

1. Click **"+ Add Stock Item"**.
2. Fill **Item Name**, **Style Code** (unique — duplicate variants are rejected), **Color**, **Size**, **Category**, **Warehouse**.
3. Set **Closing Stock**, **Stock Received**, **Cost Price**, **Selling Price**, **Low Stock Level**.
4. Save. (Optional **Item Image**.)

### Record stock received

- Click **+ Stock** on a row → enter the quantity received → **Add to Stock**. Both *Closing* and *Received* update.

### Work with the ledger

- **Filter** by category, sub-category, style code, color, size, or tick **"Out of stock only"**.
- Tick **"Group by style"** for a size-wise variant breakdown under each style code.
- **Scan** — click **Scan**, type or scan the barcode/SKU, press Enter → jumps to that item.
- **Export CSV** or **→ Sheet** to push the filtered ledger to Google Sheets.
- **Upload Excel** to bulk-load stock from a file.

---

## 7. Reports — WIP, profit and documents

**Purpose:** turn raw data into reports and printable documents.

### Production (WIP Report)

1. Go to **Reports → Production**.
2. Row-wise WIP report: **Sr, PO, Buyer, Style, Color, Size, Order Qty, WIP, Stage, Days, Dispatch, Status**.
3. Review the side cards: **Styles by Stage**, **Order Quantity by Retailer**, **Delivery Risk**.
4. **Export CSV** or **→ Sheet** to send the WIP report to Google Sheets.

### Profit Report

1. Switch to the **Profit** tab.
2. Set the **period** (All time / This month / This quarter / This year / Custom range).
3. Group **By Style / By Order / By Month** to compare selling vs cost.
4. Total row shows profit and margin for the whole period.
5. **Export CSV** or **Print / PDF**.

> **Note:** Profit needs **Unit Cost** filled on order styles (see Purchase Orders).

### Documents

- **Purchase Order Report** — list of POs in the period → CSV or **Print / PDF**.
- **Fabric Requirement** — required vs available fabric for current WIP → CSV or **Print / PDF**.
- **Delivery Challan** — pick an order, then **Print / PDF** a challan with style, color, size, qty, dispatched, balance and line value.

---

## 8. Partners & Stock — master data

**Purpose:** manage vendors, retailers, and fabric/trim stock.

### Vendors tab

- Add embroidery hubs (**Embroidery-Kolkata / Embroidery-Mumbai**), **Fabric**, **Trims**, **Cutting**, **Stitching**, **Finishing** vendors.
- Each vendor: name, type, location, contact.

### Retailers tab

- Full list of retailer/brand partners (name, city, contact). Also used by the PO form.

### Fabrics & Trims tab

- Add a fabric/trim: **name, type, stock on hand, UOM (mtr/pcs/kg/sets), cost price, consumption per piece, low stock level, vendor, lead time**.

### Fabric Stock Report tab

- Shows **On Hand vs Allocated vs Available** for each material, with status (In Stock / Low / Reorder Now) and stock value.
- Allocation is computed from open (non-dispatched) styles that consume the fabric/trim.

---

## 9. Settings — backup, audit, roles, account, sheets

### Backup & Restore (do this regularly!)

1. Go to **Settings → Backup & Restore**.
2. **⇩ Download backup (.json)** — saves the whole database (orders, styles, stock, partners).
3. Keep the file somewhere safe (drive/cloud).
4. To recover: **⇧ Restore from file** (Admin only) — replaces all data. **Warning:** irreversible.

### Audit Log

- See every **create / edit / delete** with action, entity, record and user.
- Filter by entity (orders, styles, stock, partners).

### Roles & Permissions (Admin only)

- View all user accounts.
- Change a user's role: **Admin / Manager / Viewer**.
- You cannot change your own role.

### My Account

- **Change Password** (at least 6 characters, confirm the new password).

### Sheet Sync (Google Sheets)

Bidirectional sync — export data to a Google Sheet, edit there, import back.

1. First set up the Apps Script (see `docs/SHEET_EXPORT.md`) and add `VITE_GOOGLE_SHEET_WEB_APP_URL` to your environment.
2. In the app: **sidebar → "⇪ Export all data to Sheets"** pushes every collection into its own tab.
3. Edit the tabs in Google Sheets.
4. Back in **Settings → Sheet Sync** → **⇣ Read Google Sheet** to preview changes (new vs updated rows).
5. Review, then **⇩ Apply changes to app**.

Import rules (safe by design):
- Rows match by natural key (name / PO number / style+color+size). Matches update; new rows are created.
- Calculated columns are ignored on import (WIP, Days, Status, Opening/Issued/Closing/Value) — the app recomputes them.
- Blank cells never overwrite existing values.
- **Nothing is ever deleted** by an import.

---

## Daily workflow in one glance

1. **Dashboard** — check alerts and at-risk deliveries.
2. **Tracker** — advance styles that finished their current stage.
3. **Calendar / Deliveries** — confirm what must ship today/week.
4. **Stock** — update received garments.
5. **Reports** — pull the WIP/Profit report for your daily WIP pack.
6. **Settings → Backup** — download a backup at least weekly.

---

## Roles at a glance

| Capability | Admin | Manager | Viewer |
|------------|-------|---------|--------|
| View data | ✅ | ✅ | ✅ |
| Create / edit | ✅ | ✅ | ❌ |
| Delete | ✅ | ❌ | ❌ |
| Restore backup | ✅ | ❌ | ❌ |
| Manage roles | ✅ | ❌ | ❌ |
