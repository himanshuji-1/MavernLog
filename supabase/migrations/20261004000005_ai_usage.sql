-- Phase 6: per-user usage log for the Gemini endpoints, so each user can be
-- rate-limited (serverless functions can't keep counters in memory).
-- Rows hold no user text: only who called which feature, and when.

create table public.ai_usage (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('quick_log', 'explain')),
  created_at timestamptz not null default now()
);

create index ai_usage_user_time_idx on public.ai_usage (user_id, created_at desc);

alter table public.ai_usage enable row level security;

create policy "ai_usage_select_own" on public.ai_usage
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "ai_usage_insert_own" on public.ai_usage
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "ai_usage_delete_own" on public.ai_usage
  for delete to authenticated
  using (user_id = (select auth.uid()));
