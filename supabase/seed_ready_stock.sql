-- Sample ready-stock inventory + a couple of low-stock fabrics.
-- Idempotent: skips rows whose name already exists.

insert into ready_stock (name, category, sub_category, quantity, cost_price, selling_price, low_stock_level, location, notes)
select * from (values
  ('Ivory Silk Lehenga Set', 'Bridal', 'Lehenga Set', 4, 8500, 24500, 2, 'Mumbai', 'Reversible dupatta'),
  ('Red Banarasi Suit', 'Occasions', 'Suit', 12, 3200, 8900, 4, 'Mumbai', ''),
  ('Gold Raw Silk Anarkali', 'Occasions', 'Anarkali', 0, 4200, 11500, 3, 'Kolkata', 'Out — reorder for Diwali'),
  ('Black Organza Gown', 'Cocktail Wear', 'Gown', 6, 6800, 18900, 2, 'Delhi', ''),
  ('Teal Sharara Set', 'Cocktail Wear', 'Sharara Set', 3, 5100, 14200, 2, 'Mumbai', ''),
  ('Pastel Kurta Set', 'Occasions', 'Kurta Set', 9, 2100, 5900, 3, 'Kolkata', ''),
  ('Navy Bandhgala', 'Menswear', 'Bandhgala', 2, 7400, 19900, 3, 'Delhi', 'Low stock'),
  ('Ivory Silk Saree Set', 'Bridal', 'Saree Set', 5, 9800, 26900, 2, 'Mumbai', ''),
  ('Maroon Velvet Gown', 'Cocktail Wear', 'Gown', 1, 6400, 17500, 2, 'Delhi', 'Low stock'),
  ('Off-white Sherwani', 'Menswear', 'Sherwani', 4, 8200, 22500, 2, 'Kolkata', '')
) as s(name, category, sub_category, quantity, cost_price, selling_price, low_stock_level, location, notes)
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
