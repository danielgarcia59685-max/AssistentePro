-- Migration 005: Enable RLS and add policies for per-user access

-- Enable Row Level Security (RLS)
alter table if exists public.users enable row level security;
alter table if exists public.categories enable row level security;
alter table if exists public.cost_centers enable row level security;
alter table if exists public.transactions enable row level security;
alter table if exists public.accounts_payable enable row level security;
alter table if exists public.accounts_receivable enable row level security;
alter table if exists public.reminders enable row level security;
alter table if exists public.financial_goals enable row level security;
alter table if exists public.budgets enable row level security;
alter table if exists public.messages_log enable row level security;
alter table if exists public.phone_verifications enable row level security;

-- Users table policies
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users
  for select
  using (auth.uid() = id);

drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own" on public.users
  for insert
  with check (auth.uid() = id);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "users_delete_own" on public.users;
create policy "users_delete_own" on public.users
  for delete
  using (auth.uid() = id);

-- Generic per-user policies
-- Categories
drop policy if exists "categories_select_own" on public.categories;
create policy "categories_select_own" on public.categories
  for select
  using (auth.uid() = user_id);

drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own" on public.categories
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own" on public.categories
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own" on public.categories
  for delete
  using (auth.uid() = user_id);

-- Cost centers
drop policy if exists "cost_centers_select_own" on public.cost_centers;
create policy "cost_centers_select_own" on public.cost_centers
  for select
  using (auth.uid() = user_id);

drop policy if exists "cost_centers_insert_own" on public.cost_centers;
create policy "cost_centers_insert_own" on public.cost_centers
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "cost_centers_update_own" on public.cost_centers;
create policy "cost_centers_update_own" on public.cost_centers
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "cost_centers_delete_own" on public.cost_centers;
create policy "cost_centers_delete_own" on public.cost_centers
  for delete
  using (auth.uid() = user_id);

-- Transactions
drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own" on public.transactions
  for select
  using (auth.uid() = user_id);

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own" on public.transactions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own" on public.transactions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own" on public.transactions
  for delete
  using (auth.uid() = user_id);

-- Accounts payable
drop policy if exists "accounts_payable_select_own" on public.accounts_payable;
create policy "accounts_payable_select_own" on public.accounts_payable
  for select
  using (auth.uid() = user_id);

drop policy if exists "accounts_payable_insert_own" on public.accounts_payable;
create policy "accounts_payable_insert_own" on public.accounts_payable
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "accounts_payable_update_own" on public.accounts_payable;
create policy "accounts_payable_update_own" on public.accounts_payable
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "accounts_payable_delete_own" on public.accounts_payable;
create policy "accounts_payable_delete_own" on public.accounts_payable
  for delete
  using (auth.uid() = user_id);

-- Accounts receivable
drop policy if exists "accounts_receivable_select_own" on public.accounts_receivable;
create policy "accounts_receivable_select_own" on public.accounts_receivable
  for select
  using (auth.uid() = user_id);

drop policy if exists "accounts_receivable_insert_own" on public.accounts_receivable;
create policy "accounts_receivable_insert_own" on public.accounts_receivable
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "accounts_receivable_update_own" on public.accounts_receivable;
create policy "accounts_receivable_update_own" on public.accounts_receivable
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "accounts_receivable_delete_own" on public.accounts_receivable;
create policy "accounts_receivable_delete_own" on public.accounts_receivable
  for delete
  using (auth.uid() = user_id);

-- Reminders
drop policy if exists "reminders_select_own" on public.reminders;
create policy "reminders_select_own" on public.reminders
  for select
  using (auth.uid() = user_id);

drop policy if exists "reminders_insert_own" on public.reminders;
create policy "reminders_insert_own" on public.reminders
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "reminders_update_own" on public.reminders;
create policy "reminders_update_own" on public.reminders
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "reminders_delete_own" on public.reminders;
create policy "reminders_delete_own" on public.reminders
  for delete
  using (auth.uid() = user_id);

-- Financial goals
drop policy if exists "financial_goals_select_own" on public.financial_goals;
create policy "financial_goals_select_own" on public.financial_goals
  for select
  using (auth.uid() = user_id);

drop policy if exists "financial_goals_insert_own" on public.financial_goals;
create policy "financial_goals_insert_own" on public.financial_goals
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "financial_goals_update_own" on public.financial_goals;
create policy "financial_goals_update_own" on public.financial_goals
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "financial_goals_delete_own" on public.financial_goals;
create policy "financial_goals_delete_own" on public.financial_goals
  for delete
  using (auth.uid() = user_id);

-- Budgets
drop policy if exists "budgets_select_own" on public.budgets;
create policy "budgets_select_own" on public.budgets
  for select
  using (auth.uid() = user_id);

drop policy if exists "budgets_insert_own" on public.budgets;
create policy "budgets_insert_own" on public.budgets
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "budgets_update_own" on public.budgets;
create policy "budgets_update_own" on public.budgets
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "budgets_delete_own" on public.budgets;
create policy "budgets_delete_own" on public.budgets
  for delete
  using (auth.uid() = user_id);

-- Messages log
drop policy if exists "messages_log_select_own" on public.messages_log;
create policy "messages_log_select_own" on public.messages_log
  for select
  using (auth.uid() = user_id);

drop policy if exists "messages_log_insert_own" on public.messages_log;
create policy "messages_log_insert_own" on public.messages_log
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "messages_log_update_own" on public.messages_log;
create policy "messages_log_update_own" on public.messages_log
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "messages_log_delete_own" on public.messages_log;
create policy "messages_log_delete_own" on public.messages_log
  for delete
  using (auth.uid() = user_id);

-- Phone verifications
drop policy if exists "phone_verifications_select_own" on public.phone_verifications;
create policy "phone_verifications_select_own" on public.phone_verifications
  for select
  using (auth.uid() = user_id);

drop policy if exists "phone_verifications_insert_own" on public.phone_verifications;
create policy "phone_verifications_insert_own" on public.phone_verifications
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "phone_verifications_update_own" on public.phone_verifications;
create policy "phone_verifications_update_own" on public.phone_verifications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "phone_verifications_delete_own" on public.phone_verifications;
create policy "phone_verifications_delete_own" on public.phone_verifications
  for delete
  using (auth.uid() = user_id);