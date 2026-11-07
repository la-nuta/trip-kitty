begin;

select plan(32);

-- Fixtures. Ids are kept in settings so they stay readable under every role.
select set_config('test.alice', tests.create_user('alice@example.test', false, '  Alice  ')::text, true);
select set_config('test.bob', tests.create_user('bob@example.test', false, null)::text, true);
select set_config('test.guest', tests.create_user(null, true, 'Guest')::text, true);

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', 'language@example.test', '{}',
   '{"language": "ru", "theme": "dark"}'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', 'bad-language@example.test', '{}',
   '{"language": "eng"}'),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', 'long-name@example.test', '{}',
   jsonb_build_object('display_name', repeat('x', 51))),
  ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', 'blank-name@example.test', '{}',
   '{"display_name": "   "}');

-- Table shape
select ok(
  (select relrowsecurity from pg_class where oid = 'public.users'::regclass),
  'RLS is enabled on users'
);

-- Profile trigger
select is(
  (select count(*)::int from public.users where id = current_setting('test.alice')::uuid),
  1,
  'inserting into auth.users creates a public.users row with the same id'
);
select is(
  (select display_name from public.users where id = current_setting('test.alice')::uuid),
  'Alice',
  'display_name comes from metadata, trimmed'
);
select is(
  (select display_name from public.users where id = current_setting('test.bob')::uuid),
  null,
  'display_name is null without metadata'
);
select is(
  (select display_name from public.users where id = '00000000-0000-0000-0000-00000000000c'),
  null,
  'a too long name in metadata becomes null and does not block sign-up'
);
select is(
  (select display_name from public.users where id = '00000000-0000-0000-0000-00000000000d'),
  null,
  'a blank name in metadata becomes null and does not block sign-up'
);
select is(
  (select language from public.users where id = '00000000-0000-0000-0000-00000000000a'),
  'ru',
  'language comes from metadata when it matches the format'
);
select is(
  (select language from public.users where id = '00000000-0000-0000-0000-00000000000b'),
  null,
  'language is null when metadata does not match the format'
);
select is(
  (select language from public.users where id = current_setting('test.alice')::uuid),
  null,
  'language is null without metadata'
);
select is(
  (select theme from public.users where id = '00000000-0000-0000-0000-00000000000a'),
  null,
  'theme is null for a new user even when metadata contains one'
);

-- Trigger functions have no client grants
select ok(
  not has_function_privilege('anon', 'public.handle_new_auth_user()', 'execute')
  and not has_function_privilege('authenticated', 'public.handle_new_auth_user()', 'execute'),
  'clients cannot execute handle_new_auth_user'
);
select ok(
  not has_function_privilege('anon', 'public.set_updated_at()', 'execute')
  and not has_function_privilege('authenticated', 'public.set_updated_at()', 'execute'),
  'clients cannot execute set_updated_at'
);
select ok(
  not has_function_privilege('anon', 'public.trim_user_display_name()', 'execute')
  and not has_function_privilege('authenticated', 'public.trim_user_display_name()', 'execute'),
  'clients cannot execute trim_user_display_name'
);

-- updated_at is bumped. now() is fixed within a transaction, so start from an old value.
update public.users set updated_at = '2000-01-01' where id = current_setting('test.alice')::uuid;

-- Own row
select tests.authenticate_as(current_setting('test.alice')::uuid);

select is(
  (select display_name from public.users where id = current_setting('test.alice')::uuid),
  'Alice',
  'a user can select their own row'
);
select is_empty(
  format('select 1 from public.users where id = %L', current_setting('test.bob')),
  'a user cannot select another user''s row'
);
select lives_ok(
  format(
    $$update public.users set display_name = '  Anna  ', language = 'en', theme = 'dark' where id = %L$$,
    current_setting('test.alice')
  ),
  'a user can update their display_name, language, and theme'
);
select is(
  (select display_name from public.users where id = current_setting('test.alice')::uuid),
  'Anna',
  'updating display_name stores it trimmed'
);
select is(
  (select theme from public.users where id = current_setting('test.alice')::uuid),
  'dark',
  'theme dark is accepted'
);
select ok(
  (select updated_at > '2000-01-01' from public.users where id = current_setting('test.alice')::uuid),
  'updating a row bumps updated_at'
);
select lives_ok(
  format($$update public.users set theme = 'high-contrast' where id = %L$$, current_setting('test.alice')),
  'theme high-contrast is accepted'
);
select throws_ok(
  format($$update public.users set theme = 'Dark Mode' where id = %L$$, current_setting('test.alice')),
  '23514',
  null,
  'theme Dark Mode is rejected'
);
select throws_ok(
  format($$update public.users set display_name = '   ' where id = %L$$, current_setting('test.alice')),
  '23514',
  null,
  'a blank display_name is rejected'
);
select throws_ok(
  format($$update public.users set display_name = repeat('x', 51) where id = %L$$, current_setting('test.alice')),
  '23514',
  null,
  'a 51-character display_name is rejected'
);
select throws_ok(
  format($$update public.users set language = 'eng' where id = %L$$, current_setting('test.alice')),
  '23514',
  null,
  'language eng is rejected'
);
select throws_ok(
  format($$update public.users set id = gen_random_uuid() where id = %L$$, current_setting('test.alice')),
  '42501',
  null,
  'a user cannot update id'
);
select throws_ok(
  format($$update public.users set created_at = now() where id = %L$$, current_setting('test.alice')),
  '42501',
  null,
  'a user cannot update created_at'
);
select throws_ok(
  $$insert into public.users (id) values (gen_random_uuid())$$,
  '42501',
  null,
  'a user cannot insert into users'
);
select throws_ok(
  format($$delete from public.users where id = %L$$, current_setting('test.alice')),
  '42501',
  null,
  'a user cannot delete from users'
);

-- Another user's row
select tests.authenticate_as(current_setting('test.bob')::uuid);

update public.users set display_name = 'Hacked' where id = current_setting('test.alice')::uuid;

select tests.authenticate_as(current_setting('test.alice')::uuid);
select is(
  (select display_name from public.users where id = current_setting('test.alice')::uuid),
  'Anna',
  'a user cannot update another user''s row'
);

-- Guests are ordinary profiles
select tests.authenticate_as(current_setting('test.guest')::uuid);
select is(
  (select display_name from public.users where id = current_setting('test.guest')::uuid),
  'Guest',
  'a guest can select their own row'
);

-- No session
select tests.clear_authentication();
select throws_ok(
  'select 1 from public.users',
  '42501',
  null,
  'the anon role cannot select from users'
);
select throws_ok(
  format($$update public.users set theme = 'dark' where id = %L$$, current_setting('test.alice')),
  '42501',
  null,
  'the anon role cannot update users'
);

select * from finish();
rollback;
