-- AirlineManagerNeo — database schema
--
-- Paste this whole file into the Supabase SQL editor and run it once.
-- It is idempotent: running it again is safe.
--
-- What it sets up:
--   profiles  one row per player, holding the display name
--   saves     savegames, one row per save slot per player
--   configs   saved aircraft presets and cabin/service configurations, one row
--             per configuration per player
--
-- ACCOUNTS ARE NOT CREATED HERE. Public sign-up is switched off on the project
-- (Authentication -> Sign In / Providers -> Email -> "Allow new users to sign
-- up" = off), and accounts are added by hand under Authentication -> Users.
-- There is no registration form in the game and no invite code to manage.
--
-- Row Level Security is what protects the data: the anon key shipped in the
-- browser bundle is a public identifier, not a secret. Every policy below is
-- scoped to auth.uid(), so a signed-in player can only ever touch their own
-- rows, no matter what requests the browser sends.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now()
);

create table if not exists public.saves (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  slot_id    text not null,
  name       text not null,
  payload    jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slot_id)
);

create index if not exists saves_user_updated_idx
  on public.saves (user_id, updated_at desc);

-- `kind` says which list a configuration belongs to ('aircraft_preset' or
-- 'cabin_config'); `config_id` is the id the game gave it; `payload` is the
-- configuration itself. The unique key also serves the game's lookups, which
-- always filter by user and kind.
create table if not exists public.configs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null,
  config_id  text not null,
  name       text not null,
  payload    jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind, config_id)
);

-- ---------------------------------------------------------------------------
-- Keep saves.updated_at honest
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists saves_touch_updated_at on public.saves;
create trigger saves_touch_updated_at
  before update on public.saves
  for each row execute function public.touch_updated_at();

drop trigger if exists configs_touch_updated_at on public.configs;
create trigger configs_touch_updated_at
  before update on public.configs
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.saves    enable row level security;
alter table public.configs  enable row level security;

drop policy if exists "read own profile"   on public.profiles;
drop policy if exists "create own profile" on public.profiles;
drop policy if exists "update own profile" on public.profiles;

create policy "read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- The app creates the profile itself on first sign-in. It cannot be done by a
-- trigger on auth.users: that table is owned by supabase_auth_admin, so postgres
-- is not allowed to put triggers on it.
create policy "create own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "read own saves"   on public.saves;
drop policy if exists "write own saves"  on public.saves;
drop policy if exists "update own saves" on public.saves;
drop policy if exists "delete own saves" on public.saves;

create policy "read own saves"
  on public.saves for select
  using (auth.uid() = user_id);

create policy "write own saves"
  on public.saves for insert
  with check (auth.uid() = user_id);

-- Without this one, overwriting an existing save silently does nothing: RLS
-- filters the row out of the UPDATE instead of raising an error.
create policy "update own saves"
  on public.saves for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete own saves"
  on public.saves for delete
  using (auth.uid() = user_id);

drop policy if exists "read own configs"   on public.configs;
drop policy if exists "write own configs"  on public.configs;
drop policy if exists "update own configs" on public.configs;
drop policy if exists "delete own configs" on public.configs;

create policy "read own configs"
  on public.configs for select
  using (auth.uid() = user_id);

create policy "write own configs"
  on public.configs for insert
  with check (auth.uid() = user_id);

-- Needed for the same reason as on saves: without it, saving over an existing
-- configuration silently does nothing.
create policy "update own configs"
  on public.configs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete own configs"
  on public.configs for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Everyday queries
-- ---------------------------------------------------------------------------
--
--   -- who has an account, and how many savegames and configurations do they have?
--   select u.email,
--          p.display_name,
--          u.created_at,
--          u.email_confirmed_at,
--          (select count(*) from public.saves s where s.user_id = u.id) as savegames,
--          (select count(*) from public.configs c where c.user_id = u.id) as configs
--     from auth.users u
--     left join public.profiles p on p.id = u.id
--    order by u.created_at;
--
--   -- set or change someone's in-game callsign
--   update auth.users
--      set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
--                               || jsonb_build_object('display_name', 'Captain Neo')
--    where email = 'someone@example.com';
--
-- Deleting an account is done under Authentication -> Users. Its savegames and
-- configurations go with it, via `on delete cascade` above.
