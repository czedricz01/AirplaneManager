-- AirlineManagerNeo — database schema
--
-- Paste this whole file into the Supabase SQL editor and run it once.
-- It is idempotent: running it again is safe.
--
-- What it sets up:
--   profiles      one row per player, holding the display name
--   saves         savegames, one row per save slot per player
--   invite_codes  codes that authorise a sign-up
--
-- Row Level Security is what actually protects the data: the anon key shipped in
-- the browser bundle is a public identifier, not a secret. Every policy below is
-- scoped to auth.uid(), so a signed-in player can only ever touch their own rows,
-- no matter what requests the browser sends.
--
-- AFTER RUNNING THIS, one step remains that SQL cannot do:
--   Authentication -> Hooks -> Before User Created -> Postgres ->
--   public.hook_enforce_invite_code  -> Enable
-- Until that hook is enabled, sign-ups are NOT restricted by invite code.

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

create table if not exists public.invite_codes (
  code       text primary key,
  note       text,
  max_uses   integer not null default 1 check (max_uses > 0),
  uses       integer not null default 0 check (uses >= 0),
  expires_at timestamptz,
  created_at timestamptz not null default now()
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

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles     enable row level security;
alter table public.saves        enable row level security;
alter table public.invite_codes enable row level security;

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

-- invite_codes deliberately gets NO policy. With RLS on and no policy, neither
-- anon nor authenticated can read or write it, so codes cannot be enumerated
-- from the browser. Supabase's linter flags this as "RLS enabled, no policy" —
-- here that is the intended configuration, not an oversight.

-- ---------------------------------------------------------------------------
-- Invite code enforcement — Before User Created hook
-- ---------------------------------------------------------------------------
--
-- Supabase Auth calls this with the pending user before writing it. Returning an
-- error object rejects the sign-up; returning '{}' lets it through.
--
-- This replaces what would normally be a BEFORE INSERT trigger on auth.users.
-- That is not possible on Supabase: auth.users is owned by supabase_auth_admin,
-- so `create trigger` on it fails for the postgres role. The hook is the
-- supported equivalent.
-- https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook
--
-- The check runs on the server, in the database. The browser never performs it
-- and therefore cannot skip it.

create or replace function public.hook_enforce_invite_code(event jsonb)
returns jsonb
language plpgsql
set search_path = public, auth, pg_temp
as $$
declare
  v_code  text := coalesce(nullif(trim(event->'user'->'user_metadata'->>'invite_code'), ''), '');
  v_email text := lower(coalesce(event->'user'->>'email', ''));
  v_row   public.invite_codes%rowtype;
begin
  if v_code = '' then
    return jsonb_build_object('error', jsonb_build_object(
      'message', 'An invite code is required to create an account.', 'http_code', 403));
  end if;

  -- Checked before the code is consumed, so a duplicate email does not burn it.
  if v_email <> '' and exists (select 1 from auth.users u where lower(u.email) = v_email) then
    return jsonb_build_object('error', jsonb_build_object(
      'message', 'An account with that email already exists.', 'http_code', 409));
  end if;

  select * into v_row
    from public.invite_codes
   where upper(code) = upper(v_code)
     for update;

  if not found then
    return jsonb_build_object('error', jsonb_build_object(
      'message', 'That invite code does not exist.', 'http_code', 403));
  end if;

  if v_row.expires_at is not null and v_row.expires_at < now() then
    return jsonb_build_object('error', jsonb_build_object(
      'message', 'That invite code has expired.', 'http_code', 403));
  end if;

  if v_row.uses >= v_row.max_uses then
    return jsonb_build_object('error', jsonb_build_object(
      'message', 'That invite code has already been used up.', 'http_code', 403));
  end if;

  update public.invite_codes set uses = uses + 1 where code = v_row.code;

  return '{}'::jsonb;
end;
$$;

-- Only Supabase Auth may call the hook, and it needs to read and count the codes.
grant execute on function public.hook_enforce_invite_code(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_enforce_invite_code(jsonb) from public, anon, authenticated;
grant select, update on table public.invite_codes to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- Creating invite codes
-- ---------------------------------------------------------------------------
--
--   select public.new_invite_code('for Anna');            -- single use, no expiry
--   select public.new_invite_code('flight crew', 5, 30);  -- 5 uses, valid 30 days
--
-- Or by hand:
--   insert into public.invite_codes (code, note) values ('NEO-2026-ABC', 'a friend');
--
-- Review and withdraw:
--   select code, uses, max_uses, expires_at, note from public.invite_codes order by created_at;
--   delete from public.invite_codes where code = 'NEO-CREW';

create or replace function public.new_invite_code(
  p_note     text    default null,
  p_max_uses integer default 1,
  p_days     integer default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
begin
  -- Readable alphabet: no 0/O or 1/I, so a code survives being read aloud.
  select 'NEO-' || string_agg(
           substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                  floor(random() * 32 + 1)::int, 1), '')
    into v_code
    from generate_series(1, 8);

  insert into public.invite_codes (code, note, max_uses, expires_at)
  values (v_code, p_note, greatest(coalesce(p_max_uses, 1), 1),
          case when p_days is null then null else now() + make_interval(days => p_days) end);

  return v_code;
end;
$$;

-- This is SECURITY DEFINER, so it MUST NOT be reachable from the browser: PostgREST
-- exposes every public function at /rest/v1/rpc/<name>, and anyone who could call
-- this one could mint themselves an invite code and walk past the invitation
-- requirement entirely.
--
-- Revoking from anon and authenticated is not enough. Postgres grants EXECUTE to
-- PUBLIC on every new function by default, and a role-specific revoke leaves that
-- grant in place. PUBLIC has to be revoked first.
revoke all on function public.new_invite_code(text, integer, integer) from public;
revoke all on function public.new_invite_code(text, integer, integer) from anon, authenticated;
