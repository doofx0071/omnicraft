# Database and authentication integration tests

The integration suites run generated OmniCraft projects against real databases. They are explicit,
slow checks; `npm test`, the scaffold smoke script, typechecking, and the CLI build remain Docker-free.

## Prerequisites

- Node.js 20.12 or newer and npm for the CLI, fast checks, SQLite-only integration, and Laravel
  orchestration; PostgreSQL/MySQL Testcontainers runs require Node.js 22.22 or newer, as required by
  [Testcontainers v12](https://github.com/testcontainers/testcontainers-node/releases/tag/v12.0.0).
- Python 3.12 and `uv` for FastAPI; Docker Engine is also required for its PostgreSQL case.
- Docker Engine or Docker Desktop for PostgreSQL/MySQL Testcontainers cases; Docker Compose v2 is also
  required for the containerized PHP/Laravel runner.
- Docker image pulls, PHP image package downloads, and Composer package downloads must be reachable
  from the machine running Docker. The generated Node project also installs dependencies from npm.
- No host PHP or Composer installation is required. Laravel runs in the PHP test image.

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
npm run test:integration:php --workspace=create-omnicraft
```

The Node/Drizzle suite defaults to SQLite, PostgreSQL, and MySQL. Run one database at a time with:

```bash
npm run test:integration:db --workspace=create-omnicraft -- --database sqlite
npm run test:integration:db --workspace=create-omnicraft -- --database postgres
npm run test:integration:db --workspace=create-omnicraft -- --database mysql
npm run test:integration:node --workspace=create-omnicraft -- --scenario express-prisma-postgres
npm run test:integration:python --workspace=create-omnicraft -- --database postgres
```

The FastAPI SQLite case does not require Docker. Its PostgreSQL case installs the generated Python
dependencies, applies the generated Alembic migration, boots Uvicorn, and checks PostgreSQL CRUD,
duplicate and invalid input handling, and missing-record behavior with synthetic Testcontainers
credentials. The PHP/Laravel suite runs PostgreSQL and MySQL cases.

The separate `node-runtime-integration` target covers Express + Prisma + PostgreSQL and Express + raw
SQL with SQLite, PostgreSQL, and MySQL. It installs each generated project, builds/typechecks the
client and API, initializes the schema or applies SQL migrations, boots the API, and checks CRUD plus
duplicate, invalid-input, and missing-record behavior. These cases do not install or exercise auth.

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
feature tests for the selected PostgreSQL or MySQL connection and generated users API. The test asserts
the active driver so a fallback to SQLite cannot pass. The current Laravel overlay has no OmniCraft
authentication implementation, so the Laravel lane verifies database and API behavior only.

Each case gets a unique generated-project directory, database name, and random credentials. Laravel
cases also use a unique Compose project name and no fixed host port mappings. Testcontainers publishes
ephemeral host ports so the generated Node API can connect without port collisions. The suites inject
credentials only through child process environment, redact them from failure output, stop generated
child processes, remove only their own containers/volumes, and delete generated project directories.
Testcontainers uses Ryuk as a fallback if the Node process exits unexpectedly.

These tests cover the implemented Express + Drizzle email/password auth path. They do not add providers
or implement authentication for another framework. The support matrix remains the source of truth for
supported combinations.

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
- `docker ps` — no test containers remained after the integration runs.

The first PHP image build attempted to compile `pdo_sqlite`, which the selected PHP image already
loads; the Dockerfile now adds only missing extensions. The final PHP runs passed with that image.

## Hosted CI and status boundary

On PR #28 head `88f7d4261087f97ac909ded92c41dd407a6c4f25`, [hosted run #40532522380](https://github.com/doofx0071/omnicraft/actions/runs/40532522380)
passed all ten CI jobs. `database-integration` passed for Express + Drizzle + SQLite/PostgreSQL/MySQL,
including the generated Better Auth flow, and `php-laravel-integration` passed Laravel 12 (Eloquent)
with PostgreSQL and MySQL. The support matrix promotes only these exact combinations. Other matrix rows and auth
providers remain unchanged.
