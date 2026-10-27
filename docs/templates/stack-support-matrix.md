# Stack support matrix

This matrix records exact combinations and the evidence available for each one. Prompt options, type
unions, or the presence of a template directory do not prove that every cross-product works.

## Statuses

- **Supported** — the repository records a generated-project install/setup, typecheck or equivalent,
  boot, and successful real operation for the exact combination. Historical manual results are labeled
  as such; this documentation pass did not rerun those application-level checks.
- **Scaffold-verified** — an engine test or the smoke script generated the exact combination. This does
  not prove dependencies install, the app boots, or database operations work.
- **Selectable — unverified** — the CLI registry and template layers expose the combination, but no
  exact engine fixture or smoke entry verifies it.
- **Rejected — unsupported combination** — preflight rejects the combination, or the prompt omits it,
  because no compatible template/module path exists.
- **Planned** — not selectable and not implemented.

The merged local verification run on Windows on 2026-10-27 passed 82 unit tests, typecheck, build, and
the 17-project smoke. Separate local integration runs installed, typechecked, migrated, booted, and
exercised Express + Drizzle with SQLite, PostgreSQL, and MySQL; Laravel 12 passed migrations and API
feature tests against PostgreSQL and MySQL. In [PR #28 hosted run #40532522380](https://github.com/doofx0071/omnicraft/actions/runs/40532522380)
on head `88f7d42`, all ten CI jobs passed, including the database and Laravel integration jobs, package
verification, the Ubuntu/macOS/Windows matrix, and the self-hosted job. Only combinations covered by
the passing integration jobs are promoted below. Previous manual results remain repository-recorded
history, not results reproduced during this local run.

## Frontends and platforms

| Adapter or exact path | Status | Evidence and limits |
| --- | --- | --- |
| React + Vite + TypeScript, frontend-only | **Scaffold-verified** | The prior matrix records local typecheck/build; the current smoke and package job scaffold it. No browser boot/operation result is recorded. |
| React + Vite + TypeScript + Express + Drizzle + PostgreSQL | **Supported** | See the exact backend row below: current CI installs/typechecks this generated project, and the prior matrix records local boot/health/CRUD/409 verification. |
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
| Express | Drizzle | PostgreSQL | **Supported** | Hosted `database-integration` job in [run #40532522380](https://github.com/doofx0071/omnicraft/actions/runs/40532522380) passed generated install/typechecks, migrations, boot, CRUD, and Better Auth; the earlier matrix also records health and duplicate-email 409 checks. |
| Express | Drizzle | SQLite | **Supported** | Hosted `database-integration` job in [run #40532522380](https://github.com/doofx0071/omnicraft/actions/runs/40532522380) passed generated install/typechecks, migrations, boot, CRUD, and Better Auth. |
| Express | Drizzle | MySQL | **Supported** | Hosted `database-integration` job in [run #40532522380](https://github.com/doofx0071/omnicraft/actions/runs/40532522380) passed generated install/typechecks, migrations, boot, CRUD, and Better Auth. |
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
| FastAPI | SQLAlchemy 2 async + Alembic | SQLite | **Supported** | Prior matrix records `uv sync`, migration, seed, boot, and full CRUD. Runtime result not rerun in this pass. |
| FastAPI | SQLAlchemy 2 async + Alembic | PostgreSQL | **Scaffold-verified** | Engine fixture and smoke; no generated install/migration/runtime result recorded. |
| Laravel 12 | Eloquent | SQLite | **Supported** | Prior matrix records Composer scaffold, migrate, seed, serve, and CRUD. Runtime result not rerun in this pass. |
| Laravel 12 | Eloquent | PostgreSQL | **Supported** | Hosted `php-laravel-integration` job in [run #40532522380](https://github.com/doofx0071/omnicraft/actions/runs/40532522380) passed Composer platform checks, migrations, database-driver assertions, and generated API feature tests against PostgreSQL. |
| Laravel 12 | Eloquent | MySQL | **Supported** | Hosted `php-laravel-integration` job in [run #40532522380](https://github.com/doofx0071/omnicraft/actions/runs/40532522380) passed Composer platform checks, migrations, database-driver assertions, and generated API feature tests against MySQL. |

## Language variants, modules, and extras

| Capability | Status | Evidence and limits |
| --- | --- | --- |
| TypeScript templates | **Supported** | Default for the recorded supported web combinations. |
| JavaScript React/Vite client | **Scaffold-verified** | Previous matrix records a frontend-only scaffold; no current automated fixture. Full-stack server remains TypeScript. |
| JavaScript Vue, Svelte, or Next.js templates | **Rejected — unsupported combination** | No JavaScript template overlay exists for these frontends. The prompt only offers JavaScript for React/Vite; incompatible flags are rejected. |
| JavaScript Expo or Tauri | **Rejected — unsupported combination** | Native scaffolds are fixed to TypeScript; incompatible `--lang` flags are rejected. |
| Next.js with `--orm`, `--runtime`, `--backend`, `--no-full-stack`, or contradictory `--extras` | **Rejected — unsupported combination** | Next.js is integrated full-stack and always uses raw SQL, Tailwind, and ESLint from create-next-app; separate-backend flags are rejected, extras are fixed, and the prompt has no ORM or extras question. |
| `omnicraft add auth` — Express + Drizzle + SQLite | **Supported** | Hosted `database-integration` job in [run #40532522380](https://github.com/doofx0071/omnicraft/actions/runs/40532522380) passed the generated email/password flow, session validity and persistence across restart, logout invalidation, password-hash check, and CRUD. |
| `omnicraft add auth` — Express + Drizzle + PostgreSQL/MySQL | **Supported** | Hosted `database-integration` job in [run #40532522380](https://github.com/doofx0071/omnicraft/actions/runs/40532522380) passed the generated email/password flow, session validity and persistence across restart, logout invalidation, password-hash check, and CRUD for both dialects. |
| `omnicraft add auth` — Fastify/Hono + Drizzle | **Rejected — unsupported combination** | The module guard rejects these frameworks because its route patches target Express files. |
| `omnicraft add testing` | **Supported** | Changelog records adding the client Vitest module and running its sample test; no automated add-module regression test is present. |
| `omnicraft add docker` | **Selectable — unverified** | Implementation exists for PostgreSQL/MySQL separate-API projects; no current add-module test covers it. |
| Tailwind CSS | **Scaffold-verified** | Generated in the current smoke paths; prior matrix records a generated-project build. |
| ESLint + Prettier | **Scaffold-verified** | Current smoke paths include the extra; CI lint is limited to Express + Drizzle + PostgreSQL on the Windows job. |
| shadcn/ui — React/Vite | **Scaffold-verified** | Engine test checks the overlay; the post-scaffold shadcn CLI install is not covered by the current suite. Other frontend/platform combinations omit shadcn from the prompt and reject incompatible flags. |

## Planned and registry gaps

The prompts mark NestJS, Django, Symfony, MongoDB, and PHP/MySQL or Python/MySQL as unavailable where
applicable. The type unions also contain future names such as Mongoose; a type union alone does not make
an option selectable.

`AVAILABLE` still lists choices by dimension, while `compatibility.ts` holds cross-option constraints
shared by prompt filtering, flag validation, composition, and the Better Auth module guard. Regression
tests cover JavaScript frontend limits, Next.js raw-SQL behavior, Hono ORM choices, shadcn frontend
choices, and Express-only auth patching. These checks make invalid combinations unavailable without
changing the evidence status of any valid stack row above.
