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
| Vue + Vite + TypeScript + Express + Drizzle + SQLite | **Scaffold-verified** | Local scenario `express-drizzle-sqlite-vue` installed and built the client, typechecked the API, applied Drizzle migrations, booted the API, and verified CRUD and failure behavior. The hosted scenario is required by CI but still needs a passing run before promotion. |
| Svelte + Vite + TypeScript + Express + Drizzle + SQLite | **Scaffold-verified** | Local scenario `express-drizzle-sqlite-svelte` installed and built the client, typechecked the API, applied Drizzle migrations, booted the API, and verified CRUD and failure behavior. The hosted scenario is required by CI but still needs a passing run before promotion. |
| Next.js integrated full-stack + raw SQL + SQLite | **Scaffold-verified** | The generated-project runner passed locally through `create-next-app@16`, production layer composition, install, build, typecheck, SQL migration, production boot, CRUD, and failure checks. Hosted CI is pending. |
| Next.js integrated full-stack + raw SQL + PostgreSQL | **Scaffold-verified** | The generated-project runner passed locally through `create-next-app@16`, production layer composition, install, build, typecheck, SQL migration, production boot, CRUD, and failure checks. Hosted CI is pending. |
| Next.js integrated full-stack + MySQL | **Scaffold-verified** | The compatibility contract accepts MySQL for integrated Next.js, whose exact production adapter uses `mysql2/promise` and MySQL-compatible `?` placeholders. The generated-project runner passed locally through install, build, typecheck, SQL migration, production boot, CRUD, and failure checks; hosted CI is pending. |
| React + Vite JavaScript, frontend-only | **Scaffold-verified** | Local `test:integration:frontend` generated from production layers, installed and built the project, booted Vite preview, loaded the emitted bundle, and checked missing-asset behavior. Database operations are not applicable to the frontend-only architecture. The hosted job is required before promotion. |
| React + Vite JavaScript + Express + Drizzle + SQLite separate API | **Scaffold-verified** | Local scenario `express-drizzle-sqlite-react-js` installed and built the JavaScript client, typechecked the TypeScript API, applied Drizzle migrations, booted the API, and verified CRUD and failure behavior. The hosted scenario is required by CI but still needs a passing run before promotion. |
| Expo SDK 58 + TypeScript | **Scaffold-verified** | The prior matrix/changelog record scaffold, install, and TypeScript checks. No simulator/device build or launch is recorded. |
| Tauri 2 + React UI | **Scaffold-verified** | The prior matrix/changelog record scaffold and frontend install/build. The native desktop build was not run because it requires the Rust toolchain. |

The smoke script covers React frontend-only, Vue and Svelte with Express + Drizzle + SQLite, and Next.js
with SQLite. The separate runtime integration target covers the JavaScript React frontend-only path.
It does not cover Expo or Tauri. Its Next.js step invokes `create-next-app`; if that command
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
| Express | Prisma | PostgreSQL | **Supported** | Hosted [scenario `express-prisma-postgres`, run #40609596120 on commit `b4c2627`](https://github.com/doofx0071/omnicraft/actions/runs/40609596120/job/122557613544) installs the generated project, typechecks and builds the client, typechecks the API, runs Prisma schema setup, boots the API, and verifies CRUD, duplicate, invalid-input, and missing-record behavior. <!-- support-id: express-prisma-postgres --> |
| Express | Raw SQL (`none`) | SQLite | **Supported** | Hosted [scenario `express-raw-sqlite`, run #40609596120 on commit `b4c2627`](https://github.com/doofx0071/omnicraft/actions/runs/40609596120/job/122557613491) installs, checks, migrates, boots, and verifies CRUD plus duplicate, invalid-input, and missing-record behavior. <!-- support-id: express-raw-sqlite --> |
| Express | Raw SQL (`none`) | PostgreSQL | **Supported** | Hosted [scenario `express-raw-postgres`, run #40609596120 on commit `b4c2627`](https://github.com/doofx0071/omnicraft/actions/runs/40609596120/job/122557613680) installs, checks, migrates, boots, and verifies CRUD plus duplicate, invalid-input, and missing-record behavior. <!-- support-id: express-raw-postgres --> |
| Express | Raw SQL (`none`) | MySQL | **Supported** | Hosted [scenario `express-raw-mysql`, run #40609596120 on commit `b4c2627`](https://github.com/doofx0071/omnicraft/actions/runs/40609596120/job/122557613717) installs, checks, migrates, boots, and verifies CRUD plus duplicate, invalid-input, and missing-record behavior. <!-- support-id: express-raw-mysql --> |
| Fastify | Drizzle | PostgreSQL | **Supported** | Hosted [`fastify-drizzle-postgres`, run #40612114736 on commit `14adbf9`](https://github.com/doofx0071/omnicraft/actions/runs/40612114736/job/122565905396) installs, checks, migrates, boots, and verifies CRUD plus duplicate, invalid-input, and missing-record behavior. <!-- support-id: fastify-drizzle-postgres --> |
| Fastify | Drizzle | SQLite | **Supported** | Hosted [`fastify-drizzle-sqlite`, run #40612114736 on commit `14adbf9`](https://github.com/doofx0071/omnicraft/actions/runs/40612114736/job/122565905189) installs, checks, migrates, boots, and verifies CRUD plus duplicate, invalid-input, and missing-record behavior. <!-- support-id: fastify-drizzle-sqlite --> |
| Fastify | Drizzle | MySQL | **Supported** | Hosted [`fastify-drizzle-mysql`, run #40612114736 on commit `14adbf9`](https://github.com/doofx0071/omnicraft/actions/runs/40612114736/job/122565905243) installs, checks, migrates, boots, and verifies CRUD plus duplicate, invalid-input, and missing-record behavior. The generated route uses portable reads because MySQL does not implement Drizzle `returning()`. <!-- support-id: fastify-drizzle-mysql --> |
| Fastify | Prisma | PostgreSQL | **Supported** | Hosted [`fastify-prisma-postgres`, run #40612114736 on commit `14adbf9`](https://github.com/doofx0071/omnicraft/actions/runs/40612114736/job/122565905358) installs, checks, runs Prisma schema setup, boots, and verifies CRUD plus failure behavior. <!-- support-id: fastify-prisma-postgres --> |
| Fastify | Raw SQL (`none`) | PostgreSQL, SQLite, MySQL | **Supported** | Hosted [`fastify-raw-postgres`](https://github.com/doofx0071/omnicraft/actions/runs/40612114736/job/122565905183), [`fastify-raw-sqlite`](https://github.com/doofx0071/omnicraft/actions/runs/40612114736/job/122565905359), and [`fastify-raw-mysql`](https://github.com/doofx0071/omnicraft/actions/runs/40612114736/job/122565905317) in run #40612114736 on commit `14adbf9` each install, migrate, boot, and verify CRUD plus failure behavior. <!-- support-id: fastify-raw-sql --> |
| Hono | Drizzle | PostgreSQL, SQLite | **Supported** | Hosted [`hono-drizzle-postgres`](https://github.com/doofx0071/omnicraft/actions/runs/40612114736/job/122565905450) and [`hono-drizzle-sqlite`](https://github.com/doofx0071/omnicraft/actions/runs/40612114736/job/122565905615) in run #40612114736 on commit `14adbf9` each install, migrate, boot, and verify CRUD plus failure behavior. <!-- support-id: hono-drizzle-postgres-sqlite --> |
| Hono | Drizzle | MySQL | **Supported** | Hosted [`hono-drizzle-mysql`, run #40612114736 on commit `14adbf9`](https://github.com/doofx0071/omnicraft/actions/runs/40612114736/job/122565905443) installs, checks, migrates, boots, and verifies CRUD plus failure behavior. The generated route uses portable reads because MySQL does not implement Drizzle `returning()`. <!-- support-id: hono-drizzle-mysql --> |
| Hono | Raw SQL (`none`) | PostgreSQL, SQLite, MySQL | **Supported** | Hosted [`hono-raw-postgres`](https://github.com/doofx0071/omnicraft/actions/runs/40612114736/job/122565905341), [`hono-raw-sqlite`](https://github.com/doofx0071/omnicraft/actions/runs/40612114736/job/122565905524), and [`hono-raw-mysql`](https://github.com/doofx0071/omnicraft/actions/runs/40612114736/job/122565905338) in run #40612114736 on commit `14adbf9` each install, migrate, boot, and verify CRUD plus failure behavior. <!-- support-id: hono-raw-sql --> |

`Hono + Prisma + PostgreSQL` is **Rejected — unsupported combination**: the capability registry and
prompt omit Prisma for Hono, flag preflight rejects it, and composition guards direct invalid answers.
The repository has no `templates/server/node/hono/prisma/` layer.

### Python and PHP

| Framework | Data access | Database | Status | Evidence |
| --- | --- | --- | --- | --- |
| FastAPI | SQLAlchemy 2 async + Alembic | SQLite | **Supported** | Hosted [`python-fastapi-integration`](https://github.com/doofx0071/omnicraft/actions/runs/40562224821/job/122394000487) installed generated dependencies, applied Alembic migrations, booted Uvicorn, and checked SQLite CRUD, validation, and conflict responses. <!-- support-id: fastapi-sqlalchemy-sqlite --> |
| FastAPI | SQLAlchemy 2 async + Alembic | PostgreSQL | **Supported** | Hosted [PostgreSQL scenario in run #40609596120 on commit `b4c2627`](https://github.com/doofx0071/omnicraft/actions/runs/40609596120/job/122557613423) installs generated dependencies, applies Alembic migrations, boots Uvicorn, and verifies CRUD, duplicate, invalid-input, and missing-record behavior. <!-- support-id: fastapi-sqlalchemy-postgres --> |
| Laravel 12 | Eloquent | SQLite | **Supported** | Hosted [`php-laravel-integration`](https://github.com/doofx0071/omnicraft/actions/runs/40562224821/job/122394000585) installed Composer dependencies in the pinned PHP image, migrated SQLite, verified the active driver, and exercised the generated API. <!-- support-id: laravel-eloquent-sqlite --> |
| Laravel 12 | Eloquent | PostgreSQL | **Supported** | `php-laravel-integration` installs Composer dependencies in the pinned PHP image, migrates PostgreSQL, verifies the active driver, and exercises the generated API. <!-- support-id: laravel-eloquent-postgres --> |
| Laravel 12 | Eloquent | MySQL | **Supported** | `php-laravel-integration` installs Composer dependencies in the pinned PHP image, migrates MySQL, verifies the active driver, and exercises the generated API. <!-- support-id: laravel-eloquent-mysql --> |

## Language variants, modules, and extras

| Capability | Status | Evidence and limits |
| --- | --- | --- |
| TypeScript templates | **Scaffold-verified** | TypeScript is the default language and appears in the exact supported rows above; this generic entry does not claim separate runtime evidence. |
| JavaScript React/Vite client | **Scaffold-verified** | Automated runtime fixtures now cover the frontend-only app and the exact Express + Drizzle + SQLite separate API pairing above. The selected API remains TypeScript; other API combinations are not inferred. |
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
