-- ============================================================================
-- Atelier Production & Merchandising Manager — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
-- Applies the full production data model with Row Level Security.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
do $$ begin
  create type po_status as enum ('Confirmed', 'In Production', 'On Hold', 'Dispatched');
exception when duplicate_object then null; end $$;

do $$ begin
  create type production_stage as enum (
    'Sampling', 'Fabric', 'Trims', 'Embroidery-Kolkata', 'Embroidery-Mumbai',
    'Cutting', 'Stitching', 'Finishing', 'QC', 'Packing', 'Dispatched'
  );
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

create table if not exists retailers (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null check (length(trim(name)) between 1 and 200),
  city         text not null default '',
  contact      text not null default '',
  created_at   timestamptz not null default now()
);

create table if not exists vendors (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null check (length(trim(name)) between 1 and 200),
  type         text not null default 'Vendor',
  location     text not null default '',
  contact      text not null default '',
  created_at   timestamptz not null default now()
);

create table if not exists fabrics (
  id               uuid primary key default uuid_generate_v4(),
  name             text not null check (length(trim(name)) between 1 and 200),
  type             text not null default 'Silk',
  stock            numeric not null default 0 check (stock >= 0),
  uom              text not null default 'mtr',
  vendor           text not null default '',
  lead_time_days   integer not null default 0 check (lead_time_days >= 0),
  cost_price       numeric not null default 0 check (cost_price >= 0),
  consumption      numeric not null default 0 check (consumption >= 0),
  low_stock_level  numeric not null default 30 check (low_stock_level >= 0),
  created_at       timestamptz not null default now()
);

create table if not exists ready_stock (
  id               uuid primary key default uuid_generate_v4(),
  name             text not null check (length(trim(name)) between 1 and 200),
  category         text not null default 'Occasions',
  sub_category     text not null default '',
  quantity         numeric not null default 0 check (quantity >= 0),
  cost_price       numeric not null default 0 check (cost_price >= 0),
  selling_price    numeric not null default 0 check (selling_price >= 0),
  low_stock_level  numeric not null default 2 check (low_stock_level >= 0),
  location         text not null default '',
  image            text not null default '',
  notes            text not null default '',
  created_at       timestamptz not null default now()
);

create table if not exists purchase_orders (
  id            uuid primary key default uuid_generate_v4(),
  po_number     text not null check (length(trim(po_number)) between 1 and 60),
  retailer_id   uuid references retailers(id) on delete set null,
  order_date    date,
  delivery_date date,
  status        po_status not null default 'Confirmed',
  value         numeric not null default 0 check (value >= 0),
  notes         text not null default '',
  created_at    timestamptz not null default now()
);

create table if not exists styles (
  id               uuid primary key default uuid_generate_v4(),
  po_id            uuid references purchase_orders(id) on delete cascade,
  style_code       text not null check (length(trim(style_code)) between 1 and 60),
  style_name       text not null default '',
  category         text not null default 'Occasions',
  sub_category     text not null default '',
  quantity         numeric not null default 0 check (quantity >= 0),
  price            numeric not null default 0 check (price >= 0),
  fabric           text not null default '',
  trim             text not null default '',
  stage            production_stage not null default 'Sampling',
  stage_entered_at date,
  qty_dispatched   numeric not null default 0 check (qty_dispatched >= 0),
  image            text not null default '',
  notes            text not null default '',
  history          jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
create index if not exists idx_po_retailer       on purchase_orders (retailer_id);
create index if not exists idx_po_status         on purchase_orders (status);
create index if not exists idx_po_delivery_date  on purchase_orders (delivery_date);
create index if not exists idx_styles_po         on styles (po_id);
create index if not exists idx_styles_stage      on styles (stage);
create index if not exists idx_ready_stock_cat   on ready_stock (category, sub_category);
create index if not exists idx_fabrics_name      on fabrics (lower(name));

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table retailers        enable row level security;
alter table vendors          enable row level security;
alter table fabrics          enable row level security;
alter table ready_stock      enable row level security;
alter table purchase_orders  enable row level security;
alter table styles           enable row level security;

-- Authenticated users have full read/write access to every table.
do $$ declare t text;
begin
  foreach t in array array['retailers','vendors','fabrics','ready_stock','purchase_orders','styles'] loop
    execute format('drop policy if exists "authenticated all %s" on %I', t, t);
    execute format(
      'create policy "authenticated all %s" on %I for all to authenticated using (true) with check (true)',
      t, t
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Role grants
-- Anonymous (no session): read-only access to the public helper view.
-- Authenticated (signed-in user): full read/write on the app tables.
-- Required when "Automatically expose new tables" is disabled in the dashboard.
-- ----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ----------------------------------------------------------------------------
-- Seed data (optional — safe to re-run; inserts only when tables are empty)
-- ----------------------------------------------------------------------------
insert into retailers (name, city, contact)
select * from (values
  ('Pernia''s Pop-Up Shop', 'New Delhi', '+91 98xxx 10005'),
  ('Pernia''s Pop-Up Shop', 'Mumbai', '+91 98xxx 10008'),
  ('AZA Fashion', 'Mumbai', '+91 98xxx 10006'),
  ('RK Store Kolkata', 'Kolkata', '+91 98xxx 10007')
) as s(name, city, contact)
where not exists (select 1 from retailers limit 1);

insert into vendors (name, type, location, contact)
select * from (values
  ('Meher Embroidery House', 'Embroidery-Kolkata', 'Kolkata', 'meher@example.com'),
  ('Zari & Thread Studio', 'Embroidery-Mumbai', 'Mumbai', 'zari@example.com'),
  ('Banaras Silk Traders', 'Fabric', 'Varanasi', 'banaras@example.com'),
  ('Trim & Beads Supply Co.', 'Trims', 'Mumbai', 'trims@example.com'),
  ('Heritage Tailoring Unit', 'Stitching', 'Jaipur', 'heritage@example.com')
) as s(name, type, location, contact)
where not exists (select 1 from vendors limit 1);

insert into fabrics (name, type, stock, uom, vendor, lead_time_days, cost_price, consumption, low_stock_level)
select * from (values
  ('Banarasi Silk', 'Silk', 240, 'mtr', 'Banaras Silk Traders', 10, 1400, 5, 80),
  ('Raw Silk Dupion', 'Silk', 180, 'mtr', 'Banaras Silk Traders', 12, 950, 4, 60),
  ('Organza', 'Georgette', 320, 'mtr', 'Banaras Silk Traders', 8, 520, 4, 100),
  ('Zari Border (gold)', 'Trim', 60, 'pcs', 'Trim & Beads Supply Co.', 6, 1600, 1, 25),
  ('Pearl Buttons', 'Trim', 420, 'pcs', 'Trim & Beads Supply Co.', 5, 12, 6, 100)
) as s(name, type, stock, uom, vendor, lead_time_days, cost_price, consumption, low_stock_level)
where not exists (select 1 from fabrics limit 1);

-- ----------------------------------------------------------------------------
-- Helper view: fabric allocation / availability (mirrors /api/reports/stock)
-- ----------------------------------------------------------------------------
create or replace view fabric_stock_report as
with open_styles as (
  select * from styles where stage <> 'Dispatched'
)
select
  f.id,
  f.name,
  f.type,
  f.stock,
  f.uom,
  f.cost_price,
  f.consumption,
  f.low_stock_level,
  coalesce((
    select sum(s.quantity * f.consumption)
    from open_styles s
    where lower(s.fabric) = lower(f.name) or lower(s.trim) = lower(f.name)
  ), 0) as allocated
from fabrics f;
