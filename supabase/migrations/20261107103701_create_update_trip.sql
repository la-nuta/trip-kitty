-- Shared by create_trip and update_trip. `detail` names the field for the client.
create function public.validate_trip_input(
  p_name text,
  p_start_date date,
  p_end_date date,
  p_base_currency text
) returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_name is null or char_length(btrim(p_name)) not between 1 and 100 then
    raise exception 'validation_failed' using errcode = 'P0001', detail = 'name';
  end if;
  if p_end_date < p_start_date then
    raise exception 'validation_failed' using errcode = 'P0001', detail = 'dates';
  end if;
  if p_base_currency is null or p_base_currency !~ '^[A-Z]{3}$' then
    raise exception 'validation_failed' using errcode = 'P0001', detail = 'base_currency';
  end if;
end;
$$;

revoke execute on function public.validate_trip_input(text, date, date, text)
  from public, anon, authenticated;

create function public.create_trip(
  p_name text,
  p_start_date date,
  p_end_date date,
  p_base_currency text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_is_guest boolean;
  caller_name text;
  new_trip_id uuid;
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  -- Read from the table, not the JWT: the token of a converted guest can be stale.
  select account.is_anonymous, profile.display_name
  into caller_is_guest, caller_name
  from auth.users account
  join public.users profile on profile.id = account.id
  where account.id = caller;

  if not found then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if caller_is_guest then
    raise exception 'guest_not_allowed' using errcode = 'P0001';
  end if;
  if caller_name is null then
    raise exception 'profile_incomplete' using errcode = 'P0001';
  end if;

  perform public.validate_trip_input(p_name, p_start_date, p_end_date, p_base_currency);

  insert into public.trips (name, start_date, end_date, base_currency)
  values (btrim(p_name), p_start_date, p_end_date, p_base_currency)
  returning id into new_trip_id;

  insert into public.trip_members (trip_id, user_id, role, status)
  values (new_trip_id, caller, 'organizer', 'active');

  insert into public.invitations (trip_id, token)
  values (
    new_trip_id,
    left(translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/=', '-_'), 22)
  );

  return new_trip_id;
end;
$$;

revoke execute on function public.create_trip(text, date, date, text) from public, anon;
grant execute on function public.create_trip(text, date, date, text) to authenticated;

create function public.update_trip(
  p_trip_id uuid,
  p_name text,
  p_start_date date,
  p_end_date date,
  p_base_currency text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text;
begin
  -- Access comes first, so an outsider learns nothing from validation errors.
  select member.role
  into caller_role
  from public.trip_members member
  where member.trip_id = p_trip_id
    and member.user_id = auth.uid()
    and member.status = 'active';

  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if caller_role <> 'organizer' then
    raise exception 'not_organizer' using errcode = 'P0001';
  end if;

  perform public.validate_trip_input(p_name, p_start_date, p_end_date, p_base_currency);

  update public.trips
  set
    name = btrim(p_name),
    start_date = p_start_date,
    end_date = p_end_date,
    base_currency = p_base_currency
  where id = p_trip_id;
end;
$$;

revoke execute on function public.update_trip(uuid, text, date, date, text) from public, anon;
grant execute on function public.update_trip(uuid, text, date, date, text) to authenticated;
