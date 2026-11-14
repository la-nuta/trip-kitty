begin;

select plan(40);

select set_config('test.owner', tests.create_user('owner@example.test', false, 'Owner')::text, true);
select set_config('test.member', tests.create_user('member@example.test', false, 'Member')::text, true);
select set_config('test.guest', tests.create_user(null, true, 'Guest member')::text, true);
select set_config('test.left', tests.create_user('left@example.test', false, 'Left')::text, true);
select set_config('test.removed', tests.create_user('removed@example.test', false, 'Removed')::text, true);
select set_config('test.outsider', tests.create_user('outsider@example.test', false, 'Outsider')::text, true);
select set_config('test.outsider_guest', tests.create_user(null, true, 'Outsider guest')::text, true);

-- Rows are inserted directly, so these tests do not depend on create_trip.
insert into public.trips (id, name, base_currency)
values ('00000000-0000-0000-0000-0000000000a1', 'Lisbon', 'EUR');
select set_config('test.trip', '00000000-0000-0000-0000-0000000000a1', true);

insert into public.invitations (trip_id, token)
values (current_setting('test.trip')::uuid, 'secret-token');

insert into public.trip_members (trip_id, user_id, role, status)
values
  (current_setting('test.trip')::uuid, current_setting('test.owner')::uuid, 'organizer', 'active'),
  (current_setting('test.trip')::uuid, current_setting('test.member')::uuid, 'participant', 'active'),
  (current_setting('test.trip')::uuid, current_setting('test.guest')::uuid, 'participant', 'active'),
  (current_setting('test.trip')::uuid, current_setting('test.left')::uuid, 'participant', 'left'),
  (current_setting('test.trip')::uuid, current_setting('test.removed')::uuid, 'participant', 'removed');

-- Organizer
select tests.authenticate_as(current_setting('test.owner')::uuid);
select is((select count(*)::int from public.trips), 1, 'the organizer sees the trip');
select is((select count(*)::int from public.trip_members), 5, 'the organizer sees all rows, including left and removed');
select is((select count(*)::int from public.invitations), 1, 'the organizer sees the invitation');
select is(
  (select display_name from public.users where id = current_setting('test.removed')::uuid),
  'Removed',
  'the organizer sees the profile of a removed member'
);

-- Participant
select tests.authenticate_as(current_setting('test.member')::uuid);
select is((select count(*)::int from public.trips), 1, 'a participant sees the trip');
select is((select count(*)::int from public.trip_members), 3, 'a participant sees only active rows');
select is((select count(*)::int from public.trip_members where status <> 'active'), 0, 'a participant sees no left or removed rows');
select is((select count(*)::int from public.invitations), 0, 'a participant does not see the invitation');
select is(
  (select display_name from public.users where id = current_setting('test.owner')::uuid),
  'Owner',
  'a participant sees a co-member''s profile'
);
select is_empty(
  format('select 1 from public.users where id = %L', current_setting('test.removed')),
  'a participant does not see the profile of a removed member'
);

-- Guest member
select tests.authenticate_as(current_setting('test.guest')::uuid);
select is((select count(*)::int from public.trips), 1, 'a guest member sees the trip');
select is((select count(*)::int from public.trip_members), 3, 'a guest member sees the active rows');
select is((select count(*)::int from public.invitations), 0, 'a guest member does not see the invitation');
select is(
  (select display_name from public.users where id = current_setting('test.owner')::uuid),
  'Owner',
  'a guest member sees a co-member''s profile'
);

-- Former members
select tests.authenticate_as(current_setting('test.left')::uuid);
select is((select count(*)::int from public.trips), 0, 'a member who left does not see the trip');
select results_eq(
  'select user_id, status from public.trip_members',
  format($$values (%L::uuid, 'left')$$, current_setting('test.left')),
  'a member who left sees only their own row'
);
select is_empty(
  format('select 1 from public.users where id = %L', current_setting('test.owner')),
  'a member who left does not see the organizer''s profile'
);

select tests.authenticate_as(current_setting('test.removed')::uuid);
select is((select count(*)::int from public.trips), 0, 'a removed member does not see the trip');
select results_eq(
  'select user_id, status from public.trip_members',
  format($$values (%L::uuid, 'removed')$$, current_setting('test.removed')),
  'a removed member sees only their own row'
);

-- Outsiders
select tests.authenticate_as(current_setting('test.outsider')::uuid);
select is((select count(*)::int from public.trips), 0, 'an outsider selects no trips');
select is((select count(*)::int from public.trip_members), 0, 'an outsider selects no members');
select is((select count(*)::int from public.invitations), 0, 'an outsider selects no invitations');
select is_empty(
  format('select 1 from public.users where id = %L', current_setting('test.owner')),
  'an outsider cannot see the organizer''s profile'
);

select tests.authenticate_as(current_setting('test.outsider_guest')::uuid);
select is((select count(*)::int from public.trips), 0, 'an outside guest selects no trips');
select is((select count(*)::int from public.trip_members), 0, 'an outside guest selects no members');
select is((select count(*)::int from public.invitations), 0, 'an outside guest selects no invitations');
select is_empty(
  format('select 1 from public.users where id = %L', current_setting('test.owner')),
  'an outside guest cannot see the organizer''s profile'
);

-- Direct writes fail for every client role, including the organizer
select tests.authenticate_as(current_setting('test.owner')::uuid);
select throws_ok(
  $$insert into public.trips (name, base_currency) values ('Hacked', 'EUR')$$,
  '42501', null, 'the organizer cannot insert into trips'
);
select throws_ok(
  $$update public.trips set name = 'Hacked'$$,
  '42501', null, 'the organizer cannot update trips directly'
);
select throws_ok(
  $$delete from public.trips$$,
  '42501', null, 'the organizer cannot delete trips directly'
);
select throws_ok(
  format($$insert into public.trip_members (trip_id, user_id, role, status) values (%L, %L, 'participant', 'active')$$, current_setting('test.trip'), current_setting('test.outsider')),
  '42501', null, 'the organizer cannot insert into trip_members'
);
select throws_ok(
  $$update public.trip_members set status = 'removed'$$,
  '42501', null, 'the organizer cannot update trip_members directly'
);
select throws_ok(
  $$delete from public.trip_members$$,
  '42501', null, 'the organizer cannot delete from trip_members directly'
);
select throws_ok(
  format($$insert into public.invitations (trip_id, token) values (%L, 'x')$$, current_setting('test.trip')),
  '42501', null, 'the organizer cannot insert into invitations'
);
select throws_ok(
  $$update public.invitations set token = 'x'$$,
  '42501', null, 'the organizer cannot update invitations directly'
);
select throws_ok(
  $$delete from public.invitations$$,
  '42501', null, 'the organizer cannot delete from invitations directly'
);

-- No session
select tests.clear_authentication();
select throws_ok('select 1 from public.trips', '42501', null, 'anon cannot select trips');
select throws_ok('select 1 from public.trip_members', '42501', null, 'anon cannot select trip_members');
select throws_ok('select 1 from public.invitations', '42501', null, 'anon cannot select invitations');

-- RLS helpers
reset role;
select ok(
  not has_function_privilege('anon', 'public.is_active_member(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.is_organizer(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.shares_trip_with(uuid)', 'execute'),
  'anon cannot execute the RLS helpers'
);

select * from finish();
rollback;
