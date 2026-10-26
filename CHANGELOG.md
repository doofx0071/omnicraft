# Changelog

All notable, user-visible changes to `create-omnicraft` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is semver
(0.x = rapid iteration, breaking changes allowed).

## [0.4.0] — 2026-10-26

### Added

- **Next.js frontend (integrated full-stack)** (#17) — Next.js 16 via the pinned
  `create-next-app` (App Router, Tailwind, `@/*` alias), then an OmniCraft overlay:
  users API route handlers + demo page + a `query()` db adapter (raw SQL, all three
  databases) + SQL-file migrations (`app/db`), root scripts and CI. One app serves the
  page and the API — the separate-backend prompts collapse. Verified: build, typecheck,
  page 200, CRUD 201/409/404.
- **Vue + Vite frontend** (#18) — Vue 3.5 + vue-tsc, same /api proxy + demo CRUD page,
  tailwind/eslint extras wired. Verified: typecheck + build + server CRUD.
- **Svelte + Vite frontend** (#19) — Svelte 5 (runes) + svelte-check, same shape.
  Verified: 0 errors/0 warnings, build, server CRUD.
- Explicit architecture model (`frontend-only` / `integrated-fullstack` /
  `separate-frontend-api`) — master plan §3-B.
- ADR 0001: frontend framework strategy (Next via official-generator adapter;
  TanStack Start / React Router deferred; Vue/Svelte owned templates). (#20)

### Changed

- The Tailwind extra ships a per-frontend `vite.config.ts` (react/vue/svelte plugins)
  — it previously overwrote the vue/svelte configs with the react plugin.
- shadcn/ui is React+Vite-only (offered for other frontends later).

## [0.3.3] — 2026-10-26

### Added

- **shadcn/ui extra** — new "Pick extras" option (and `--extras shadcn`; implies Tailwind).
  The generated client gets the `@/*` path alias (tsconfig + vite, no deprecated `baseUrl`), a
  shadcn-based demo app (Button/Input/Card/Badge/Separator via the `@/` alias), and the
  **pinned shadcn CLI** runs post-install: `init --template vite --base radix --preset nova`
  then `add` those components, then a prettier pass so the lint gates stay clean. If the CLI
  step fails, the exact manual commands are printed.
- Fixed the generated client `tsconfig.json` using deprecated `baseUrl` (TS 5.9 deprecation
  error); `paths` alone is sufficient.

## [0.3.2] — 2026-10-26

### Added

- **None (raw SQL) option** in the ORM prompt for Node backends: plain pg/mysql2/better-sqlite3
  drivers with parameterized queries (values bind separately from SQL — the standard injection
  defense), a uniform `query()` adapter, and a minimal SQL-file migration runner (`_migrations`
  table, transactional apply, `db:migrate`/`db:push`/`db:seed`). No ORM, no drizzle-kit/prisma
  dependency. Available for all three node databases; verified end-to-end on SQLite (migrate,
  seed, boot, CRUD, 409 on duplicate, 404 on missing).

## [0.3.1] — 2026-10-26

### Fixed

- **Destination safety** (master plan PR2): scaffolding into a non-empty directory now shows an
  explicit collision summary — which files would be overwritten — before continuing; `--yes` mode
  refuses non-empty directories outright instead of silently overwriting.
- **Protected paths**: the engine never overwrites an existing `.env`, `.env.*`, or `.git` in the
  destination — user secrets and VCS state are untouchable by generation (`.env.example` template
  assets still ship; a fresh scaffold still bootstraps `.env` from it).

### Changed

- **Unresolved template tokens now fail generation** (`UnresolvedTokenError` with file + token
  names) instead of silently leaking `{{token}}` into generated projects.
- `--latest` fetches templates pinned to the **release tag** matching the CLI version
  (`v<version>`), not the mutable `main` branch — two runs of the same CLI version produce
  identical projects. Tag templates in lockstep with releases.

### Verified

- CI hardened: fork PRs run only on GitHub-hosted runners (ubuntu/macos/windows-latest); the
  self-hosted Windows runner executes push-to-main and same-repo PRs only.
- New `package` CI job: packs the tarball, installs it into a clean temp dir, and scaffolds a
  project non-interactively through the published-style binary.
- Node version matrix: fast checks on Node 20 (declared minimum) and 24; heavy e2e on Node 24.
- Contributor docs shipped (template contract, adding-a-stack/integration, support matrix). (#27)

## [0.3.0] — 2026-10-26

### Added

- **Python backend runtime** — FastAPI + SQLAlchemy 2 (async) + Alembic, managed with uv. An initial
  migration ships with the template, so `npm run db:push` works immediately. Databases: PostgreSQL
  (asyncpg) and SQLite (aiosqlite, zero-docker). (#15)
- **PHP backend runtime** — Laravel 12 created via `composer create-project`, then an OmniCraft
  overlay (users controller + `/api/users` routes + migration + seeder + per-database `.env` +
  app key). Databases: PostgreSQL, SQLite, MySQL. (#16)
- **SQLite via Drizzle** — zero-setup local dev for Node backends: database file auto-created
  (WAL mode), no docker-compose, tailored README/next steps. (#12)
- **MySQL via Drizzle** — mysql2 adapter + `mysql:8` compose service with healthcheck. (#14)
- **Hono backend** for Node.js (Drizzle). (#13)
- **Database prompt** — PostgreSQL / SQLite / MySQL (MongoDB shown as "(soon)").
- `--runtime <node|python|php>` and `--db <postgres|sqlite|mysql>` flags.
- Interactive `uv sync` step after scaffolding Python projects.

### Changed

- Generated client API wrapper sends `Accept: application/json` (Laravel returns JSON validation
  errors instead of redirects).
- Users CRUD routes handle unique-constraint codes across PostgreSQL/MySQL/SQLite (409 JSON).
- Database-unreachable errors return 503 with guidance in all three runtimes.

### Notes

- Prisma remains PostgreSQL-only (driver adapters); other combinations are rejected with a clear error.

## [0.2.0] — 2026-10-26

### Added

- Non-interactive mode: `--yes` (skip all prompts, works without a TTY) plus stack flags
  `--frontend`, `--backend`, `--orm`, `--extras`, `--full-stack`/`--no-full-stack`. (#7)
- Update check — cached (24h) npm registry lookup with a one-line upgrade notice;
  silent on failure, respects `NO_UPDATE_NOTIFIER`/`CI`. (#8)
- Generated projects now ship their own GitHub Actions CI workflow
  (install, client+server typecheck, build). (#9)

### Changed

- Friendlier database errors: 503 + actionable hint on connection failures; Troubleshooting
  section in generated READMEs. (#10)

### Verified

- All templates prettier-normalized; CI lints generated output (eslint + prettier --check). (#11)
- Multi-OS CI: Windows (self-hosted) + Ubuntu + macOS, all green. (#26)

## [0.1.0] — 2026-10-25

### Added

- Initial public release. Interactive scaffolding (`npm create omnicraft@latest`):
  - React 19 + Vite + TypeScript frontend (frontend-only or full-stack `client/` + `server/`
    npm-workspaces layout).
  - Node.js backends: Express, Fastify — PostgreSQL via Drizzle or Prisma.
  - Extras: Tailwind CSS, ESLint + Prettier.
  - Working users CRUD wired end-to-end (client → API → database), health endpoint,
    docker-compose for PostgreSQL, seed script, per-stack generated README.
  - Post-scaffold: git init, package-manager detection, dependency install, `.env` bootstrap,
    tailored next steps.
- `--latest` (remote templates via giget), `--skip-install`, `--debug`, `--help`, `--version`.
