-- Shared pgTAP helpers. This file is committed on purpose (no rollback), so later test files can
-- use the `tests` schema. `npm run db:reset` removes it together with everything else.
create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

-- Inserts into auth.users; the profile trigger then creates public.users.
create or replace function tests.create_user(
  email text,
  is_anonymous boolean default false,
  display_name text default 'Test'
) returns uuid
language plpgsql
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id, instance_id, aud, role, email, is_anonymous,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    new_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    create_user.email,
    create_user.is_anonymous,
    '{}'::jsonb,
    jsonb_strip_nulls(jsonb_build_object('display_name', create_user.display_name)),
    now(),
    now()
  );
  return new_id;
end;
$$;

-- Acts as the given user until the end of the transaction, or until the next helper call.
create or replace function tests.authenticate_as(user_id uuid) returns void
language plpgsql
as $$
declare
  claims text;
begin
  -- The previous role may not be allowed to read auth.users.
  reset role;

  select json_build_object(
    'sub', u.id,
    'role', 'authenticated',
    'is_anonymous', u.is_anonymous
  )::text
  into strict claims
  from auth.users u
  where u.id = authenticate_as.user_id;

  perform set_config('request.jwt.claims', claims, true);
  set local role authenticated;
end;
$$;

-- Acts as a visitor without a session.
create or replace function tests.clear_authentication() returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
end;
$$;

-- Runs a statement that must fail and returns the DETAIL of its error.
create or replace function tests.error_detail(statement text) returns text
language plpgsql
as $$
declare
  detail text;
begin
  execute statement;
  return null;
exception
  when others then
    get stacked diagnostics detail = pg_exception_detail;
    return detail;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;

select plan(1);
select pass('helpers ready');
select * from finish();
