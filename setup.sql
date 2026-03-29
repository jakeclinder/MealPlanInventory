-- Kitchen Hub — Supabase setup
-- Run this once in your Supabase project:
--   Dashboard → SQL Editor → New query → paste → Run
--
-- One row per user per key (keys are "kitchen:inventory" and "kitchen:mealplan").
-- Data is stored as JSONB blobs — no normalisation needed.

create table if not exists user_data (
  id          uuid        default gen_random_uuid() primary key,
  user_id     uuid        references auth.users(id) on delete cascade not null,
  key         text        not null,
  value       jsonb       not null,
  updated_at  timestamptz default now() not null,
  unique(user_id, key)
);

-- Row-level security: each user can only see and touch their own rows.
alter table user_data enable row level security;

create policy "Users can read own data"
  on user_data for select
  using (auth.uid() = user_id);

create policy "Users can insert own data"
  on user_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update own data"
  on user_data for update
  using (auth.uid() = user_id);
