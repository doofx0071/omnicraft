# Database and authentication integration tests

The integration suites run generated OmniCraft projects against real databases. They are explicit,
slow checks; `npm test`, the scaffold smoke script, typechecking, and the CLI build remain Docker-free.

## Prerequisites

- Node.js 20.12 or newer and npm for the CLI, fast checks, SQLite-only integration, and Laravel
  orchestration; PostgreSQL/MySQL Testcontainers runs require Node.js 22.22 or newer, as required by
  [Testcontainers v12](https://github.com/testcontainers/testcontainers-node/releases/tag/v12.0.0).
- Python 3.12 and `uv` for FastAPI; Docker Engine is also required for its PostgreSQL case.
- Docker Engine or Docker Desktop for PostgreSQL/MySQL Testcontainers cases; Docker Compose v2 is also
  required for the containerized PHP/Laravel runner and the local Supabase Auth integration.
- Docker image pulls, PHP image package downloads, and Composer package downloads must be reachable
  from the machine running Docker. The generated Node project also installs dependencies from npm.
- The containerized database suite does not require host PHP or Composer. The production-CLI Sanctum
  SPA integration runs a local generated Laravel server and therefore needs host PHP 8.2+ and Composer.

The test images are pinned in the test infrastructure:

| Purpose         | Image                          |
| --------------- | ------------------------------ |
| PostgreSQL      | `postgres:17.11-alpine3.24`    |
| MySQL           | `mysql:8.4.13`                 |
| Laravel PHP CLI | `php:8.3.36-cli-bookworm`      |
| Composer binary | `composer/composer:2.10.3-bin` |

The PHP image includes `curl`, `dom`, `mbstring`, `pdo_sqlite`, `sqlite3`, and `xml` from the official
base image; the Dockerfile adds `bcmath`, `intl`, `pdo_mysql`, `pdo_pgsql`, and `zip`, plus Composer's
`git` and `unzip` tools. Both database drivers are present in one reusable image.

## Commands

Run from the repository root:

```bash
npm test --workspace=create-omnicraft
npm run test:integration:db --workspace=create-omnicraft
npm run test:integration:node --workspace=create-omnicraft
npm run test:integration:nextjs --workspace=create-omnicraft
npm run test:integration:php --workspace=create-omnicraft
npm run test:integration:php-livewire --workspace=create-omnicraft
npm run test:integration:php-inertia --workspace=create-omnicraft
npm run test:integration:php-sanctum-auth --workspace=create-omnicraft
npm run test:integration:supabase-auth --workspace=create-omnicraft
```

The Node/Drizzle suite defaults to SQLite, PostgreSQL, and MySQL. Run one database at a time with:

```bash
npm run test:integration:db --workspace=create-omnicraft -- --database sqlite
npm run test:integration:db --workspace=create-omnicraft -- --database postgres
npm run test:integration:db --workspace=create-omnicraft -- --database mysql
npm run test:integration:node --workspace=create-omnicraft -- --scenario express-prisma-postgres
npm run test:integration:node --workspace=create-omnicraft -- --scenario hono-raw-mysql
npm run test:integration:nextjs --workspace=create-omnicraft -- --database mysql
npm run test:integration:python --workspace=create-omnicraft -- --database postgres
```

The FastAPI SQLite case does not require Docker. Its PostgreSQL case installs the generated Python
dependencies, applies the generated Alembic migration, boots Uvicorn, and checks PostgreSQL CRUD,
duplicate and invalid input handling, and missing-record behavior with synthetic Testcontainers
credentials. The PHP/Laravel suite runs PostgreSQL and MySQL cases.

The separate `node-runtime-integration` target covers 15 exact paths: Express + Prisma/PostgreSQL and
Express + raw SQL on SQLite/PostgreSQL/MySQL; Fastify + Drizzle on SQLite/PostgreSQL/MySQL, Prisma on
PostgreSQL, and raw SQL on SQLite/PostgreSQL/MySQL; and Hono + Drizzle and raw SQL on
SQLite/PostgreSQL/MySQL. It installs each generated project, builds/typechecks the client and API,
initializes the schema or applies migrations, boots the API, and checks CRUD plus duplicate,
invalid-input, and missing-record behavior. These cases do not install or exercise auth.

The `nextjs-runtime-integration` target covers Next.js integrated full-stack + raw SQL on SQLite,
PostgreSQL, and MySQL. It runs the pinned-major `create-next-app@16`, applies production layers,
installs and builds the generated app, typechecks it, applies the generated SQL migrations, boots the
production Next.js server, and checks the users page plus persisted CRUD and failure behavior. The
PostgreSQL and MySQL cases use synthetic Testcontainers credentials; SQLite uses a file in the
isolated generated project. This target validates the selectable MySQL adapter against its
`mysql2/promise` driver and MySQL SQL migrations.

## Coverage and isolation

The database suite scaffolds the existing Express + Drizzle API and applies the existing
`omnicraft add auth` module. It installs the generated project, typechecks the client and API, generates
and applies Drizzle migrations, boots the generated API, and uses HTTP requests against the actual
database. It checks user create/list/delete, duplicate and invalid input handling, Better Auth
email/password registration and login, invalid credentials, session cookies, the protected `/api/me`
route, session persistence across an API restart, logout invalidation, and that stored passwords are
hashes rather than plaintext. Generated-project typechecks exposed unused Drizzle imports in the
PostgreSQL/MySQL auth schemas and an un-narrowed MySQL `DATABASE_URL`; both are corrected. The MySQL
run also exposed `.returning()` calls in the generated Express users route, which now reloads rows with
portable selects.

The Laravel suite scaffolds the current Laravel 12 overlay, creates the Composer Laravel skeleton,
installs/checks Composer dependencies in PHP 8.3, applies the generated migration, and runs Laravel
feature tests for the selected SQLite, PostgreSQL, or MySQL connection and generated users API. The
test asserts the active driver so a fallback to SQLite cannot pass. The existing base public `None`
API behavior remains covered alongside the authenticated API target below.

The separate `php-laravel-sanctum-spa-auth` target uses the built production CLI for the exact React/Vite
TypeScript + Laravel 12 API + Eloquent tuple on SQLite, PostgreSQL, and MySQL. `None` retains the existing
public SQLite API. For each database, it checks incompatible choices reject before writes, confirms the
native manifest records auth separately from module history, verifies the generated database setting and
actual active driver, and checks the generated README names the selected database. It checks the generated
dependency is the pinned Sanctum release and that Fortify, personal-access-token routes, traits, and
migrations are absent. Each generated native app is migrated and runs Laravel feature tests for hashed
passwords, registration/login/logout, protected routes, and the selected database driver. Live loopback
HTTP tests use independent cookie jars to verify credentialed CORS preflight, the CSRF cookie/header
requirement, session restoration after a server restart, per-account record isolation, cross-account
read/delete rejection, and sign-out invalidation. They verify failed credentials return a generic 422
without framework exception details, count toward the shared IP-based registration/login throttle, and
receive a 429 response once that limit is reached. Livewire and Inertia PostgreSQL/MySQL auth requests
must reject before creating files; their integrated SQLite boundaries are unchanged.
The generated docs require explicit production SPA origins, a shared session-cookie parent domain, and
secure cookies over HTTPS. Laravel's session store remains file-based; changing the application database
does not add database-backed or distributed sessions. All accounts and records use synthetic test values;
the job creates no external service or credential. The hosted job uses the pinned PostgreSQL and MySQL
images from the PHP integration infrastructure and is required by the supported-stack release gate. A
tuple is Supported only after its generated-project checks and the exact final PR-head gate pass.

The separate `php-laravel-inertia-react-auth-integration` target generates Laravel 13 + Inertia React
through the production CLI using pinned official blank/authenticated React kits. Its `None` and
Laravel-native/Fortify cases run on SQLite only. It installs Composer dependencies, prepares the
generated SQLite database, runs the Inertia TypeScript check and asset build, and executes generated
Laravel feature tests. The tests verify absent auth routes in `None`, registration with a hashed
password, login/session state, guest redirects, dashboard access, and logout. The harness also checks
that `/api/users` remains public in `None` and auth-protected when present in the native mode, and that
incompatible choices reject before the CLI creates target files. This is distinct from the Laravel 12
API/data integration target and the Laravel 13 Livewire/Fortify target.

The `supabase-auth-integration` target generates the exact React/Vite TypeScript frontend-only mode
with the production CLI. It installs dependencies, starts pinned Supabase CLI `2.122.0` services in
Docker, resets the local database through the generated migration, verifies explicit authenticated
role grants and all four owner policies, builds and previews the app, then tests email signup,
password sign-in, restored local session, local sign-out, and User A/User B row isolation through the
installed Supabase JS `2.118.0` client and Data API. It checks that the generated example uses
placeholders and that the built bundle contains no privileged local key. All local resources are
isolated and removed. The hosted job uses only its disposable local stack; it does not call Supabase
cloud APIs or require provider credentials. Docker is required locally. If Docker Engine is
unavailable, the run can still verify production generation and dependency installation before
reporting the runtime blocker.

Each case gets a unique generated-project directory, database name, and random credentials. Laravel
cases also use a unique Compose project name and no fixed host port mappings. Testcontainers publishes
ephemeral host ports so the generated Node API can connect without port collisions. The suites inject
credentials only through child process environment, redact them from failure output, stop generated
child processes, remove only their own containers/volumes, and delete generated project directories.
Testcontainers uses Ryuk as a fallback if the Node process exits unexpectedly.

The Node database/auth tests cover Express + Drizzle Better Auth. The separate Laravel 13 integration
targets cover their exact Livewire/Fortify and Inertia React/Fortify modes. No managed provider or
account-linking path is implied. The support matrix remains the source of truth for supported
combinations.

## Verification record

This section records the commands and outcomes actually run for this change.

- `npm ci --no-audit --no-fund` — passed; installed 263 packages. npm printed a non-blocking
  deprecation warning for transitive `glob@10.5.0`.
- From `packages/cli/`, `npx vitest run` — passed, 82 tests across 10 files.
- From `packages/cli/`, `npx tsc --noEmit` and `npx tsup` — passed.
- From `packages/cli/`, `npx tsx scripts/smoke-e2e.ts <temp-dir>` — passed; scaffolded 17 projects,
  including the existing matrix, frontend-only, Vue/Svelte variants, and the Next.js overlay.
- `npm run test:integration:db --workspace=create-omnicraft` — passed for SQLite, PostgreSQL, and
  MySQL. Each ran migrations, generated client/API typechecks, CRUD, Better Auth, restart/session
  checks, password-hash verification, and cleanup.
- `npm run test:integration:php --workspace=create-omnicraft` — passed for Laravel 12 with PostgreSQL
  and MySQL. Both ran Composer platform checks, migrations, database-driver assertions, API feature
  tests, and cleanup.
- `npm run test:integration:php-inertia --workspace=create-omnicraft` — passed locally for Laravel 13
  - Inertia React with `None` and Laravel-native/Fortify on SQLite. Both modes were generated through
    the production CLI, migrated, typechecked/built, and exercised with generated Laravel feature tests;
    incompatible choices rejected before target creation.
- `npm run test:integration:node --workspace=create-omnicraft -- --scenario ...` — all 15 registered
  Express, Fastify, and Hono scenarios passed locally through install, client build/API typecheck,
  database initialization, API boot, CRUD/failure checks, and cleanup. Generated-project checks fixed
  Fastify's error-handler typing, portable Fastify/Hono Drizzle MySQL row reads, and an unused Drizzle
  import in the Hono raw-SQL route.
- `npm run test:integration:nextjs --workspace=create-omnicraft -- --database ...` — SQLite,
  PostgreSQL, and MySQL passed locally through official generator, production layers, install, build,
  typecheck, migration, production boot, CRUD/failure checks, and cleanup. These hosted rows are
  pending their first CI run. The checks fixed the Next.js PostgreSQL query typing and migration URL,
  added the missing direct dotenv dependency for migration commands, and checked the previously
  unverified MySQL adapter end to end.
- `docker ps` — no test containers remained after the integration runs.

The first PHP image build attempted to compile `pdo_sqlite`, which the selected PHP image already
loads; the Dockerfile now adds only missing extensions. The final PHP runs passed with that image.

## Hosted CI and status boundary

On PR #28 head `88f7d4261087f97ac909ded92c41dd407a6c4f25`, [hosted run #40532522380](https://github.com/doofx0071/omnicraft/actions/runs/40532522380)
passed all ten CI jobs. `database-integration` passed for Express + Drizzle + SQLite/PostgreSQL/MySQL,
including the generated Better Auth flow, and `php-laravel-integration` passed Laravel 12 (Eloquent)
with PostgreSQL and MySQL. The support matrix promotes only these exact combinations. Other matrix rows and auth
providers remain unchanged.

Hosted [runtime-evidence run #40609596120](https://github.com/doofx0071/omnicraft/actions/runs/40609596120)
passed on commit `b4c26273eaab033fee604bd77c04e0a2ab1d7e19`, including all four Express runtime scenarios,
FastAPI + PostgreSQL, and the aggregate release gate.

Hosted [Fastify/Hono run #40612114736](https://github.com/doofx0071/omnicraft/actions/runs/40612114736)
passed all 15 Node runtime scenarios and the aggregate release gate on commit
`14adbf9d9805e74f44f66d8101077d0d68878f0d`. Exact Fastify/Hono jobs now support the corresponding
matrix rows. The Next.js SQLite/PostgreSQL/MySQL jobs are still pending hosted CI.
