-- Phase 2: daily logs + weekly wellbeing check-ins. user_id + RLS on both.

create type public.diet_followed as enum ('yes', 'mostly', 'no');

-- -------------------------------------------------------------- daily_logs
-- One row per user per day. Every field except the date is optional.
create table public.daily_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  log_date      date not null,
  bodyweight_kg numeric(4,1) check (bodyweight_kg between 30 and 300),
  steps         integer      check (steps between 0 and 100000),
  sleep_hours   numeric(3,1) check (sleep_hours between 0 and 24),
  diet_followed public.diet_followed,
  hunger        smallint     check (hunger between 1 and 5),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, log_date)
);

alter table public.daily_logs enable row level security;

create policy "daily_logs_select_own" on public.daily_logs
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "daily_logs_insert_own" on public.daily_logs
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "daily_logs_update_own" on public.daily_logs
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "daily_logs_delete_own" on public.daily_logs
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ------------------------------------------------------ wellbeing_checkins
-- One row per user per week; week_start is the Monday of that week.
create table public.wellbeing_checkins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  mood       smallint not null check (mood between 1 and 5),
  energy     smallint not null check (energy between 1 and 5),
  motivation smallint not null check (motivation between 1 and 5),
  created_at timestamptz not null default now(),
  unique (user_id, week_start),
  check (extract(isodow from week_start) = 1)
);

alter table public.wellbeing_checkins enable row level security;

create policy "wellbeing_select_own" on public.wellbeing_checkins
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "wellbeing_insert_own" on public.wellbeing_checkins
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "wellbeing_update_own" on public.wellbeing_checkins
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "wellbeing_delete_own" on public.wellbeing_checkins
  for delete to authenticated
  using (user_id = (select auth.uid()));
