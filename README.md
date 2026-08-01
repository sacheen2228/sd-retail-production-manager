# SD Retail Production & Merchandising Manager

A production and merchandising management system for **SD Retail**. It digitises the complete workflow from retailer purchase orders and style-wise job cards to the daily work-in-progress tracker, delivery deadlines and WIP reports.

## Features

- **Dashboard** — live KPIs: active orders, styles in production, at-risk deliveries, pipeline value; production pipeline view; upcoming deliveries; order value by retailer. Plus an **Alerts & Reminders** feed: overdue deliveries, stuck stages, sampling approvals pending, low fabric/trim stock.
- **Purchase Orders** — create a full order in one flow: register a new retailer/brand partner on the spot, add multiple style lines (style code, category, sub-category, qty, price, fabric, trims, stage), auto-computed order total. Expand any PO to see its styles.
- **Production Tracker** — style-wise job cards across the full pipeline (Sampling → Fabric → Trims → Embroidery-Kolkata → Embroidery-Mumbai → Cutting → Stitching → Finishing → QC → Packing → Dispatched). **Bulk select** to advance multiple styles at once or move them to a chosen stage. Every style carries a **stage-history timeline** (audit log of every move).
- **Calendar** — month view of all deliveries colour-coded by risk (overdue / due ≤7d / on track / dispatched) plus sampling milestones, with month totals and a delivery list.
- **Deliveries** — delivery schedule with due/overdue indicators and one-click dispatch.
- **Stock Report** — **ready-stock inventory of finished garments** by category/sub-category (Lehenga Set, Suit, Anarkali, Set-2, Set-3, Gown, Kurta Set, Bandhgala…). Each row carries a **Sr No**, **Style Code**, **Color** and **Size**, plus pieces on hand, cost/selling price, stock value, low/out-of-stock status, with **+ Stock** quick-add and full item add/edit. Filter by style code, color, size or out-of-stock-only; **group by style** for a size-wise variant breakdown; see **units sold, sell-through % and days-of-stock** derived from dispatched deliveries; **barcode/SKU scan** jumps straight to an item; Style Code is required and duplicate variants are rejected on save. CSV / Google Sheets export. (Fabric & trim allocation is available under **Partners & Stock → Fabric Stock Report**.)
- **Reports** — daily/weekly WIP report with days-in-stage, delivery risk list, by-stage and by-retailer summaries, **CSV export** and **→ Google Sheet export** (see `docs/SHEET_EXPORT.md`).
- **Partners & Stock** — vendors (embroidery hubs, fabric, trims, stitching), retailers, and fabrics/trims stock register (with low-stock alerts).
- **Settings** — **Backup & Restore** (download/upload a full JSON snapshot), a global **Audit Log** of every create/edit/delete with user and timestamp, and **Roles & Permissions** (Admin / Manager / Viewer) that gate delete, restore, and role management.

## Tech Stack

- **Frontend:** Vite + React (single-page, lazy-loaded code-split views, hand-rolled CSS design system)
- **Backend (production):** Supabase (Postgres + Auth + Row-Level Security), Cloudinary for image uploads — served statically on Vercel, no Express server
- **Backend (local dev):** Node.js + Express, JSON-file persistence (`server/data/db.json`), seeded with realistic sample data
- **Dev:** Vite dev server proxies `/api` to the Express server on port 3001

The app runs against one of two backends behind the same `api.*` contract in `src/api.js`:

| Mode | When | Backend |
|------|------|---------|
| Supabase | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set | Postgres + Auth, snake_case columns, RLS |
| Legacy | env vars absent | Express + JSON file on `:3001` |

## Run (local, legacy mode)

```bash
npm install
npm run build
npm start
```

Then open `http://localhost:3001`.

**Development mode** (hot reload):

```bash
npm run dev:server   # API on :3001
npm run dev          # Vite on :5173, proxies /api
```

## Tests

```bash
npm test   # Vitest — data-layer routing/mapping + reports (tests/)
```

## Project Structure

```
server/          Express API + JSON store (db.json) — legacy/local mode
supabase/        schema.sql — tables, enums, RLS, indexes, seed data
src/views/       Dashboard, Orders, Tracker, Deliveries, Reports, Partners
src/components/  Shared UI (badges, cards, modal, inputs, ImageUpload, AuthScreen)
src/services/    supabaseClient, auth, images (Cloudinary), reports
src/lib/         validate.js — server-style validation for PO/styles/stock/partners
src/context/     ToastContext — inline notifications
tests/           Vitest suites for src/api.js and src/services/reports.js
docs/            ENGAGEMENT_PLAN.md, GROWTH_PLAN.md, SETUP.md (production deploy)
```

## Data Model

- `purchaseOrders` — retailer POs with delivery dates, status, value
- `styles` — style-wise job cards; each linked to a PO and tracked through production stages
- `retailers`, `vendors`, `fabrics` — master data for partners and stock

## Production Deploy

Follow `docs/SETUP.md` — run `supabase/schema.sql` in a Supabase project, add the four `VITE_*` env vars (Supabase URL/key, Cloudinary cloud name/upload preset), then deploy to Vercel.

## Planning Docs

- `docs/ENGAGEMENT_PLAN.md` — operating rhythm, weekly model, escalation matrix, reporting pack
- `docs/GROWTH_PLAN.md` — phased growth roadmap (0–3+ years) with KPIs and how the app supports each phase
