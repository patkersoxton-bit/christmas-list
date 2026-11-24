-- Christmas list claim storage.
-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query).
--
-- Privacy model:
--   * Only the item id and a timestamp are stored. No names, emails or IPs.
--   * Visitors can't read or write the table directly. They can only call
--     the three functions below.
--   * Claiming returns a random secret token, kept in the claimer's browser,
--     so only that browser can undo the claim.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.claims (
  item_id    text primary key,
  token_hash text not null,
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
create or replace function public.claim_item(p_item_id text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text := encode(gen_random_bytes(24), 'hex');
begin
  if p_item_id is null or p_item_id !~ '^[a-z0-9-]{1,80}$' then
    raise exception 'invalid item id';
  end if;

  insert into public.claims (item_id, token_hash)
  values (p_item_id, encode(digest(v_token, 'sha256'), 'hex'))
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

revoke execute on function public.get_claimed_items()        from public;
revoke execute on function public.claim_item(text)           from public;
revoke execute on function public.unclaim_item(text, text)   from public;
grant  execute on function public.get_claimed_items()        to anon, authenticated;
grant  execute on function public.claim_item(text)           to anon, authenticated;
grant  execute on function public.unclaim_item(text, text)   to anon, authenticated;

-- Owner tip: to reset a claim manually, delete its row in
-- Table Editor → claims (the dashboard bypasses these restrictions).
