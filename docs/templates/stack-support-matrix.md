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
- **Invalid registry entry** — the current prompt/flags accept a combination that is missing a required
  adapter or compatibility guard. Do not select or describe it as supported.
- **Planned** — not selectable and not implemented.

The merged local verification run on Windows on 2026-10-27 passed 82 unit tests, typecheck, build, and
the 17-project smoke. Separate local integration runs installed, typechecked, migrated, booted, and
exercised Express + Drizzle with SQLite, PostgreSQL, and MySQL; Laravel 12 passed migrations and API
feature tests against PostgreSQL and MySQL. The workflow now defines hosted Linux jobs for those exact
integration paths, but hosted checks have not run for this local merge. No support status was promoted;
wait for the required hosted CI evidence before changing the rows below. Previous manual results remain
repository-recorded history, not results reproduced during this local run.

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
| Express | Drizzle | PostgreSQL | **Supported** | CI install + typecheck; prior matrix records local boot, health, CRUD, and duplicate-email 409. Runtime result not rerun in this pass. |
| Express | Drizzle | SQLite | **Scaffold-verified** | Engine fixture and smoke; local 2026-10-27 integration run passed generated install/typechecks, migrations, boot, CRUD, and Better Auth. Hosted result for this merge is pending; status unchanged. |
| Express | Drizzle | MySQL | **Scaffold-verified** | Engine fixture and smoke; local 2026-10-27 integration run passed generated install/typechecks, migrations, boot, CRUD, and Better Auth. Hosted result for this merge is pending; status unchanged. |
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

`Hono + Prisma + PostgreSQL` is an **Invalid registry entry**: the current registry/prompt accepts it, but
`templates/server/node/hono/prisma/` does not exist, so composition fails with `MissingLayerError`.
It must not be treated as supported. The registry currently checks Prisma's PostgreSQL database limit
but does not constrain Prisma by framework.

### Python and PHP

| Framework | Data access | Database | Status | Evidence |
| --- | --- | --- | --- | --- |
| FastAPI | SQLAlchemy 2 async + Alembic | SQLite | **Supported** | Prior matrix records `uv sync`, migration, seed, boot, and full CRUD. Runtime result not rerun in this pass. |
| FastAPI | SQLAlchemy 2 async + Alembic | PostgreSQL | **Scaffold-verified** | Engine fixture and smoke; no generated install/migration/runtime result recorded. |
| Laravel 12 | Eloquent | SQLite | **Supported** | Prior matrix records Composer scaffold, migrate, seed, serve, and CRUD. Runtime result not rerun in this pass. |
| Laravel 12 | Eloquent | PostgreSQL | **Selectable — unverified** | Local 2026-10-27 generated-project migrations and API feature tests passed. The new hosted job must pass before the matrix status changes. |
| Laravel 12 | Eloquent | MySQL | **Selectable — unverified** | Local 2026-10-27 generated-project migrations and API feature tests passed. The new hosted job must pass before the matrix status changes. |

## Language variants, modules, and extras

| Capability | Status | Evidence and limits |
| --- | --- | --- |
| TypeScript templates | **Supported** | Default for the recorded supported web combinations. |
| JavaScript React/Vite client | **Scaffold-verified** | Previous matrix records a frontend-only scaffold; no current automated fixture. Full-stack server remains TypeScript. |
| JavaScript Vue, Svelte, or Next.js templates | **Invalid registry entry** | No JavaScript template overlay exists for these frontends. The current language prompt/flag still accepts JavaScript globally; selecting it silently leaves the generated files TypeScript. |
| JavaScript Expo or Tauri | **Invalid registry entry** | `--lang javascript` is accepted, but native prompt flow and templates always use TypeScript. |
| Next.js with `--orm drizzle` or `--orm prisma` | **Invalid registry entry** | The Next.js prompt/flags expose Node ORM values, but composition ignores the selection and always uses its raw-SQL adapter. |
| `omnicraft add auth` — Express + Drizzle + SQLite | **Supported** | Changelog records the complete email/password, cookie/session, sign-out, and protected-route flow. No automated module test is present in the current 8-file suite. |
| `omnicraft add auth` — Express + Drizzle + PostgreSQL/MySQL | **Selectable — unverified** | Dialect schema variants exist, but no equivalent end-to-end evidence is recorded. |
| `omnicraft add auth` — Fastify/Hono + Drizzle | **Invalid registry entry** | The guard does not reject these frameworks, but the module patches target Express files and do not have framework-specific wiring. |
| `omnicraft add testing` | **Supported** | Changelog records adding the client Vitest module and running its sample test; no automated add-module regression test is present. |
| `omnicraft add docker` | **Selectable — unverified** | Implementation exists for PostgreSQL/MySQL separate-API projects; no current add-module test covers it. |
| Tailwind CSS | **Scaffold-verified** | Generated in the current smoke paths; prior matrix records a generated-project build. |
| ESLint + Prettier | **Scaffold-verified** | Current smoke paths include the extra; CI lint is limited to Express + Drizzle + PostgreSQL on the Windows job. |
| shadcn/ui — React/Vite | **Scaffold-verified** | Engine test checks the overlay; the post-scaffold shadcn CLI install is not covered by the current suite. For other frontends, the accepted flag is an invalid registry entry because composition silently skips the overlay. |

## Planned and registry gaps

The prompts mark NestJS, Django, Symfony, MongoDB, and PHP/MySQL or Python/MySQL as unavailable where
applicable. The type unions also contain future names such as Mongoose; a type union alone does not make
an option selectable.

The `AVAILABLE` object is a dimension-level list for runtimes, frontends, language, backends, databases,
Node ORMs, and extras. It does not yet encode every compatibility edge, native platform prerequisites,
module compatibility, or verification status. Platforms are listed directly in the prompt, while modules
live in a separate registry. Known mismatches found in this review:

- Hono + Prisma is accepted but has no framework/ORM template layer.
- JavaScript is accepted for all web frontends although only the React/Vite JavaScript client exists.
- `--lang javascript` is accepted for native platforms even though Expo/Tauri templates stay TypeScript.
- Next.js exposes ORM choices that its composition ignores; it always uses raw SQL. `--runtime` and
  `--backend` overrides are also accepted but ignored because Next.js is integrated full-stack.
- shadcn is accepted by flags for all frontends although composition applies it only to React/Vite.
- Better Auth's guard does not reject non-Express frameworks, although the patches target Express files.

These combinations are not promoted by this matrix. A later capability-registry phase should represent
these constraints in one place and test that prompts, flags, composition, and documentation agree.
