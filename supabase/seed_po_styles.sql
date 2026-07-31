-- Sample purchase orders & styles for demo/exploration.
-- Idempotent: skips rows whose po_number / style_code already exist.

insert into purchase_orders (po_number, retailer_id, order_date, delivery_date, status, value, notes)
select v.po, r.id, v.od::date, v.dd::date, v.status::po_status, v.value, v.notes
from (values
  ('PO-2026-001', 'Pernia''s Pop-Up Shop', 'New Delhi', '2026-06-02', '2026-09-10', 'In Production', 228000, 'Priority bridal line'),
  ('PO-2026-002', 'AZA Fashion', 'Mumbai', '2026-06-20', '2026-08-20', 'In Production', 137500, ''),
  ('PO-2026-003', 'Pernia''s Pop-Up Shop', 'Mumbai', '2026-07-01', '2026-07-15', 'In Production', 86000, 'Client wedding blocked — chase'),
  ('PO-2026-004', 'RK Store Kolkata', 'Kolkata', '2026-05-10', '2026-07-05', 'Dispatched', 101000, 'Dispatched 05-Jul'),
  ('PO-2026-005', 'AZA Fashion', 'Mumbai', '2026-07-20', '2026-10-05', 'Confirmed', 129000, '')
) as v(po, rname, rcity, od, dd, status, value, notes)
join retailers r on r.name = v.rname and r.city = v.rcity
where not exists (select 1 from purchase_orders where po_number = v.po);

insert into styles (po_id, style_code, style_name, category, sub_category, quantity, price, fabric, trim, stage, stage_entered_at, qty_dispatched, history)
select
  po.id, v.sc, v.sn, v.cat, v.sub, v.qty, v.price, v.fab, v.trim,
  v.stage::production_stage, v.sea::date, v.qd,
  ('[{"at":"' || v.sea || '","from":null,"to":"' || v.stage || '","note":"Order created"}]')::jsonb
from (values
  ('BR-001', 'Lehenga Set', 'Bridal', 'Lehenga Set', 6, 18000, 'Banarasi Silk', 'Zari Border (gold)', 'Stitching', '2026-07-25', 0, 'PO-2026-001'),
  ('BR-002', 'Gown', 'Bridal', 'Gown', 3, 24000, 'Raw Silk Dupion', 'Pearl Buttons', 'Embroidery-Mumbai', '2026-07-18', 0, 'PO-2026-001'),
  ('BR-003', 'Anarkali', 'Bridal', 'Anarkali', 4, 12000, 'Organza', 'Zari Border (gold)', 'Fabric', '2026-07-28', 0, 'PO-2026-001'),
  ('OC-101', 'Suit', 'Occasions', 'Suit', 8, 6500, 'Organza', 'Pearl Buttons', 'Cutting', '2026-07-22', 0, 'PO-2026-002'),
  ('OC-102', 'Kurta Set', 'Occasions', 'Kurta Set', 10, 4800, 'Raw Silk Dupion', 'Pearl Buttons', 'Sampling', '2026-07-30', 0, 'PO-2026-002'),
  ('OC-103', 'Anarkali', 'Occasions', 'Anarkali', 5, 7500, 'Banarasi Silk', 'Zari Border (gold)', 'Embroidery-Kolkata', '2026-07-12', 0, 'PO-2026-002'),
  ('CT-201', 'Gown', 'Cocktail Wear', 'Gown', 4, 9500, 'Organza', 'Zari Border (gold)', 'QC', '2026-07-10', 0, 'PO-2026-003'),
  ('CT-202', 'Sharara Set', 'Cocktail Wear', 'Sharara Set', 6, 8000, 'Raw Silk Dupion', 'Pearl Buttons', 'Stitching', '2026-07-15', 0, 'PO-2026-003'),
  ('RK-301', 'Suit', 'Menswear', 'Suit', 5, 9000, 'Banarasi Silk', 'Pearl Buttons', 'Dispatched', '2026-06-20', 5, 'PO-2026-004'),
  ('RK-302', 'Bandhgala', 'Menswear', 'Bandhgala', 4, 14000, 'Raw Silk Dupion', 'Zari Border (gold)', 'Dispatched', '2026-06-25', 4, 'PO-2026-004'),
  ('OC-301', 'Lehenga Set', 'Bridal', 'Lehenga Set', 5, 16000, 'Banarasi Silk', 'Zari Border (gold)', 'Sampling', '2026-07-29', 0, 'PO-2026-005'),
  ('OC-302', 'Suit', 'Occasions', 'Suit', 7, 7000, 'Organza', 'Pearl Buttons', 'Sampling', '2026-07-29', 0, 'PO-2026-005')
) as v(sc, sn, cat, sub, qty, price, fab, trim, stage, sea, qd, po_num)
join purchase_orders po on po.po_number = v.po_num
where not exists (select 1 from styles where style_code = v.sc);
