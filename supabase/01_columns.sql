-- Step 1 of 6: add new-format columns (safe to run more than once)
alter table ready_stock add column if not exists style_code     text    not null default '';
alter table ready_stock add column if not exists color          text    not null default '';
alter table ready_stock add column if not exists size           text    not null default '';
alter table ready_stock add column if not exists received_stock numeric not null default 0;
alter table styles      add column if not exists color          text    not null default '';
alter table styles      add column if not exists size           text    not null default '';
create index if not exists idx_ready_stock_style on ready_stock (lower(style_code));
