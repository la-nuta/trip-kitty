# Feature Specification: Trip Creation and Participant Invitations

**Feature Branch**: `001-trip-invitations`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "Trip creation and participant invitations (vertical slice of stage 1 "Foundation" from docs/plan.md §14). An organizer creates a trip with a name, dates, and base currency, and sees it in "My trips". The organizer invites participants via a shareable invitation link; invited people can join either with an account or as a guest with a persistent identity. All trip members see the trip and its participant list; non-members cannot access it. Each user has a profile with a name and interface language (Russian / English); the default language is detected from the browser (Russian for Russian-language browsers, English otherwise), the invitation page opens in the browser language, and the choice persists across sessions and devices, including for guests. Dates and numbers are formatted for the selected language. Out of scope for this feature: expenses, AI import, settlements, archiving, roles beyond organizer/participant, export."

**Plan reference**: `docs/plan.md` §14, stage 1 "Foundation"; §2 steps 1–2; §3 "My trips", "Participants and settings", "User profile"; §3a; §10.

## Clarifications

### Session 2026-10-27

- Q: If the organizer removes a participant, can that person rejoin the trip through the same
  invitation link? → A: No. A removed participant is blocked from rejoining via the link until
  the organizer lifts the block in the participant list.
- Q: Should trip events (joins, leaves, removals, trip edits, link resets) be recorded in an
  activity history? → A: No. Nothing is recorded in this feature; the activity log arrives with
  the expenses feature.
- Q: What is the maximum number of participants in one trip? → A: 20 active members, including
  the organizer; typical trips have 3–7 people.
- Q: Can a guest without an account create trips and be their organizer? → A: No. Only users
  with an account can create trips; a guest is offered to convert to an account first.
- Q: How should "My trips" show trips that have already ended? → A: Three groups: current and
  upcoming (nearest first), undated, then past (most recent first).

### Session 2026-10-31

- Q: Which language does a first-time visitor get when the browser lists several languages, for
  example German first and Russian second? → A: The first language in the browser's list that
  TripKitty supports (German, Russian → Russian); English if none is supported.
- Q: Is Google sign-in part of this feature? → A: No. Accounts sign in with an email one-time
  code only; Google sign-in is deferred to a later feature (`docs/decisions.md` D6).
- Q: Do trip details and memberships need edit conflict detection (versions)? → A: No. Versions
  are required only for financial records (constitution v1.1.0, principle III); the organizer's
  last edit wins.

### Session 2026-11-04

- Q: Does the app have visual themes? → A: Yes, two: light and dark. The user switches them in
  the profile (`docs/decisions.md` D7).
- Q: Where is the chosen theme kept? → A: In the profile, like the language, so it follows the
  user across devices, including guests.
- Q: Which theme does a user without a saved theme get? → A: Always light. The device's color
  scheme setting is not used.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a trip and see it in "My trips" (Priority: P1)

A person signs in to an account, creates a trip by entering its name, optional start and end dates, and a base
currency, and becomes the trip's organizer. The trip appears in their "My trips" list, and opening
it shows the trip details and a participant list containing only the organizer.

**Why this priority**: Nothing else in TripKitty works without a trip. This story alone already
proves the whole path from the interface to stored data and back, and the organizer can use it to
prepare a trip before inviting anyone.

**Independent Test**: Sign in as a new user, create a trip, reload the app and sign in again from
another browser; the trip is listed in "My trips" with the entered name, dates, and currency, and
the organizer is its only participant.

**Acceptance Scenarios**:

1. **Given** a signed-in user with no trips, **When** they open "My trips", **Then** they see an
   empty state with an action to create a trip.
2. **Given** a signed-in user, **When** they create a trip with name "Lisbon 2027", dates
   10–17 May 2027, and base currency EUR, **Then** the trip appears in "My trips" and they are
   shown as its organizer.
3. **Given** the trip creation form, **When** the user submits it without a name, or with an end
   date before the start date, or without a base currency, **Then** the trip is not created and
   the problem is explained next to the corresponding field, with the entered values preserved.
4. **Given** a user who belongs to several trips, **When** they open "My trips", **Then** every
   trip they organize or participate in is listed with its name, dates, base currency, number of
   participants, and their own role, grouped as in FR-005: current and upcoming, undated, past.
5. **Given** the organizer of a trip, **When** they change the trip's name, dates, or base
   currency, **Then** all members see the updated values.
6. **Given** a guest, **When** they try to create a trip, **Then** the trip is not created and
   they are offered to convert their guest profile into an account first (User Story 5); after
   converting, they can create the trip.

---

### User Story 2 - Invite participants by link (Priority: P2)

The organizer copies the trip's invitation link and sends it to friends through any messenger.
A friend opens the link, sees which trip they are invited to and who invited them, and joins
either by signing in to an account or by continuing as a guest under a display name. After
joining, they see the trip and its full participant list, and the trip appears in their
"My trips".

**Why this priority**: Shared expense tracking is impossible without a group. This is the second
half of the core flow in `docs/plan.md` §2 steps 1–2.

**Independent Test**: As an organizer, copy the invitation link; open it in a separate browser
with no session, join as a guest with the name "Masha"; both the organizer and Masha now see the
same participant list of two people.

**Acceptance Scenarios**:

1. **Given** the organizer of a trip, **When** they open the participants screen, **Then** they
   can copy the trip's invitation link in one action.
2. **Given** a person who is not signed in, **When** they open a valid invitation link, **Then**
   they see the trip name, dates, and organizer name, and a choice to sign in or continue as a
   guest; no other trip data is shown before they join.
3. **Given** a person on the invitation page, **When** they continue as a guest and enter a
   display name, **Then** they become a participant of the trip, the trip opens, and on later
   visits from the same browser they are recognized as the same participant without entering
   anything again.
4. **Given** a person with an account, **When** they open the invitation link and sign in,
   **Then** they become a participant of the trip and the trip appears in their "My trips"
   alongside their other trips.
5. **Given** a person who is already a member of the trip, **When** they open its invitation link
   again, **Then** they are taken to the trip and no duplicate membership is created.
6. **Given** the organizer, **When** they reset the invitation link, **Then** the old link stops
   working, anyone opening it sees a message that the invitation is no longer valid, and existing
   members are not affected.
7. **Given** a trip with several members, **When** a new participant joins, **Then** other members
   currently viewing the participant list see the new participant appear without reloading the
   page.

---

### User Story 3 - Access limited to trip members (Priority: P2)

Only members of a trip can see the trip, its details, and its participants. A person who is not
a member, whether signed in or not, cannot see anything about the trip except what the
invitation page shows to holders of a valid link.

**Why this priority**: Trips contain personal and, in later features, financial data of a group.
Per constitution principle II, the protection must exist from the first feature; it ships
together with Story 2.

**Independent Test**: As a signed-in user who is not a member, open a trip's direct address
(not the invitation link); the app shows a "no access" message and no trip name, dates, or
participants.

**Acceptance Scenarios**:

1. **Given** a signed-in user who is not a member of a trip, **When** they open the trip's
   address, **Then** they see a "trip not found or no access" message that does not reveal
   whether the trip exists.
2. **Given** a non-member, **When** they try to read or change trip data by any means other than
   the app's screens, **Then** the server refuses, and no trip data is returned.
3. **Given** a participant who is not the organizer, **When** they try to edit trip details,
   reset the invitation link, or remove a participant, **Then** the action is unavailable in the
   interface and is also refused by the server.
4. **Given** a participant removed from the trip by the organizer, **When** they open the trip
   again, **Then** they no longer have access and the trip disappears from their "My trips".
5. **Given** a participant removed by the organizer, **When** they open the trip's still-valid
   invitation link, **Then** they cannot join and see a message that they were removed from the
   trip and should contact the organizer.
6. **Given** the organizer and a removed participant, **When** the organizer lifts the block in
   the participant list, **Then** that person can join again through the invitation link.

---

### User Story 4 - Profile with name and interface language (Priority: P3)

Every user, including guests, has a profile with a display name and an interface language
(Russian or English). The first time someone opens TripKitty, the interface uses the browser's
language. A user can change their name and language in the profile at any time; the language
switches immediately without losing anything typed on the current screen, and the choice is kept
on later visits and on other devices.

**Why this priority**: Constitution principle VI requires bilingual support from the start, and
retrofitting translations later is costly. The browser-language default already covers most
users, so the explicit switch is the lowest-priority slice.

**Independent Test**: Open the invitation page in a browser set to Russian; the page is in
Russian. Join as a guest, switch the language to English in the profile while a half-filled form
is open; the form keeps its values and the interface is in English. Reload; it stays English.

**Acceptance Scenarios**:

1. **Given** a first-time visitor whose browser language is Russian, **When** they open any
   TripKitty page, including an invitation page, **Then** the interface is in Russian.
2. **Given** a first-time visitor whose browser language is anything other than Russian,
   **When** they open any TripKitty page, **Then** the interface is in English.
3. **Given** a user with a saved language, **When** they open TripKitty in a browser with a
   different language, **Then** their saved language is used, not the browser language.
4. **Given** a user editing a form, **When** they switch the interface language, **Then** the
   interface changes language and the values already entered in the form remain.
5. **Given** two members of the same trip with different languages, **When** they view the same
   trip, **Then** each sees the interface in their own language, while user-entered text such
   as the trip name and participant names is shown exactly as entered.
6. **Given** a trip with dates, **When** a Russian-language user and an English-language user
   view it, **Then** each sees dates and numbers formatted for their own language.
7. **Given** a user, **When** they change their display name, **Then** all members of their
   trips see the new name.
8. **Given** a first-time visitor whose device is set to a dark color scheme, **When** they open
   any TripKitty page, **Then** the light theme is used.
9. **Given** a user with a half-filled profile form, **When** they switch the theme, **Then** the
   whole interface changes theme at once, without a page reload, and the entered values remain.
10. **Given** a user who chose the dark theme, **When** they open TripKitty on another device
    where they are recognized, **Then** the dark theme is used.
11. **Given** two members of the same trip with different themes, **When** they view the same
    trip, **Then** each sees it in their own theme.

---

### User Story 5 - Convert a guest profile into an account (Priority: P3)

A guest who joined a trip without an account decides to keep using TripKitty on their phone and
laptop. From the profile they convert their guest profile into an account by confirming an
email address with a one-time code. Their name, language, and trips stay the same, and they can now sign in on any
device.

**Why this priority**: Guest access lowers the barrier to joining (Story 2), but without
conversion a guest is tied to a single browser. It is needed for the "persists across devices"
requirement but not for the first working version of joining.

**Independent Test**: Join a trip as a guest, convert to an account with an email, then sign in
with that email in another browser; the same trips, name, and language are there, and the other
members still see one participant, not two.

**Acceptance Scenarios**:

1. **Given** a guest who is a member of two trips, **When** they convert to an account with
   an email address, **Then** they remain a member of both trips with the same name, language, theme, and
   roles, and other members see no change in the participant list.
2. **Given** a converted user, **When** they sign in on another device, **Then** they see their
   trips and their saved interface language and theme.
3. **Given** a guest, **When** they try to convert using an email address that already
   belongs to another TripKitty user, **Then** the conversion is refused with an explanation and
   the guest profile is unchanged.

---

### Edge Cases

- The invitation link was reset by the organizer or the trip was deleted: the invitation page
  explains that the invitation is no longer valid and suggests asking the organizer for a new
  link.
- A malformed or unknown invitation link behaves the same as an invalid one and does not reveal
  whether a trip exists.
- A guest clears their browser data or opens TripKitty on another device without having converted
  to an account: they are not recognized; they can join again via the invitation link, which
  creates a new participant (the old guest entry stays in the list until the organizer removes
  it). The interface reminds guests that converting to an account protects against this.
- A removed guest clears their browser data and opens the invitation link again: they are not
  recognized and can join as a new guest, so the block (FR-013a) cannot hold for unrecognized
  guests; the organizer's remedy is to remove them again and reset the invitation link.
- A guest tries to convert to an account using an email address that already belongs to
  another TripKitty user: conversion is refused with an explanation; profiles are not merged in
  this feature.
- A signed-in user opens an invitation link while already signed in: they join directly with
  their existing profile, after confirming on the invitation page.
- Two participants have the same display name: both are allowed; the participant list
  distinguishes them, for example by marking the viewer's own entry as "you".
- A display name or trip name made only of spaces is rejected; leading and trailing spaces are
  trimmed.
- A trip has only a start date or only an end date: allowed; it is shown with the single date.
- A saved theme is no longer available: the light theme is used, and the saved value is left
  unchanged.
- The browser blocks local storage: the app still works and applies the saved theme after the
  profile loads, so the light theme may show briefly on load.
- The organizer tries to remove themselves or leave the trip: not allowed in this feature
  (transferring the organizer role is out of scope).
- A participant leaves the trip voluntarily: they lose access and the trip disappears from their
  "My trips"; they can rejoin with a valid invitation link.
- Two people join through the same link at the same moment: both become members; no membership
  is lost or duplicated, and the 20-member limit is never exceeded even when the last free place
  is taken concurrently.
- A trip already has 20 active members: anyone opening the invitation link sees that the trip is
  full and cannot join until someone leaves or is removed.
- The organizer edits trip details while another member has the trip open: the other member sees
  the new values without reloading.
- The browser reports a regional variant of a language (for example `ru-RU`, `ru-UA`, `en-GB`):
  it matches the base language (Russian, English); a browser whose list contains no supported
  language gets English.

## Requirements *(mandatory)*

### Functional Requirements

**Trips**

- **FR-001**: Users with an account MUST be able to create a trip with a name (required, 1–100 characters after
  trimming), an optional start date, an optional end date, and a base currency (required).
- **FR-001a**: Guests MUST NOT be able to create trips; the server MUST refuse it, and the
  interface MUST offer the guest to convert to an account instead.
- **FR-002**: The system MUST reject a trip whose end date is earlier than its start date.
- **FR-003**: The base currency MUST be chosen from a list of standard currency codes
  (ISO 4217); the list MUST be searchable by code and by currency name in the user's language.
- **FR-004**: The creator of a trip MUST become its organizer; a trip has exactly one organizer.
- **FR-005**: The "My trips" screen MUST list every trip in which the user is a member, with name,
  dates, base currency, participant count, and the user's role, in three groups shown in this
  order: (1) current and upcoming trips, by start date, nearest first; (2) undated trips, by
  creation time, newest first; (3) past trips, by end date, most recent first. A trip is past
  when its last date (the end date, or the start date if there is no end date) is before today
  in the user's local time zone; empty groups are not shown.
- **FR-006**: Only the organizer MUST be able to edit the trip's name, dates, and base currency.

**Invitations and membership**

- **FR-007**: Each trip MUST have one shareable invitation link that anyone holding it can use to
  join, until the organizer resets it.
- **FR-007a**: A trip MUST have at most 20 active members, including the organizer; members who
  left or were removed do not count. When the trip is full, the invitation page MUST say so and
  joining MUST be refused by the server.
- **FR-008**: The organizer MUST be able to copy the invitation link and reset it; resetting
  makes the previous link invalid immediately and does not affect existing members.
- **FR-009**: Before joining, the invitation page MUST show only the trip name, dates, and
  organizer name; it MUST NOT show participants or any other trip data.
- **FR-010**: A person opening a valid invitation link MUST be able to join either by signing in
  to an account or by continuing as a guest with a display name.
- **FR-011**: Joining a trip the person is already a member of MUST NOT create a second
  membership.
- **FR-012**: All members of a trip MUST be able to see the trip's details and full participant
  list, with each participant's display name and role (organizer or participant).
- **FR-013**: The organizer MUST be able to remove any participant other than themselves; a
  participant MUST be able to leave a trip; in both cases the person loses access immediately.
- **FR-013a**: A participant removed by the organizer MUST NOT be able to rejoin through the
  invitation link; the organizer MUST be able to see removed participants and lift the block,
  after which the person can rejoin through the link. A participant who left voluntarily is not
  blocked.
- **FR-014**: Changes to a trip's details and participant list MUST appear for other members who
  have the trip open, without a page reload.

**Identity and access**

- **FR-015**: A guest MUST get a persistent identity: returning to TripKitty from the same browser
  recognizes them as the same participant, with the same name, language, and trip memberships.
- **FR-016**: A guest MUST be able to convert their guest profile into an account at any time,
  keeping the same identity, display name, language, and all trip memberships and roles; after
  conversion they can sign in on any device. A guest who has not converted is recognized only in
  the browser where they joined.
- **FR-017**: Account holders MUST be able to sign in with an email one-time code (or the
  one-time link in the same email). Other sign-in methods, including Google, are out of scope
  for this feature.
- **FR-018**: Every access rule in this feature MUST be enforced by the server; a non-member MUST
  NOT be able to read or change any trip data, and a non-organizer MUST NOT be able to perform
  organizer-only actions, regardless of the client used.
- **FR-019**: When a non-member opens a trip's address, the system MUST show a message that does
  not reveal whether the trip exists.

**Profile and language**

- **FR-020**: Every user, including guests, MUST have a profile with a display name (required,
  1–50 characters after trimming) and an interface language.
- **FR-021**: For a user without a saved language, the interface language MUST be the first
  language in the browser's list of preferred languages that TripKitty supports, matching any
  regional variant (`ru-UA` → Russian); if none is supported, English. This applies to the
  invitation page as well.
- **FR-022**: Users MUST be able to change their display name and interface language in the
  profile; the language change MUST take effect immediately without losing values entered on the
  current screen.
- **FR-023**: The saved interface language MUST be applied on every later visit and on every
  device where the user is recognized, taking precedence over the browser language.
- **FR-024**: Dates and numbers MUST be formatted according to the user's interface language;
  stored values MUST NOT depend on the language.
- **FR-025**: All interface text in this feature, including validation messages, roles, and
  error messages, MUST be available in Russian and English; user-entered text (trip names,
  display names) MUST be shown as entered, without translation.

**Visual themes**

- **FR-026**: The interface MUST be available in a light and a dark theme, defined in
  `contracts/theme-tokens.md`.
- **FR-027**: For a user without a saved theme, including a first-time visitor, the theme MUST be
  light, regardless of the device's color scheme setting.
- **FR-028**: Users, including guests, MUST be able to change the theme in the profile; the
  change MUST take effect immediately, without a page reload and without losing values entered
  on the current screen.
- **FR-029**: The saved theme MUST be applied on every later visit and on every device where the
  user is recognized.
- **FR-030**: In every theme, text MUST have a contrast ratio of at least 4.5:1 against its
  background.
- **FR-031**: A returning user MUST NOT see a different theme flash on load in a browser where
  they have already used their theme.

### Key Entities

- **User**: A person using TripKitty, either with an account or as a guest. Has a display name,
  an interface language, a visual theme, and a kind (account or guest). The same user can be a member of many
  trips.
- **Trip**: A journey whose costs a group shares. Has a name, optional start and end dates, a base
  currency, and an organizer. Has many members and one current invitation link.
- **Trip membership**: The link between a user and a trip, with a role (organizer or participant),
  the time of joining, and a state (active, left, or removed). At most one membership per user
  per trip; a removed membership blocks rejoining until the organizer lifts the block.
- **Invitation**: The trip's current shareable link. It is valid until the organizer resets it;
  a reset replaces it with a new one.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can sign in and create a trip in under 2 minutes.
- **SC-002**: A person who receives an invitation link can join the trip as a guest in under
  1 minute, entering nothing but a display name.
- **SC-003**: After a participant joins or trip details change, other members viewing the trip
  see the change within 5 seconds without reloading.
- **SC-004**: In automated access tests covering the outsider, guest, participant, and organizer
  roles, 100% of attempts to read or change data beyond the role's rights are refused.
- **SC-005**: 100% of interface text in this feature is available in both Russian and English,
  verified by an automated check for missing translation keys and hardcoded strings.
- **SC-006**: Switching the interface language never loses values entered in an open form,
  verified in every form of this feature.
- **SC-007**: Every screen of this feature is fully usable on a phone-sized screen (360 px wide)
  and on desktop, without horizontal scrolling.
- **SC-008**: 100% of the text and background pairs in `contracts/theme-tokens.md` reach a
  contrast ratio of at least 4.5:1 in both themes, and no component uses a color outside the
  theme tokens, verified by an automated check.
- **SC-009**: Switching the theme never loses values entered in an open form and never reloads
  the page, verified by an automated test.

## Assumptions

- This feature covers only two roles, organizer and participant, with the rights from
  `docs/plan.md` §10 that apply to trips and participants. Expense-related rights arrive with
  the expenses feature.
- Trip dates are optional, because groups often start collecting people before dates are fixed;
  the plan lists dates among trip attributes but does not say they are required.
- A typical trip has 3–7 participants; the 20-member limit (FR-007a) is a safeguard against
  abuse of the open invitation link, not an expected size. Screens are designed for the typical
  case and remain usable at 20.
- One reusable invitation link per trip is enough for a group of friends; per-person invitations,
  link expiry dates, and join approval by the organizer are not needed in the MVP.
- The base currency can be changed freely in this feature because no expenses exist yet; the
  expenses feature will decide whether to restrict it once expenses are recorded.
- Deleting and archiving trips, transferring the organizer role, and notifications (email or
  push) are out of scope.
- No activity history is recorded for trip and membership events in this feature (no
  financial changes exist yet, so constitution principle III does not require it); the activity
  log is introduced with the expenses feature.
- An invitation link carries enough randomness that it cannot be guessed; anyone who has the link
  can join, which is acceptable for groups of friends.
- Interface languages are limited to Russian and English, and adding another one must need only
  a new translation file and its entry in the language list, with no code changes (constitution
  principle VI).
- Two themes are enough for this feature. Adding another one must need only a new set of token
  values, its code in the theme list, and its translated name, with no database migration.
- Merging an existing account with a guest profile, and signing in with a password, Google, or
  any provider other than email, are out of scope (Google is deferred, `docs/decisions.md` D6).
- Users have a modern mobile or desktop browser with an internet connection; offline use is out
  of scope.
