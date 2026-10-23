-- LOCAL ONLY. Never run against Supabase.
--
-- Lets the app role log in to the throwaway dev/test database, and lets the
-- local dev sign-in stand in for Supabase Auth by managing auth.users. In
-- production the app role has no access to the auth schema at all.
alter role gamebase_app with login password 'gamebase_app_local';
grant usage on schema auth to gamebase_app;
grant select, insert, delete on auth.users to gamebase_app;
