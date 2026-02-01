-- Migration 002: Create complete financial assistant database schema
-- This includes all tables for a full financial assistant system

-- 1. Users table
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  password_hash text,
  whatsapp_number text unique,
  timezone text default 'America/Sao_Paulo',
  currency text default 'BRL',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Categories table
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  type text not null, -- 'income' or 'expense'
  color text default '#3B82F6',
  created_at timestamptz default now()
);

-- 3. Cost centers
create table if not exists public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz default now()
);

-- 4. Transactions (updated schema)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  amount numeric not null,
  type text not null, -- 'income' or 'expense'
  category_id uuid references public.categories(id),
  cost_center_id uuid references public.cost_centers(id),
  description text,
  date text not null, -- ISO format: YYYY-MM-DD
  payment_method text default 'cash', -- 'pix', 'card', 'cash', 'transfer', 'check'
  client_name text, -- For income transactions (who paid)
  supplier_name text, -- For expense transactions (who received)
  notes text,
  inserted_at timestamptz default now()
);

-- 5. Accounts payable (contas a pagar)
create table if not exists public.accounts_payable (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  supplier_name text not null,
  amount numeric not null,
  due_date text not null, -- ISO format: YYYY-MM-DD
  category_id uuid references public.categories(id),
  description text,
  status text default 'pending', -- 'pending', 'paid', 'overdue'
  payment_date text,
  payment_method text,
  installments integer default 1,
  current_installment integer default 1,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 6. Accounts receivable (contas a receber)
create table if not exists public.accounts_receivable (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  client_name text not null,
  amount numeric not null,
  due_date text not null, -- ISO format: YYYY-MM-DD
  category_id uuid references public.categories(id),
  description text,
  status text default 'pending', -- 'pending', 'paid', 'overdue'
  payment_date text,
  payment_method text,
  installments integer default 1,
  current_installment integer default 1,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 7. Reminders (lembretes e reuniões)
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  reminder_type text not null, -- 'bill_payment', 'meeting', 'review', 'custom'
  due_date text not null, -- ISO format: YYYY-MM-DD
  due_time text, -- HH:MM format
  related_id uuid, -- Can reference accounts_payable, accounts_receivable, etc
  status text default 'pending', -- 'pending', 'sent', 'completed'
  send_notification boolean default true,
  notification_sent_at timestamptz,
  created_at timestamptz default now()
);

-- 8. Financial goals and planning
create table if not exists public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  target_amount numeric not null,
  current_amount numeric default 0,
  deadline text not null, -- ISO format: YYYY-MM-DD
  category text, -- 'savings', 'investment', 'debt_payment', 'purchase'
  description text,
  created_at timestamptz default now()
);

-- 9. Budget (orçamento)
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  category_id uuid references public.categories(id),
  month text not null, -- YYYY-MM format
  planned_amount numeric not null,
  spent_amount numeric default 0,
  created_at timestamptz default now()
);

-- 10. Messages log (para rastreabilidade)
create table if not exists public.messages_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  whatsapp_number text,
  message_type text, -- 'text', 'audio', 'image'
  original_message text,
  parsed_data jsonb,
  response text,
  created_at timestamptz default now()
);

-- Create indexes for better performance
create index if not exists idx_categories_user_id on public.categories (user_id);
create index if not exists idx_transactions_user_id on public.transactions (user_id);
create index if not exists idx_transactions_date on public.transactions (date);
create index if not exists idx_accounts_payable_user_id on public.accounts_payable (user_id);
create index if not exists idx_accounts_payable_due_date on public.accounts_payable (due_date);
create index if not exists idx_accounts_payable_status on public.accounts_payable (status);
create index if not exists idx_accounts_receivable_user_id on public.accounts_receivable (user_id);
create index if not exists idx_accounts_receivable_due_date on public.accounts_receivable (due_date);
create index if not exists idx_accounts_receivable_status on public.accounts_receivable (status);
create index if not exists idx_reminders_user_id on public.reminders (user_id);
create index if not exists idx_reminders_due_date on public.reminders (due_date);
create index if not exists idx_messages_log_user_id on public.messages_log (user_id);
