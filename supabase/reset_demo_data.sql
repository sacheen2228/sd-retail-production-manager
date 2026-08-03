-- ----------------------------------------------------------------------------
-- FULL RESET — Stock & WIP to the new row-wise format with demo data
-- Deletes existing ready_stock / purchase_orders / styles rows and re-inserts
-- the new-format example data. Safe to run more than once.
-- Run: Supabase Dashboard → SQL Editor → paste → Run.
-- ----------------------------------------------------------------------------

-- Make sure the new-format columns exist (no-op if already added).
alter table ready_stock add column if not exists style_code     text    not null default '';
alter table ready_stock add column if not exists color          text    not null default '';
alter table ready_stock add column if not exists size           text    not null default '';
alter table ready_stock add column if not exists received_stock numeric not null default 0;
alter table styles      add column if not exists color          text    not null default '';
alter table styles      add column if not exists size           text    not null default '';
create index if not exists idx_ready_stock_style on ready_stock (lower(style_code));

-- 1) Delete the old rows (styles first — FK from purchase_orders).
delete from styles;
delete from purchase_orders;
delete from ready_stock;

-- 2) Buyers (retailers). Added only if missing so existing retailer ids are kept.
insert into retailers (name, city, contact)
select name, city, contact from (values
  ('Pernia Designs',    'Mumbai',    '+91 98xxx 10001'),
  ('AZA Fashion',       'Mumbai',    '+91 98xxx 10002'),
  ('The Wedding House', 'New Delhi', '+91 98xxx 10003'),
  ('Royal Occasions',   'Jaipur',    '+91 98xxx 10004')
) as v(name, city, contact)
where not exists (select 1 from retailers where retailers.name = v.name);

-- 3) Purchase orders.
insert into purchase_orders (po_number, retailer_id, order_date, delivery_date, status, value, notes)
select v.po, r.id, v.od::date, v.dd::date, v.status::po_status, v.value, v.notes
from (values
  ('PO-2026-001', 'Pernia Designs',    current_date - 15, current_date + 12, 'In Production', 7050000, 'Bridal capsule for trunk show'),
  ('PO-2026-002', 'AZA Fashion',       current_date - 8,  current_date + 20, 'In Production', 6400000, 'Occasion wear re-order'),
  ('PO-2026-003', 'The Wedding House', current_date - 40, current_date - 5,  'Dispatched',    128200,   'Dispatched stock replenishment')
) as v(po, rname, od, dd, status, value, notes)
join retailers r on r.name = v.rname;

-- 4) Styles / WIP lines (with Color + Size).
insert into styles (po_id, style_code, style_name, category, sub_category, color, size, quantity, price, fabric, trim, stage, stage_entered_at, qty_dispatched, history)
select
  po.id, v.sc, v.sn, v.cat, v.sub, v.color, v.size, v.qty, v.price, v.fab, v.trim,
  v.stage::production_stage, v.sea::date, v.qd,
  ('[{"at":"' || v.sea || '","from":null,"to":"' || v.stage || '","note":"Order created"}]')::jsonb
from (values
  ('BR-001', 'Red Banarasi Lehenga Set', 'Bridal', 'Lehenga Set', 'Red', 'M',   50,  95000, 'Banarasi Silk', 'Zari Border (gold)', 'Stitching', current_date - 8,  8,  'PO-2026-001'),
  ('BR-001', 'Red Banarasi Lehenga Set', 'Bridal', 'Lehenga Set', 'Red', 'L',   40,  95000, 'Banarasi Silk', 'Zari Border (gold)', 'Finishing', current_date - 5,  5,  'PO-2026-001'),
  ('OC-101', 'Pastel Organza Saree Set', 'Occasions', 'Saree Set', 'Navy', 'XL', 100, 28000, 'Organza',       'Zari Border (gold)', 'Cutting',   current_date - 3,  10, 'PO-2026-002'),
  ('BR-LH-001', 'Ivory Silk Lehenga Set', 'Bridal', 'Lehenga Set', 'Ivory', 'M', 3,  24500, 'Banarasi Silk', 'Zari Border (gold)', 'Dispatched', current_date - 12, 3, 'PO-2026-003'),
  ('BR-SA-001', 'Ivory Silk Saree Set', 'Bridal', 'Saree Set', 'Ivory', 'Free', 2, 26900, 'Raw Silk Dupion','Pearl Buttons',       'Dispatched', current_date - 10, 2, 'PO-2026-003'),
  ('CW-GW-001', 'Black Organza Gown', 'Cocktail Wear', 'Gown', 'Black', 'L', 2, 18900, 'Organza',      'Pearl Buttons',       'Dispatched', current_date - 8,  2, 'PO-2026-003'),
  ('CW-SH-001', 'Teal Sharara Set', 'Cocktail Wear', 'Sharara Set', 'Teal', 'M', 1, 14200, 'Raw Silk Dupion','Pearl Buttons',     'Dispatched', current_date - 6,  1, 'PO-2026-003'),
  ('CW-GW-002', 'Maroon Velvet Gown', 'Cocktail Wear', 'Gown', 'Maroon', 'S', 1, 17500, 'Banarasi Silk', 'Pearl Buttons',       'Dispatched', current_date - 4,  1, 'PO-2026-003')
) as v(sc, sn, cat, sub, color, size, qty, price, fab, trim, stage, sea, qd, po_num)
join purchase_orders po on po.po_number = v.po_num;

-- 5) Ready stock (new format: SKU Code, Color, Size, Received ledger).
insert into ready_stock (name, style_code, color, size, category, sub_category, quantity, received_stock, cost_price, selling_price, low_stock_level, location)
select * from (values
  ('Ivory Silk Lehenga Set', 'BR-LH-001', 'Ivory', 'M',    'Bridal',        'Lehenga Set',  4,  2,  8500, 24500, 2, 'Mumbai'),
  ('Ivory Silk Saree Set',   'BR-SA-001', 'Ivory', 'Free', 'Bridal',        'Saree Set',    5,  1,  9800, 26900, 2, 'Mumbai'),
  ('Black Organza Gown',     'CW-GW-001', 'Black', 'L',    'Cocktail Wear', 'Gown',         6,  0,  6800, 18900, 2, 'Delhi'),
  ('Teal Sharara Set',       'CW-SH-001', 'Teal',   'M',    'Cocktail Wear', 'Sharara Set', 3,  0,  5100, 14200, 2, 'Mumbai'),
  ('Maroon Velvet Gown',     'CW-GW-002', 'Maroon', 'S',    'Cocktail Wear', 'Gown',        1,  0,  6400, 17500, 2, 'Delhi'),
  ('Navy Bandhgala',         'MN-BD-001', 'Navy',   'L',    'Menswear',      'Bandhgala',   2,  0,  7400, 19900, 2, 'Delhi'),
  ('Off-white Sherwani',     'MN-SW-001', 'Off-white', 'M', 'Menswear',      'Sherwani',    4,  0,  8200, 22500, 2, 'Kolkata'),
  ('Red Banarasi Suit',      'OC-ST-001', 'Red',    'M',    'Occasions',     'Suit',        12, 0,  3200, 8900,  2, 'Mumbai'),
  ('Gold Raw Silk Anarkali', 'OC-AN-001', 'Gold',   'Free', 'Occasions',     'Anarkali',    0,  0,  4200, 11500, 2, 'Kolkata'),
  ('Pastel Kurta Set',       'OC-KS-001', 'Pastel Pink', 'M', 'Occasions',   'Kurta Set',   9,  0,  2100, 5900,  2, 'Kolkata')
) as s(name, style_code, color, size, category, sub_category, quantity, received_stock, cost_price, selling_price, low_stock_level, location);
