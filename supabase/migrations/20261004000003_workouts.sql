-- Phase 3: workout sessions + sets. user_id + RLS on both.
-- Inserts also verify that the referenced session / exercise belong to the same
-- user, so a crafted request can't attach a set to someone else's rows.

create table public.workout_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  performed_on date not null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index workout_sessions_user_date_idx
  on public.workout_sessions (user_id, performed_on desc);

alter table public.workout_sessions enable row level security;

create policy "sessions_select_own" on public.workout_sessions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "sessions_insert_own" on public.workout_sessions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "sessions_update_own" on public.workout_sessions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "sessions_delete_own" on public.workout_sessions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ------------------------------------------------------------ workout_sets
create table public.workout_sets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  session_id  uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  set_number  smallint not null check (set_number between 1 and 30),
  weight_kg   numeric(5,1) not null check (weight_kg between 0 and 1000),
  reps        smallint not null check (reps between 1 and 100),
  rir         smallint not null check (rir between 0 and 5),
  created_at  timestamptz not null default now(),
  unique (session_id, exercise_id, set_number)
);

create index workout_sets_user_exercise_idx
  on public.workout_sets (user_id, exercise_id);
create index workout_sets_session_idx
  on public.workout_sets (session_id);

alter table public.workout_sets enable row level security;

create policy "sets_select_own" on public.workout_sets
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "sets_insert_own" on public.workout_sets
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.exercises e
      where e.id = exercise_id and e.user_id = (select auth.uid())
    )
  );

create policy "sets_update_own" on public.workout_sets
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.exercises e
      where e.id = exercise_id and e.user_id = (select auth.uid())
    )
  );

create policy "sets_delete_own" on public.workout_sets
  for delete to authenticated
  using (user_id = (select auth.uid()));
