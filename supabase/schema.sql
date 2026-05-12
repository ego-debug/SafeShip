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
  subscription_status text not null default 'trial'        -- trial | active | canceled
);

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null references public.users(id) on delete cascade,
  name        text not null,
  environment text not null default 'prod',
  api_key     text not null unique,                        -- sk_live_xxx
  created_at  timestamptz not null default now(),
  first_trace_at timestamptz                                -- set on first trace ingestion
);

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
