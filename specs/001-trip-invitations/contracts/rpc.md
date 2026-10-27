# Contract: Database Functions (RPC)

**Feature**: [../spec.md](../spec.md) | **Data model**: [../data-model.md](../data-model.md)

All writes go through these PostgreSQL functions, called with `supabase.rpc(name, args)`. Each
runs in one transaction, is `SECURITY DEFINER` with a pinned `search_path`, and identifies the
caller by `auth.uid()`. Reads of trips, members, profiles, and invitations use plain table
queries under RLS (see the data model).

## Errors

Functions raise a PostgreSQL exception whose `message` is a stable **error code** from the list
below and whose `SQLSTATE` is `P0001`. The client maps codes to translation keys
(`errors.<code>`); the database never returns translated text (principle VI).

| Code | Meaning |
|---|---|
| `not_authenticated` | No session |
| `profile_incomplete` | Caller has no display name |
| `guest_not_allowed` | Caller is a guest (anonymous) |
| `not_found` | Trip does not exist **or** caller has no access (same code on purpose, FR-019) |
| `not_organizer` | Caller is a member but not the organizer |
| `invalid_invitation` | Token unknown, malformed, or reset |
| `trip_full` | Trip already has 20 active members |
| `removed_from_trip` | Caller was removed by the organizer and is blocked |
| `version_conflict` | Expected version is stale; reload and retry |
| `cannot_remove_self` | Organizer tried to remove themselves |
| `organizer_cannot_leave` | Organizer tried to leave |
| `validation_failed` | Input breaks a rule; `detail` holds the field name (`name`, `dates`, `base_currency`, `display_name`) |

## Trips

### `create_trip(p_name text, p_start_date date, p_end_date date, p_base_currency text) → uuid`

Creates the trip, the caller's `organizer` membership, and the invitation token. Returns the trip
id.
Errors: `not_authenticated`, `guest_not_allowed`, `profile_incomplete`, `validation_failed`.
Requirements: FR-001, FR-001a, FR-002, FR-004, FR-007.

### `update_trip(p_trip_id uuid, p_expected_version int, p_name text, p_start_date date, p_end_date date, p_base_currency text) → int`

Organizer only. Replaces all editable fields; returns the new version.
Errors: `not_found`, `not_organizer`, `version_conflict`, `validation_failed`.
Requirements: FR-006, principle III.

## Invitations

### `get_invitation_preview(p_token text) → table(trip_name text, start_date date, end_date date, organizer_name text, is_full boolean, viewer_status text)`

Callable **without a session** (`anon`) and with one. Returns one row or raises
`invalid_invitation`. `viewer_status` is `null` without a session, otherwise the caller's
membership status in that trip (`active`, `left`, `removed`) or `none`. Returns nothing else about
the trip.
Requirements: FR-009, FR-019, spec edge cases (invalid link, full trip).

### `join_trip(p_token text) → uuid`

Adds the caller as an `active` participant (or reactivates a `left` membership) and returns the
trip id. Idempotent for active members. Locks the trip row while counting members.
Errors: `not_authenticated`, `profile_incomplete`, `invalid_invitation`, `removed_from_trip`,
`trip_full`.
Requirements: FR-007a, FR-010, FR-011, FR-013a.

### `reset_invitation(p_trip_id uuid) → text`

Organizer only. Replaces the token and returns the new one; the old token is invalid at once.
Errors: `not_found`, `not_organizer`.
Requirements: FR-008.

## Membership

### `remove_member(p_trip_id uuid, p_user_id uuid, p_expected_version int) → void`

Organizer only. Sets the member's status to `removed`.
Errors: `not_found`, `not_organizer`, `cannot_remove_self`, `version_conflict`.
Requirements: FR-013, FR-013a.

### `unblock_member(p_trip_id uuid, p_user_id uuid, p_expected_version int) → void`

Organizer only. Changes `removed` to `left`, so the person can rejoin via the link.
Errors: `not_found`, `not_organizer`, `version_conflict`.
Requirements: FR-013a.

### `leave_trip(p_trip_id uuid) → void`

Sets the caller's own active membership to `left`.
Errors: `not_found`, `organizer_cannot_leave`.
Requirements: FR-013.

## Profile

Profiles are updated directly: `update users set display_name = …, language = … where id =
auth.uid()` under RLS and column grants. Check constraints return `validation_failed`-equivalent
constraint errors, which the client maps to field messages.
Requirements: FR-020, FR-022.

## Auth (Supabase Auth, not custom functions)

| Use | Call |
|---|---|
| Continue as guest | `auth.signInAnonymously({ options: { data: { display_name, language } } })` |
| Email sign-in | `auth.signInWithOtp({ email, options: { data: { language } } })` → `auth.verifyOtp(...)` |
| Google sign-in | `auth.signInWithOAuth({ provider: 'google' })` |
| Guest → account, email | `auth.updateUser({ email })` → `auth.verifyOtp({ type: 'email_change', ... })` |
| Guest → account, Google | `auth.linkIdentity({ provider: 'google' })` |

Requirements: FR-015, FR-016, FR-017.

## Realtime subscriptions

| Channel | Table | Filter | Client reaction |
|---|---|---|---|
| `trip:<id>` | `trips` | `id=eq.<id>` | Refetch trip |
| `trip:<id>` | `trip_members` | `trip_id=eq.<id>` | Refetch members; if own status is no longer `active`, go to "My trips" |
| `trip:<id>` | `users` | none (RLS limits to co-members) | Refetch members |

Requirements: FR-014, SC-003.
