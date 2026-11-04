# Research: Trip Creation and Participant Invitations

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-27

Package versions were checked against the npm registry on 2026-10-27.

## R1. Toolchain versions

**Decision**: Angular 22.2 (`@angular/core`, `@angular/cli`, `@angular/build`), TypeScript 6.0.x,
Node.js ≥ 24.15 (LTS line 24), npm. `@supabase/supabase-js` 2.x, Supabase CLI 2.x as a dev
dependency (`supabase` npm package), `@jsverse/transloco` 8.x.

**Rationale**: Latest stable lines at the time of planning. Angular 22.2 requires TypeScript
`>=6.0 <6.1` (so not TypeScript 7.x, which is the npm `latest`) and Node `^22.22.3 || ^24.15.0 ||
>=26`. The local machine has Node 24.14.1, which is **below** the minimum: upgrade Node before
scaffolding (see [quickstart.md](./quickstart.md)).

**Alternatives considered**: pnpm (not installed locally; npm is enough for a single app);
pinning Angular 21 (no reason, nothing depends on it).

## R2. Guest identity and account sign-in

**Decision**: Supabase Auth with three methods:
- **Guests** — Supabase anonymous sign-in. The guest gets a real `auth.users` row and a JWT with
  `is_anonymous = true`; the session is persisted in the browser, which gives FR-015.
- **Accounts** — email one-time code/link (`signInWithOtp`). Google OAuth is deferred to a later
  feature (`docs/decisions.md` D6).
- **Guest → account conversion (FR-016)** — on the anonymous user: `updateUser({ email })` and
  then OTP verification (`type: 'email_change'`), followed by `refreshSession()` so the JWT's
  `is_anonymous` claim becomes `false` at once. The user id does not change, so memberships, roles, name, and language stay without any data migration.

**Rationale**: The constitution fixes Supabase Auth. Anonymous sign-ins produce a persistent,
server-recognized identity that RLS can check, unlike a client-generated id. Converting to an
email that already belongs to another user fails in Supabase, which matches the spec's edge case (refuse, no merge).

**Settings required**: anonymous sign-ins enabled; email OTP enabled; rate limit on anonymous sign-ins per IP (Supabase default) kept on. CAPTCHA (e.g. Cloudflare
Turnstile) on anonymous sign-in is deferred to stage 5 "launch readiness".

**Alternatives considered**: client-generated guest UUID stored in localStorage (not verifiable by
the server, violates principle II); a custom guest token table (reimplements what Supabase Auth
already does).

## R3. Where business rules run

**Decision**: All writes go through PostgreSQL functions called via RPC (`SECURITY DEFINER`, with
`search_path` pinned, each running as one transaction). Tables get RLS for reads; direct
`INSERT`/`UPDATE`/`DELETE` from clients is revoked except updating one's own profile. No Edge
Functions in this feature.

**Rationale**: Joining needs an atomic check of token, block, and the 20-member limit; creating a
trip must create the trip, the organizer membership, and the invitation together (principle III).
SQL functions do this in one transaction close to the data and are testable with pgTAP. Edge
Functions add a deploy unit without benefit here, since no secrets or external calls are needed.

**Alternatives considered**: direct table writes guarded only by RLS (cannot express the member
limit or "create three rows atomically"); Edge Functions (extra runtime, no gain).

## R4. Concurrency: member limit and stale edits

**Decision**:
- `join_trip` locks the trip row (`SELECT … FOR UPDATE`) before counting active members, so two
  concurrent joins for the last place serialize and the limit of 20 is never exceeded.
- No `version` columns on `trips` or `trip_members`: constitution v1.1.0 requires versions for
  financial records only. Trip details are edited by the single organizer; the last write wins.
- `join_trip` is idempotent: an active member gets the trip back without changes.
- The concurrent "last free place" case is not covered by an automated test (accepted risk,
  2026-10-31): the row lock is checked in the migration review (tasks T071), and the limit
  guards against link abuse, not money.

**Rationale**: Row locking is the simplest correct approach at this scale (≤ 20 members, rare
joins).

**Alternatives considered**: counting in a constraint trigger (harder to test and reason about);
serializable isolation for the whole function (retries needed in the client).

## R5. Invitation link

**Decision**: One row per trip in `invitations` with a random token of 128 bits (16 bytes from
`gen_random_bytes`, base64url-encoded, 22 characters). The link is `/join/<token>`. Reset replaces
the token in place. Unknown, malformed, and reset tokens return the same "invalid invitation"
result. The preview function is callable without a session and returns only trip name, dates,
organizer name, and whether the trip is full.

**Rationale**: Unguessable links (spec assumption), constant-shape errors (no trip enumeration,
FR-019), and the preview data limited exactly as FR-009 requires.

**Alternatives considered**: invitations as many rows with history (not needed: no activity log in
this feature, per clarification); signed JWT links (cannot be revoked without a denylist).

## R6. Real-time updates

**Decision**: Supabase Realtime `postgres_changes` on `trips`, `trip_members` (filtered by
`trip_id`), and `users` (profiles; RLS limits events to co-members). On any event, the client
refetches the affected trip view. A user who sees their own membership change to `removed` or
`left` is navigated to "My trips".

**Rationale**: Realtime is in the constitution's stack. `postgres_changes` honors RLS, so events
do not leak data to non-members. Refetch-on-event keeps client state simple and correct at this
scale and meets SC-003 (≤ 5 s).

**Alternatives considered**: Broadcast from SQL functions (more code, no benefit at this volume);
polling (wastes requests and is slower).

## R7. Localization

**Decision**:
- Transloco with translation files in `public/i18n/<lang>.json` and a manifest
  `public/i18n/languages.json` listing available languages. The app reads the manifest at
  startup, so a new language needs only files, no code (principle VI).
- Default language: the first entry of `navigator.languages` whose primary subtag is in the
  manifest; otherwise `en` (FR-021: `['de-DE','ru']` → Russian, any `ru-*` → Russian).
- Language names in the switcher come from `Intl.DisplayNames(code, { type: 'language' })`
  (each language named in itself), so a new language needs no new keys in other files.
- After sign-in, the profile language wins (FR-023). A guest's chosen browser language is saved to
  the profile on first sign-in.
- Formatting through small signal-aware pipes over `Intl.DateTimeFormat` and `Intl.NumberFormat`
  for the active language (constitution: format via `Intl`). Currency names come from
  `Intl.DisplayNames` and the currency list from `Intl.supportedValuesOf('currency')`, so no
  currency data file is needed (FR-003).
- The database stores a language code (`ru`, `en`) validated by format only, not by an enum, so
  adding a language needs no migration.

**Rationale**: Transloco switches language at runtime without re-creating components, so form
values stay (FR-022, SC-006).

**Alternatives considered**: Angular built-in i18n (compile-time, one build per language, no
runtime switch); ngx-translate (works, but the constitution names Transloco as the example and it
has better signal support).

## R8. Detecting untranslated strings (SC-005)

**Decision**: Two automated checks in the unit test suite:
1. **Key parity** — every key in `en.json` exists in every other language file and vice versa;
   every key used in templates and code (`t('…')`, `transloco` pipe) exists in `en.json`.
2. **No bare text in templates** — a test parses every component template with
   `@angular/compiler`'s `parseTemplate` and fails on any text node that is not whitespace and is
   not inside an interpolation, and on any static `placeholder`, `title`, `aria-label`, or `alt`
   attribute. A small allowlist covers non-language symbols (e.g. "·", "—").
3. **No UI strings in code** — user-visible text set from TypeScript (snackbars, `confirm`
   texts, `document.title`) goes only through `translate(...)`; a test scans `src/**/*.ts`
   (except specs) for string literals passed to those APIs.

**Rationale**: Both checks run in Vitest with no extra tooling and give the constitution's
merge gate "no untranslated UI strings" a concrete test.

**Alternatives considered**: `@angular-eslint/template/i18n` (built for Angular's own i18n
attributes, not Transloco); manual review only (not verifiable).

## R9. Testing and CI

**Decision** (see `docs/decisions.md` D5):
- **Vitest** via the Angular CLI unit-test builder (jsdom) for pure functions, services, and
  components.
- **pgTAP** via `supabase test db` for RLS and SQL functions, covering the outsider, guest,
  participant, and organizer roles (principle VII, SC-004).
- **Playwright** smoke suite against the app on a local Supabase: create a trip, join as a guest,
  switch language with a half-filled form, outsider denied. Email sign-in in e2e reads the code
  from the local mail catcher that ships with the Supabase CLI.
- **fast-check** is added with the first financial logic (expenses feature); this feature has no
  money calculations.
- **GitHub Actions** on every pull request: lint, `tsc` strict type check, unit tests, `supabase
  start` + `supabase test db`, Playwright.

**Rationale**: Matches the user's choices and the constitution's merge gates.

## R10. Hosting

**Decision**: No deployment in this feature. Target host when deploying: Cloudflare (Workers
static assets), no PWA (see `docs/decisions.md` D4).

**Rationale**: The feature is verified locally and in CI; choosing the deploy setup now would add
work without validating anything in this slice.

## R11. Themes and fonts

**Decision**: Colors are CSS custom properties named by role, in `src/styles/themes.scss`
([contracts/theme-tokens.md](./contracts/theme-tokens.md)). The active theme is the `data-theme`
attribute on `<html>`. A short inline script in `index.html` applies the copy from
`localStorage` before the first paint; `ThemeService` then reconciles it with the profile. Fonts
come from `@fontsource` packages and ship with the app.

**Rationale**: A role-based set of variables keeps a new theme to one block of values, and switching
an attribute re-colors the page without a reload or re-render, so forms keep their values. Only
this copy can prevent a flash, because the profile arrives after the first paint. Self-hosting
avoids a request to a third party on every visit.

**Alternatives considered**: `prefers-color-scheme` as the default (rejected by the user: first
visit is always light); keeping the theme only in the browser (it would not follow the user across
devices); a fixed enum for `users.theme` (a new theme would need a migration); Google Fonts
(third-party request and no real benefit for this app).
