-- Step 4 of 6: add the 3 purchase orders
insert into purchase_orders (po_number, retailer_id, order_date, delivery_date, status, value, notes)
select v.po, r.id, v.od::date, v.dd::date, v.status::po_status, v.value, v.notes
from (values
  ('PO-2026-001', 'Pernia Designs',    current_date - 15, current_date + 12, 'In Production', 7050000, 'Bridal capsule for trunk show'),
  ('PO-2026-002', 'AZA Fashion',       current_date - 8,  current_date + 20, 'In Production', 6400000, 'Occasion wear re-order'),
  ('PO-2026-003', 'The Wedding House', current_date - 40, current_date - 5,  'Dispatched',    128200,   'Dispatched stock replenishment')
) as v(po, rname, od, dd, status, value, notes)
join retailers r on r.name = v.rname;
