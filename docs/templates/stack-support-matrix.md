# Stack support matrix

Every combination OmniCraft can generate, with its honest verification status. Updated in the same PR as
capability changes (see [documentation standards](../development/documentation-standards.md)).

**Statuses** (defined in [docs/index.md](../index.md#status-vocabulary)):

- **Supported** — template + CI-verified scaffold/install/typecheck + boot and at least one real DB
  operation verified per the [testing strategy](../development/testing-strategy.md) Level 3.
- **Scaffold-verified** — generates + CI smoke green; install/build or functional check not yet done.
- **Planned** — offered as "(soon)" in prompts; no template. Tracked in [ROADMAP.md](../../ROADMAP.md).

Last reconciled: after v0.3.0 (`main`, `create-omnicraft@0.3.0`).

## Architecture: separate frontend + API (the only architecture today)

**Frontend (all combos):** React 19 + Vite + TypeScript — _Supported_ (every full-stack e2e run also
exercises the client; frontend-only builds via `npm run build` in CI and locally).

### Node.js backends — framework × ORM × database

| Framework | ORM            | Database   | Status            | Evidence                                                                                                    |
| --------- | -------------- | ---------- | ----------------- | ----------------------------------------------------------------------------------------------------------- |
| Express   | Drizzle        | PostgreSQL | **Supported**     | CI e2e (windows): install + typecheck; boot + health + CRUD + 409 verified locally; docker compose verified |
| Express   | Drizzle        | SQLite     | **Supported**     | CI smoke; boot + full CRUD + 409 verified locally, zero-docker                                              |
| Express   | Drizzle        | MySQL      | Scaffold-verified | CI smoke; install/build/functional not yet run                                                              |
| Express   | Prisma         | PostgreSQL | **Supported**     | CI e2e (unix): install (incl. `prisma generate`) + typecheck; boot + DB error handling verified             |
| Fastify   | Drizzle        | PostgreSQL | **Supported**     | CI smoke + typecheck; boot + health + CRUD verified locally                                                 |
| Fastify   | Drizzle        | SQLite     | **Supported**     | CI smoke; typecheck verified locally; boot verified (health)                                                |
| Fastify   | Drizzle        | MySQL      | Scaffold-verified | CI smoke; install/build/functional not yet run                                                              |
| Fastify   | Prisma         | PostgreSQL | **Supported**     | CI smoke + typecheck; boot + health + Prisma adapter error path verified locally                            |
| Express   | None (raw SQL) | SQLite     | **Supported**     | verified locally: migrate (sql-file runner), seed, boot, full CRUD, 409/404 paths, zero-docker              |
| Express   | None (raw SQL) | PostgreSQL | Scaffold-verified | CI smoke; functional run pending                                                                            |
| Fastify   | None (raw SQL) | SQLite     | Scaffold-verified | CI smoke; wiring shared with the express pattern                                                            |
| Fastify   | None (raw SQL) | PostgreSQL | Scaffold-verified | CI smoke                                                                                                    |
| Hono      | None (raw SQL) | SQLite     | Scaffold-verified | CI smoke                                                                                                    |
| Hono      | None (raw SQL) | PostgreSQL | Scaffold-verified | CI smoke                                                                                                    |

### Python backend

| Framework | ORM/data                     | Database   | Status            | Evidence                                                                                              |
| --------- | ---------------------------- | ---------- | ----------------- | ----------------------------------------------------------------------------------------------------- |
| FastAPI   | SQLAlchemy 2 async + Alembic | SQLite     | **Supported**     | verified locally: `uv sync`, `alembic upgrade head`, seed, uvicorn boot, full CRUD + 409, zero-docker |
| FastAPI   | SQLAlchemy 2 async + Alembic | PostgreSQL | Scaffold-verified | CI smoke; install/migrate/boot not yet run end-to-end                                                 |

### PHP backend

| Framework  | ORM/data | Database   | Status            | Evidence                                                                                                           |
| ---------- | -------- | ---------- | ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| Laravel 12 | Eloquent | SQLite     | **Supported**     | verified locally: composer create-project via CLI, migrate + seed, artisan serve, full CRUD, 422 JSON on duplicate |
| Laravel 12 | Eloquent | PostgreSQL | Scaffold-verified | template + compose verified in CI smoke; install/functional not yet run                                            |
| Laravel 12 | Eloquent | MySQL      | Scaffold-verified | template + compose verified in CI smoke; install/functional not yet run                                            |

### Frontend-only

| Architecture              | Status        | Evidence                                                        |
| ------------------------- | ------------- | --------------------------------------------------------------- |
| React + Vite (no backend) | **Supported** | CI smoke (all OSes); local `npm run build` + typecheck verified |

## Extras

| Extra             | Status        | Evidence                                                                        |
| ----------------- | ------------- | ------------------------------------------------------------------------------- |
| Tailwind CSS      | **Supported** | shipped in every smoke combo; generated project builds with `@tailwindcss/vite` |
| ESLint + Prettier | **Supported** | CI windows job lints a generated project (eslint + prettier --check)            |

## Planned (prompts show "(soon)")

| Dimension        | Choices                                     | Tracking                         |
| ---------------- | ------------------------------------------- | -------------------------------- |
| Platform         | Mobile (React Native/Expo), Desktop (Tauri) | #21, #22                         |
| Frontend         | Next.js, Vue, Svelte                        | #17, #18, #19 (+ #20 evaluation) |
| Node framework   | NestJS                                      | master plan Phase E              |
| Python framework | Django                                      | master plan Phase E              |
| PHP framework    | Symfony                                     | master plan Phase E              |
| Database         | MongoDB                                     | master plan Phase E              |
| Node ORM         | Mongoose                                    | master plan Phase E              |
| Language         | JavaScript variants                         | #25                              |

## Promotion rules

- **Scaffold-verified → Supported:** run the Level-3 verification (install + typecheck + boot + one real
  DB operation for the specific combo), add evidence to this table. Install/build coverage in CI
  (currently one combo per OS) doesn't auto-promote others.
- **Supported → regression:** if CI or re-verification fails, demote with a note and open/label an issue.
- **Planned → any:** requires the full [adding-a-stack](adding-a-stack.md) /
  [adding-an-integration](adding-an-integration.md) procedure.
- Never edit a status without linking the evidence (PR, CI run, or local verification summary in an issue).
