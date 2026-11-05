# Contract: Application Routes and Screens

**Feature**: [../spec.md](../spec.md)

| Route | Screen | Access | Requirements |
|---|---|---|---|
| `/` | Redirect: signed in → `/trips`, otherwise → `/sign-in` | anyone | — |
| `/sign-in` | Email one-time code; no guest option here (guests come only via an invitation) | no session | FR-017 |
| `/auth/callback` | Completes sign-in from the one-time link in the email, then returns to the saved `returnUrl` | anyone | FR-017 |
| `/profile/setup` | Display name (and language) when the profile is incomplete; shown before any action that needs a name | session | FR-020 |
| `/trips` | "My trips": three groups, empty state, "Create trip" (guests are offered account conversion instead) | session | FR-001a, FR-005 |
| `/trips/new` | Create trip form | account | FR-001–FR-003 |
| `/trips/:id` | Trip details and participant list; organizer sees edit, copy/reset link, remove/unblock; participants see "Leave trip" | active member; otherwise "not found or no access" | FR-006, FR-008, FR-012–FR-014, FR-019 |
| `/trips/:id/edit` | Edit trip form; a non-organizer sees "trip not found or no access" | organizer | FR-006 |
| `/join/:token` | Invitation page: trip preview; sign in or continue as guest (name); states: valid (also when the viewer previously left), invalid, full, removed, already a member (→ trip); a signed-in user without a display name is sent to `/profile/setup` and back | anyone | FR-009–FR-011, FR-007a, FR-013a |
| `/profile` | Display name, language switch, theme switch, guest → account conversion | session | FR-016, FR-020, FR-022, FR-028 |

## Rules for all screens

- Language: the profile language if set, otherwise the browser language (FR-021, FR-023). The
  language switch never reloads the page or resets forms (FR-022).
- Theme: the profile theme if set, otherwise light; the device's color scheme is ignored (FR-027,
  FR-029). The theme switch never reloads the page or resets forms (FR-028). Colors and fonts
  come only from `theme-tokens.md`.
- Every text comes from translation files; dates and numbers are formatted with `Intl` for the
  active language (FR-024, FR-025).
- Layout works from 360 px width without horizontal scrolling (SC-007).
- A route guard requiring a session saves the target URL and returns to it after sign-in
  (including `/join/:token`).
