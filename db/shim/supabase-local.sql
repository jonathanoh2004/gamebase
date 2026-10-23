-- LOCAL DEVELOPMENT AND TESTS ONLY. Never run this against Supabase.
--
-- Recreates the small slice of Supabase that our migrations depend on, so the
-- same migrations run unchanged on a plain Postgres:
--   * the anon / authenticated roles
--   * auth.users and auth.uid()
--   * realtime.messages, realtime.topic() and realtime.send()
-- realtime.send() is backed by pg_notify; the local dev server forwards those
-- notifications to browsers over server-sent events.

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text unique,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create schema if not exists realtime;

create table if not exists realtime.messages (
  id bigserial primary key,
  topic text not null,
  extension text not null,
  event text,
  payload jsonb,
  private boolean not null default true,
  inserted_at timestamptz not null default now()
);

alter table realtime.messages enable row level security;

create or replace function realtime.topic() returns text
language sql stable
as $$
  select nullif(current_setting('realtime.topic', true), '')
$$;

create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void
language sql
as $$
  select pg_notify(
    'gb_realtime',
    json_build_object('topic', topic, 'event', event, 'payload', payload)::text
  )
$$;
