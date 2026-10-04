-- Phase 1: profiles + exercises.
-- Rule for every table in this app: user_id + row-level security, own rows only.

create type public.body_region as enum ('upper', 'lower');

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  height_cm        numeric(4,1) not null check (height_cm between 100 and 250),
  start_weight_kg  numeric(4,1) not null check (start_weight_kg between 30 and 300),
  goal_weight_kg   numeric(4,1) not null check (goal_weight_kg between 30 and 300),
  calorie_target   integer      not null check (calorie_target between 1000 and 6000),
  protein_target_g integer      not null check (protein_target_g between 40 and 400),
  step_target      integer               check (step_target between 0 and 60000),
  timezone         text         not null default 'UTC',
  onboarded_at     timestamptz  not null default now(),
  created_at       timestamptz  not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "profiles_delete_own" on public.profiles
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- --------------------------------------------------------------- exercises
-- Per-user list (not global). A default set is copied in at onboarding.
create table public.exercises (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  body_region public.body_region not null,
  target_sets integer not null default 3 check (target_sets between 1 and 10),
  target_reps integer not null default 5 check (target_reps between 1 and 30),
  archived    boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

create index exercises_user_id_idx on public.exercises (user_id);

alter table public.exercises enable row level security;

create policy "exercises_select_own" on public.exercises
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "exercises_insert_own" on public.exercises
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "exercises_update_own" on public.exercises
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "exercises_delete_own" on public.exercises
  for delete to authenticated
  using (user_id = (select auth.uid()));
