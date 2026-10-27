# Implementation Plan: Trip Creation and Participant Invitations

**Branch**: `001-trip-invitations` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-trip-invitations/spec.md`

**Stage**: `docs/plan.md` §14, stage 1 "Foundation" (first vertical slice; this feature also
scaffolds the project).

## Summary

A signed-in account holder creates a trip (name, optional dates, base currency) and invites
people through one resettable link; invitees join with an account (email code or Google) or as a
guest, and guests can later convert to an account without losing anything. Only active members
see a trip; the organizer can remove, block, and unblock participants; a trip holds at most 20
active members. Every user has a display name and a Russian/English interface language detected
from the browser and stored in the profile.

Technically: an Angular 22 SPA (standalone components, signals) on Supabase. Guests are Supabase
anonymous users; all writes go through transactional PostgreSQL functions; reads go through RLS;
changes reach other members through Realtime. Transloco provides runtime language switching with
translation files only. The feature also sets up the repository: Angular workspace, local
Supabase, Vitest, pgTAP, Playwright, and GitHub Actions.

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), SQL (PostgreSQL 17 as shipped by the Supabase
CLI), Node.js ≥ 24.15

**Primary Dependencies**: Angular 22.2 (`@angular/core`, `@angular/router`, `@angular/forms`,
`@angular/build`), `@supabase/supabase-js` 2.x, `@jsverse/transloco` 8.x, Supabase CLI 2.x (dev)

**Storage**: Supabase PostgreSQL; tables `users`, `trips`, `trip_members`, `invitations` (see
[data-model.md](./data-model.md)); no file storage in this feature

**Testing**: Vitest (Angular CLI unit-test builder, jsdom); pgTAP via `supabase test db`;
Playwright smoke suite; GitHub Actions on every PR (see `docs/decisions.md` D5)

**Target Platform**: Current mobile and desktop browsers (last two versions of Chrome, Safari,
Firefox, Edge); local development and CI only, no deployment in this feature (hosting decided:
Cloudflare, `docs/decisions.md` D4)

**Project Type**: Web application — single-page frontend with a managed backend (Supabase); no
custom server

**Performance Goals**: Changes visible to other members within 5 s (SC-003); joining as a guest
in under 1 minute of user time (SC-002); "My trips" and trip screens interactive within 2 s on a
mid-range phone over 4G

**Constraints**: All permissions enforced on the server (principle II); no UI strings outside
translation files (principle VI); usable at 360 px width (SC-007); no money logic in this feature

**Scale/Scope**: ≤ 20 active members per trip, typically 3–7; 10 routes
([contracts/routes.md](./contracts/routes.md)); 8 database functions
([contracts/rpc.md](./contracts/rpc.md)); 4 tables

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applies here | How the design complies | Status |
|---|---|---|---|
| I. Monetary Precision | Only the base currency code is stored; no amounts | `base_currency` is an ISO 4217 code; nothing to compute | ✅ Pass (n/a) |
| II. Server Is the Sole Authority | Yes, central to this feature | RLS on every table; all writes via `SECURITY DEFINER` functions checking `auth.uid()`; guests have a server-side identity (Supabase anonymous users); no service keys in the client; `anon` role limited to the invitation preview | ✅ Pass |
| III. Integrity of Collaborative Changes | Partly (no financial changes) | Each function is one transaction; `version` on `trips` and `trip_members` with `version_conflict`; `join_trip` idempotent and row-locked; Realtime delivery. `activity_log` not written — principle III requires it for **financial** changes only, and the clarification confirms none in this feature | ✅ Pass |
| IV. Separate Stages, Independent Statuses | Membership status only | `trip_members.status` is its own field with explicit transitions; no merged statuses | ✅ Pass |
| V. AI Recognition Without Guesswork | No | — | ✅ Pass (n/a) |
| VI. Localization Without Hardcoding | Yes | Transloco with files + language manifest (no code for a new language); codes in the database, error codes from functions; `Intl` for formatting and currency names; language in `users`, including guests; automated checks for key parity and bare template text (research R8) | ✅ Pass |
| VII. Tested Financial Logic | RLS tests: yes; financial logic: none yet | pgTAP for outsider, guest, participant, organizer; pure functions (trip grouping, language detection) unit-tested; `fast-check` arrives with expenses | ✅ Pass |
| Stack: new dependencies | — | All in the constitution's stack. Testing tools (Vitest, pgTAP, Playwright) and Cloudflare hosting are justified in `docs/decisions.md` D4–D5 and research R9–R10 | ✅ Pass |

**Post-design re-check (after Phase 1)**: still passes. The data model keeps the organizer as a
membership role (no duplicate source of truth), and the RPC contract returns codes only, never
translated text.

## Project Structure

### Documentation (this feature)

```text
specs/001-trip-invitations/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R10
├── data-model.md        # Phase 1: tables, RLS, state transitions
├── quickstart.md        # Phase 1: setup and validation scenarios
├── contracts/
│   ├── rpc.md           # Database functions, error codes, auth calls, realtime
│   └── routes.md        # Routes and screens
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 (/speckit-tasks — not created by /speckit-plan)
```

### Source Code (repository root)

```text
package.json, angular.json, tsconfig*.json, eslint.config.js, playwright.config.ts

src/
├── main.ts, index.html, styles.scss
├── environments/                 # local Supabase URL + anon key
└── app/
    ├── app.config.ts, app.routes.ts
    ├── core/
    │   ├── supabase/             # client provider, generated database.types.ts
    │   ├── auth/                 # session signal, guards, sign-in/guest/convert flows
    │   ├── i18n/                 # Transloco setup, language detection, Intl pipes, error-code mapping
    │   └── realtime/             # trip channel subscription helper
    ├── features/
    │   ├── auth/                 # /sign-in, /auth/callback
    │   ├── profile/              # /profile, /profile/setup
    │   ├── trips/                # /trips, /trips/new, /trips/:id, /trips/:id/edit; trip-grouping.ts
    │   └── invitations/          # /join/:token
    └── shared/                   # UI building blocks (form field, empty state, currency picker)

public/i18n/
├── languages.json                # manifest: ["en", "ru"]
├── en.json
└── ru.json

supabase/
├── config.toml                   # anonymous sign-ins, manual linking, Google provider via env
├── migrations/                   # tables, RLS, helper and RPC functions, triggers
└── tests/                        # pgTAP: rls_*.sql, functions_*.sql

e2e/                              # Playwright smoke specs
.github/workflows/ci.yml          # lint, typecheck, unit, db test, e2e
```

**Structure Decision**: One Angular workspace at the repository root with `supabase/` beside it.
There is no separate backend project: server logic lives in SQL migrations. Unit tests sit next
to their sources (`*.spec.ts`), database tests in `supabase/tests/`, end-to-end tests in `e2e/`.
Feature folders follow the screens in `docs/plan.md` §3.

## Complexity Tracking

No constitution violations to justify.

## Notes for `/speckit-tasks`

- Scaffolding (Angular workspace, Supabase init, CI) comes first and is shared by all stories.
- Story order follows priorities: P1 create trip → P2 invite/join and access (ship together,
  since Story 3 protects Story 2) → P3 profile/language and guest conversion.
- Database work per story is test-first: pgTAP test, then migration (principle VII applies to RLS).
- Before scaffolding, upgrade Node to ≥ 24.15 (research R1).
