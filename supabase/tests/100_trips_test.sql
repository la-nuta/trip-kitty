begin;

select plan(32);

select set_config('test.owner', tests.create_user('owner@example.test')::text, true);
select set_config('test.guest', tests.create_user(null, true, 'Guest')::text, true);
select set_config('test.converted', tests.create_user(null, true, 'Converted')::text, true);
select set_config('test.nameless', tests.create_user('nameless@example.test', false, null)::text, true);

-- Account with a name
select tests.authenticate_as(current_setting('test.owner')::uuid);

select set_config(
  'test.trip',
  public.create_trip('  Lisbon 2027  ', '2027-05-10', '2027-05-17', 'EUR')::text,
  true
);
select set_config('test.second_trip', public.create_trip('Second', null, null, 'USD')::text, true);

reset role;

select results_eq(
  format(
    'select name, start_date, end_date, base_currency::text from public.trips where id = %L',
    current_setting('test.trip')
  ),
  $$values ('Lisbon 2027', '2027-05-10'::date, '2027-05-17'::date, 'EUR')$$,
  'create_trip stores the trimmed name, the dates, and the currency, and returns the id'
);
select results_eq(
  format(
    'select user_id, role, status from public.trip_members where trip_id = %L',
    current_setting('test.trip')
  ),
  format(
    $$values (%L::uuid, 'organizer', 'active')$$,
    current_setting('test.owner')
  ),
  'the creator becomes the only member, as active organizer'
);
select is(
  (select count(*)::int from public.invitations where trip_id = current_setting('test.trip')::uuid),
  1,
  'the trip gets one invitation'
);
select matches(
  (select token from public.invitations where trip_id = current_setting('test.trip')::uuid),
  '^[A-Za-z0-9_-]{22}$',
  'the token has 22 URL-safe characters'
);
select isnt(
  (select token from public.invitations where trip_id = current_setting('test.trip')::uuid),
  (select token from public.invitations where trip_id = current_setting('test.second_trip')::uuid),
  'tokens differ between trips'
);

-- Grants
select ok(
  not has_function_privilege('anon', 'public.create_trip(text, date, date, text)', 'execute'),
  'anon cannot execute create_trip'
);
select ok(
  has_function_privilege('authenticated', 'public.create_trip(text, date, date, text)', 'execute'),
  'authenticated can execute create_trip'
);

select ok(
  not has_function_privilege('anon', 'public.validate_trip_input(text, date, date, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.validate_trip_input(text, date, date, text)', 'execute'),
  'clients cannot execute validate_trip_input'
);

-- Guests, read from auth.users and not from the JWT
select tests.authenticate_as(current_setting('test.guest')::uuid);
select throws_ok(
  $$select public.create_trip('Trip', null, null, 'EUR')$$,
  'P0001',
  'guest_not_allowed',
  'a guest cannot create a trip'
);

select tests.authenticate_as(current_setting('test.converted')::uuid);
reset role;
update auth.users set is_anonymous = false where id = current_setting('test.converted')::uuid;
set local role authenticated;
select is(
  current_setting('request.jwt.claims')::jsonb ->> 'is_anonymous',
  'true',
  'the token of a converted guest is still stale'
);
select lives_ok(
  $$select public.create_trip('Trip', null, null, 'EUR')$$,
  'a converted guest with a stale token can create a trip'
);

select tests.authenticate_as(current_setting('test.nameless')::uuid);
select throws_ok(
  $$select public.create_trip('Trip', null, null, 'EUR')$$,
  'P0001',
  'profile_incomplete',
  'a user without a name cannot create a trip'
);

-- No user
select tests.clear_authentication();
select throws_ok(
  $$select public.create_trip('Trip', null, null, 'EUR')$$,
  '42501',
  null,
  'the anon role is refused'
);
select tests.clear_authentication();
set local role authenticated;
select throws_ok(
  $$select public.create_trip('Trip', null, null, 'EUR')$$,
  'P0001',
  'not_authenticated',
  'the authenticated role with empty claims is refused'
);

-- Validation
select tests.authenticate_as(current_setting('test.owner')::uuid);

select throws_ok(
  $$select public.create_trip('  ', null, null, 'EUR')$$,
  'P0001',
  'validation_failed',
  'a blank name is refused'
);
select is(
  tests.error_detail($$select public.create_trip('  ', null, null, 'EUR')$$),
  'name',
  'a blank name names the field'
);
select throws_ok(
  $$select public.create_trip(null, null, null, 'EUR')$$,
  'P0001',
  'validation_failed',
  'a missing name is refused'
);
select throws_ok(
  format($$select public.create_trip(%L, null, null, 'EUR')$$, repeat('x', 101)),
  'P0001',
  'validation_failed',
  'a 101-character name is refused'
);
select lives_ok(
  format($$select public.create_trip(%L, null, null, 'EUR')$$, repeat('x', 100)),
  'a 100-character name is accepted'
);
select throws_ok(
  $$select public.create_trip('Trip', '2027-05-17', '2027-05-10', 'EUR')$$,
  'P0001',
  'validation_failed',
  'an end date before the start date is refused'
);
select is(
  tests.error_detail($$select public.create_trip('Trip', '2027-05-17', '2027-05-10', 'EUR')$$),
  'dates',
  'wrong dates name the field'
);
select lives_ok(
  $$select public.create_trip('Trip', '2027-05-10', '2027-05-10', 'EUR')$$,
  'a one-day trip is accepted'
);
select lives_ok(
  $$select public.create_trip('Trip', '2027-05-10', null, 'EUR')$$,
  'only a start date is accepted'
);
select lives_ok(
  $$select public.create_trip('Trip', null, '2027-05-10', 'EUR')$$,
  'only an end date is accepted'
);
select throws_ok(
  $$select public.create_trip('Trip', null, null, 'eur')$$,
  'P0001',
  'validation_failed',
  'a lowercase currency is refused'
);
select throws_ok(
  $$select public.create_trip('Trip', null, null, 'EURO')$$,
  'P0001',
  'validation_failed',
  'a four-letter currency is refused'
);
select throws_ok(
  $$select public.create_trip('Trip', null, null, 'EU')$$,
  'P0001',
  'validation_failed',
  'a two-letter currency is refused'
);
select throws_ok(
  $$select public.create_trip('Trip', null, null, null)$$,
  'P0001',
  'validation_failed',
  'a missing currency is refused'
);
select is(
  tests.error_detail($$select public.create_trip('Trip', null, null, 'eur')$$),
  'base_currency',
  'a wrong currency names the field'
);

-- Table rules
reset role;
select throws_ok(
  format(
    $$insert into public.trip_members (trip_id, user_id, role, status) values (%L, %L, 'organizer', 'active')$$,
    current_setting('test.trip'),
    current_setting('test.guest')
  ),
  '23505',
  null,
  'a second organizer for the trip violates the unique index'
);
select throws_ok(
  format(
    $$update public.trip_members set status = 'left' where trip_id = %L$$,
    current_setting('test.trip')
  ),
  '23514',
  null,
  'an organizer is always active'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.trips'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.trip_members'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.invitations'::regclass),
  'RLS is enabled on the three tables'
);

select * from finish();
rollback;
