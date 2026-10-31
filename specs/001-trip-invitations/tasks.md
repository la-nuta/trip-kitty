---

description: "Task list for feature 001: trip creation and participant invitations"
---

# Tasks: Trip Creation and Participant Invitations

**Input**: Design documents from `specs/001-trip-invitations/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/rpc.md](./contracts/rpc.md),
[contracts/routes.md](./contracts/routes.md), [quickstart.md](./quickstart.md)

**Tests**: Included. Constitution principle VII requires database-level RLS tests for the
outsider, guest, participant, and organizer roles, written before the code; SC-004 and SC-005
require automated access and translation checks; the e2e smoke scope is fixed in
`docs/decisions.md` D5. Database tests are written first and must fail before the migration that
makes them pass.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested on
its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story from spec.md (US1–US5)
- Paths are relative to the repository root, per the structure in plan.md

## Conventions used by every task

- **Migrations** are created with `npx supabase migration new <name>`; the CLI adds the timestamp
  prefix. Each migration enables RLS on the tables it creates.
- **Database functions** are `SECURITY DEFINER`, `SET search_path = ''` (fully qualified names),
  raise errors as `RAISE EXCEPTION '<code>'` with `SQLSTATE 'P0001'` and the codes listed in
  `contracts/rpc.md`, and `GRANT EXECUTE` only to the roles named in the contract.
- **UI text** only via Transloco keys in `public/i18n/en.json` and `public/i18n/ru.json`; every
  task that adds UI adds its keys to **both** files.
- **Components** are standalone, use signals and `ChangeDetectionStrategy.OnPush`, and are
  laid out mobile-first (usable at 360 px).
- After each migration task, run `npm run db:reset && npm run db:types`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the Angular workspace, local Supabase, test tooling, and CI.

- [ ] T001 Verify `node -v` reports ≥ 24.15 (Angular 22 requirement, research R1); if not, stop and ask the user to upgrade Node before continuing. Add `"engines": { "node": ">=24.15" }` and an `.nvmrc` with `24` at the repository root
- [ ] T002 Scaffold the Angular 22.2 workspace at the repository root without overwriting `README.md`, `docs/`, `specs/`, `.specify/`, `.claude/`: run `npx @angular/cli@22.2 new trip-kitty --directory . --style=scss --routing --ssr=false --skip-git --test-runner=vitest` (or the equivalent flags of that CLI version); keep the existing `.gitignore` entries and merge the CLI's entries into it
- [ ] T003 Pin TypeScript to `~6.0.3` and enable strict mode (`strict`, `noUncheckedIndexedAccess`, `strictTemplates`, `strictInjectionParameters`) in `tsconfig.json`; add npm script `typecheck` = `tsc -p tsconfig.app.json --noEmit && tsc -p tsconfig.spec.json --noEmit` in `package.json`
- [ ] T004 [P] Add ESLint via `npx ng add angular-eslint` and configure `eslint.config.js`; add npm script `lint`
- [ ] T005 [P] Install runtime dependencies `@supabase/supabase-js@^2` and `@jsverse/transloco@^8` in `package.json`
- [ ] T006 Install the Supabase CLI as a dev dependency (`supabase@^2`), run `npx supabase init`, and add npm scripts `db:start` (`supabase start`), `db:stop`, `db:reset` (`supabase db reset`), `db:test` (`supabase test db`), `db:types` (`supabase gen types typescript --local > src/app/core/supabase/database.types.ts`) in `package.json`
- [ ] T007 Configure Auth in `supabase/config.toml`: `[auth] enable_anonymous_sign_ins = true`, `enable_manual_linking = true`, `site_url = "http://localhost:4200"`, `additional_redirect_urls = ["http://localhost:4200/auth/callback"]`; `[auth.email] enable_signup = true` with OTP; `[auth.external.google] enabled = true`, `client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"`, `secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"`; keep the default anonymous sign-in rate limit; add `supabase/.env.example` with the two Google variables and add `supabase/.env` to `.gitignore`
- [ ] T008 [P] Install `@playwright/test`, create `playwright.config.ts` (baseURL `http://localhost:4200`, `webServer` running `npm start`, projects Chromium desktop and a 360×740 mobile viewport), create the `e2e/` directory, and add npm script `e2e`
- [ ] T009 [P] Create `e2e/support/mail.ts`: helper that reads the latest email for an address from the local Supabase mail catcher HTTP API (URL printed by `supabase start`) and returns the 6-digit OTP code
- [ ] T010 Create `.github/workflows/ci.yml`: on `pull_request` and push to `main`; Node from `.nvmrc`; `npm ci`; `npm run lint`; `npm run typecheck`; `npm test -- --watch=false`; `supabase/setup-cli` action, `supabase start`, `npm run db:test`; `npx playwright install --with-deps chromium`; `npm run e2e`; upload the Playwright report on failure

**Checkpoint**: `npm start` serves the empty app; `npm run lint`, `typecheck`, `test`, `db:start`, `db:test` (no tests yet) all succeed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Profiles, sign-in, localization, and test helpers that every story needs.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Database foundation (test first)

- [ ] T011 Create pgTAP helpers in `supabase/tests/000_helpers.sql` (committed, not rolled back, so later test files can use them): schema `tests`; `tests.create_user(email text, is_anonymous bool default false, display_name text default 'Test') returns uuid` inserting into `auth.users` (the profile trigger then creates `public.users`); `tests.authenticate_as(user_id uuid)` setting `role authenticated` and `request.jwt.claims` with `sub` and `is_anonymous` from `auth.users`; `tests.clear_authentication()` setting `role anon` and empty claims
- [ ] T012 Write failing pgTAP tests in `supabase/tests/010_users_test.sql`: inserting into `auth.users` creates a `public.users` row with the same id; `display_name` is taken from `raw_user_meta_data->>'display_name'`, else `->>'full_name'`, else `->>'name'`, else null; `language` from `raw_user_meta_data->>'language'` when it matches `^[a-z]{2}$`, else null; a user can select and update only their own `display_name` and `language`; a user cannot update `id` or `created_at`; `display_name` of `'   '` or 51 characters is rejected; `language` `'eng'` is rejected; the `anon` role cannot select from `users`
- [ ] T013 Create migration `users` in `supabase/migrations/<ts>_users.sql`: table `public.users` (`id uuid primary key references auth.users(id) on delete cascade`, `display_name text null check (display_name is null or char_length(btrim(display_name)) between 1 and 50)`, `language text null check (language is null or language ~ '^[a-z]{2}$')`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`); generic trigger function `public.set_updated_at()`; trigger function `public.handle_new_auth_user()` on `auth.users` insert per T012; RLS enabled; policy select own row (the co-member policy is added in US1); `grant update (display_name, language) on public.users to authenticated` with an update policy `id = auth.uid()`; revoke all from `anon`. Make T012 pass

### Supabase client and auth

- [ ] T014 [P] Create `src/environments/environment.ts` and `environment.development.ts` with `supabaseUrl` and `supabaseAnonKey` (local values from `supabase start`), and `src/app/core/supabase/supabase.client.ts`: an `InjectionToken<SupabaseClient<Database>>` provided in `src/app/app.config.ts` using the generated `src/app/core/supabase/database.types.ts`
- [ ] T015 Create `src/app/core/auth/auth.service.ts`: signals `session`, `user`, `isGuest` (from `user.is_anonymous`), `profile` (row from `public.users`, loaded after sign-in and on `onAuthStateChange`); methods `signInWithEmail(email)` (`signInWithOtp` with `options.data.language` = active language), `verifyEmailCode(email, code)`, `signInWithGoogle()` (`redirectTo` `/auth/callback`), `signInAsGuest(displayName)` (`signInAnonymously` with `options.data` `{ display_name, language }`), `signOut()`
- [ ] T016 [P] Write `src/app/core/auth/auth.guards.spec.ts`, then implement `src/app/core/auth/auth.guards.ts`: `requireSession` (no session → `/sign-in?returnUrl=<url>`), `requireProfile` (no `display_name` → `/profile/setup?returnUrl=<url>`), `requireAccount` (guest → `/trips`, which offers conversion)

### Localization

- [ ] T017 [P] Write `src/app/core/i18n/language-detection.spec.ts`, then implement `src/app/core/i18n/language-detection.ts`: pure `detectLanguage(browserLanguages: readonly string[], available: readonly string[], profileLanguage: string | null): string` — profile language if available; else the first browser language whose primary subtag (lowercased) is available; else `'en'`. Cases: `['ru-RU']`→`ru`, `['ru-UA','en']`→`ru`, `['en-GB']`→`en`, `['de-DE','ru']`→`ru`, `['de-DE']`→`en`, `[]`→`en`, profile `en` with browser `ru`→`en` (FR-021, FR-023)
- [ ] T018 Create `public/i18n/languages.json` (`["en","ru"]`), `public/i18n/en.json`, `public/i18n/ru.json` with namespaces `common`, `auth`, `profile`, `trips`, `invitations`, `members`, `errors`, `validation`; and `src/app/core/i18n/transloco.config.ts` + `transloco-loader.ts`: available languages read from `languages.json` at startup (`provideAppInitializer`), initial language from `detectLanguage(navigator.languages, available, null)`, `reRenderOnLangChange: true`, `fallbackLang: 'en'`, `missingHandler.logMissingKey: true`; register in `src/app/app.config.ts`
- [ ] T019 Create `src/app/core/i18n/language.service.ts`: signal `language`; `setLanguage(code)` switches Transloco without navigation, sets `<html lang>`, and when signed in updates `public.users.language`; on sign-in applies the profile language if set, else writes the current language to the profile (FR-021–FR-023)
- [ ] T020 [P] Write specs, then implement `src/app/core/i18n/intl-date.pipe.ts` and `intl-number.pipe.ts`: pipes declared `pure: false` (so they re-run when the language signal changes) that read `LanguageService.language()`, cache the `Intl` formatter per language, and formatting with `Intl.DateTimeFormat` / `Intl.NumberFormat`; date-only values (`'2027-05-10'`) are formatted without time-zone shift (FR-024)
- [ ] T021 [P] Write spec, then implement `src/app/core/i18n/error-code.ts`: `toErrorKey(error: unknown): string` mapping a PostgREST error whose `message` is one of the codes in `contracts/rpc.md` to `errors.<code>`, constraint violations to `errors.validation_failed`, and anything else to `errors.unknown`; add all `errors.*` keys to both language files
- [ ] T022 [P] Create translation checks in `src/app/core/i18n/translations.spec.ts` (research R8): (a) `en.json` and every other file in `languages.json` have identical key sets; (b) every key used in `src/**/*.html` and `src/**/*.ts` via `transloco` pipe/directive or `t('…')`/`translate('…')` exists in `en.json`; (c) every component template parsed with `parseTemplate` from `@angular/compiler` has no non-whitespace text node outside interpolations, except an allowlist `['·','—','–','/','|','×']`

### App shell and shared screens

- [ ] T023 Create `src/app/app.routes.ts` with all routes from `contracts/routes.md` (lazy-loaded feature components, guards from T016) and `src/app/app.ts` shell: header with app name, language switcher (calls `LanguageService.setLanguage`), profile link when signed in; `<router-outlet>`; global styles in `src/styles.scss` (mobile-first base, CSS custom properties for colors, spacing; no horizontal overflow at 360 px)
- [ ] T024 [P] Create shared components in `src/app/shared/`: `form-field/` (label, control slot, error message by translation key), `empty-state/`, `page-not-found/` (also used for "trip not found or no access", FR-019)
- [ ] T025 Create `src/app/features/auth/sign-in.page.ts` (+ `.html`, `.scss`): email step → code step (`verifyEmailCode`), "Continue with Google" button; on success navigate to `returnUrl` or `/trips`; errors via `toErrorKey`; and `src/app/features/auth/auth-callback.page.ts` completing OAuth / email-link sign-in and redirecting to the saved `returnUrl` (FR-017)
- [ ] T026 Create `src/app/features/profile/profile-setup.page.ts` (+ `.html`): display name field (required, 1–50 after trim) and language select; saves to `public.users`; continues to `returnUrl` (FR-020)

**Checkpoint**: A user can sign in by email, set a name, and see the empty shell in their browser language; `npm test` and `npm run db:test` pass.

---

## Phase 3: User Story 1 — Create a trip and see it in "My trips" (Priority: P1) 🎯 MVP

**Goal**: An account holder creates a trip, becomes its organizer, sees it in grouped "My trips", and can edit it.

**Independent Test**: Sign in as a new user, create a trip, sign in again from another browser; the trip is in "My trips" with the entered values and the organizer as the only participant.

### Tests for User Story 1 (write first, must fail)

- [ ] T027 [P] [US1] Write pgTAP tests in `supabase/tests/100_trips_test.sql` for `create_trip`: account with a name creates a trip and gets an `organizer`/`active` membership and one `invitations` row with a 22-character token; returns the trip id; guest → `guest_not_allowed`; no name → `profile_incomplete`; no session → `not_authenticated`; name `'  '` or 101 chars → `validation_failed`; `end_date < start_date` → `validation_failed`; `base_currency` `'eur'` or `'EURO'` → `validation_failed`; only dates partly set is allowed; a second organizer row for the same trip violates the unique index
- [ ] T028 [P] [US1] Write pgTAP tests in `supabase/tests/110_trips_update_test.sql` for `update_trip`: organizer updates all fields and gets `version + 1`; stale version → `version_conflict`; participant → `not_organizer`; outsider → `not_found`; same validation as `create_trip`
- [ ] T029 [P] [US1] Write pgTAP tests in `supabase/tests/120_trips_rls_test.sql`: an active member can select the trip, its active `trip_members` rows, and co-members' `users` rows; an outsider (account and guest) selects zero rows from `trips`, `trip_members`, `invitations`, and cannot see the organizer's `users` row; only the organizer can select the trip's `invitations` row; direct `insert`/`update`/`delete` on `trips`, `trip_members`, `invitations` by any client role fails
- [ ] T030 [P] [US1] Write `src/app/features/trips/trip-grouping.spec.ts` for FR-005: groups `current_or_upcoming` (start date ascending), `undated` (`created_at` descending), `past` (last date = `end_date ?? start_date` before today, last date descending); a trip ending today is not past; a trip with only a start date in the past is past; empty groups are omitted; "today" is passed in as a local date string so tests are time-zone independent

### Implementation for User Story 1

- [ ] T031 [US1] Create migration `trips` in `supabase/migrations/<ts>_trips.sql`: tables per data-model.md — `trips` (`name text not null check (char_length(btrim(name)) between 1 and 100)`, `start_date date null`, `end_date date null`, `check (start_date is null or end_date is null or end_date >= start_date)`, `base_currency char(3) not null check (base_currency ~ '^[A-Z]{3}$')`, `created_at`, `updated_at`, `version integer not null default 1`); `trip_members` (`primary key (trip_id, user_id)`, `role text not null check (role in ('organizer','participant'))`, `status text not null check (status in ('active','left','removed'))`, `check (role <> 'organizer' or status = 'active')`, `joined_at timestamptz not null default now()`, `updated_at`, `version integer not null default 1`, unique index on `(trip_id) where role = 'organizer'`); `invitations` (`trip_id uuid primary key`, `token text not null unique`, `created_at`); triggers bumping `updated_at` and `version` on update; RLS enabled on all three; `revoke insert, update, delete` from `anon, authenticated`
- [ ] T032 [US1] Create migration `trip_access` in `supabase/migrations/<ts>_trip_access.sql`: `SECURITY DEFINER STABLE` helpers `public.is_active_member(trip_id uuid)`, `public.is_organizer(trip_id uuid)`, `public.shares_trip_with(other_user uuid)` (active co-member, or removed member of a trip the caller organizes); select policies per the access table in data-model.md for `trips`, `trip_members` (own rows any status; `active` rows in trips where the caller is active; all rows for the organizer), `invitations` (organizer), and an extra `users` select policy using `shares_trip_with(id)`. Make T029 pass
- [ ] T033 [US1] Create migration `create_update_trip` in `supabase/migrations/<ts>_create_update_trip.sql`: `public.create_trip(p_name text, p_start_date date, p_end_date date, p_base_currency text) returns uuid` and `public.update_trip(p_trip_id uuid, p_expected_version int, p_name text, p_start_date date, p_end_date date, p_base_currency text) returns int` per `contracts/rpc.md` (trims name; token = `translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/=', '-_')` truncated to 22 chars); `grant execute … to authenticated`. Make T027 and T028 pass
- [ ] T034 [P] [US1] Implement `src/app/features/trips/trip-grouping.ts` (pure function `groupTrips(trips, today)` returning ordered non-empty groups). Make T030 pass
- [ ] T035 [US1] Create `src/app/features/trips/trips.service.ts`: `listMyTrips()` (trips where the caller is an active member, with participant count and own role), `getTrip(id)` (trip + active members with `display_name` and role; returns `null` for not found / no access), `createTrip(input)` and `updateTrip(id, expectedVersion, input)` via RPC; errors mapped with `toErrorKey`
- [ ] T036 [P] [US1] Create `src/app/shared/currency-picker/currency-picker.component.ts` (+ `.html`, spec): options from `Intl.supportedValuesOf('currency')`, labels `CODE — name` from `Intl.DisplayNames(language, { type: 'currency' })`, searchable by code and localized name, implements `ControlValueAccessor` (FR-003)
- [ ] T037 [US1] Create `src/app/features/trips/trip-form/trip-form.component.ts` (+ `.html`, spec): reactive form shared by create and edit — name (required, 1–100 after trim), start date, end date (≥ start date), base currency (required); field-level errors via translation keys; server `validation_failed` with `detail` mapped to the matching field; entered values kept on error (Story 1 scenario 3)
- [ ] T038 [US1] Create `src/app/features/trips/my-trips.page.ts` (+ `.html`): grouped list from `groupTrips` with name, dates (`intlDate`), currency, participant count (`intlNumber`), own role; empty state with "Create trip"; for guests the create action shows a message that creating trips needs an account (conversion UI arrives in US5)
- [ ] T039 [US1] Create `src/app/features/trips/trip-create.page.ts` and `trip-edit.page.ts` using `TripFormComponent`; create → navigate to `/trips/:id`; edit sends the loaded `version`, and on `version_conflict` shows the error and reloads the trip
- [ ] T040 [US1] Create `src/app/features/trips/trip-detail.page.ts` (+ `.html`): trip details and participant list (name, role, "you" marker on own entry); organizer sees "Edit"; renders `page-not-found` with the "trip not found or no access" text when `getTrip` returns `null`
- [ ] T041 [US1] Add all `trips.*`, `validation.*` keys used by T036–T040 to `public/i18n/en.json` and `public/i18n/ru.json`; run `npm test` so T022 checks pass
- [ ] T042 [US1] Write e2e smoke `e2e/create-trip.spec.ts`: sign in by email (OTP via `e2e/support/mail.ts`), complete profile, create "Lisbon 2027" 2027-05-10 to 2027-05-17 EUR, see it under current/upcoming in "My trips", open it, see self as organizer; submit an invalid end date and see the field error with values kept

**Checkpoint**: User Story 1 works end-to-end; `npm run db:test`, `npm test`, `npm run e2e` pass.

---

## Phase 4: User Story 2 — Invite participants by link (Priority: P2)

**Goal**: The organizer shares one link; invitees join with an account or as a guest; members see each other live.

**Independent Test**: Copy the link as organizer; open it in a fresh browser, join as guest "Masha"; both see the same two-person list without reloading.

### Tests for User Story 2 (write first, must fail)

- [ ] T043 [P] [US2] Write pgTAP tests in `supabase/tests/200_invitations_test.sql`: `get_invitation_preview` as `anon` returns exactly trip name, dates, organizer name, `is_full`, `viewer_status = null`; as a signed-in non-member `viewer_status = 'none'`; as a removed member `'removed'`; unknown, malformed (`'x'`), and reset tokens all raise `invalid_invitation`; `reset_invitation` by organizer returns a new 22-char token and the old one becomes invalid; by participant → `not_organizer`; by outsider → `not_found`
- [ ] T044 [P] [US2] Write pgTAP tests in `supabase/tests/210_join_trip_test.sql`: account and guest with a name join as `participant`/`active`; joining twice keeps one row and the same `version` (idempotent); a `left` member rejoins as `active`; a `removed` member → `removed_from_trip`; no name → `profile_incomplete`; no session → `not_authenticated`; with 20 active members (organizer + 19) the 21st → `trip_full`, while `left`/`removed` members do not count; after joining, the user can select the trip and the active member list

### Implementation for User Story 2

- [ ] T045 [US2] Create migration `invitations_join` in `supabase/migrations/<ts>_invitations_join.sql`: `public.get_invitation_preview(p_token text)` (grant to `anon, authenticated`), `public.join_trip(p_token text) returns uuid` (locks the trip row with `select … for update` before counting active members; limit 20), `public.reset_invitation(p_trip_id uuid) returns text` (grant to `authenticated`) per `contracts/rpc.md`. Make T043 and T044 pass
- [ ] T046 [US2] Create `src/app/features/invitations/invitations.service.ts`: `preview(token)`, `join(token)`, `getLink(tripId)` (organizer reads `invitations.token`, builds `${location.origin}/join/<token>`), `reset(tripId)`
- [ ] T047 [US2] Create `src/app/features/invitations/join.page.ts` (+ `.html`) for `/join/:token` (no guard): loads the preview; states per `contracts/routes.md` — valid (trip name, dates, organizer; "Sign in" → `/sign-in?returnUrl=/join/<token>`; "Continue as guest" with display name field 1–50), invalid (FR-009 edge case text), full (`trip_full`), removed (`removed_from_trip`), already a member (navigate to `/trips/:id`); a signed-in user with a name sees "Join trip" confirmation; guest path calls `signInAsGuest(name)` then `join(token)` then navigates to the trip
- [ ] T048 [US2] Add the invitation block to `src/app/features/trips/trip-detail.page.html`: organizer-only "Copy invitation link" (Clipboard API with a visible "copied" confirmation) and "Reset link" with a confirmation dialog (FR-008)
- [ ] T049 [US2] Create `src/app/core/realtime/trip-channel.ts`: `watchTrip(tripId, onChange)` subscribing to `postgres_changes` on `trips` (`id=eq.<id>`), `trip_members` (`trip_id=eq.<id>`), and `users`, debouncing refetch by 300 ms, returning an unsubscribe function; use it in `trip-detail.page.ts` to refetch the trip and members (FR-014); enable Realtime for the three tables in a migration `realtime` (`alter publication supabase_realtime add table …`)
- [ ] T050 [US2] Add all `invitations.*` keys used by T047–T048 to `public/i18n/en.json` and `public/i18n/ru.json`
- [ ] T051 [US2] Write e2e smoke `e2e/join-as-guest.spec.ts`: organizer creates a trip and copies the link; a second browser context with `locale: 'ru-RU'` opens it, sees the Russian invitation page with trip name and organizer, joins as guest "Маша", lands on the trip; the organizer's page shows "Маша" within 5 s without reload (SC-002, SC-003)

**Checkpoint**: User Stories 1 and 2 work; guests and account holders can join; lists update live.

---

## Phase 5: User Story 3 — Access limited to trip members (Priority: P2)

**Goal**: Only active members see a trip; the organizer can remove, block, and unblock; participants can leave.

**Independent Test**: As a signed-in non-member, open `/trips/<id>`; see "no access" and no trip data.

### Tests for User Story 3 (write first, must fail)

- [ ] T052 [P] [US3] Write pgTAP tests in `supabase/tests/300_membership_test.sql`: `remove_member` by organizer sets `removed` and increments `version`; stale version → `version_conflict`; on self → `cannot_remove_self`; by participant → `not_organizer`; by outsider → `not_found`; `unblock_member` changes `removed` to `left` and the user can then `join_trip`; `leave_trip` by a participant sets `left`; by the organizer → `organizer_cannot_leave`; after `removed` or `left` the user selects zero rows from `trips` and only their own `trip_members` row
- [ ] T053 [P] [US3] Write the role matrix in `supabase/tests/310_access_matrix_test.sql` (SC-004): for each role — outsider account, outsider guest, participant (account), participant (guest), organizer — assert every select on `trips`, `trip_members`, `users`, `invitations` and every call to `update_trip`, `reset_invitation`, `remove_member`, `unblock_member` either succeeds or is refused exactly as in data-model.md "Access rules"; the organizer sees removed members and their names, participants do not

### Implementation for User Story 3

- [ ] T054 [US3] Create migration `membership` in `supabase/migrations/<ts>_membership.sql`: `public.remove_member(p_trip_id uuid, p_user_id uuid, p_expected_version int)`, `public.unblock_member(p_trip_id uuid, p_user_id uuid, p_expected_version int)`, `public.leave_trip(p_trip_id uuid)` per `contracts/rpc.md`; grant to `authenticated`. Make T052 and T053 pass
- [ ] T055 [US3] Extend `src/app/features/trips/trips.service.ts` with `removeMember`, `unblockMember`, `leaveTrip`, and `listRemovedMembers(tripId)` (organizer only)
- [ ] T056 [US3] Extend `src/app/features/trips/trip-detail.page.ts` (+ `.html`): organizer sees "Remove" on each participant (confirmation dialog) and a "Removed participants" section with "Unblock"; participants see "Leave trip" (confirmation); when the realtime refetch shows the viewer is no longer an active member, navigate to `/trips` with a message (Story 3 scenario 4)
- [ ] T057 [US3] Add all `members.*` keys used by T056 to `public/i18n/en.json` and `public/i18n/ru.json`
- [ ] T058 [US3] Write e2e smoke `e2e/access-denied.spec.ts`: organizer creates a trip; a different signed-in user opens `/trips/<id>` directly and sees "trip not found or no access" and none of the trip's name, dates, or participants

**Checkpoint**: Access rules hold for all roles; removal, blocking, unblocking, and leaving work.

---

## Phase 6: User Story 4 — Profile with name and interface language (Priority: P3)

**Goal**: Users change their name and language at any time; the language switches instantly, persists, and follows the user across devices.

**Independent Test**: With a Russian browser, open the invitation page (Russian), join as guest, switch to English with a half-filled form; values stay; after reload the language stays English.

### Tests for User Story 4 (write first, must fail)

- [ ] T059 [P] [US4] Write `src/app/core/i18n/language.service.spec.ts`: `setLanguage` switches Transloco and updates the profile when signed in; on sign-in a saved profile language overrides the browser language; without a saved language the current language is written to the profile; switching does not trigger router navigation
- [ ] T060 [P] [US4] Write e2e smoke `e2e/language-switch.spec.ts`: with `locale: 'ru-RU'`, a signed-in user opens `/trips/new`, types a name and picks dates, switches to English in the header; the labels are English and the typed values remain; dates in the form summary are formatted in English; after reload the interface stays English (SC-006, FR-022, FR-023)

### Implementation for User Story 4

- [ ] T061 [US4] Create `src/app/features/profile/profile.page.ts` (+ `.html`) for `/profile`: display name (1–50 after trim) with save, language select bound to `LanguageService`; shows the user's kind (guest / account) — the conversion block is added in US5 (FR-020, FR-022)
- [ ] T062 [US4] Make `LanguageService` (from T019) pass T059: apply the profile language on every sign-in and session restore; keep the active language when the profile is loaded later than the first render (no flicker back to the browser language)
- [ ] T063 [US4] Add all `profile.*` keys used by T061 to `public/i18n/en.json` and `public/i18n/ru.json`

**Checkpoint**: Language and name are per-user, persisted, and switch without losing input.

---

## Phase 7: User Story 5 — Convert a guest profile into an account (Priority: P3)

**Goal**: A guest turns their profile into an account by email or Google and keeps everything.

**Independent Test**: Join as guest, convert with an email, sign in with that email in another browser; same trips, name, language; members still see one entry.

### Tests for User Story 5 (write first, must fail)

- [ ] T064 [P] [US5] Write pgTAP test in `supabase/tests/400_guest_conversion_test.sql`: after setting `auth.users.is_anonymous = false` and an email for a guest who is a member of two trips, the same user id keeps both memberships, role, `display_name`, and `language`, and `create_trip` now succeeds
- [ ] T065 [P] [US5] Write `src/app/core/auth/guest-conversion.spec.ts`: conversion by email calls `updateUser({ email })` then `verifyOtp({ type: 'email_change' })`; by Google calls `linkIdentity({ provider: 'google' })`; an "email already registered" / "identity already exists" error maps to `errors.account_exists` and leaves the session a guest

### Implementation for User Story 5

- [ ] T066 [US5] Add `convertWithEmail(email)`, `confirmConversion(email, code)`, `convertWithGoogle()` to `src/app/core/auth/auth.service.ts`; refresh `isGuest` and `profile` afterwards; map the "already registered" errors to `errors.account_exists`. Make T065 pass
- [ ] T067 [US5] Add the conversion block to `src/app/features/profile/profile.page.html` (guests only): email → code steps and "Continue with Google"; success message; explanation that without an account the profile lives only in this browser (spec edge case)
- [ ] T068 [US5] In `src/app/features/trips/my-trips.page.html`, replace the guest "creating trips needs an account" message with a call to action linking to the conversion block on `/profile` (Story 1 scenario 6, FR-001a); add a dismissible reminder banner for guests on `/trips`
- [ ] T069 [US5] Add `errors.account_exists` and all conversion keys to `public/i18n/en.json` and `public/i18n/ru.json`

**Checkpoint**: All five stories work independently.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T070 [P] Run the 360 px Playwright project over all e2e specs and fix any horizontal overflow (SC-007)
- [ ] T071 [P] Review all migrations: every function has `SET search_path = ''`, grants match `contracts/rpc.md`, no table grants `insert/update/delete` to client roles beyond `users (display_name, language)`; record findings in the PR description
- [ ] T072 [P] Update `README.md`: prerequisites (Node ≥ 24.15, Docker), setup and test commands from `quickstart.md`, link to `specs/001-trip-invitations/`
- [ ] T073 Run every manual scenario in `specs/001-trip-invitations/quickstart.md` and note the result of each in the PR description
- [ ] T074 Run the full gate locally — `npm run lint && npm run typecheck && npm test -- --watch=false && npm run db:test && npm run e2e` — and confirm CI is green on the pull request

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none; T001 gates everything (Node version).
- **Foundational (Phase 2)**: after Setup; blocks all stories.
- **US1 (Phase 3)**: after Foundational. Creates the `trips`, `trip_members`, `invitations` tables and RLS that all later stories use.
- **US2 (Phase 4)**: after US1 (needs trips and the invitation row created by `create_trip`).
- **US3 (Phase 5)**: after US2 (removal and blocking need members who joined). Ship US2 and US3 together: US3 is the protection for US2.
- **US4 (Phase 6)**: after Foundational; independent of US1–US3 except that the e2e test uses the create-trip form from US1.
- **US5 (Phase 7)**: after US2 (a guest exists only via joining) and US4 (profile page).
- **Polish (Phase 8)**: after all stories.

### Within Each Story

- pgTAP and unit tests first; confirm they fail; then the migration or code that makes them pass.
- Migrations before services; services before pages; translation keys before the story's e2e test.

### Parallel Opportunities

- Setup: T004, T005, T008, T009 after T002/T003.
- Foundational: T014, T016, T017, T020, T021, T022, T024 in parallel once T013 and T018 are done.
- US1: tests T027–T030 in parallel; T034 and T036 in parallel with the migrations.
- US2: T043 and T044 in parallel.
- US3: T052 and T053 in parallel.
- US4 can run in parallel with US2/US3 by a second developer.
- Polish: T070–T072 in parallel.

## Parallel Example: User Story 1

```text
Task: "Write pgTAP tests for create_trip in supabase/tests/100_trips_test.sql"
Task: "Write pgTAP tests for update_trip in supabase/tests/110_trips_update_test.sql"
Task: "Write pgTAP RLS tests in supabase/tests/120_trips_rls_test.sql"
Task: "Write trip-grouping spec in src/app/features/trips/trip-grouping.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup → Phase 2 Foundational.
2. Phase 3 (US1): a single user can create and manage trips.
3. **Stop and validate**: quickstart scenarios 1–2, `db:test`, `test`, `e2e`.

### Incremental Delivery

1. US1 → demo trip creation.
2. US2 + US3 together → groups can form, access is protected (first release worth showing to friends).
3. US4 → per-user language and name.
4. US5 → guests keep their trips across devices.
5. Polish → full gate and quickstart run.

## Notes

- Commit after each task or logical group; keep each migration small and named after what it adds.
- Never edit an applied migration; add a new one.
- If a task finds a gap in the spec or contracts, update the document in the same commit.
