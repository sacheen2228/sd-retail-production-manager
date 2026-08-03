-- Step 5 of 6: add the 8 WIP style lines (with Color + Size)
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
