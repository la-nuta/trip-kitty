# TripKitty — MVP Plan

*TripKitty — travel expense organizer.*

**Format:** responsive web application in the browser. **Goal:** shared expense tracking for
travelers, with AI receipt recognition and settlement between participants. Development timelines
are intentionally omitted.

## 1. Product principles

- Every participant sees the full shared table, adds expenses manually, and uploads receipts.
- Recognition, expense confirmation, and allocation are separate stages. A receipt can be saved
  now and allocated later.
- Any participant can allocate any expense and change its allocation.
- By default an expense is split equally among everyone, but participants can be excluded.
- Confirmed unallocated expenses count toward the trip cost but not toward debts.
- The sender marks a transfer as sent, the recipient confirms receipt; only confirmed transfers
  affect balances.
- The interface is available in Russian and English; each participant chooses their own
  language, independently of the other trip participants.

## 2. User flow

1. The organizer creates a trip with a name, dates, and base currency.
2. The organizer invites participants via a link. Guest access with a persistent identity is
   allowed.
3. Any participant adds expenses manually or bulk-uploads photos, screenshots, and PDFs.
4. AI extracts the data and shows a table of drafts.
5. The user fixes amounts, excludes irrelevant entries and duplicates, and confirms the selected
   records.
6. Confirmed expenses can be saved without allocation.
7. Any participant allocates the whole receipt or individual line items among selected people.
8. The app computes balances and suggested transfers.
9. The sender marks a transfer as sent; the recipient confirms receipt.

## 3. Screens

### My trips
Trip list, creation, archiving, invitations, participants, base currency.

### Expenses — main screen
A shared table on desktop and responsive cards on mobile. Fields: date, title, category, amount
and currency, payer(s), expense participants, status, source. Search, sorting, filters, grouping
by day. Metrics: total cost, allocated, unallocated, needs review. Actions: add, import, open
document, edit, allocate, bulk-select expenses.

### AI import
Bulk upload, per-file progress, errors and retry. A draft table with editing, row selection,
removal of irrelevant entries, and duplicate warnings. Bulk confirmation and saving without
allocation. Unconfirmed drafts are excluded from financial totals.

### Expense details
Title, date, category, amount, currency, original document, notes, payer(s), status, history.
A "Whole receipt / By line items" toggle. "Save without allocation" and "Allocate" buttons.

### Settlements
Participant balances, how much each paid and what their share is, suggested transfers, history of
actual transfers, a warning about unallocated expenses.

### Participants and settings
Invitations, roles, participant management, trip currency, export, archiving.

### User profile
Name and interface language (Russian / English). The language is stored in the profile,
including for guests.

## 3a. Language support

- Interface languages: Russian and English. Adding another language must not require code
  changes, only a new translation file.
- The default language is detected from the browser language: Russian for Russian-language
  browsers, English otherwise. The invitation page for a new participant also opens in the
  browser language.
- The language is switched in the profile without losing entered data and persists across
  sessions and devices.
- Dates, numbers, and monetary amounts are formatted according to the selected language (e.g.
  `1 234,50 €` and `€1,234.50`); stored values are language-independent.
- All interface elements are translated: built-in categories, statuses, AI import errors and
  warnings, activity log entries. The database stores category and status codes, not translated
  text.
- User data (expense titles, notes, custom categories, merchant names from receipts) is not
  translated and is shown as entered.
- CSV export headers are in the language of the user performing the export.

## 4. Manual expense

A confirmed expense requires a title, a positive amount, a currency, and a date. Category, payer,
participants, note, and attachment are optional. The payer and allocation can be set later. A
single payer is the default; multiple payers are an additional option.

## 5. AI receipt recognition

- Supports images, screenshots, PDFs, and bulk batches.
- Extracts merchant, date, total amount, currency, category, document type, payment status, line
  items, discounts, and fees when present.
- AI does not invent missing data and does not declare a booking paid without evidence.
- Recognition is independent of the interface language: documents in any language are processed
  the same way. The category is returned as a code; the merchant name and line items are stored
  in the original language, untranslated.
- Warnings about doubtful values, repeated receipts, and "booking + payment confirmation"
  duplicates.
- **Hybrid mode:** by default the whole receipt is one expense. Optionally, line items can be
  expanded and allocated individually. The total is never double-counted.
- If the sum of line items does not match the total, discounts, taxes, tips must be reconciled
  or the user must adjust manually.
- The source file is kept in private storage.

## 6. Four allocation modes

| Mode | Rule |
|---|---|
| Equal | The amount is divided among the selected participants |
| Percentages | Percentages of the selected participants sum to 100% |
| Fixed amounts | Assigned amounts sum to the expense cost |
| Shares | The amount is divided proportionally to weights, e.g. 2:1:1 |

Any participant can be excluded. Bulk allocation of several expenses, changing allocation after
saving, and allocation by receipt line items are supported. Calculations use exact monetary units
with deterministic distribution of remainder cents. The sum of shares always equals the expense
cost.

## 7. Multiple payers

An optional "Paid by multiple participants" toggle opens a list of payers and their contributed
amounts. Payment and allocation are independent entities: a payer may not participate in the
expense. The sum of payments must not exceed the expense cost. With partial payment, the unpaid
remainder is shown; it must not be silently attributed to any participant.

## 8. Balances and transfers

For fully paid allocated expenses:

**Balance = paid for expenses − own share + confirmed transfers sent − confirmed transfers
received.**

A positive balance means the participant is owed; a negative one means they owe. Unallocated
expenses are excluded from balances. Partially paid expenses require a separate display of the
unpaid remainder.

Suggested transfers reduce the number of operations but are not required to guarantee the
mathematical minimum. A suggestion is not an actual transfer. Actual transfer statuses:
`pending`, `sent`, `confirmed`, `rejected`, `cancelled`. The sender marks it as sent, the
recipient confirms receipt. Only `confirmed` affects debt. Repeated confirmations do not create
duplicate operations; cancellations and rejections are kept in history.

## 9. Multi-currency

Each expense stores its original amount and currency. A trip has a base currency. A rate is
suggested for the transaction date, can be corrected manually, and is recorded together with its
source. Old calculations do not change automatically when rates update. Balances are shown in the
base currency.

## 10. Access rights

| Action | Participant | Organizer |
|---|---|---|
| View all expenses and receipts | Yes | Yes |
| Add expenses and AI import | Yes | Yes |
| Confirm recognized expenses | Yes | Yes |
| Allocate and change allocation of any expense | Yes | Yes |
| Edit/delete own expenses | Yes | Yes |
| Edit/delete others' expenses | No | Yes |
| Manage participants | No | Yes |
| View history | Yes | Yes |

All permissions are checked by the server. A guest user must have a persistent identity,
especially for confirming transfers. Concurrent changes use record version control, with no
silent overwrites. The log records the author, time, and content of financial changes.

## 11. Independent statuses

- Recognition: `pending / processing / completed / failed`.
- Review: `draft / confirmed / rejected`.
- Allocation: `unallocated / allocated`.
- Expense payment: `unknown / unpaid / partially_paid / paid`.
- Transfer: `pending / sent / confirmed / rejected / cancelled`.

An import draft is not included in the total; a confirmed unallocated expense is included in the
total cost but does not affect debts.

## 12. Technical architecture

- **Frontend:** Angular with Signals, mobile-first UI.
- **Localization:** RU/EN translation files with runtime language switching (e.g. Transloco);
  date, number, and currency formatting via `Intl` for the selected locale. The user's language
  is stored in `users`.
- **Backend:** Supabase Auth, PostgreSQL, Edge Functions, Realtime.
- **Files:** private Supabase Storage.
- **AI:** Vision API via the server with validation of the structured result.
- **Currencies:** a rate source, e.g. ECB, with the option of a manual rate.
- **Hosting:** a platform for Angular SPAs.

Core tables: `users`, `trips`, `trip_members`, `invitations`, `receipts`, `import_batches`,
`expenses`, `expense_items`, `expense_payments`, `expense_splits`, `settlements`,
`exchange_rates`, `activity_log`.

Use integer minor units or PostgreSQL `NUMERIC` for money, not floating point. Perform critical
changes transactionally. Configure RLS, file type and size validation, AI quotas, private
document links, and idempotency of imports and confirmations.

## 13. Integrations

**In the MVP:** AI Vision, a currency rate source, in-browser file upload, invitation links, CSV
export (PDF if needed).

**Later:** Gmail (bookings), Google Drive, Telegram bot, bank CSV import, Open Banking,
Wise/Revolut payment links, maps. API availability and permission requirements are to be
verified separately.

## 14. Implementation stages — no timelines

1. **Foundation:** Angular, Supabase, DB schema, RLS, trip creation, participants, invitations,
   RU/EN localization.
2. **Expenses:** manual entry, shared table, four allocation modes, participant exclusion,
   multiple payers, save for later.
3. **AI import:** file upload, recognition, drafts, review, duplicates, hybrid receipt.
4. **Settlements:** multi-currency, balances, suggested transfers, two-step confirmation.
5. **Launch readiness:** mobile UX, security, audit, tests, monitoring, AI limits, export.

## 15. Acceptance criteria

- Multiple participants see the same trip and its changes.
- Everyone can add an expense and bulk-import receipts.
- AI drafts can be corrected and confirmed in bulk; duplicates are highlighted.
- A receipt can be saved without a payer or allocation; it does not affect debts.
- The whole receipt and its line items are never counted twice at the same time.
- All four allocation modes are correct, including excluding people and rounding.
- Any participant can change the allocation of someone else's expense, but not its amount.
- Multiple payers and partial payment with a visible remainder are supported.
- Balances include only valid allocations and confirmed transfers.
- The recipient confirms receipt; a repeated confirmation does not change the balance again.
- Edit conflicts never lose changes silently; activity history is available.
- The interface works in mobile and desktop browsers.
- The whole interface is available in Russian and English; the language is chosen in the profile
  and persisted; dates, numbers, and amounts are formatted for the selected language;
  participants of the same trip can work in different languages.

## 16. Monetization

Basic manual tracking and allocation can stay free. Potentially paid features: higher AI
recognition limits, bulk batches, advanced reports, and future integrations. For travel, a
one-time per-trip payment can be tested instead of a mandatory subscription. Prices and limits
are to be defined after validating demand and AI costs.

## 17. Open questions

- Are notifications needed for new expenses, changes, and transfer confirmations?
- What level of collaborative editing of import drafts is needed?
- Is restoring a previous allocation version needed in the MVP?
- Is PDF export part of the first release, or is CSV enough?
- Rules for closing a trip and edit restrictions after final settlement.
