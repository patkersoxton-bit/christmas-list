-- Christmas list claim storage.
-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query).
--
-- Privacy model:
--   * Each claim stores the item id, the claimer's name and a timestamp.
--   * Visitors can't read or write the tables directly. They can only call
--     the functions below, and the public ones never return names.
--   * Claiming returns a random secret token, kept in the claimer's browser,
--     so only that browser can undo the claim.
--   * The organizer page (admin.html) uses a passphrase. Only its SHA-256
--     hash is stored, in admin_settings.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.claims (
  item_id    text primary key,
  token_hash text not null,
  claimer_name text,
  claimed_at timestamptz not null default now()
);

alter table public.claims enable row level security;
revoke all on public.claims from anon, authenticated;

-- List which items are taken (ids only).
create or replace function public.get_claimed_items()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select item_id from public.claims;
$$;

-- Claim an item. Returns a secret token, or NULL if it was already taken.
create or replace function public.claim_item(p_item_id text, p_name text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text := encode(gen_random_bytes(24), 'hex');
  v_name  text := btrim(coalesce(p_name, ''));
begin
  if p_item_id is null or p_item_id !~ '^[a-z0-9-]{1,80}$' then
    raise exception 'invalid item id';
  end if;
  if length(v_name) < 1 or length(v_name) > 60 then
    raise exception 'name required (max 60 characters)';
  end if;

  insert into public.claims (item_id, token_hash, claimer_name)
  values (p_item_id, encode(digest(v_token, 'sha256'), 'hex'), v_name)
  on conflict (item_id) do nothing;

  if not found then
    return null;
  end if;
  return v_token;
end;
$$;

-- Undo a claim. Needs the token returned by claim_item.
create or replace function public.unclaim_item(p_item_id text, p_token text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from public.claims
  where item_id = p_item_id
    and token_hash = encode(digest(p_token, 'sha256'), 'hex');
  return found;
end;
$$;

-- ---------- Organizer (admin) access ----------
-- Set the passphrase hash after running this file, e.g. in a terminal:
--   printf '%s' 'your-passphrase' | sha256sum
-- then:
--   insert into public.admin_settings (id, key_hash) values (1, '<hash>')
--   on conflict (id) do update set key_hash = excluded.key_hash;
create table if not exists public.admin_settings (
  id        int primary key default 1 check (id = 1),
  key_hash  text not null
);
alter table public.admin_settings enable row level security;
revoke all on public.admin_settings from anon, authenticated;

create or replace function public.admin_is_valid(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.admin_settings
    where key_hash = encode(digest(coalesce(p_key, ''), 'sha256'), 'hex')
  );
$$;

create or replace function public.admin_get_claims(p_key text)
returns table (item_id text, claimer_name text, claimed_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if not public.admin_is_valid(p_key) then
    raise exception 'invalid admin key' using errcode = '28000';
  end if;
  return query
    select c.item_id, c.claimer_name, c.claimed_at
    from public.claims c order by c.claimed_at;
end;
$$;

create or replace function public.admin_release(p_key text, p_item_id text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.admin_is_valid(p_key) then
    raise exception 'invalid admin key' using errcode = '28000';
  end if;
  delete from public.claims where item_id = p_item_id;
  return found;
end;
$$;

-- ---------- Permissions ----------
revoke execute on function public.admin_is_valid(text)        from public, anon, authenticated;
revoke execute on function public.get_claimed_items()         from public;
revoke execute on function public.claim_item(text, text)      from public;
revoke execute on function public.unclaim_item(text, text)    from public;
revoke execute on function public.admin_get_claims(text)      from public;
revoke execute on function public.admin_release(text, text)   from public;
grant  execute on function public.get_claimed_items()         to anon, authenticated;
grant  execute on function public.claim_item(text, text)      to anon, authenticated;
grant  execute on function public.unclaim_item(text, text)    to anon, authenticated;
grant  execute on function public.admin_get_claims(text)      to anon, authenticated;
grant  execute on function public.admin_release(text, text)   to anon, authenticated;
