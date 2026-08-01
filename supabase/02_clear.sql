-- Step 2 of 6: delete all old rows (styles first because it links to purchase_orders)
delete from styles;
delete from purchase_orders;
delete from ready_stock;
