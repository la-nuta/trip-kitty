# Decision Log

Short records of project decisions: context, decision, consequences. Newest entries go at the
bottom. Binding engineering rules live in the [constitution](../.specify/memory/constitution.md);
this log explains *why* things are the way they are.

## D1. Product name: TripKitty

**Date:** 2026-10-25

**Context.** The working title "Travel Expense Organizer" describes the product but is not a
brand. The name should be short, work for both English- and Russian-speaking users, and convey
"chipping in together" on a trip.

**Options considered.**

| Option | Finding | Verdict |
|---|---|---|
| Kvits | Pun on Russian «квиты» / English "call it quits" (both mean "we're even") | Not chosen |
| AllSquare | Clear in English ("all square"), opaque for Russian speakers | Not chosen |
| Tallio | Neutral, but says nothing about trips or debts | Not chosen |
| ChipIn | Taken in the same niche: [Chip In by Moneywise](https://apps.apple.com/app/id592997652) (expense splitting), [ChipInPool](https://apps.apple.com/cd/app/chipinpool/id6741926843), US trademark application [CHIPIN 97320874](https://trademarks.justia.com/973/20/chipin-97320874.html) covering payment processing | Rejected |
| TripChip | Taken in an adjacent niche: [TripChip](https://tripchip-prod.gigs.com/discover/en-US), a Brazilian travel eSIM brand; Chrome extension [TripChipper](https://chromewebstore.google.com/detail/coplmfnphahpcknbchcehdikbdieognn) (~200K users); in Russian "trip chip" reads as a travel SIM card | Rejected |
| **TripKitty** | No app or trademark found by web search | **Chosen** |

**Decision.** The product is named **TripKitty**; "travel expense organizer" is the tagline.

**Consequences and known caveats.**
- "Kitty" means both a kitten and a shared pot of money ("travel kitty"). In Russian «Китти»
  reads as just a cute cat; the "shared pot" meaning is lost. Accepted; can be played up with a
  cat mascot.
- A classic kitty is a pooled fund paid in upfront, while TripKitty tracks who paid and who owes.
  Close enough to accept.
- English slang meaning of "kitty" is unlikely in the "Trip" + "Kitty" combination; Hello Kitty
  associations are neutral-to-cute.
- Competitor [Kittysplit](https://blog.kittysplit.com/expense-categories/) already uses "kitty"
  in the travel expense niche.
- Domains as of 2026-10-25: `tripkitty.com` is parked (registered 2017, possibly for sale),
  `tripkitty.app` is registered, `tripkitty.io` was available.
- The web search is not a legal trademark clearance; do one before a public launch.

## D2. Documentation language: English

**Date:** 2026-10-25

**Decision.** All project documentation (constitution, specs, plans, tasks, README, this log)
is written in English. The product interface stays bilingual (RU/EN) per constitution
principle VI.

**Consequences.** The MVP plan was translated to English (`docs/plan.md`); only the English
architecture diagram is kept (`docs/architecture/architecture.html`).

## D3. Spec-driven development with Spec Kit

**Date:** 2026-10-25

**Decision.** The project uses [Spec Kit](https://github.com/github/spec-kit) with the Claude
Code integration and POSIX shell scripts (`specify init --here --integration claude --script
sh`). Constitution v1.0.0 was adopted the same day.

**Consequences.** Features go through `/speckit-specify` → `/speckit-clarify` →
`/speckit-plan` → `/speckit-tasks` → `/speckit-implement`; every plan includes a Constitution
Check.

## D4. Hosting: Cloudflare; no PWA in the MVP; users in Russia are not a target

**Date:** 2026-10-27

**Context.** The architecture diagram listed PWA support and SPA hosting on Cloudflare Pages or
Vercel; the constitution named neither. The app is a static Angular SPA with all server logic in
Supabase, so both hosts fit technically.

**Options considered.**

| Option | Finding | Verdict |
|---|---|---|
| Vercel | Best DX, but the free Hobby plan is [non-commercial only](https://vercel.com/docs/plans/hobby-plan); paid features (plan §16) would need Pro at $20/seat/month | Not chosen |
| **Cloudflare** (Workers static assets; Pages is being folded into Workers) | Free static hosting with unlimited bandwidth, commercial use allowed, PR previews | **Chosen** |

**Decision.** The SPA is hosted on Cloudflare (Workers static assets) when it is first deployed.
PWA is not part of the MVP. Users located in Russia are not a target audience; the Russian
interface is for Russian speakers elsewhere.

**Consequences.**
- Russian ISPs have [throttled Cloudflare since June 2025](https://zona.media/article/2025/06/27/cloud_confirmed);
  accepted, since Russia is not a target market.
- Feature 001 is developed and tested locally and in CI; no deployment is set up yet.
- The architecture diagram still shows PWA and two hosting options; update it when it is next
  edited.

## D5. Testing tools and CI

**Date:** 2026-10-27

**Decision.** Unit and component tests run on Vitest (the Angular CLI's built-in runner);
property-based tests use `fast-check`; RLS and SQL function tests use pgTAP via
`supabase test db`; end-to-end tests use Playwright as a smoke suite of key user paths, not one
test per acceptance scenario. GitHub Actions runs lint, type checks, unit, database, and e2e tests
on every pull request from the first feature. No coverage threshold for now.

**Consequences.** Resolves the testing questions in `docs/plan.md` §17. A coverage threshold can
be added later if gaps appear in review.

## D6. Google sign-in deferred; versions only for financial records

**Date:** 2026-10-31

**Context.** `/speckit-analyze` for feature 001 found that "Google and email for the same address
lead to the same user" (FR-017) cannot be tested automatically without a real OAuth client, and
that an enabled Google provider with unset credentials can break `supabase start` locally and in
CI. It also found that the constitution's rule "mutable records carry a version" was broader than
intended.

**Decision.**
- Feature 001 supports only email one-time code sign-in (plus guests). Google sign-in moves to a
  later feature together with its OAuth setup and a manual verification scenario.
- Versions and stale-write conflicts are required only for financial records (expenses,
  payments, splits, transfers, exchange rates). Profiles, interface language, trip details,
  memberships, and invitations are last-write-wins: the participant set is fixed before expenses
  are allocated, and the language affects display only. Constitution amended to v1.1.0.
- The trip's base currency keeps the meaning from `docs/plan.md` §9 (balances are shown in it).
  Whether it may change once expenses exist is decided by the expenses feature.

**Consequences.**
- No `version` columns or `version_conflict` error in feature 001.
- Adding Google later needs: provider config, `linkIdentity` for guest conversion, a check that
  Supabase links identities with the same verified email, and a quickstart scenario.

## D7. Visual direction and themes

**Date:** 2026-11-04

**Context.** The product had no visual direction. Three styles were compared on clickable mockups
of the invitation page and "My trips": warm and friendly, calm and clean, bright and travel-themed.

**Decision.**
- The style is bright and travel-themed: the invitation is drawn as a ticket, trips as cards,
  Unbounded for headings, Rubik for text.
- Cards and buttons are soft colors, clearly separated from the background, with one bright
  accent on the ticket and the current trips.
- There are two themes: light "Mediterranean" and dark "Sunset". Their values are in
  `specs/001-trip-invitations/contracts/theme-tokens.md`.
- Colors are CSS variables named by role. Components never use raw colors.
- The theme is switched in the profile and stored there, so it follows the user across devices,
  including guests.
- A user without a saved theme always gets the light theme; the device's color scheme is ignored.
- Text contrast is at least 4.5:1 in every theme.

**Consequences.**
- Feature 001 gains the `users.theme` column, requirements FR-026–FR-031, and SC-008–SC-009.
- A new theme needs token values, a code in the theme list, and a translated name, with no
  migration.
- Not decided yet: a mascot, icons, and the look of the other screens.

## Open items

Not decisions yet; to be resolved during `/speckit-plan` for the relevant feature.

- **Architecture diagram layout.** Automated checks pass, but two readability issues remain:
  "transaction + version" (financial operations → PostgreSQL) crosses "trip subscription"
  (Realtime → Angular SPA), and "receipt files" (Angular SPA → AI receipt import) has three
  bends. Fix by repositioning nodes when the diagram is next updated.
