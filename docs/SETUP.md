# Production Deployment — Vercel + Supabase + Cloudinary

Free-tier, no Express server in production. The app is served as a static SPA from Vercel; all data lives in Supabase (Postgres + Auth + RLS); images go to Cloudinary.

## 1. Supabase

1. Create a project at https://supabase.com (free plan is fine).
2. Open **SQL Editor → New query**, paste and run `supabase/schema.sql`. This creates:
   - Tables: `retailers`, `vendors`, `fabrics`, `ready_stock`, `purchase_orders`, `styles`
   - Enums `po_status`, `production_stage`; indexes; the `fabric_stock_report` view
   - `profiles` (roles: admin/manager/viewer) and `audit_log`, with database triggers that auto-assign roles to new signups and record every change
   - Row-Level Security policies — anyone signed in can read; **admin/manager** create & edit; only **admin** can delete, restore, or change roles
   - Sample seed data
3. Under **Authentication → Providers → Email**, keep email/password enabled.
4. Copy from **Project Settings → API**:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`

## 2. Cloudinary (product images)

1. Create a free account at https://cloudinary.com.
2. Under **Settings → Upload**, add an **unsigned upload preset** (set the folder, e.g. `atelier/items`).
3. Copy your **Cloud Name** and the **Upload Preset** name.

## 3. Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Add Environment Variables (see `.env.example`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_CLOUDINARY_CLOUD_NAME`
   - `VITE_CLOUDINARY_UPLOAD_PRESET`
3. Deploy. `vercel.json` already sets the build command, output directory (`dist`), SPA rewrites and cache headers.

## 4. Sign up users & assign roles

With auth enabled, the app opens on a **sign-in screen**. Click **Create account** and register the first email — **that first account automatically becomes the Admin**. Everyone who signs up afterwards starts as a **Viewer** (read-only).

Manage roles in the app: **Settings → Roles & Permissions** (admin only). Only admins can delete records, restore backups, and change roles. Existing accounts created before this schema ran are backfilled as admins.

> **Re-run `supabase/schema.sql`** against an existing project to create `profiles` + `audit_log` and upgrade the RLS policies. It is safe to re-run.

## Notes

- **Local dev without Supabase:** omit the env vars and run `npm start` — the app falls back to the Express + JSON backend (`server/data/db.json`). No login screen in this mode.
- **Schema changes:** run them via the Supabase SQL Editor against your project (the project database is your source of truth, not a migration tool).
- **Env var names** must be prefixed `VITE_` so Vite inlines them at build time. Changing them requires a fresh deploy.
