# Quickstart: Trip Creation and Participant Invitations

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

How to run the feature locally and prove it works. Command names below are the npm scripts the
implementation adds to `package.json`.

## Prerequisites

- Node.js **26** (pinned in `mise.toml`; Angular 22 also accepts it, 24.14 is too old). Check with
  `node -v`.
- Docker running (the Supabase CLI starts the local stack in containers).

## Setup

```sh
npm ci
npm run db:start       # supabase start: Postgres, Auth, Realtime, mail catcher
npm run db:reset       # apply migrations from supabase/migrations
npm run db:types       # regenerate src/app/core/supabase/database.types.ts
npm start              # Angular dev server
```

`db:start` prints the local API URL, anon key, and the mail catcher URL; the app reads the URL and
key from `src/environments/`.

## Automated checks

```sh
npm run lint
npm run typecheck      # tsc --noEmit, strict
npm test -- --watch=false  # Vitest: pure functions, components, translation checks (R8)
npm run db:test        # pgTAP: RLS and functions for outsider, guest, participant, organizer
npm run e2e            # Playwright smoke suite (needs db:start)
```

All five run in GitHub Actions on every pull request.

## Manual validation scenarios

Each scenario maps to the spec. Use two browsers (or a normal and a private window) to act as two
people.

1. **Create a trip** (Story 1, SC-001)
   Sign in by email on `/sign-in`; take the code from the mail catcher. Complete the profile,
   create "Lisbon 2027", 10–17 May 2027, EUR.
   Expected: the trip is in "My trips" under current/upcoming; you are its organizer and the only
   participant.

2. **Validation** (Story 1, scenario 3)
   Try an end date before the start date, an empty name, and no currency.
   Expected: no trip is created; each field explains the problem; entered values remain.

3. **Join as a guest** (Story 2, SC-002, SC-003)
   As the organizer, copy the link on the trip page. In a private window with the browser in
   Russian, open it.
   Expected: the page is in Russian and shows only trip name, dates, and organizer. Continue as a
   guest with the name "Маша": the trip opens. In the organizer's window, "Маша" appears within
   5 seconds without reloading.

4. **Guest is remembered** (FR-015)
   Close and reopen the private window's tab (same session).
   Expected: Masha is still signed in and sees the trip.

5. **Outsider denied** (Story 3, SC-004)
   Sign in as a third user who is not a member and open `/trips/<id>` directly.
   Expected: "trip not found or no access", no trip data.

6. **Remove, block, unblock** (FR-013a)
   As the organizer, remove Masha. In Masha's window: the trip disappears and she is sent to
   "My trips". She opens the link again: "you were removed". The organizer unblocks her; she can
   join again.
   Leave the trip as a third member in another window: the organizer's and Masha's lists drop
   that member within 5 seconds without reloading.

7. **Reset the link** (FR-008)
   Reset the invitation link; open the old link.
   Expected: "invitation is no longer valid"; existing members unaffected.

8. **Language switch keeps form values** (Story 4, SC-006)
   Start filling the create-trip form, switch the language in the header.
   Expected: the interface changes language, the form keeps its values; dates are formatted for
   the new language. Reload: the language stays.

9. **Guest → account** (Story 5)
   As Masha, convert to an account by email. Sign in with that email in another browser.
   Expected: same trips, name, language, and theme; the organizer still sees one Masha.

10. **Trip full** (FR-007a)
    Covered by `npm run db:test` (creating 20 members by hand is impractical).

11. **Mobile layout** (SC-007)
    In browser dev tools, set the width to 360 px and walk through scenarios 1–3, then open
    `/profile`, `/trips/<id>/edit`, and the organizer's "Removed participants" section.
    Expected: no horizontal scrolling.

12. **Themes** (FR-026–FR-031, SC-009)
    Set the device to a dark color scheme and open TripKitty in a new private window.
    Expected: the light theme. On `/profile`, start changing the name without saving and switch
    to the dark theme.
    Expected: all colors change at once, the page does not reload, and the typed name stays.
    Reload: the dark theme appears with no flash of the light one. Sign in on another browser:
    the dark theme is applied. Check "My trips" and an invitation page in both themes against
    `contracts/theme-tokens.md`.
