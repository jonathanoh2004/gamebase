-- Gamebase core schema (docs/DESIGN.md §7, §8).
--
-- Everything lives in the private `app` schema, which Supabase's Data API does
-- not expose, and nothing here is granted to `anon` or `authenticated`: the
-- browser cannot query these tables at all. The Next.js server connects as
-- `gamebase_app`, a role that can read and write these tables and nothing else.

create schema if not exists app;
revoke all on schema app from public;

do $$
begin
  if not exists (select from pg_roles where rolname = 'gamebase_app') then
    -- LOGIN and a password are added by hand during setup (docs/SETUP.md),
    -- so no credential ever lives in a migration.
    create role gamebase_app nologin;
  end if;
end $$;

grant usage on schema app to gamebase_app;

-- Profiles ------------------------------------------------------------------

create table app.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default ''
    check (char_length(display_name) <= 24 and display_name !~ '[[:cntrl:]]'),
  avatar_seed text not null check (avatar_seed ~ '^[a-z0-9]{8,32}$'),
  color text not null default 'yellow'
    check (color in ('red', 'orange', 'yellow', 'green', 'teal', 'blue', 'violet', 'pink')),
  role text not null default 'pending'
    check (role in ('pending', 'member', 'owner', 'revoked')),
  invited_by uuid references app.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Rooms ---------------------------------------------------------------------

create table app.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[A-HJ-NP-Z2-9]{4}$'),
  game_id text not null check (game_id ~ '^[a-z0-9-]{1,40}$'),
  host_id uuid references app.profiles (id) on delete set null,
  status text not null default 'lobby'
    check (status in ('lobby', 'playing', 'finished', 'abandoned')),
  locked boolean not null default false,
  allow_spectators boolean not null default true,
  options jsonb not null default '{}'::jsonb check (jsonb_typeof(options) = 'object'),
  lobby_version integer not null default 0,
  current_match_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rooms_host_idx on app.rooms (host_id);

create table app.room_seats (
  room_id uuid not null references app.rooms (id) on delete cascade,
  seat integer not null check (seat between 0 and 15),
  user_id uuid not null references app.profiles (id) on delete cascade,
  color text not null
    check (color in ('red', 'orange', 'yellow', 'green', 'teal', 'blue', 'violet', 'pink')),
  ready boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (room_id, seat),
  unique (room_id, user_id),
  unique (room_id, color)
);

create index room_seats_user_idx on app.room_seats (user_id);

-- Invites -------------------------------------------------------------------
-- One-time links. Only a SHA-256 of the token is stored, so a database leak
-- exposes no working invite.

create table app.invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references app.profiles (id) on delete cascade,
  room_id uuid references app.rooms (id) on delete set null,
  expires_at timestamptz not null,
  used_by uuid references app.profiles (id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index invites_created_by_idx on app.invites (created_by);

-- Matches -------------------------------------------------------------------
-- `seed` and `state` never leave the server: clients only ever receive
-- per-seat views computed by the game engine.

create table app.matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references app.rooms (id) on delete cascade,
  game_id text not null,
  engine_version integer not null,
  seed text not null check (seed ~ '^[0-9a-f]{32,64}$'),
  seats jsonb not null check (jsonb_typeof(seats) = 'array'),
  state jsonb not null,
  version integer not null default 0,
  outcome jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index matches_room_idx on app.matches (room_id);

alter table app.rooms
  add constraint rooms_current_match_fk
  foreign key (current_match_id) references app.matches (id) on delete set null;

create table app.match_actions (
  match_id uuid not null references app.matches (id) on delete cascade,
  version integer not null check (version >= 0),
  seat integer,
  action jsonb not null,
  events jsonb not null check (jsonb_typeof(events) = 'array'),
  state_after jsonb not null,
  created_at timestamptz not null default now(),
  primary key (match_id, version)
);

-- Rate limiting ---------------------------------------------------------------

create table app.rate_limits (
  key text not null check (char_length(key) <= 200),
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

-- Access ----------------------------------------------------------------------
-- Row-level security is on everywhere as a second wall. The only policies
-- admit the server role; every other role (anon, authenticated) is refused.

grant select, insert, update, delete on
  app.profiles, app.rooms, app.room_seats, app.invites,
  app.matches, app.match_actions, app.rate_limits
to gamebase_app;

alter table app.profiles enable row level security;
alter table app.rooms enable row level security;
alter table app.room_seats enable row level security;
alter table app.invites enable row level security;
alter table app.matches enable row level security;
alter table app.match_actions enable row level security;
alter table app.rate_limits enable row level security;

create policy server_only on app.profiles to gamebase_app using (true) with check (true);
create policy server_only on app.rooms to gamebase_app using (true) with check (true);
create policy server_only on app.room_seats to gamebase_app using (true) with check (true);
create policy server_only on app.invites to gamebase_app using (true) with check (true);
create policy server_only on app.matches to gamebase_app using (true) with check (true);
create policy server_only on app.match_actions to gamebase_app using (true) with check (true);
create policy server_only on app.rate_limits to gamebase_app using (true) with check (true);
