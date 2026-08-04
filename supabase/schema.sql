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
  style_code       text not null default '',
  color            text not null default '',
  size             text not null default '',
  category         text not null default 'Occasions',
  sub_category     text not null default '',
  quantity         numeric not null default 0 check (quantity >= 0),
  received_stock   numeric not null default 0 check (received_stock >= 0),
  cost_price       numeric not null default 0 check (cost_price >= 0),
  selling_price    numeric not null default 0 check (selling_price >= 0),
  low_stock_level  numeric not null default 2 check (low_stock_level >= 0),
  location         text not null default '',
  image            text not null default '',
  notes            text not null default '',
  created_at       timestamptz not null default now()
);

-- Upgrades for existing projects: adds the variant columns if missing.
alter table ready_stock add column if not exists style_code text not null default '';
alter table ready_stock add column if not exists color     text not null default '';
alter table ready_stock add column if not exists size      text not null default '';
alter table ready_stock add column if not exists received_stock numeric not null default 0;

create index if not exists idx_ready_stock_style on ready_stock (lower(style_code));

create table if not exists purchase_orders (
  id            uuid primary key default uuid_generate_v4(),
  po_number     text not null check (length(trim(po_number)) between 1 and 60),
  retailer_id   uuid references retailers(id) on delete set null,
  order_date    date,
  delivery_date date,
  status        po_status not null default 'Confirmed',
  value         numeric not null default 0 check (value >= 0),
  notes         text not null default '',
  image         text not null default '',
  created_at    timestamptz not null default now()
);
alter table purchase_orders add column if not exists image text not null default '';

create table if not exists styles (
  id               uuid primary key default uuid_generate_v4(),
  po_id            uuid references purchase_orders(id) on delete cascade,
  style_code       text not null check (length(trim(style_code)) between 1 and 60),
  style_name       text not null default '',
  category         text not null default 'Occasions',
  sub_category     text not null default '',
  color            text not null default '',
  size             text not null default '',
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

-- Upgrades for existing projects: adds the variant columns if missing.
alter table styles add column if not exists color text not null default '';
alter table styles add column if not exists size  text not null default '';

-- ----------------------------------------------------------------------------
-- User profiles & roles
-- ----------------------------------------------------------------------------
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null default '',
  role        text not null default 'viewer'
              check (role in ('admin', 'manager', 'viewer')),
  created_at  timestamptz not null default now()
);

-- The first user to ever sign up becomes the admin; everyone else starts as a viewer.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    coalesce(new.email, ''),
    case when not exists (select 1 from public.profiles) then 'admin' else 'viewer' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Returns the signed-in user's role ('admin' | 'manager' | 'viewer' | null).
create or replace function public.get_user_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ----------------------------------------------------------------------------
-- Audit log
-- ----------------------------------------------------------------------------
create table if not exists audit_log (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references auth.users(id) on delete set null,
  action       text not null check (action in ('insert', 'update', 'delete')),
  entity       text not null,
  entity_id    text not null default '',
  detail       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists idx_audit_log_created on audit_log (created_at desc);

-- Records every change to the app tables with the acting user and a before/after snapshot.
create or replace function public.log_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_id text;
  detail jsonb;
begin
  if tg_op = 'DELETE' then
    new_id := coalesce(old.id::text, '');
    detail := jsonb_build_object('before', to_jsonb(old));
  elsif tg_op = 'UPDATE' then
    new_id := coalesce(new.id::text, '');
    detail := jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new));
  else
    new_id := coalesce(new.id::text, '');
    detail := jsonb_build_object('after', to_jsonb(new));
  end if;
  insert into public.audit_log (user_id, action, entity, entity_id, detail)
  values (auth.uid(), lower(tg_op), tg_table_name, new_id, detail);
  return coalesce(new, old);
end $$;

do $$ declare t text;
begin
  foreach t in array array['retailers','vendors','fabrics','ready_stock','purchase_orders','styles'] loop
    execute format('drop trigger if exists trg_audit_%s on %I', t, t);
    execute format(
      'create trigger trg_audit_%s after insert or update or delete on %I for each row execute function public.log_audit()',
      t, t
    );
  end loop;
end $$;

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
alter table profiles         enable row level security;
alter table audit_log        enable row level security;

-- App tables: anyone signed in can read; admin/manager can create & edit; only
-- admin can delete. Roles come from the profiles table via get_user_role().
do $$ declare t text;
begin
  foreach t in array array['retailers','vendors','fabrics','ready_stock','purchase_orders','styles'] loop
    execute format('drop policy if exists "authenticated all %s" on %I', t, t);
    execute format(
      'create policy "authenticated read %s" on %I for select to authenticated using (true)',
      t, t
    );
    execute format(
      'create policy "role write %s" on %I for insert to authenticated with check (public.get_user_role() in (''admin'', ''manager''))',
      t, t
    );
    execute format(
      'create policy "role update %s" on %I for update to authenticated using (public.get_user_role() in (''admin'', ''manager'')) with check (public.get_user_role() in (''admin'', ''manager''))',
      t, t
    );
    execute format(
      'create policy "admin delete %s" on %I for delete to authenticated using (public.get_user_role() = ''admin'')',
      t, t
    );
  end loop;
end $$;

-- Profiles: everyone can read (needed for the role manager); only admins change roles.
drop policy if exists "profiles read" on profiles;
create policy "profiles read" on profiles for select to authenticated using (true);
drop policy if exists "profiles admin update" on profiles;
create policy "profiles admin update" on profiles for update to authenticated
  using (public.get_user_role() = 'admin') with check (public.get_user_role() = 'admin');

-- Audit log: everyone signed in can read; writes come from the security-definer trigger.
drop policy if exists "audit read" on audit_log;
create policy "audit read" on audit_log for select to authenticated using (true);

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
-- Backfill profiles for users who signed up before this schema ran.
-- Existing accounts become admins (single-owner deployments); demote them in
-- the app's Settings → Roles tab if needed. Safe to re-run.
-- ----------------------------------------------------------------------------
insert into profiles (id, email, role)
select id, email, 'admin' from auth.users
where not exists (select 1 from profiles p where p.id = auth.users.id);

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
