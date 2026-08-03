-- Step 3 of 6: add the 4 buyer/retailer names (keeps existing ids)
insert into retailers (name, city, contact)
select name, city, contact from (values
  ('Pernia Designs',    'Mumbai',    '+91 98xxx 10001'),
  ('AZA Fashion',       'Mumbai',    '+91 98xxx 10002'),
  ('The Wedding House', 'New Delhi', '+91 98xxx 10003'),
  ('Royal Occasions',   'Jaipur',    '+91 98xxx 10004')
) as v(name, city, contact)
where not exists (select 1 from retailers where retailers.name = v.name);
