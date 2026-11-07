-- Profiles of all people, including guests. One row per auth.users row, same id.
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text null
    check (display_name is null or char_length(btrim(display_name)) between 1 and 50),
  language text null
    check (language is null or language ~ '^[a-z]{2}$'),
  theme text null
    check (theme is null or theme ~ '^[a-z][a-z0-9-]{0,29}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;

-- Supabase default privileges give clients everything on new tables, so start from nothing.
revoke all on table public.users from public, anon, authenticated;
grant select on table public.users to authenticated;
grant update (display_name, language, theme) on table public.users to authenticated;

-- The policy for co-members is added with the trips tables.
create policy users_select_own on public.users
  for select to authenticated
  using (id = (select auth.uid()));

create policy users_update_own on public.users
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Generic trigger function, reused by later tables.
create function public.set_updated_at() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create function public.trim_user_display_name() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.display_name := btrim(new.display_name);
  return new;
end;
$$;

revoke execute on function public.trim_user_display_name() from public, anon, authenticated;

create trigger users_trim_display_name
  before update of display_name on public.users
  for each row execute function public.trim_user_display_name();

-- Metadata comes from the client. An unusable value becomes null: sign-up must not fail because
-- of it, and the profile step asks for the name later.
create function public.handle_new_auth_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata_name text := nullif(btrim(new.raw_user_meta_data ->> 'display_name'), '');
  metadata_language text := new.raw_user_meta_data ->> 'language';
begin
  insert into public.users (id, display_name, language)
  values (
    new.id,
    case when char_length(metadata_name) <= 50 then metadata_name end,
    case when metadata_language ~ '^[a-z]{2}$' then metadata_language end
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
