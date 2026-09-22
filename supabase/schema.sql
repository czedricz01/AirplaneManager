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
drop policy if exists "update own profile" on public.profiles;

create policy "read own profile"
  on public.profiles for select
  using (auth.uid() = id);

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

create policy "update own saves"
  on public.saves for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete own saves"
  on public.saves for delete
  using (auth.uid() = user_id);

-- invite_codes deliberately gets NO policy. With RLS on and no policy, neither
-- anon nor authenticated can read or write it, so codes cannot be enumerated
-- from the browser. The sign-up trigger below runs as SECURITY DEFINER and is
-- the only thing that touches this table.

-- ---------------------------------------------------------------------------
-- Sign-up: validate and consume the invite code, then create the profile
-- ---------------------------------------------------------------------------

-- Runs BEFORE the user row exists. Raising here aborts the whole sign-up, which
-- is what makes the invite code a real restriction rather than a client-side
-- suggestion: the browser never gets to decide.
create or replace function public.enforce_invite_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := coalesce(nullif(trim(new.raw_user_meta_data->>'invite_code'), ''), '');
  v_row  public.invite_codes%rowtype;
  v_role text := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role',
    ''
  );
begin
  -- Users created from the Supabase dashboard or via the service role key are
  -- already authorised by definition, so they skip the invite check.
  if v_role = 'service_role' then
    return new;
  end if;

  if v_code = '' then
    raise exception 'INVITE_CODE_REQUIRED';
  end if;

  select * into v_row
    from public.invite_codes
   where code = v_code
     for update;

  if not found then
    raise exception 'INVITE_CODE_INVALID';
  end if;

  if v_row.expires_at is not null and v_row.expires_at < now() then
    raise exception 'INVITE_CODE_EXPIRED';
  end if;

  if v_row.uses >= v_row.max_uses then
    raise exception 'INVITE_CODE_EXHAUSTED';
  end if;

  update public.invite_codes
     set uses = uses + 1
   where code = v_code;

  return new;
end;
$$;

drop trigger if exists on_auth_user_invite_check on auth.users;
create trigger on_auth_user_invite_check
  before insert on auth.users
  for each row execute function public.enforce_invite_code();

-- Runs AFTER the user row exists, because profiles.id references it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      split_part(coalesce(new.email, 'operator'), '@', 1)
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Creating invite codes (run these yourself, whenever you need one)
-- ---------------------------------------------------------------------------
--
--   -- a code good for a single sign-up:
--   insert into public.invite_codes (code, note) values ('NEO-2026-ABC', 'for a friend');
--
--   -- a code good for five sign-ups, expiring in 30 days:
--   insert into public.invite_codes (code, note, max_uses, expires_at)
--   values ('NEO-CREW', 'flight crew', 5, now() + interval '30 days');
--
--   -- see how often each code has been used:
--   select code, uses, max_uses, expires_at, note from public.invite_codes order by created_at;
--
--   -- withdraw a code:
--   delete from public.invite_codes where code = 'NEO-CREW';
