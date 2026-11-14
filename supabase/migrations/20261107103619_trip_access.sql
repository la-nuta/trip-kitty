-- SECURITY DEFINER keeps the policies on trip_members from querying themselves.
create function public.is_active_member(trip_id uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_members member
    where member.trip_id = is_active_member.trip_id
      and member.user_id = (select auth.uid())
      and member.status = 'active'
  );
$$;

create function public.is_organizer(trip_id uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_members member
    where member.trip_id = is_organizer.trip_id
      and member.user_id = (select auth.uid())
      and member.role = 'organizer'
  );
$$;

-- Active co-members, plus removed members of a trip the caller organizes.
create function public.shares_trip_with(other_user uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_members own
    join public.trip_members other on other.trip_id = own.trip_id
    where own.user_id = (select auth.uid())
      and own.status = 'active'
      and other.user_id = shares_trip_with.other_user
      and (
        other.status = 'active'
        or (own.role = 'organizer' and other.status = 'removed')
      )
  );
$$;

revoke execute on function public.is_active_member(uuid) from public, anon;
revoke execute on function public.is_organizer(uuid) from public, anon;
revoke execute on function public.shares_trip_with(uuid) from public, anon;
grant execute on function public.is_active_member(uuid) to authenticated;
grant execute on function public.is_organizer(uuid) to authenticated;
grant execute on function public.shares_trip_with(uuid) to authenticated;

create policy trips_select_member on public.trips
  for select to authenticated
  using (public.is_active_member(id));

create policy trip_members_select on public.trip_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (status = 'active' and public.is_active_member(trip_id))
    or public.is_organizer(trip_id)
  );

create policy invitations_select_organizer on public.invitations
  for select to authenticated
  using (public.is_organizer(trip_id));

create policy users_select_co_member on public.users
  for select to authenticated
  using (public.shares_trip_with(id));
