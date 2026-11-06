# Contract: Visual Themes

**Feature**: [../spec.md](../spec.md)

The themes, as agreed on clickable mockups on 2026-11-04 (`docs/decisions.md` D7). Components use
only the tokens below, never raw colors. Requirements: FR-026–FR-031, SC-008.

## Color tokens

Tokens are named by role, not by color. The light theme is defined on `:root`, so it also applies
when `data-theme` is missing or unknown; the dark theme overrides the tokens under
`[data-theme='dark']`, set on `<html>`.

| Token | Role | Light (`light`) | Dark (`dark`) |
|---|---|---|---|
| `--color-bg` | Page background | `#FBF3E6` | `#4A2A63` |
| `--color-text` | Text on the background | `#1F3A52` | `#FFFFFF` |
| `--color-brand` | Logo, group headings, secondary links | `#8F4E3A` | `#F4C89B` |
| `--color-accent` | Invitation ticket, cards of current and upcoming trips | `#F98F72` | `#FF8A73` |
| `--color-card-2` | Cards of undated trips | `#8FBDD0` | `#C9D8F2` |
| `--color-card-3` | Cards of past trips | `#7DC3BD` | `#D8CCEE` |
| `--color-on-card` | Text on the accent and on cards | `#1F3A52` | `#3A2148` |
| `--color-action` | Primary buttons | `#3F6A8C` | `#C9B8F0` |
| `--color-on-action` | Text on primary buttons | `#FFFFFF` | `#3A2148` |
| `--color-field` | Input background | `#FFFFFF` | `#FFFFFF` |
| `--color-on-field` | Input text | `#1F2A3A` | `#1F2A3A` |
| `--color-error` | Error messages on the page background | `#A32A1E` | `#FFD9CF` |
| `--color-focus` | Keyboard focus outline | `#1F5F8B` | `#FFE08A` |

New roles may be added during implementation. Each one needs a value in every theme and, if it colors text, a pair in the
contrast check.

## Required contrast (FR-030)

Every pair must reach at least 4.5 : 1 in every theme. Current values:

| Text on background | Light | Dark |
|---|---|---|
| `--color-text` on `--color-bg` | 10.7 : 1 | 11.7 : 1 |
| `--color-brand` on `--color-bg` | 5.7 : 1 | 7.5 : 1 |
| `--color-on-card` on `--color-accent` | 5.2 : 1 | 6.1 : 1 |
| `--color-on-card` on `--color-card-2` | 5.8 : 1 | 9.8 : 1 |
| `--color-on-card` on `--color-card-3` | 5.8 : 1 | 9.2 : 1 |
| `--color-on-action` on `--color-action` | 5.8 : 1 | 7.8 : 1 |
| `--color-on-field` on `--color-field` | 14.5 : 1 | 14.5 : 1 |
| `--color-error` on `--color-bg` | 6.6 : 1 | 8.9 : 1 |

`--color-focus` is not text, so it needs at least 3 : 1 against `--color-bg`: 6.2 : 1 in the
light theme and 9.0 : 1 in the dark theme.

## Using the tokens

- **Invitation page**: the trip is drawn as a ticket in `--color-accent`, with a dashed line and
  two notches between the trip name and the row of dates, currency, and member count.
- **"My trips"**: card color follows the group: current and upcoming `--color-accent`, undated
  `--color-card-2`, past `--color-card-3`.
- **Profile**: the theme switch is a two-option control next to the language control.

## Fonts

| Token | Font | Use |
|---|---|---|
| `--font-heading` | Unbounded | Logo, page titles, trip names |
| `--font-body` | Rubik | All other text |

Both are self-hosted with their Latin and Cyrillic subsets (research R11).

## Adding a theme

1. Add a `[data-theme='<code>']` block with a value for every token.
2. Add the code to the `THEMES` list and add its label to the translation files.

No database migration is needed: `users.theme` is not limited to a fixed list (data-model.md).
