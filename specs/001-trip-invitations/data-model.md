# Data Model: Trip Creation and Participant Invitations

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-27

All tables live in the `public` schema and are created by migrations in `supabase/migrations/`.
Timestamps are `timestamptz`; dates are `date` (no time zone). Every table has RLS enabled.

```text
auth.users 1 ── 1 users ──< trip_members >── 1 trips 1 ── 1 invitations
```

## users

Profile of every person, including guests. One row per `auth.users` row, same id.

| Column | Type | Rules |
|---|---|---|
| `id` | uuid, PK | = `auth.users.id`, `ON DELETE CASCADE` |
| `display_name` | text, null | 1–50 characters after trim when set; `null` until the profile is completed |
| `language` | text, null | format `^[a-z]{2}$`; `null` until set; no enum, so new languages need no migration |
| `created_at` | timestamptz | default `now()` |
| `updated_at` | timestamptz | set by trigger |

- Created by a trigger on insert into `auth.users`. `display_name` is filled from the provider's
  metadata (`full_name` / `name` for Google, `display_name` passed on anonymous sign-in) when
  present; `language` from metadata passed by the client (browser language).
- Whether a user is a guest is **not stored**: it is the `is_anonymous` claim of the session and
  `auth.users.is_anonymous`. Converting a guest flips it in `auth.users`; this row is untouched.
- A user with `display_name is null` cannot create or join trips (checked in the functions); the
  app shows a "complete your profile" step first.

## trips

| Column | Type | Rules |
|---|---|---|
| `id` | uuid, PK | default `gen_random_uuid()` |
| `name` | text | 1–100 characters after trim (FR-001) |
| `start_date` | date, null | |
| `end_date` | date, null | `end_date >= start_date` when both set (FR-002) |
| `base_currency` | char(3) | `^[A-Z]{3}$`; the client offers ISO 4217 codes (FR-003) |
| `created_at` | timestamptz | default `now()` |
| `updated_at` | timestamptz | set by trigger |
| `version` | integer | starts at 1, incremented on every update (principle III) |

The organizer is not a column here; it is the `trip_members` row with role `organizer`.

## trip_members

| Column | Type | Rules |
|---|---|---|
| `trip_id` | uuid | FK → `trips.id`, `ON DELETE CASCADE` |
| `user_id` | uuid | FK → `users.id`, `ON DELETE CASCADE` |
| `role` | text | `organizer` \| `participant` |
| `status` | text | `active` \| `left` \| `removed` |
| `joined_at` | timestamptz | time of the latest join |
| `updated_at` | timestamptz | set by trigger |
| `version` | integer | starts at 1, incremented on every update |

- Primary key `(trip_id, user_id)`: at most one membership per user per trip (FR-011).
- Partial unique index on `(trip_id) WHERE role = 'organizer'`: exactly one organizer per trip
  (FR-004). The organizer's status is always `active` (check constraint).
- Active member count per trip ≤ 20 (FR-007a), enforced in `join_trip` under a row lock on the
  trip (research R4).

### Membership state transitions

```text
              join_trip                     leave_trip
   (none) ───────────────► active ───────────────────────► left
                            ▲  │                            │
                  join_trip │  │ remove_member              │ join_trip
                            │  ▼                            │
              left ◄─────── removed                         ▼
           unblock_member   (join_trip refused)           active
```

| From | Action | To | Who |
|---|---|---|---|
| none | `join_trip` with a valid token, trip not full | `active` | the joining user |
| `active` | `leave_trip` | `left` | the member, not the organizer |
| `active` | `remove_member` | `removed` | the organizer, not on themselves |
| `left` | `join_trip` | `active` | the user |
| `removed` | `join_trip` | — refused (`removed_from_trip`) | — |
| `removed` | `unblock_member` | `left` | the organizer |
| `active` | `join_trip` | `active` (no change, idempotent) | the user |

`left` means "not a member, may rejoin"; `unblock_member` therefore sets `left`.

## invitations

| Column | Type | Rules |
|---|---|---|
| `trip_id` | uuid, PK | FK → `trips.id`, `ON DELETE CASCADE`; one current link per trip (FR-007) |
| `token` | text, unique | 22 characters, base64url of 16 random bytes |
| `created_at` | timestamptz | time the current token was issued |

Reset (`reset_invitation`) replaces `token` and `created_at` in place; the old token stops working
immediately (FR-008).

## Access rules (RLS)

Helper functions (`SECURITY DEFINER`, `STABLE`) avoid recursive policies:
`is_active_member(trip_id)`, `is_organizer(trip_id)`, `shares_trip_with(user_id)`.

| Table | SELECT | INSERT / UPDATE / DELETE |
|---|---|---|
| `users` | own row; users who share a trip with the viewer (active co-members, plus removed members for the organizer) | UPDATE own `display_name`, `language` only (column grants); no insert/delete |
| `trips` | active members | none — via functions only |
| `trip_members` | own rows (any status); rows with status `active` in trips where the viewer is active; all rows for the organizer | none — via functions only |
| `invitations` | organizer of the trip | none — via functions only |

The `anon` role (no session) has no table access; it can call only `get_invitation_preview`.
Guests are the `authenticated` role with `is_anonymous = true`; they differ from account holders
only in `create_trip` (refused, FR-001a).

## Derived values (client, pure functions)

- **Trip group** in "My trips" (FR-005): `past` if the last date (`end_date ?? start_date`) is
  before today in the viewer's local time zone; `undated` if both dates are null; otherwise
  `current_or_upcoming`. Ordering per group as in FR-005.
- **Interface language** (FR-021, FR-023): profile language if set; otherwise the first browser
  language whose primary subtag is available; otherwise `en`.
