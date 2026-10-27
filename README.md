# TripKitty

*Travel expense organizer.*

TripKitty is a responsive web app for shared travel expenses: participants add expenses or
bulk-import receipts recognized by AI, allocate costs flexibly, and settle up with confirmed
transfers. The interface is available in English and Russian.

## Documentation

- [MVP plan](docs/plan.md)
- [Architecture diagram](docs/architecture/architecture.html)
- [Project constitution](.specify/memory/constitution.md)
- [Decision log](docs/decisions.md)

## Development

The project uses [Spec Kit](https://github.com/github/spec-kit) for spec-driven development.
In Claude Code: `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` →
`/speckit-implement`.

Planned stack: Angular (Signals) + Supabase (Auth, PostgreSQL, Edge Functions, Realtime,
Storage).
