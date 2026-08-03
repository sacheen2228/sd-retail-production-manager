-- Sample ready-stock inventory + a couple of low-stock fabrics.
-- Idempotent: skips rows whose name already exists.

insert into ready_stock (name, style_code, color, size, category, sub_category, quantity, received_stock, cost_price, selling_price, low_stock_level, location, notes)
select * from (values
  ('Ivory Silk Lehenga Set', 'BR-LH-001', 'Ivory', 'M', 'Bridal', 'Lehenga Set', 4, 2, 8500, 24500, 2, 'Mumbai', ''),
  ('Ivory Silk Saree Set', 'BR-SA-001', 'Ivory', 'Free', 'Bridal', 'Saree Set', 5, 1, 9800, 26900, 2, 'Mumbai', ''),
  ('Black Organza Gown', 'CW-GW-001', 'Black', 'L', 'Cocktail Wear', 'Gown', 6, 0, 6800, 18900, 2, 'Delhi', ''),
  ('Teal Sharara Set', 'CW-SH-001', 'Teal', 'M', 'Cocktail Wear', 'Sharara Set', 3, 0, 5100, 14200, 2, 'Mumbai', ''),
  ('Maroon Velvet Gown', 'CW-GW-002', 'Maroon', 'S', 'Cocktail Wear', 'Gown', 1, 0, 6400, 17500, 2, 'Delhi', ''),
  ('Navy Bandhgala', 'MN-BD-001', 'Navy', 'L', 'Menswear', 'Bandhgala', 2, 0, 7400, 19900, 2, 'Delhi', ''),
  ('Off-white Sherwani', 'MN-SW-001', 'Off-white', 'M', 'Menswear', 'Sherwani', 4, 0, 8200, 22500, 2, 'Kolkata', ''),
  ('Red Banarasi Suit', 'OC-ST-001', 'Red', 'M', 'Occasions', 'Suit', 12, 0, 3200, 8900, 2, 'Mumbai', ''),
  ('Gold Raw Silk Anarkali', 'OC-AN-001', 'Gold', 'Free', 'Occasions', 'Anarkali', 0, 0, 4200, 11500, 2, 'Kolkata', 'Out — reorder for Diwali'),
  ('Pastel Kurta Set', 'OC-KS-001', 'Pastel Pink', 'M', 'Occasions', 'Kurta Set', 9, 0, 2100, 5900, 2, 'Kolkata', '')
) as s(name, style_code, color, size, category, sub_category, quantity, received_stock, cost_price, selling_price, low_stock_level, location, notes)
where not exists (select 1 from ready_stock limit 1);

insert into fabrics (name, type, stock, uom, vendor, lead_time_days, cost_price, consumption, low_stock_level)
select * from (values
  ('Sequin Fabric', 'Trim', 18, 'mtr', 'Trim & Beads Supply Co.', 9, 760, 2, 30)
) as s(name, type, stock, uom, vendor, lead_time_days, cost_price, consumption, low_stock_level)
where not exists (select 1 from fabrics where name = 'Sequin Fabric');

insert into fabrics (name, type, stock, uom, vendor, lead_time_days, cost_price, consumption, low_stock_level)
select * from (values
  ('Chantilly Lace', 'Lace', 40, 'mtr', 'Meher Embroidery House', 7, 340, 3, 50)
) as s(name, type, stock, uom, vendor, lead_time_days, cost_price, consumption, low_stock_level)
where not exists (select 1 from fabrics where name = 'Chantilly Lace');
