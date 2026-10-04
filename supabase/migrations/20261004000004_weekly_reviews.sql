-- Phase 4: weekly reviews. One row per finished week: the decision, the numbers
-- behind it, and the targets before/after. user_id + RLS like every other table.

create table public.weekly_reviews (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  week_start            date not null check (extract(isodow from week_start) = 1),
  outcome               text not null check (outcome in (
                          'insufficient_data', 'diet_break', 'too_fast', 'raise_calories',
                          'simplify', 'on_track', 'stall_watch', 'ladder_step')),
  message               text not null,
  avg_weight_kg         numeric(5,2),
  prev_avg_weight_kg    numeric(5,2),
  loss_rate_pct         numeric(5,2),
  adherence_pct         numeric(4,1) not null,
  ladder_rung           smallint not null default 0 check (ladder_rung between 0 and 4),
  calorie_target_before integer not null,
  calorie_target_after  integer not null check (calorie_target_after >= 1800),
  step_target_before    integer,
  step_target_after     integer,
  inputs                jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  unique (user_id, week_start)
);

create index weekly_reviews_user_week_idx on public.weekly_reviews (user_id, week_start desc);

alter table public.weekly_reviews enable row level security;

create policy "reviews_select_own" on public.weekly_reviews
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "reviews_insert_own" on public.weekly_reviews
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "reviews_update_own" on public.weekly_reviews
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "reviews_delete_own" on public.weekly_reviews
  for delete to authenticated
  using (user_id = (select auth.uid()));
