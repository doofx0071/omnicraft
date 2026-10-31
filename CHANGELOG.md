# Changelog

All notable, user-visible changes to `create-omnicraft` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is semver
(breaking changes may occur in `0.x`; from `1.0.0`, public changes follow semver).

## [Unreleased]

### Added

- Added a manual-setup Supabase Auth option for React/Vite TypeScript frontend-only apps. Generated
  notes use the Supabase Data API with explicit authenticated-role grants and per-user RLS policies;
  generated browser configuration contains placeholders and a publishable key only.

## [1.0.4] — 2026-10-31

### Added

- Integrated Laravel 13 + Inertia React + TypeScript scaffolding with SQLite and either `None` or
  Laravel-native Fortify authentication. The Laravel 12 API and Laravel 13 Livewire paths remain
  separate; account linking and managed providers are not included.
- Generated-project checks for both Inertia React auth modes, including the auth lifecycle and
  pre-write rejection of incompatible combinations.

## [1.0.3] — 2026-10-31

### Added

- Integrated Laravel 13 + Livewire 4 + SQLite scaffolding, with `None` or Laravel-native Fortify auth.
  The Laravel 12 API path remains separate and unchanged.
- Creation-time `None` or Better Auth selection for React/Vite + Express + Drizzle with SQLite,
  PostgreSQL, or MySQL. The manifest records active authentication separately from `modules`.
- Runtime checks for 254 additional compatible React/Vite `omnicraft add testing` paths (260 total
  including the six previously verified paths) and pre-write rejection for 52 JavaScript + shadcn
  paths that lack the template aliases required by shadcn.

### Changed

- Create-time auth and `omnicraft add auth` share one auth setup catalog and compatibility rules.
- The initial Laravel Livewire migration is isolated to the generated SQLite file, even when the
  invoking shell exports database settings.

### Testing

- Hosted generated-project checks cover Expo on Android emulator and iOS simulator, and Tauri desktop
  build/launch on Linux, macOS, and Windows. Expo and Tauri remain Scaffold-verified; physical-device
  Android and iOS paths remain Selectable — unverified.

## [1.0.2] — 2026-10-28

### Fixed

- `omnicraft add auth` now rejects unsupported frontend/runtime/ORM/database manifests before writing
  files.
- Module additions restore all changed files if a filesystem write fails after validation.
- FastAPI + SQLite Alembic migrations create the generated database directory on a clean scaffold.

### Testing

- The release matrix now runs FastAPI + SQLite and Laravel + SQLite runtime checks and verifies every
  Supported matrix row against its exact CI scenario and release aggregate. The complete gate runs on
  pull requests, main pushes, nightly, and manual pre-release dispatch.

## [1.0.1] — 2026-10-28

### Fixed

- Prompt choices and CLI flag validation now match the template layers that composition generates,
  rejecting unsupported combinations before writing files.
- SQLite-backed Drizzle scaffolds include `server/data`, so the first migration can create the
  database before the API server starts.

## [1.0.0] — 2026-10-27

First stable release. The selectable catalog includes 3 runtimes, 4 web frontends, 2 Node ORMs
plus a raw-SQL option, 3 database choices with runtime-specific compatibility, 3 extras, and 2 native
platforms. These are catalog counts, not a claim that every combination has the same verification.
See the [support matrix](docs/templates/stack-support-matrix.md) for exact combinations and evidence.

### Added

- **`omnicraft add auth` (#23)** — Better Auth email/password boilerplate. Its first end-to-end
  verified path is Express + Drizzle + SQLite. The code includes PostgreSQL and MySQL schema variants,
  but those database paths do not have equivalent recorded end-to-end evidence; Fastify and Hono are
  outside the verified scope. See the support matrix. Ships `auth.ts` (betterAuth config with
  drizzle adapter, trustedOrigins from CORS_ORIGIN), the full better-auth drizzle schema
  (user/session/account/verification, per-database variants), a protected `/api/me` route
  example, and `auth-client.ts` for the frontend. Patches index.ts (mounts the handler
  before the body parser — express 5 `*splat` syntax) and drizzle.config.ts (schema array)
  via the new named patch strategy: anchors validated before any write, aborting cleanly
  on mismatch. env additions (BETTER_AUTH_SECRET) are printed, never written into .env.
  Verified end-to-end on SQLite: register 200, login 200, session with cookie, wrong
  password 401, protected route 401/200, sign-out 200, session invalid after sign-out.

## [0.6.0] — 2026-10-27

### Added

- **`.omnicraft/project.json` manifest** — written at scaffold time (stack, architecture,
  extras, modules, package manager). Foundation for stack-aware commands (master plan §6.3).
- **`omnicraft add <module>`** (#24) — module injector for existing OmniCraft projects:
  `docker` (compose for postgres/mysql) and `testing` (vitest + testing-library for the client).
  Stack-aware via the manifest (rejects incompatible combos with a reason), **idempotent**
  (repeat adds are no-ops), **never overwrites** existing files, `--dry-run` preview, and
  `omnicraft` as a second bin. Verified end-to-end: add testing → manifest updated → deps
  merged → vitest runs the sample test.
- **JavaScript client variant** (#25, first increment) — "Select a language" prompt +
  `--lang <typescript|javascript>` flag. `javascript` ships the React/Vite client as
  `main.jsx`/`App.jsx`/`api.js` (no TypeScript tooling). Verified: frontend-only JS scaffold.
  In a full-stack React project the server remains TypeScript. Node-server JS overlays and Vue/Svelte
  JavaScript templates are not included in this release.

### Notes

- At the time of v0.6.0, auth (#23) was the remaining v1.0.0 item. It shipped in v1.0.0 above;
  this note is retained as the v0.6.0 release state.

## [0.5.0] — 2026-10-26

### Added

- **Mobile platform: React Native via Expo** (#21) — "What are you building? → Mobile App"
  now scaffolds Expo SDK 58 (TypeScript, Expo Router) via the pinned `create-expo-app`
  adapter, plus an OmniCraft overlay: a typed API client with device-aware base URL
  (`EXPO_PUBLIC_API_URL`, Android-emulator/iOS-simulator/physical-device guidance) and
  OMNICRAFT.md pairing notes. Verified: scaffold + install + tsc pass.
- **Desktop platform: Tauri 2 + React** (#22) — "→ Desktop App" scaffolds via the pinned
  `create-tauri-app` adapter (bundle id `com.omnicraft.<app>`), plus OMNICRAFT.md with
  Rust prerequisites, CORS/origin pairing guidance, and a typed API client. Verified:
  scaffold + frontend install + build (Rust toolchain required for the desktop shell).
- `--platform <web|mobile|desktop>` flag — the "What are you building?" branches are real.
- Architecture kind `native-app` (mobile/desktop) — the official generator IS the scaffold;
  no db/ORM prompts (the device app pairs with a separately-run backend, documented).

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
