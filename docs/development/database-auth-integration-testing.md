# Database and authentication integration tests

The integration suites run generated OmniCraft projects against real databases. They are explicit,
slow checks; `npm test`, the scaffold smoke script, typechecking, and the CLI build remain Docker-free.

## Prerequisites

- Node.js 20.12 or newer and npm for the CLI, fast checks, SQLite-only integration, and Laravel
  orchestration; PostgreSQL/MySQL Testcontainers runs require Node.js 22.22 or newer, as required by
  [Testcontainers v12](https://github.com/testcontainers/testcontainers-node/releases/tag/v12.0.0).
- Docker Engine or Docker Desktop with the Docker Compose v2 plugin for PostgreSQL/MySQL cases.
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
```

The SQLite case does not require Docker. The PHP/Laravel suite runs PostgreSQL and MySQL cases.

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

These tests cover the implemented Express + Drizzle email/password auth path. They do not add providers,
implement authentication for another framework, or change the support status of any generated stack.
The support matrix remains the source of truth for supported combinations.

## Verification record

This section records the commands and outcomes actually run for this change.

- `npm ci --no-audit --no-fund` — passed; installed 263 packages. npm printed a non-blocking
  deprecation warning for transitive `glob@10.5.0`.
- `npm test` — passed, 77 tests across 9 files.
- `npx tsc --noEmit` — passed.
- `npx tsup` — passed.
- `npx tsx scripts/smoke-e2e.ts <temp-dir>` — passed; scaffolded the existing matrix, frontend-only,
  Vue/Svelte variants, and the Next.js overlay.
- `npm run test:integration:db` — passed for SQLite, PostgreSQL, and MySQL. Each ran migrations,
  generated client/API typechecks, CRUD, Better Auth, restart/session checks, password-hash verification,
  and cleanup.
- `npm run test:integration:php` — passed for Laravel 12 with PostgreSQL and MySQL. Both ran Composer
  platform checks, migrations, database-driver assertions, API feature tests, and cleanup.
- `git diff --check` — passed. No Docker test containers remained after the integration runs.

The first PHP image build attempted to compile `pdo_sqlite`, which the selected PHP image already
loads; the Dockerfile now adds only missing extensions. The final PHP runs passed with that image.

## Shared documentation follow-up

The shared [testing strategy](testing-strategy.md) was left unchanged as requested. Before merging,
update its opening count to the verified local fast-suite result (77 tests / 9 files), add the two
hosted-Linux database jobs to the CI level, and replace the statement that CI does not boot servers or
hit databases. The new jobs boot generated APIs and exercise real databases. Do not change
support-matrix statuses based on the presence of this test scaffolding alone.

The local Level-3 runs now verify Express + Drizzle with SQLite, PostgreSQL, and MySQL, plus Laravel
with PostgreSQL and MySQL. After the new hosted CI jobs pass, update the affected evidence in
`stack-support-matrix.md`; promote the currently scaffold-verified MySQL/Laravel rows only if the full
CI and per-combination evidence meet the matrix's criteria. The `CONTRIBUTING.md` checklist still says
62 tests and should be refreshed to 77 tests / 9 files as part of that shared-doc update.
