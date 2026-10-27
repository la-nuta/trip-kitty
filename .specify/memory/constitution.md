# TripKitty Constitution

TripKitty is a travel expense organizer: shared expense tracking for travelers with AI receipt
recognition and settlement between participants.

Requirement sources: `docs/plan.md` (MVP plan) and `docs/architecture/` (architecture diagram).
If they conflict with this constitution, the constitution prevails; the conflict is resolved by
amending either the constitution or the documentation.

## Core Principles

### I. Monetary Precision (NON-NEGOTIABLE)

- Monetary amounts MUST be stored and computed in integer minor currency units (e.g. cents) or
  PostgreSQL `NUMERIC`. Floating-point types (`float`, `double`, JS `number` for fractional
  amounts) are FORBIDDEN for money.
- The sum of allocation shares MUST exactly equal the expense cost in all four modes (equal,
  percentages, fixed amounts, shares).
- Remainder minor units MUST be distributed deterministically: identical inputs always produce
  identical results, regardless of client or call order.
- The sum of payments MUST NOT exceed the expense cost. An unpaid remainder MUST be shown
  explicitly and MUST NOT be silently attributed to any participant.
- Every expense stores its original amount and currency. An exchange rate is recorded with its
  source and date; rate updates MUST NOT change previously saved calculations.
- A whole receipt and its line items MUST NOT be counted in totals at the same time.

**Rationale:** a one-cent error in a settlement app undermines trust in the whole product;
floating-point rounding and non-deterministic remainders cause balance mismatches between
participants.

### II. Server Is the Sole Authority on Permissions

- All permissions MUST be enforced on the server: PostgreSQL RLS policies and checks in Edge
  Functions. UI checks exist for convenience only and are not considered protection.
- The permission matrix in `docs/plan.md` §10 is binding: any participant may allocate any
  expense, but only the organizer may edit or delete others' expenses and manage participants.
- Guest access MUST have a persistent identity sufficient for confirming transfers.
- Receipt files are kept in private Supabase Storage and served only via signed, time-limited
  URLs. Upload file type and size are validated on the server.
- AI keys and service keys NEVER reach client code.

**Rationale:** the user controls the browser client; a group's financial data is protected only
by the server refusing forbidden actions.

### III. Integrity of Collaborative Changes

- Critical financial operations (saving an expense with payments and splits, confirming a batch
  of drafts, changing a transfer status) MUST run in a single transaction.
- Imports, confirmations, and transfers MUST be idempotent: a repeated request creates no
  duplicate operation and does not change a balance a second time.
- Mutable records carry a version; a write with a stale version is rejected as a conflict.
  Silently overwriting others' changes is FORBIDDEN.
- Every financial change is written to `activity_log`: author, time, what changed.
  Cancellations and rejections are kept in history, not deleted.
- Trip changes are delivered to other participants via Supabase Realtime.

**Rationale:** several people edit the same trip at once; without transactions, versions, and an
audit log, data loss and disputes over debts are inevitable.

### IV. Separate Stages, Independent Statuses

- Recognition, review, allocation, expense payment, and transfer are independent stages with
  their own statuses (`docs/plan.md` §11). Merging them into a single status field is FORBIDDEN.
- Unconfirmed import drafts MUST NOT be included in any financial totals.
- A confirmed unallocated expense counts toward the total trip cost but MUST NOT affect balances
  or debts.
- Only transfers with status `confirmed` count in balances. The sender marks a transfer as sent;
  the recipient confirms receipt.
- A suggested transfer is a computation, not a record of an actual transfer.

**Rationale:** users must be able to save a receipt now and allocate it later; mixing stages
makes totals unpredictable.

### V. AI Recognition Without Guesswork

- Vision API calls run only on the server. The model response MUST be validated against a strict
  schema; an invalid result is marked as failed and is not saved as a draft with invented fields.
- AI MUST NOT invent missing data. An unknown field stays empty and gets a warning; a booking is
  not treated as paid without explicit evidence.
- An AI result is always a draft. It enters financial data only after user confirmation.
- The category is returned as a code; merchant name and line items are stored in the original
  language, untranslated. Recognition is independent of the interface language.
- Duplicates and "booking + payment confirmation" pairs are flagged with warnings. A mismatch
  between line items and the total requires explicit reconciliation.
- AI usage is limited by per-user and per-trip quotas.

**Rationale:** a confidently invented amount is more dangerous than an empty field; a human is
always the final authority on money.

### VI. Localization Without Hardcoding

- All interface text (including categories, statuses, errors, AI warnings, and activity log
  entries) comes from translation files. UI strings in templates and code are FORBIDDEN.
- Adding a new language MUST require only a new translation file, with no code changes.
- The database stores category and status codes, not translated text. User data is not
  translated.
- Dates, numbers, and amounts are formatted via `Intl` for the selected locale; stored values
  are locale-independent.
- Each user chooses their language individually; it is stored in the profile (`users`),
  including for guests, and switches without losing entered data. The default is detected from
  the browser language: Russian for Russian-language browsers, English otherwise.

**Rationale:** participants of one trip work in different languages on the same data;
hardcoded strings make that impossible.

### VII. Tested Financial Logic (NON-NEGOTIABLE)

- Allocation, balance, suggested-transfer, currency conversion, and partial-payment functions
  MUST be developed test-first: a failing test first, then the implementation.
- Edge-case tests are mandatory: rounding remainders, excluded participants, zero shares,
  multiple payers, partial payment, repeated confirmation.
- The invariant "sum of shares = cost" MUST be verified with property-based tests.
- RLS policies MUST be covered by database-level tests for the participant, organizer, guest,
  and outsider roles.
- Financial logic is implemented as pure functions with no dependency on UI or network.

**Rationale:** money bugs are found by users, not developers; exhaustive automated tests are the
only cheap protection.

## Technology Stack and Constraints

- **Frontend:** Angular with Signals for state, standalone components, mobile-first responsive
  layout: a table on desktop, cards on mobile. The interface MUST work in mobile and desktop
  browsers.
- **Localization:** a runtime-switchable translation library (e.g. Transloco) and `Intl` for
  formatting.
- **Backend:** Supabase: Auth, PostgreSQL, Edge Functions, Realtime. Business rules affecting
  money and permissions execute on the server (SQL functions / Edge Functions).
- **Files:** private Supabase Storage.
- **AI:** Vision API via an Edge Function with structured-response validation.
- **Currencies:** an external rate source (e.g. ECB) with manual rate override.
- **Data schema:** core tables `users`, `trips`, `trip_members`, `invitations`, `receipts`,
  `import_batches`, `expenses`, `expense_items`, `expense_payments`, `expense_splits`,
  `settlements`, `exchange_rates`, `activity_log`. Schema changes are made only via migrations.
- **MVP integrations:** AI Vision, exchange rates, file upload, invitation links, CSV export.
  Gmail, Google Drive, Telegram, bank import, and payment links are out of MVP scope.
- New dependencies and services not listed here require justification in the feature plan.

## Development Workflow and Quality Gates

- Work follows the Spec Kit cycle: `/speckit-specify` → `/speckit-clarify` (when ambiguous) →
  `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. Each feature references the
  corresponding stage in `docs/plan.md` §14.
- Every `plan.md` MUST include a Constitution Check against principles I–VII; deviations are
  recorded in Complexity Tracking with justification.
- Code touching money, permissions, or statuses is not accepted without passing tests per
  principle VII.
- Before merge: passing tests, linter, TypeScript type checks in strict mode, and no
  untranslated UI strings.
- The acceptance criteria in `docs/plan.md` §15 are the shared definition of done for the MVP.

## Governance

- This constitution takes precedence over all other project practices and documents.
- Amendments are made by editing this file with a Sync Impact Report, a rationale, and, if the
  amendment affects existing code, a migration plan.
- Versioning follows SemVer: MAJOR — removal or incompatible redefinition of a principle;
  MINOR — a new principle or section, or materially expanded guidance; PATCH — wording
  clarifications without change in meaning.
- Every review and every `/speckit-analyze` run checks compliance with this constitution.
  Violating a principle marked NON-NEGOTIABLE blocks merge.
- All project documentation (constitution, specs, plans, tasks, README) is written in English.
  The product interface remains bilingual (RU/EN) per principle VI.
- Runtime development guidance lives in `docs/plan.md` and in feature specs (`specs/`).

**Version**: 1.0.0 | **Ratified**: 2026-10-25 | **Last Amended**: 2026-10-25
