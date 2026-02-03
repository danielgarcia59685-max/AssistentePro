-- Migration 006: Add category text column fallback and sync with category_id

alter table if exists public.transactions
  add column if not exists category text;

-- Backfill category text from category_id when possible
update public.transactions t
set category = c.name
from public.categories c
where t.category is null
  and t.category_id is not null
  and c.id = t.category_id;

-- Keep category text in sync when category_id changes
create or replace function public.sync_transaction_category()
returns trigger as $$
begin
  if (new.category is null or length(trim(new.category)) = 0) and new.category_id is not null then
    select name into new.category from public.categories where id = new.category_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_transaction_category on public.transactions;
create trigger trg_sync_transaction_category
before insert or update on public.transactions
for each row
execute function public.sync_transaction_category();
