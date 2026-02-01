-- Migration: Create transactions table
-- Run this in Supabase SQL Editor or via psql/CLI

create extension if not exists "pgcrypto";

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  amount numeric not null,
  type text not null default 'expense', -- 'income' or 'expense'
  category text,
  description text,
  date text not null, -- ISO date format: YYYY-MM-DD
  payment_method text default 'cash', -- 'pix', 'card', 'cash', 'transfer'
  inserted_at timestamptz default now()
);

-- Optional: create an index for user queries
create index if not exists idx_transactions_user_id on public.transactions (user_id);
create index if not exists idx_transactions_date on public.transactions (date);
