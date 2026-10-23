-- Realtime doorbells and channel authorization (docs/DESIGN.md §4.2, §8.3).
--
-- Each room has one private channel, `room:<room id>`. The database rings it
-- when something changes; the message carries only a version number, never
-- game data. Clients then fetch their own redacted view over HTTPS.

-- Who may join a room's channel: members who are seated in the room, or any
-- member when the room allows spectators. It lives in its own tiny schema so
-- the `authenticated` role (which Realtime evaluates policies as) never gets
-- any access to `app`. It runs with a fixed, empty search_path so it can't be
-- hijacked through a user-controlled schema.
create schema if not exists app_realtime;
revoke all on schema app_realtime from public;
grant usage on schema app_realtime to authenticated;

create or replace function app_realtime.can_join_room_topic(topic text) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app.rooms r
    join app.profiles p on p.id = auth.uid()
    where topic = 'room:' || r.id::text
      and p.role in ('member', 'owner')
      and (
        r.allow_spectators
        or exists (
          select 1 from app.room_seats s where s.room_id = r.id and s.user_id = p.id
        )
      )
  )
$$;

revoke all on function app_realtime.can_join_room_topic(text) from public;
grant execute on function app_realtime.can_join_room_topic(text) to authenticated;

-- Lobby doorbell: rings whenever the server bumps rooms.lobby_version.
create or replace function app.ring_lobby() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('v', new.lobby_version),
    'lobby',
    'room:' || new.id::text,
    true
  );
  return null;
end
$$;

revoke all on function app.ring_lobby() from public;

create trigger rooms_ring_lobby
  after update of lobby_version on app.rooms
  for each row
  when (new.lobby_version is distinct from old.lobby_version)
  execute function app.ring_lobby();

-- Match doorbell: rings once per committed move (and once when a match starts).
create or replace function app.ring_match() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room uuid;
begin
  select m.room_id into v_room from app.matches m where m.id = new.match_id;
  perform realtime.send(
    jsonb_build_object('v', new.version, 'match', new.match_id),
    'match',
    'room:' || v_room::text,
    true
  );
  return null;
end
$$;

revoke all on function app.ring_match() from public;

create trigger match_actions_ring
  after insert on app.match_actions
  for each row
  execute function app.ring_match();

-- Channel policies. Realtime checks these when a client joins a private
-- channel. Messages that clients send (hovers, emotes, presence) are treated
-- as untrusted decoration by the app and can never change game state.
create policy "gamebase members receive room messages"
  on realtime.messages
  for select
  to authenticated
  using (app_realtime.can_join_room_topic((select realtime.topic())));

create policy "gamebase members send room messages"
  on realtime.messages
  for insert
  to authenticated
  with check (
    app_realtime.can_join_room_topic((select realtime.topic()))
    and realtime.messages.extension in ('broadcast', 'presence')
  );
