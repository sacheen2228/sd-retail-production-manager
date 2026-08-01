-- ----------------------------------------------------------------------------
-- Migration: Stock & WIP reports — new row-wise format
-- Adds the columns the new Stock Report / WIP Report need, then backfills your
-- existing ready-stock rows with SKU / Color / Size by item name.
--
-- Idempotent: safe to run more than once.
-- How to run: Supabase Dashboard → SQL Editor → paste → Run.
-- ----------------------------------------------------------------------------

-- 1) New columns on ready_stock (Stock Report: SKU Code, Color, Size, Received)
alter table ready_stock add column if not exists style_code     text    not null default '';
alter table ready_stock add column if not exists color          text    not null default '';
alter table ready_stock add column if not exists size           text    not null default '';
alter table ready_stock add column if not exists received_stock numeric not null default 0 check (received_stock >= 0);

create index if not exists idx_ready_stock_style on ready_stock (lower(style_code));

-- 2) New columns on styles (WIP Report: Color, Size)
alter table styles add column if not exists color text not null default '';
alter table styles add column if not exists size  text not null default '';

-- 3) Backfill SKU / Color / Size for your existing ready-stock items (by name).
--    Rows already carrying a style_code are left untouched.
update ready_stock set style_code = v.sku, color = v.color, size = v.size
from (values
  ('Ivory Silk Lehenga Set', 'BR-LH-001', 'Ivory', 'M'),
  ('Ivory Silk Saree Set',   'BR-SA-001', 'Ivory', 'Free'),
  ('Black Organza Gown',     'CW-GW-001', 'Black', 'L'),
  ('Teal Sharara Set',       'CW-SH-001', 'Teal', 'M'),
  ('Maroon Velvet Gown',     'CW-GW-002', 'Maroon', 'S'),
  ('Navy Bandhgala',         'MN-BD-001', 'Navy', 'L'),
  ('Off-white Sherwani',     'MN-SW-001', 'Off-white', 'M'),
  ('Red Banarasi Suit',      'OC-ST-001', 'Red', 'M'),
  ('Gold Raw Silk Anarkali', 'OC-AN-001', 'Gold', 'Free'),
  ('Pastel Kurta Set',       'OC-KS-001', 'Pastel Pink', 'M')
) as v(name, sku, color, size)
where ready_stock.name = v.name and ready_stock.style_code = '';

-- 4) Sample Received figures so the Opening column reads sensibly.
update ready_stock set received_stock = 2 where name = 'Ivory Silk Lehenga Set';
update ready_stock set received_stock = 1 where name = 'Ivory Silk Saree Set';
