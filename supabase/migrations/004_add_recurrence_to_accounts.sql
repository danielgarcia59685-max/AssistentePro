-- Migration: add recurrence fields to accounts_payable and accounts_receivable
ALTER TABLE IF EXISTS accounts_payable
  ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_interval text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS recurrence_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recurrence_end_date timestamptz;

ALTER TABLE IF EXISTS accounts_receivable
  ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_interval text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS recurrence_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recurrence_end_date timestamptz;
