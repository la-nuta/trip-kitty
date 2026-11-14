begin;

select plan(17);

select set_config('test.owner', tests.create_user('owner@example.test')::text, true);
select set_config('test.member', tests.create_user('member@example.test')::text, true);
select set_config('test.left', tests.create_user('left@example.test')::text, true);
select set_config('test.outsider', tests.create_user('outsider@example.test')::text, true);
select set_config('test.guest', tests.create_user(null, true, 'Guest')::text, true);

select tests.authenticate_as(current_setting('test.owner')::uuid);
select set_config(
  'test.trip',
  public.create_trip('Lisbon', '2027-05-10', '2027-05-17', 'EUR')::text,
  true
);
reset role;

insert into public.trip_members (trip_id, user_id, role, status)
values
  (current_setting('test.trip')::uuid, current_setting('test.member')::uuid, 'participant', 'active'),
  (current_setting('test.trip')::uuid, current_setting('test.left')::uuid, 'participant', 'left');

update public.trips set updated_at = '2000-01-01' where id = current_setting('test.trip')::uuid;

select tests.authenticate_as(current_setting('test.owner')::uuid);

select lives_ok(
  format($$select public.update_trip(%L, '  Porto  ', '2027-06-01', '2027-06-05', 'USD')$$, current_setting('test.trip')),
  'the organizer can update the trip'
);
select results_eq(
  format('select name, start_date, end_date, base_currency::text from public.trips where id = %L', current_setting('test.trip')),
  $$values ('Porto', '2027-06-01'::date, '2027-06-05'::date, 'USD')$$,
  'all fields are replaced and the name is trimmed'
);
select ok(
  (select updated_at > '2000-01-01' from public.trips where id = current_setting('test.trip')::uuid),
  'updated_at is bumped'
);
select lives_ok(
  format($$select public.update_trip(%L, 'Faro', null, null, 'GBP')$$, current_setting('test.trip')),
  'a second update right after the first succeeds'
);
select results_eq(
  format('select name, start_date, end_date, base_currency::text from public.trips where id = %L', current_setting('test.trip')),
  $$values ('Faro', null::date, null::date, 'GBP')$$,
  'the last write wins, and dates can be cleared'
);

select throws_ok(
  format($$select public.update_trip(%L, '  ', null, null, 'EUR')$$, current_setting('test.trip')),
  'P0001', 'validation_failed', 'a blank name is refused'
);
select is(
  tests.error_detail(format($$select public.update_trip(%L, '  ', null, null, 'EUR')$$, current_setting('test.trip'))),
  'name', 'a blank name names the field'
);
select throws_ok(
  format($$select public.update_trip(%L, %L, null, null, 'EUR')$$, current_setting('test.trip'), repeat('x', 101)),
  'P0001', 'validation_failed', 'a 101-character name is refused'
);
select throws_ok(
  format($$select public.update_trip(%L, 'Trip', '2027-05-17', '2027-05-10', 'EUR')$$, current_setting('test.trip')),
  'P0001', 'validation_failed', 'an end date before the start date is refused'
);
select is(
  tests.error_detail(format($$select public.update_trip(%L, 'Trip', '2027-05-17', '2027-05-10', 'EUR')$$, current_setting('test.trip'))),
  'dates', 'wrong dates name the field'
);
select throws_ok(
  format($$select public.update_trip(%L, 'Trip', null, null, 'eur')$$, current_setting('test.trip')),
  'P0001', 'validation_failed', 'a wrong currency is refused'
);
select is(
  tests.error_detail(format($$select public.update_trip(%L, 'Trip', null, null, 'eur')$$, current_setting('test.trip'))),
  'base_currency', 'a wrong currency names the field'
);

select tests.authenticate_as(current_setting('test.member')::uuid);
select throws_ok(
  format($$select public.update_trip(%L, 'Hacked', null, null, 'EUR')$$, current_setting('test.trip')),
  'P0001', 'not_organizer', 'an active participant gets not_organizer'
);

select tests.authenticate_as(current_setting('test.left')::uuid);
select throws_ok(
  format($$select public.update_trip(%L, 'Hacked', null, null, 'EUR')$$, current_setting('test.trip')),
  'P0001', 'not_found', 'a former member gets not_found'
);

select tests.authenticate_as(current_setting('test.outsider')::uuid);
select throws_ok(
  format($$select public.update_trip(%L, '  ', null, null, 'eur')$$, current_setting('test.trip')),
  'P0001', 'not_found', 'an outsider gets not_found, even with invalid input'
);
select throws_ok(
  $$select public.update_trip(gen_random_uuid(), 'Trip', null, null, 'EUR')$$,
  'P0001', 'not_found', 'an unknown trip gets not_found'
);

select tests.clear_authentication();
select throws_ok(
  format($$select public.update_trip(%L, 'Hacked', null, null, 'EUR')$$, current_setting('test.trip')),
  '42501', null, 'the anon role is refused'
);

select * from finish();
rollback;
