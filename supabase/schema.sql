-- SafeShip database schema
-- Run this in the Supabase SQL editor. Idempotent — safe to re-run.

-- =====================================================================
-- extensions
-- =====================================================================
create extension if not exists "pgcrypto";

-- =====================================================================
-- Stage 1: waitlist (email capture from landing page)
-- =====================================================================
create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  created_at  timestamptz not null default now(),
  source      text default 'landing',
  ip          inet,
  user_agent  text
);

create unique index if not exists waitlist_email_lower_idx
  on public.waitlist (lower(email));

alter table public.waitlist enable row level security;
drop policy if exists "service-role-insert" on public.waitlist;
create policy "service-role-insert" on public.waitlist
  for insert to service_role with check (true);

-- =====================================================================
-- Stage 2: users, projects (with api_key), api_keys log
-- Identity comes from Clerk. We mirror the user_id (Clerk user id) here.
-- =====================================================================
create table if not exists public.users (
  id              text primary key,                       -- Clerk user id (user_xxx)
  email           text not null,
  created_at      timestamptz not null default now(),
  subscription_status text not null default 'none'         -- none | trialing | active | past_due | canceled
);

-- Subscription columns — added via ALTER for forward-compat with v1 schema
alter table public.users add column if not exists stripe_customer_id      text;
alter table public.users add column if not exists stripe_subscription_id  text;
alter table public.users add column if not exists current_period_end      timestamptz;
alter table public.users add column if not exists trial_ends_at           timestamptz;
alter table public.users add column if not exists cancel_at_period_end    boolean not null default false;

-- Migration: an earlier version of this file had `default 'trial'` on
-- subscription_status. The `create table if not exists` above is a no-op
-- on existing tables, so when we changed the default to 'none' the running
-- DB kept the old 'trial' default and every new signup got that status —
-- bypassing the access gate. Force the default to 'none' and rewrite any
-- legacy 'trial' rows to the intended starting state. Idempotent.
alter table public.users alter column subscription_status set default 'none';
update public.users set subscription_status = 'none' where subscription_status = 'trial';

create unique index if not exists users_stripe_customer_idx
  on public.users (stripe_customer_id)
  where stripe_customer_id is not null;
create unique index if not exists users_stripe_subscription_idx
  on public.users (stripe_subscription_id)
  where stripe_subscription_id is not null;

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null references public.users(id) on delete cascade,
  name        text not null,
  environment text not null default 'prod',
  api_key     text not null unique,                        -- sk_live_xxx
  created_at  timestamptz not null default now(),
  first_trace_at timestamptz                                -- set on first trace ingestion
);

-- Per-project notification settings. Defaults: email alerts on, no Slack
-- webhook (user adds one via /app/onboarding if they want it).
alter table public.projects add column if not exists alerts_enabled boolean not null default true;
alter table public.projects add column if not exists slack_webhook_url text;

create index if not exists projects_user_idx on public.projects (user_id);

-- =====================================================================
-- Stage 3+: runs / traces (one row per agent run, child rows per step)
-- Commented-out body left so the next migration is one diff away.
-- =====================================================================
create table if not exists public.runs (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  trigger      text not null default 'production',         -- deploy | scheduled | production | manual
  score        int,                                         -- 0-100 regression score
  status       text not null default 'ok',                  -- ok | warn | fail
  started_at   timestamptz not null default now(),
  duration_ms  int,
  model        text
);

create index if not exists runs_project_started_idx
  on public.runs (project_id, started_at desc);

create table if not exists public.traces (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null references public.runs(id) on delete cascade,
  step_index   int not null,
  tool_name    text,
  kind         text,                                        -- llm | tool | retry
  input        jsonb,
  output       jsonb,
  duration_ms  int,
  status       text                                          -- ok | warn | fail
);

create index if not exists traces_run_idx on public.traces (run_id, step_index);

-- =====================================================================
-- Stage 5+: suggested_tests / tests / test_runs
-- =====================================================================
create table if not exists public.suggested_tests (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  trace_id      uuid references public.traces(id) on delete set null,
  name          text not null,
  plain_english text,
  code_yaml     text,
  status        text not null default 'pending',            -- pending | accepted | skipped
  created_at    timestamptz not null default now()
);

-- Stage 5 columns — added via ALTER for forward-compat with v1 schema
alter table public.suggested_tests add column if not exists run_id uuid;
alter table public.suggested_tests add column if not exists severity text;
alter table public.suggested_tests add column if not exists rationale text;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'suggested_tests_run_id_fkey'
  ) then
    alter table public.suggested_tests
      add constraint suggested_tests_run_id_fkey
      foreign key (run_id) references public.runs(id) on delete set null;
  end if;
end$$;

create index if not exists suggested_tests_project_idx
  on public.suggested_tests (project_id, status, created_at desc);
create index if not exists suggested_tests_run_idx
  on public.suggested_tests (run_id);

create table if not exists public.tests (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  name          text not null,
  plain_english text,
  code_yaml     text,
  status        text not null default 'active',             -- active | muted | deleted
  created_at    timestamptz not null default now()
);

-- Phase-2 columns: when a suggestion is accepted, we also denormalize the
-- top-level input of the failing run (the args/kwargs the agent was called
-- with). The CI test runner re-invokes the customer's agent with this
-- payload to check whether the same regression would recur. `origin_run_id`
-- points back at the run the test was generated from so we can deep-link
-- the original failure in PR comments and the dashboard.
alter table public.tests add column if not exists replay_input  jsonb;
alter table public.tests add column if not exists origin_run_id uuid;

-- Phase-3 column: cached LLM HTTP calls captured by the auto-instrument
-- transport at recording time. Each entry is one Anthropic or OpenAI call:
-- {index, host, path, request_body, response_status, response_body,
--  response_headers, duration_ms}. The CI replayer matches on
-- (index, sha256(canonical_request_body)) and returns the cached
-- response — making CI runs $0 at the LLM-call layer. Nullable for
-- backwards compat: tests accepted before Phase 3 fall back to live LLM
-- calls (current Phase 2 behavior).
alter table public.tests add column if not exists cached_llm_calls jsonb;
alter table public.runs  add column if not exists cached_llm_calls jsonb;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tests_origin_run_id_fkey'
  ) then
    alter table public.tests
      add constraint tests_origin_run_id_fkey
      foreign key (origin_run_id) references public.runs(id) on delete set null;
  end if;
end$$;

create index if not exists tests_project_idx on public.tests (project_id, status);

create table if not exists public.test_runs (
  id           uuid primary key default gen_random_uuid(),
  test_id      uuid not null references public.tests(id) on delete cascade,
  run_id       uuid not null references public.runs(id) on delete cascade,
  passed       boolean not null,
  duration_ms  int,
  created_at   timestamptz not null default now()
);

create index if not exists test_runs_test_idx on public.test_runs (test_id, created_at desc);

-- =====================================================================
-- Notification log: throttling source-of-truth for email + Slack alerts.
-- Each row = one notification we successfully dispatched. Throttle queries
-- (max-per-window) read this table; cleanup is best-effort (we don't
-- delete; the table is small because of per-project throttle limits).
-- =====================================================================
create table if not exists public.notification_log (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  channel     text not null,                                -- 'email' | 'slack'
  kind        text not null default 'failure_alert',        -- 'failure_alert' | future kinds
  run_id      uuid references public.runs(id) on delete set null,
  sent_at     timestamptz not null default now()
);

create index if not exists notification_log_project_channel_sent_idx
  on public.notification_log (project_id, channel, sent_at desc);

alter table public.notification_log enable row level security;

-- =====================================================================
-- Health checks: synthetic ingest pings recorded by the Vercel cron at
-- /api/cron/ingest-ping. /status reads the last hour and computes p95.
-- Rows are deleted by the same cron after 24h so the table stays tiny.
-- =====================================================================
create table if not exists public.health_checks (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null,                              -- 'ingest_synthetic' | future kinds
  ok           boolean not null,
  duration_ms  integer not null,
  detail       text,
  checked_at   timestamptz not null default now()
);

create index if not exists health_checks_kind_checked_idx
  on public.health_checks (kind, checked_at desc);

alter table public.health_checks enable row level security;

-- =====================================================================
-- Row Level Security: all reads go through server actions / API routes
-- using the service role. We enable RLS to defend against direct anon
-- access — no anon policies are created.
-- =====================================================================
alter table public.users           enable row level security;
alter table public.projects        enable row level security;
alter table public.runs            enable row level security;
alter table public.traces          enable row level security;
alter table public.suggested_tests enable row level security;
alter table public.tests           enable row level security;
alter table public.test_runs       enable row level security;

-- Tell PostgREST to refresh its schema cache after running migrations.
-- Without this, freshly-created tables sometimes 404 with PGRST205 until
-- the cache TTL expires. Idempotent — safe to re-run.
notify pgrst, 'reload schema';
