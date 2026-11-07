# Contract: Database Functions (RPC)

**Feature**: [../spec.md](../spec.md) | **Data model**: [../data-model.md](../data-model.md)

All writes go through these PostgreSQL functions, called with `supabase.rpc(name, args)`. Each
runs in one transaction, is `SECURITY DEFINER` with a pinned `search_path`, and identifies the
caller by `auth.uid()`. Reads of trips, members, profiles, and invitations use plain table
queries under RLS (see the data model).

`EXECUTE` is revoked from `PUBLIC` and `anon` on every function, then granted to `authenticated`,
and also to `anon` for `get_invitation_preview` only. A client with no session is therefore
refused with PostgreSQL error `42501` before a function runs.

## Errors

Functions raise a PostgreSQL exception whose `message` is a stable **error code** from the list
below and whose `SQLSTATE` is `P0001`. The client maps codes to translation keys
(`errors.<code>`); the database never returns translated text (principle VI).

| Code | Meaning |
|---|---|
| `not_authenticated` | Signed-in role without a user id; the client also shows it for error `42501` |
| `profile_incomplete` | Caller has no display name |
| `guest_not_allowed` | Caller is a guest (`auth.users.is_anonymous`, read from the table, not the JWT) |
| `not_found` | Trip does not exist **or** caller has no access (same code on purpose, FR-019) |
| `not_organizer` | Caller is a member but not the organizer |
| `invalid_invitation` | Token unknown, malformed, or reset |
| `trip_full` | Trip already has 20 active members |
| `removed_from_trip` | Caller was removed by the organizer and is blocked |
| `cannot_remove_self` | Organizer tried to remove themselves |
| `organizer_cannot_leave` | Organizer tried to leave |
| `validation_failed` | Input breaks a rule; `detail` holds the field name (`name`, `dates`, `base_currency`) |
| `account_exists` | Supabase Auth error, not raised by these functions: during guest conversion the email belongs to another user |
| `invalid_code` | Client key for the Supabase Auth error `otp_expired`: the one-time code is wrong or expired |
| `rate_limited` | Client key for the Supabase Auth errors `over_email_send_rate_limit` and `over_request_rate_limit` |

## Trips

### `create_trip(p_name text, p_start_date date, p_end_date date, p_base_currency text) → uuid`

Creates the trip, the caller's `organizer` membership, and the invitation token. Returns the trip
id.
Errors: `not_authenticated`, `guest_not_allowed`, `profile_incomplete`, `validation_failed`.
Requirements: FR-001, FR-001a, FR-002, FR-004, FR-007.

### `update_trip(p_trip_id uuid, p_name text, p_start_date date, p_end_date date, p_base_currency text) → void`

Organizer only. Replaces all editable fields; the last write wins (no version, constitution
v1.1.0 principle III).
Errors: `not_found`, `not_organizer`, `validation_failed`.
Requirements: FR-006.

## Invitations

### `get_invitation_preview(p_token text) → table(trip_name text, start_date date, end_date date, organizer_name text, is_full boolean, viewer_status text)`

Callable **without a session** (`anon`) and with one. Returns one row or raises
`invalid_invitation`. `viewer_status` is `null` without a session, otherwise the caller's
membership status in that trip (`active`, `left`, `removed`) or `none`. Returns nothing else about
the trip.
Requirements: FR-009, FR-019, spec edge cases (invalid link, full trip).

### `join_trip(p_token text) → uuid`

Adds the caller as an `active` participant (or reactivates a `left` membership) and returns the
trip id. Idempotent for active members (no write, no event). Locks the trip row while counting
members. On an actual join sets `trips.members_changed_at`.
Errors: `not_authenticated`, `profile_incomplete`, `invalid_invitation`, `removed_from_trip`,
`trip_full`.
Requirements: FR-007a, FR-010, FR-011, FR-013a.

### `reset_invitation(p_trip_id uuid) → text`

Organizer only. Replaces the token and returns the new one; the old token is invalid at once.
Errors: `not_found`, `not_organizer`.
Requirements: FR-008.

## Membership

### `remove_member(p_trip_id uuid, p_user_id uuid) → void`

Organizer only. Sets the member's status to `removed` and `trips.members_changed_at`.
Errors: `not_found` (also when the target is not an active participant), `not_organizer`,
`cannot_remove_self`.
Requirements: FR-013, FR-013a.

### `unblock_member(p_trip_id uuid, p_user_id uuid) → void`

Organizer only. Changes `removed` to `left`, so the person can rejoin via the link; sets
`trips.members_changed_at`.
Errors: `not_found` (also when the target is not `removed`), `not_organizer`.
Requirements: FR-013a.

### `leave_trip(p_trip_id uuid) → void`

Sets the caller's own active membership to `left` and `trips.members_changed_at`.
Errors: `not_found`, `organizer_cannot_leave`.
Requirements: FR-013.

## Profile

Profiles are updated directly: `update users set display_name = …, language = …, theme = … where
id = auth.uid()` under RLS and column grants. A trigger trims `display_name`. Check constraints return `validation_failed`-equivalent
constraint errors, which the client maps to field messages.
Requirements: FR-020, FR-022, FR-028, FR-029.

## Auth (Supabase Auth, not custom functions)

| Use | Call |
|---|---|
| Continue as guest | `auth.signInAnonymously({ options: { data: { display_name, language } } })` |
| Email sign-in | `auth.signInWithOtp({ email, options: { data: { language }, emailRedirectTo } })` → `auth.verifyOtp(...)` |
| Guest → account | `auth.updateUser({ email })` → `auth.verifyOtp({ type: 'email_change', ... })` → `auth.refreshSession()` |
| Sign out (account holders only) | `auth.signOut()` |

Requirements: FR-015, FR-016, FR-017, FR-032.

## Realtime subscriptions

| Channel | Table | Filter | Client reaction |
|---|---|---|---|
| `trip:<id>` | `trips` | `id=eq.<id>` | Refetch trip and members (also fires on `members_changed_at`, so leaves and removals reach every active member) |
| `trip:<id>` | `trip_members` | `trip_id=eq.<id>` | Refetch members; if own status is no longer `active`, go to "My trips" |
| `trip:<id>` | `users` | none (RLS limits to co-members) | Refetch members |

Requirements: FR-014, SC-003.
