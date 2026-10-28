# Stack support matrix

This matrix records exact combinations and the evidence available for each one. Prompt options, type
unions, or the presence of a template directory do not prove that every cross-product works.

## Statuses

- **Supported** — the repository records a generated-project install/setup, typecheck or equivalent,
  boot, and successful real operation for the exact combination, with a passing hosted CI run recorded
  on a tested commit.
- **Scaffold-verified** — an engine test or the smoke script generated the exact combination. A local
  runtime result may be recorded, but the row remains provisional until the exact hosted CI evidence is
  recorded; scaffolding alone does not prove dependencies install, the app boots, or database operations
  work.
- **Selectable — unverified** — the CLI registry and template layers expose the combination, but no
  exact engine fixture or smoke entry verifies it.
- **Rejected — unsupported combination** — preflight rejects the combination, or the prompt omits it,
  because no compatible template/module path exists.
- **Planned** — not selectable and not implemented.

On 2026-10-28, the Windows checkout passed 129 unit tests, typecheck, build, support-evidence check,
and the 17-project smoke. Local generated-project runs passed Express + Drizzle on SQLite/PostgreSQL/
MySQL, FastAPI + SQLite, and Laravel 12 on SQLite/PostgreSQL/MySQL. The hosted
[closeout run #40558971071](https://github.com/doofx0071/omnicraft/actions/runs/40558971071) passed the
new FastAPI and Laravel SQLite runtime jobs. The follow-up
[PR run #40562224821](https://github.com/doofx0071/omnicraft/actions/runs/40562224821) on head
`2a1e581312af0e1a84f604c9c86541ea8bdf9eed` passed the complete ten-row release gate. Those exact
combinations are now Supported. The prior
[PR #28 hosted run #40532522380](https://github.com/doofx0071/omnicraft/actions/runs/40532522380) on
head `88f7d42` remains historical evidence for its then-current matrix; do not use it as evidence for
jobs added after that run.

## Frontends and platforms

| Adapter or exact path | Status | Evidence and limits |
| --- | --- | --- |
| React + Vite + TypeScript, frontend-only | **Scaffold-verified** | The prior matrix records local typecheck/build; the current smoke and package job scaffold it. No browser boot/operation result is recorded. |
| React + Vite + TypeScript + Express + Drizzle + PostgreSQL | **Supported** | `database-integration` installs and typechecks the generated client/API, migrates PostgreSQL data, boots the API, and exercises CRUD/auth. <!-- support-id: frontend-react-express-drizzle-postgres --> |
| Vue + Vite + TypeScript + Express + Drizzle + SQLite | **Scaffold-verified** | Current smoke run generated it. The changelog records Vue build/CRUD verification but does not identify the database combination, so that result is not attributed to this exact row. |
| Svelte + Vite + TypeScript + Express + Drizzle + SQLite | **Scaffold-verified** | Current smoke run generated it. The changelog records Svelte build/CRUD verification but does not identify the database combination, so that result is not attributed to this exact row. |
| Next.js integrated full-stack + raw SQL + SQLite | **Scaffold-verified** | Engine test, current smoke run, and a built-CLI `--yes --skip-install` run generated the database adapter and root files. No dependency install or app boot was run. Earlier Next.js CRUD evidence does not identify a database dialect. |
| Next.js integrated full-stack + raw SQL + PostgreSQL | **Scaffold-verified** | Engine fixture composes the adapter and root files; no database-specific runtime result is recorded. |
| Next.js integrated full-stack + MySQL | **Selectable — unverified** | Template directories exist, but no engine fixture or smoke entry covers this dialect. |
| React + Vite JavaScript, frontend-only | **Scaffold-verified** | The previous matrix records a frontend-only JavaScript scaffold. The current unit suite and smoke script do not cover this path. |
| React + Vite JavaScript + separate API | **Selectable — unverified** | The JavaScript client layer composes with the TypeScript server, but no exact test or smoke entry verifies it. |
| Expo SDK 58 + TypeScript | **Scaffold-verified** | The prior matrix/changelog record scaffold, install, and TypeScript checks. No simulator/device build or launch is recorded. |
| Tauri 2 + React UI | **Scaffold-verified** | The prior matrix/changelog record scaffold and frontend install/build. The native desktop build was not run because it requires the Rust toolchain. |

The smoke script covers React frontend-only, Vue and Svelte with Express + Drizzle + SQLite, and Next.js
with SQLite. It does not cover Expo or Tauri. Its Next.js step invokes `create-next-app`; if that command
fails, the script logs the failure and skips the overlay without failing the whole smoke run.

## Separate frontend + API backend combinations

The rows below describe the backend/data-access portion with the React + Vite TypeScript client. Vue and
Svelte are only scaffolded in the exact SQLite pairings shown above. No frontend/backend Cartesian
product is implied.

### Node.js

| Framework | ORM/data access | Database | Status | Evidence |
| --- | --- | --- | --- | --- |
| Express | Drizzle | PostgreSQL | **Supported** | `database-integration` installs/typechecks the generated project, migrates PostgreSQL, boots the API, and checks CRUD, conflict handling, and auth. <!-- support-id: express-drizzle-postgres --> |
| Express | Drizzle | SQLite | **Supported** | `database-integration` installs/typechecks the generated project, applies SQLite migrations, boots the API, and checks CRUD, conflict handling, and auth. <!-- support-id: express-drizzle-sqlite --> |
| Express | Drizzle | MySQL | **Supported** | `database-integration` installs/typechecks the generated project, migrates MySQL, boots the API, and checks CRUD, conflict handling, and auth. <!-- support-id: express-drizzle-mysql --> |
| Express | Prisma | PostgreSQL | **Scaffold-verified** | Engine fixture and smoke. Prior matrix records boot/error handling, not a successful database CRUD operation; current CI does not install this generated project. |
| Express | Raw SQL (`none`) | SQLite | **Scaffold-verified** | Changelog records migration, seed, boot, CRUD, duplicate 409, and missing-record 404, but does not record generated install/typecheck evidence. Runtime result not rerun in this pass. |
| Express | Raw SQL (`none`) | PostgreSQL | **Scaffold-verified** | Current smoke run generated it; no PostgreSQL runtime result recorded. |
| Express | Raw SQL (`none`) | MySQL | **Selectable — unverified** | Registry and template layers exist; no exact engine fixture or smoke entry. |
| Fastify | Drizzle | PostgreSQL | **Scaffold-verified** | Engine fixture; prior matrix records local boot, health, and CRUD, but does not record generated install/typecheck evidence. Current CI does not install this generated project. |
| Fastify | Drizzle | SQLite | **Scaffold-verified** | Engine fixture and smoke. Prior matrix records boot/health only, without a successful database operation. |
| Fastify | Drizzle | MySQL | **Scaffold-verified** | Engine fixture; no smoke entry or generated runtime result. |
| Fastify | Prisma | PostgreSQL | **Scaffold-verified** | Engine fixture and smoke. Prior matrix records health/error handling, not a successful database CRUD operation. |
| Fastify | Raw SQL (`none`) | PostgreSQL, SQLite, MySQL | **Selectable — unverified** | Registry and template layers exist; no exact engine fixture or smoke entry. |
| Hono | Drizzle | PostgreSQL, SQLite | **Scaffold-verified** | Current smoke script generates both; no install/runtime result recorded. |
| Hono | Drizzle | MySQL | **Selectable — unverified** | Registry and template layers exist; no exact engine fixture or smoke entry. |
| Hono | Raw SQL (`none`) | PostgreSQL, SQLite, MySQL | **Selectable — unverified** | Registry and template layers exist; no exact engine fixture or smoke entry. |

`Hono + Prisma + PostgreSQL` is **Rejected — unsupported combination**: the capability registry and
prompt omit Prisma for Hono, flag preflight rejects it, and composition guards direct invalid answers.
The repository has no `templates/server/node/hono/prisma/` layer.

### Python and PHP

| Framework | Data access | Database | Status | Evidence |
| --- | --- | --- | --- | --- |
| FastAPI | SQLAlchemy 2 async + Alembic | SQLite | **Supported** | Hosted [`python-fastapi-integration`](https://github.com/doofx0071/omnicraft/actions/runs/40562224821/job/122394000487) installed generated dependencies, applied Alembic migrations, booted Uvicorn, and checked SQLite CRUD, validation, and conflict responses. <!-- support-id: fastapi-sqlalchemy-sqlite --> |
| FastAPI | SQLAlchemy 2 async + Alembic | PostgreSQL | **Scaffold-verified** | The generated-project runner now passes locally through install, Alembic migration, Uvicorn boot, CRUD, conflict, validation, and missing-record checks. Keep provisional until the exact hosted CI run is recorded. |
| Laravel 12 | Eloquent | SQLite | **Supported** | Hosted [`php-laravel-integration`](https://github.com/doofx0071/omnicraft/actions/runs/40562224821/job/122394000585) installed Composer dependencies in the pinned PHP image, migrated SQLite, verified the active driver, and exercised the generated API. <!-- support-id: laravel-eloquent-sqlite --> |
| Laravel 12 | Eloquent | PostgreSQL | **Supported** | `php-laravel-integration` installs Composer dependencies in the pinned PHP image, migrates PostgreSQL, verifies the active driver, and exercises the generated API. <!-- support-id: laravel-eloquent-postgres --> |
| Laravel 12 | Eloquent | MySQL | **Supported** | `php-laravel-integration` installs Composer dependencies in the pinned PHP image, migrates MySQL, verifies the active driver, and exercises the generated API. <!-- support-id: laravel-eloquent-mysql --> |

## Language variants, modules, and extras

| Capability | Status | Evidence and limits |
| --- | --- | --- |
| TypeScript templates | **Scaffold-verified** | TypeScript is the default language and appears in the exact supported rows above; this generic entry does not claim separate runtime evidence. |
| JavaScript React/Vite client | **Scaffold-verified** | Previous matrix records a frontend-only scaffold; no current automated fixture. Full-stack server remains TypeScript. |
| JavaScript Vue, Svelte, or Next.js templates | **Rejected — unsupported combination** | No JavaScript template overlay exists for these frontends. The prompt only offers JavaScript for React/Vite; incompatible flags are rejected. |
| JavaScript Expo or Tauri | **Rejected — unsupported combination** | Native scaffolds are fixed to TypeScript; incompatible `--lang` flags are rejected. |
| Next.js with `--orm`, `--runtime`, `--backend`, `--no-full-stack`, or contradictory `--extras` | **Rejected — unsupported combination** | Next.js is integrated full-stack and always uses raw SQL, Tailwind, and ESLint from create-next-app; separate-backend flags are rejected, extras are fixed, and the prompt has no ORM or extras question. |
| `omnicraft add auth` — Express + Drizzle + SQLite | **Supported** | `database-integration` checks registration, login, session persistence across restart, protected-route behavior, logout, stored password hash, and CRUD on SQLite. <!-- support-id: auth-express-drizzle-sqlite --> |
| `omnicraft add auth` — Express + Drizzle + PostgreSQL/MySQL | **Supported** | `database-integration` checks registration, login, session persistence across restart, protected-route behavior, logout, stored password hash, and CRUD on both databases. <!-- support-id: auth-express-drizzle-postgres-mysql --> |
| `omnicraft add auth` — Fastify/Hono + Drizzle | **Rejected — unsupported combination** | The module guard rejects these frameworks because its route patches target Express files. |
| `omnicraft add testing` | **Scaffold-verified** | Unit tests verify files, dependencies, scripts, and manifest changes; the generated sample test is not installed and executed in CI. |
| `omnicraft add docker` | **Selectable — unverified** | Implementation exists for PostgreSQL/MySQL separate-API projects; no current add-module test covers it. |
| Tailwind CSS | **Scaffold-verified** | Generated in the current smoke paths; prior matrix records a generated-project build. |
| ESLint + Prettier | **Scaffold-verified** | Current smoke paths include the extra; CI lint is limited to Express + Drizzle + PostgreSQL on the Windows job. |
| shadcn/ui — React/Vite | **Scaffold-verified** | Engine test checks the overlay; the post-scaffold shadcn CLI install is not covered by the current suite. Other frontend/platform combinations omit shadcn from the prompt and reject incompatible flags. |

## Planned and registry gaps

The prompts mark NestJS, Django, Symfony, MongoDB, and PHP/MySQL or Python/MySQL as unavailable where
applicable. The type unions also contain future names such as Mongoose; a type union alone does not make
an option selectable.

`src/capabilities.ts` is the typed source for selectable dimension and module options; prompts and flag
validation derive their available values from it. `src/compatibility.ts` holds cross-option constraints
shared by prompt filtering, flag validation, composition, and Better Auth. Exact `Supported` rows carry
an id linked by `src/support-evidence.ts` to a CI job and scenario. The support-evidence check rejects
missing rows, stale ids, missing scripts, changed CI commands, and targets omitted from the aggregate
release gate. Compatibility tests cover JavaScript frontend limits, Next.js raw-SQL behavior, Hono ORM
choices, shadcn frontend choices, and Express-only auth patching; those tests do not promote any stack.
