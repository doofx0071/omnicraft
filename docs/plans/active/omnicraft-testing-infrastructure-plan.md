# OmniCraft — Database, Authentication, PHP/Composer, and Generated-Project Testing Plan

**Status:** Closeout in progress; final hosted CI evidence pending
**Prepared:** 2026-10-27
**Repository:** <https://github.com/doofx0071/omnicraft>
**Current repository path:** `docs/plans/active/omnicraft-testing-infrastructure-plan.md`
**Related plan:** `docs/plans/completed/omnicraft-master-plan.md`
**Related guides:** `docs/development/testing-strategy.md`, `docs/templates/stack-support-matrix.md`, `docs/templates/adding-an-integration.md`, `docs/templates/template-contract.md`

> This is a focused addendum to the master plan, not a replacement for it. It specifies how OmniCraft should test generated projects against real databases and how to verify authentication and other integrations end to end, including PHP/Laravel through a Dockerized PHP + Composer test runtime. The dated recommendation below is historical; current implementation status and closeout evidence are recorded in the section that follows.

## Current implementation status

- **Phases 0–1:** the current stack matrix and CI tooling requirements are recorded; Node PostgreSQL/
  MySQL use Testcontainers, and Laravel runs in the pinned PHP/Composer image with isolated Compose DBs.
  SQLite DB tests for Node/FastAPI need no DB container; PHP remains containerized so host PHP/Composer
  are not required.
- **Phases 2–3:** generated Express + Drizzle CRUD and Better Auth flows run for SQLite, PostgreSQL, and
  MySQL, including migration, restart-persistent sessions, denial/allowance, logout, duplicate signup,
  wrong credentials, stored hash, and secret/log checks.
- **Phase 4:** creation-time auth is **not applicable** because the CLI has no creation-time auth
  feature. The existing `omnicraft add auth` path is tested in the generated-project database suite.
- **Phase 5:** FastAPI + SQLite and Laravel + SQLite were added to the runtime suite and pass locally;
  hosted evidence is pending. Laravel PostgreSQL/MySQL are already exercised. The remaining existing
  selectable combinations are intentionally not promoted and are itemized in the [runtime evidence
  follow-up](omnicraft-stack-runtime-evidence-plan.md). Laravel Livewire/Inertia starter modes are
  **not applicable** because the current CLI exposes no such modes.
- **Phase 6:** CI maps Supported rows to scripts/scenarios/jobs, gates releases on the full supported
  matrix and package artifact, and supports pull requests, main pushes, nightly runs, and explicit
  pre-release dispatch. Documentation contains exact commands and runtime boundaries. The final hosted
  run is still required before this plan is archived.
- **Phase 7:** future browser, mail-catcher, and external-service work remains conditional on those
  features being implemented; it is not a blocker for this plan.

---

## 1. Executive recommendation

OmniCraft should use **real, disposable Docker database containers for integration tests**, and it should also provide a reproducible PHP/Composer runtime for the Laravel/PHP templates. The CLI generates projects that claim to connect applications to databases, apply schemas/migrations, and implement behavior such as CRUD and authentication. Static template checks and TypeScript builds cannot establish that those behaviors work against PostgreSQL, MySQL, or a PHP framework runtime.

Recommended approach:

1. Keep existing unit tests and scaffold smoke tests fast and Docker-free.
2. Use **Testcontainers for Node.js-generated applications** to start disposable PostgreSQL and MySQL containers, then run migrations, boot generated servers, and exercise real HTTP/database behavior.
3. Keep SQLite integration tests Docker-free where practical; always use a fresh temporary database file per run.
4. Add a dedicated **Dockerized PHP test runner** based on the official PHP CLI image, with Composer available inside that matching PHP environment and the PHP extensions required by the generated project. Use it for Laravel/PHP dependency installation, migrations, Artisan/Pest/PHPUnit tests, and runtime checks.
5. Use Docker Compose for the PHP integration lane so the PHP runner and selected PostgreSQL/MySQL service share an internal network. Keep a simple optional Compose workflow for developers who want to inspect databases manually.
6. For Laravel projects with Vite/Inertia-based frontend assets, use a separate Node.js container (or a clearly isolated Node CI step) for `npm ci` and the generated asset build. Do not require Node for PHP-only/API cases that do not need frontend assets.
7. Run container-backed integration tests on GitHub-hosted Ubuntu. Keep cross-platform unit/scaffold checks on the existing Windows, Linux, and macOS jobs.
8. Expand authentication testing from Better Auth + Express + Drizzle + SQLite to PostgreSQL and MySQL only after the matching base-stack and auth schema/migration paths are compatible. Test future Laravel authentication separately with Laravel's generated auth flow and PHP test tooling.
9. Treat a stack or integration as **Supported** only when its defined evidence passes. Scaffolded files, successful dependency installation, or typechecking alone are not proof that a database integration works.

Important distinction: **PHP is the runtime; Composer is the PHP dependency manager, not a PHP runtime.** The Laravel/PHP lane needs an image that can actually execute PHP and has Composer available inside it. Use Testcontainers, Docker Compose, or GitHub Actions service containers according to the test lane, but do not provision the same database multiple times for one test run. Testcontainers is a good fit for Node test orchestration; Compose is the clearest fit for a PHP test runner plus a database sharing one Docker network. See the [Testcontainers PostgreSQL module](https://node.testcontainers.org/modules/postgresql/), [Testcontainers MySQL module](https://node.testcontainers.org/modules/mysql/), [Docker PHP guide](https://docs.docker.com/guides/php/), [Composer Docker guidance](https://getcomposer.org/doc/00-intro.md#docker-image), and [Laravel Sail documentation](https://laravel.com/docs/13.x/sail).

## 2. Current-state findings from the repository

The current public repository already has meaningful testing layers. This plan adds missing real-database coverage rather than replacing the existing test strategy.

### 2.1 Existing test structure

The current `docs/development/testing-strategy.md` documents:

- **Level 1 — unit tests:** argument parsing, validation, rendering, manifest merging, prefilled answers, composition, and related CLI logic.
- **Level 2 — scaffold smoke:** generate all currently enumerated combinations in temporary output directories without installing or booting every generated application.
- **Level 3 — generated-project verification:** install the project, typecheck, boot it, and exercise API/database behavior for a combination being added or changed.
- **CI:** typecheck/build/unit tests, scaffold smoke tests, selected generated-project installation/typechecking, and package-artifact checks.

The same testing guide explicitly says CI does not currently boot all generated servers or hit all databases. The support matrix records some PostgreSQL/SQLite behavior as locally verified, while multiple MySQL, PostgreSQL, Python, and Laravel variants remain `Scaffold-verified` because their complete database-backed runtime path has not been exercised.

Relevant source documents:

- `docs/development/testing-strategy.md`
- `docs/templates/stack-support-matrix.md`
- `packages/cli/scripts/smoke-e2e.ts`
- `packages/cli/src/scaffold/`
- `packages/cli/templates/`
- `.github/workflows/ci.yml`
- `packages/cli/package.json`
- GitHub issue [#23 — Auth boilerplate wired to the users table](https://github.com/doofx0071/omnicraft/issues/23)

### 2.2 Current authentication baseline

Issue #23 records `omnicraft add auth` as a Better Auth email/password integration for Express + Drizzle. Its documented end-to-end SQLite checks include registration, successful login, session retrieval using a cookie, wrong-password rejection, a protected `/api/me` route returning unauthorized without a session and success with a valid session, logout, and invalidation of the session after logout.

That is a valuable first proof, but it does not prove that the same auth integration works with PostgreSQL or MySQL. Better Auth's official Drizzle adapter documentation explicitly shows `provider: "sqlite"`, `provider: "pg"`, and `provider: "mysql"`; each database still needs its own migration/schema and runtime validation. See [Better Auth's Drizzle adapter guide](https://better-auth.com/docs/adapters/drizzle).

### 2.3 Specific goals for this plan

- Test real PostgreSQL and MySQL, not just mocked clients.
- Verify migrations/schema setup before any endpoint tests.
- Verify CRUD/data access and database error handling.
- Verify the complete Better Auth flow against every database dialect OmniCraft advertises as supported for auth.
- Reuse a shared auth integration between future create-time wizard configuration and `omnicraft add auth`.
- Make tests reproducible locally and in CI, with reliable cleanup and no production credentials.
- Update the support matrix with concrete evidence rather than manually optimistic labels.

---

## 3. Proposed test architecture

### 3.1 Test layers

| Layer | Purpose | Docker required? | Required on every PR? |
|---|---|---:|---:|
| L1 — Unit | Arguments, prompts, validators, compatibility, composition, token rendering, merge rules | No | Yes |
| L2 — Scaffold matrix | Generate every advertised stack combination and assert expected files/tokens/configuration | No | Yes |
| L2b — Generated static validation | Install/typecheck/lint/build selected generated project combinations | No, unless the project itself requires containers | Yes for representative combinations and all changed combinations |
| L3 — SQLite integration | Apply schema/migrations, start app, hit real endpoints, validate CRUD/auth as applicable | No | Yes for core SQLite and auth regression paths |
| L4 — PostgreSQL/MySQL integration (Node stacks) | Start real DB container, migrate, boot generated app, exercise HTTP/DB behavior | Yes | Yes on a dedicated Linux job for core supported paths; changed combinations must be included |
| L4-PHP — PHP/Laravel integration | Run Composer/PHP in a matching PHP CLI container, connect to the selected DB over Compose networking, migrate, run framework tests, and verify DB/runtime behavior | Yes | Required for PHP/Laravel combinations before they are marked Supported |
| L5 — Browser E2E | Test user-facing sign-in/protected pages in a real browser | Browser install; DB may also be required | When a generated browser auth UI exists; otherwise defer |
| L6 — Release matrix | Verify all combinations advertised as Supported across their applicable runtimes | Yes for DB-backed combinations; PHP lane also requires PHP/Composer container | Before release; optionally nightly on schedule |

### 3.2 Use Testcontainers for Node-generated application tests

Add the official Testcontainers Node.js modules as development-only dependencies when implementation begins:

- `@testcontainers/postgresql`
- `@testcontainers/mysql`

Do not add these packages to generated users' project dependencies. They belong to OmniCraft's development/test toolchain only.

The integration test harness should:

1. Start the required database container with a pinned, explicit image tag.
2. Wait for the database to become ready using the container module's readiness strategy, not an arbitrary fixed sleep.
3. Read the host/port/credentials from Testcontainers' runtime metadata.
4. Generate an isolated project in a unique temporary directory.
5. Install that generated project's dependencies in a controlled subprocess.
6. Create a temporary test environment with a database connection string and test-only auth secret.
7. Run the exact documented migration/initialization command for that generated project.
8. Start the generated server as a child process.
9. Poll its health endpoint with a deadline and capture logs on failure.
10. Exercise real HTTP endpoints and, where required, assert database state.
11. Stop the server, close DB clients, stop/remove the container, and delete the temporary directory even if an assertion fails.

Testcontainers' database modules document this pattern for running a real query against a PostgreSQL or MySQL container: [PostgreSQL](https://node.testcontainers.org/modules/postgresql/) and [MySQL](https://node.testcontainers.org/modules/mysql/).

**Do not enable container reuse in CI.** CI needs clean state and deterministic teardown. Reuse can be an optional local optimization only if it cannot retain data between test runs or undermine isolation.

### 3.3 Optional Docker Compose for manual database debugging

Keep `tests/infra/compose.yaml` as an optional manual database-debugging environment. It may provide PostgreSQL and MySQL services with:

- Explicit versioned image tags (never `latest`).
- Health checks.
- Test-only database names, usernames, and passwords.
- Host ports bound to `127.0.0.1` with configurable non-default host ports.
- No persistent named volume by default, unless manual persistence is an intentional documented option.
- No production secrets and no real user data.
- Clear teardown instructions, including the explicit `-v` option only when a developer intends to remove test data.

For the Node.js database suite, Compose is for manually reproducing failures and automated tests should continue using Testcontainers so readiness, connection details, and cleanup are controlled by the test harness. **Exception: the PHP/Laravel integration lane described next should use a dedicated Compose profile**, because the test needs a PHP/Composer runtime and a database on the same container network. Do not provision the same database through Testcontainers and Compose in one PHP test run.

### 3.4 Dockerized PHP, Composer, and Laravel test runtime

**Required for PHP/Laravel integration testing.** A database container alone is not sufficient to verify an OmniCraft-generated Laravel project. The test environment must also run the project's PHP version, required PHP extensions, Composer dependencies, Artisan commands, migration workflow, and tests. Do not install PHP/Composer on every developer's host as a prerequisite; use a reproducible test container so Windows, macOS, Linux, and CI contributors can run the same PHP lane when Docker is available.

#### Recommended design

- Build a test-only image from the official PHP CLI image (`php:<pinned-version>-cli`), choosing the PHP minor version from the generated template's `composer.json` constraints and the version supported by that Laravel template. Do not use `php:latest`.
- Install the required OS tools and PHP extensions in that image. At minimum, validate the extensions required by the actual template; for Laravel the official server requirements include Ctype, cURL, DOM, Fileinfo, Filter, Hash, Mbstring, OpenSSL, PCRE, PDO, Session, Tokenizer, and XML. Database test images additionally need the right PDO driver, such as `pdo_pgsql` for PostgreSQL and `pdo_mysql` for MySQL. Common Composer/asset needs may include `git`, `unzip`, `zip`, `intl`, and `bcmath` depending on the generated project's dependencies. Do not blindly install all optional extensions: check `composer.json`, `composer.lock`, Laravel starter-kit dependencies, and `composer check-platform-reqs`.
- Make Composer available inside the matching PHP environment. Preferred pattern: copy the Composer binary from the official `composer/composer:2-bin` image in a multi-stage Dockerfile (or install a pinned Composer 2 release). This gives the test process the PHP version and extension set that will actually run the application.
- **Do not use the generic `composer/composer:2` image as the application runtime or assume its PHP/extension set matches the generated project.** Composer's own guidance says dependency installation should run using the same PHP version and extensions as the application runtime; otherwise Composer may resolve/install under a mismatched platform. See [Composer's Docker guidance](https://getcomposer.org/doc/articles/caching.md#docker-and-buildkit), [Composer platform dependencies](https://getcomposer.org/doc/articles/composer-platform-dependencies.md), and the [official PHP image documentation](https://hub.docker.com/_/php).
- Add a `php-test` Compose service built from this Dockerfile. Mount the temporary generated project at a known work directory, run `composer install --no-interaction --prefer-dist` from its `composer.lock`, then run the project's documented Artisan/migration/test commands. Never run `composer update` in a verification test because it can change dependency resolution instead of verifying the lockfile.
- Add a PostgreSQL profile and a MySQL profile, or equivalent per-database Compose files, so the `php-test` service can reach the selected database through an internal Compose network using service DNS names (for example `postgres` or `mysql`). Use health checks and wait for database readiness before migrations. Use synthetic credentials and ephemeral database storage; do not expose DB ports to the host unless a local debugging mode explicitly requests it.
- Add an optional `node-assets` service using a pinned Node.js image for Laravel starter kits that require Vite/Inertia/React/Vue/Svelte asset installation and compilation. Run `npm ci` when a lockfile is present and then the generated project's asset build command. Skip this service for PHP/API templates with no frontend asset build. Do not put Node into the PHP image just for convenience.
- Execute Laravel's generated tests (`php artisan test`, Pest, or PHPUnit as defined by the project), run migrations against an empty PostgreSQL/MySQL database, seed only when part of the generated setup, and run at least one real data-access/API behavior check. For HTTP smoke tests, run the generated server in the PHP container and poll its health endpoint with a bounded timeout.
- Keep the container test image test-only; do not copy it into generated projects by default. Generated Laravel projects may optionally offer Laravel Sail as a user-facing development environment, but OmniCraft's internal test runner and Sail-generated project Docker configuration are separate concerns. Sail is Laravel's own Docker development environment and can be validated as a generated-project option in a dedicated test later; do not require Sail to run every Laravel test. See [Laravel Sail](https://laravel.com/docs/13.x/sail) and [Laravel installation requirements](https://laravel.com/docs/13.x/deployment#server-requirements).
- Run the PHP test container and database service under one unique Compose project name per test run. Use `docker compose run --rm` for the PHP test task, and always call `docker compose down --volumes --remove-orphans` for that unique test project in teardown. Do not remove shared developer volumes or run broad `docker system prune` commands.
- Capture sanitized PHP/Composer/Artisan output on failure. Never print complete `.env` files or secrets. Preserve generated output only in an explicit debug mode, and exclude populated `.env` files from artifacts.

#### Proposed infrastructure files

```text
tests/infra/
├── compose.yaml                 # optional manual Postgres/MySQL debugging
├── php/
│   ├── Dockerfile               # PHP CLI + required extensions + Composer binary
│   └── entrypoint.sh            # optional test command wrapper / diagnostics
├── compose.php-postgres.yaml    # PHP test runner + PostgreSQL service/profile
├── compose.php-mysql.yaml       # PHP test runner + MySQL service/profile
└── node-assets/                 # only if a separate Node asset-build image is required
```

Adapt this layout to the repository's existing test structure instead of moving existing files unnecessarily. A single Compose file with profiles is also acceptable if it remains understandable and the test harness can start only the selected DB.

#### PHP test image blueprint (illustrative; pin versions during implementation)

This image is a **test toolchain**, not the production image for generated Laravel applications. It should contain:

- A PHP CLI version compatible with the Laravel template's declared `php` constraint.
- Composer 2 installed as a binary in that same PHP runtime.
- `pdo_pgsql`, `pdo_mysql`, and/or `pdo_sqlite` according to the database being tested.
- The PHP extensions required by Laravel and the generated project's locked Composer dependencies.
- Minimal OS utilities needed by Composer (`git`, `unzip`) and the libraries needed to compile the selected PHP extensions.

The example below shows a useful starting point for a matrix that includes SQLite, PostgreSQL, and MySQL. It deliberately builds on the PHP CLI image and copies only the Composer binary from the official binary-only Composer image. Composer's official documentation describes this pattern and cautions that the dependency installation environment should match the application's PHP version and extensions: [Composer Docker/BuildKit guidance](https://getcomposer.org/doc/articles/caching.md#docker-and-buildkit), [official Composer binary image](https://hub.docker.com/r/composer/composer), and [official PHP image](https://hub.docker.com/_/php).

```dockerfile
# tests/infra/php/Dockerfile
# Example tags only. Before CI use, pin reviewed PHP/Composer tags or digests
# that match the generated Laravel template's composer.json constraints.
ARG PHP_VERSION=8.4
FROM php:${PHP_VERSION}-cli-bookworm

COPY --from=composer/composer:2.10.3-bin /composer /usr/local/bin/composer

RUN apt-get update && apt-get install -y --no-install-recommends \
    git unzip \
    libcurl4-openssl-dev libicu-dev libonig-dev libpq-dev \
    libsqlite3-dev libxml2-dev libzip-dev \
 && docker-php-ext-install -j"$(nproc)" \
    bcmath curl dom intl mbstring \
    pdo_mysql pdo_pgsql pdo_sqlite sqlite3 xml zip \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
CMD ["php", "--version"]
```

This remains an **illustrative starting point** rather than a guaranteed, universal Dockerfile. The actual extension list must be verified from the generated `composer.json`, `composer.lock`, Laravel version, and all selected integrations. For example:

- `pdo_mysql` is required for direct PDO/MySQL integration tests.
- `pdo_pgsql` is required for direct PDO/PostgreSQL integration tests.
- `pdo_sqlite` and `sqlite3` are needed when the selected dependencies/test path use SQLite.
- `curl`, `dom`/XML, and `mbstring` are among Laravel's documented server requirements; many of the other core requirements are built into the official PHP image, but confirm with `php -m`.
- `intl`, `zip`, and `bcmath` should be included when required by the generated starter kit or dependencies; do not blindly install every optional extension.
- `gd`, Redis, Imagick, and other PECL extensions/services should be added only when an advertised template requires them.
- Run `composer check-platform-reqs` after dependency installation. Never mask missing extensions with `--ignore-platform-reqs` in a support-verification test.

Laravel 13's current deployment requirements specify PHP >= 8.3 and document the required extensions. The version shown above (`8.4`) is an example only: first inspect the actual generated template's Laravel version and `composer.json`, then test the minimum PHP version it declares. Add a newer supported PHP version to a compatibility matrix where practical. Before relying on the image in CI, replace floating major/minor tags with reviewed, pinned versions or image digests under OmniCraft's reproducibility policy. See [Laravel 13 server requirements](https://laravel.com/docs/13.x/deployment#server-requirements).

Composer is a **dependency manager**, not the PHP runtime. Do not use the generic Composer runtime image as if it were the tested application runtime. The test process should execute Composer and the application under the same PHP version and extension set so that platform checks and scripts reflect the runtime being verified.

The Compose runner should mount one generated project into `/workspace`, run commands as an unprivileged user where practical, and connect to `postgres` or `mysql` through the private Compose network. Do not publish the PHP runner's port unless a test specifically needs host-side HTTP access. Do not mount the host home directory, SSH keys, or global Composer credentials into the test container.

#### PHP/Laravel test workflow

1. Generate an actual Laravel project through OmniCraft in a temporary directory.
2. Select a test profile for the intended Laravel PHP version, frontend starter mode, database, and auth integration (where implemented).
3. Start only the required DB service in the dedicated Compose project and wait for healthy status.
4. Run `php -v`, `composer --version`, and `php -m`/`composer check-platform-reqs` in the PHP test container to expose missing runtime prerequisites.
5. Run `composer install --no-interaction --prefer-dist`; verify a committed/generated `composer.lock` is honored.
6. If the selected starter kit uses Vite/Inertia frontend assets, run `npm ci` and the project's build command in the Node asset container or the approved Node CI step.
7. Prepare a test-only `.env`/environment, generate `APP_KEY` as required by Laravel, and configure `DB_CONNECTION`, host, port, database, username, and password using the Compose service name. Never commit this file.
8. Run `php artisan migrate --force` against a clean test database and any explicitly documented seed command.
9. Run `php artisan test` (or the generated Pest/PHPUnit command) and the integration smoke path. For API/CRUD templates, verify at least one write and read against the real DB.
10. If browser-facing auth starter kits are generated, validate their asset build in this lane; full browser workflows can be a later Playwright phase.
11. Tear down the PHP service, database, network, temporary data volumes, and project directory even if a step fails.

**Acceptance criteria:** the project can run Composer dependency checks and Laravel commands inside the pinned PHP image; both PostgreSQL and MySQL lanes can migrate and execute real behavior for the Laravel combinations advertised as Supported; no host PHP/Composer installation is required for the Docker-backed PHP lane; failures produce actionable redacted logs.

### 3.5 Database image/version policy

- First inspect the database versions used by existing generated templates and existing Compose examples.
- Pin a specific, supported database image tag in CI and tests. Do not use `latest` because that makes a test's behavior change independently of a code review.
- Start with the currently intended compatibility baseline for each database; a sensible initial candidate is PostgreSQL 17.x and MySQL 8.4.x LTS, subject to compatibility review against the repo's templates and drivers.
- Add a scheduled compatibility job for newer supported majors after the baseline is green. PostgreSQL 18 is a supported current major, and MySQL 8.4 is an LTS series; consult the official [PostgreSQL versioning policy](https://www.postgresql.org/support/versioning/) and [MySQL 8.4 release model](https://dev.mysql.com/doc/refman/8.4/en/mysql-releases.html) when choosing/updating pins.
- When updating an image, update the test metadata, docs, and relevant generated Compose templates together if those versions are coupled.

Exact patch tags should be reviewed and deliberately updated; the versions above are proposed baselines, not claims that all current templates have already been tested with them.

---

## 4. Test harness design

### 4.1 Suggested layout

Follow the existing repository structure where practical; do not restructure the test suite solely to match this example.

```text
packages/cli/
├── scripts/
│   ├── smoke-e2e.ts                  # existing fast scaffold matrix
│   ├── db-e2e.ts                     # proposed Node DB orchestrator
│   └── php-laravel-e2e.ts            # proposed PHP/Compose orchestrator
├── src/
│   └── ... existing unit tests ...
└── tests/
    ├── support/                      # process, HTTP, generation, cleanup helpers
    ├── database/                     # PostgreSQL, MySQL, SQLite integration tests
    ├── auth/                         # Better Auth integration tests
    └── fixtures/                     # test-only values; no credentials

# Repository-level Docker test infrastructure
tests/infra/
├── compose.yaml                     # optional manual DB debugging
├── php/
│   ├── Dockerfile                   # PHP CLI + extensions + Composer binary
│   └── entrypoint.sh                # optional test wrapper/diagnostics
├── compose.php-postgres.yaml         # PHP test runner + PostgreSQL
├── compose.php-mysql.yaml            # PHP test runner + MySQL
└── node-assets/                     # optional Node asset-build image
```

If the current Vitest configuration auto-discovers files too broadly, add a dedicated integration configuration or use an explicit file pattern. Keep the normal `npm test` command quick and independent of Docker; expose Docker-backed checks through separate scripts such as `npm run test:integration:db` and `npm run test:integration:php`.

### 4.2 Recommended npm scripts

Names are proposals; align them with existing package scripts before adding anything.

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:integration:db": "vitest run --config vitest.integration.config.ts tests/database tests/auth",
    "test:integration:php": "tsx scripts/php-laravel-e2e.ts",
    "test:smoke": "tsx scripts/smoke-e2e.ts"
  }
}
```

Do not blindly copy this snippet: define paths/configuration according to the current package and verify the commands in CI. The PHP command is a host-side orchestrator that invokes Docker Compose; it does not require PHP or Composer to be installed on the host.

### 4.3 Isolation and reliability rules

- Use a unique temporary directory for each generated project.
- Use a unique database name or schema per test run when the database module supports it.
- Do not share the same auth account/session state across concurrently mutating tests.
- Use dynamically assigned container ports; avoid relying on host ports 5432 or 3306 being free.
- Use unique test emails and deterministic synthetic data.
- Do not use a fixed `sleep` to wait for database/server readiness; poll health/readiness with bounded timeouts.
- Set per-stage timeouts for installation, migration, server startup, and HTTP tests.
- Capture stdout/stderr and sanitized environment diagnostics on failure; never dump secrets.
- Register cleanup in `finally`/test teardown so failed assertions do not leave servers or containers running.
- Stop child processes gracefully, then force terminate only after a timeout.
- Never point integration tests at a developer's default/local/production database.
- Fail fast if an integration test is configured with a non-test hostname or a connection string that does not match the test harness.
- Avoid depending on external auth APIs or real OAuth credentials in normal CI.

Vitest documents `beforeEach`/`afterEach` and setup/teardown hooks for database connections, server startup, and cleanup: <https://vitest.dev/guide/learn/setup-teardown>.

---

## 5. Database integration scenarios

### 5.1 Required behavior for every advertised database-backed project

For any generated stack marked **Supported**, the end-to-end test should run the generated application's own documented scripts rather than silently substituting a different setup.

Minimum flow:

1. Generate the project through the real CLI or through the same exported scaffolding path used by the CLI.
2. Install dependencies with the project's package manager.
3. Verify the expected config, `.env.example`, migration/schema files, README, and scripts exist.
4. Create a fresh database/container.
5. Set the test connection string and required variables.
6. Run migrations/initialization using the documented command.
7. Run seeds if the template documents seeding.
8. Boot the generated server.
9. Wait for `/api/health` or the stack's declared health endpoint.
10. Exercise actual endpoints and confirm changes reach the database.
11. Verify failure behavior where applicable.
12. Shut down and clean up.

Minimum CRUD/validation checks (adapt routes/statuses to the documented generated API contract):

- Health endpoint responds as expected.
- Valid create succeeds and returns a stable identifier.
- Read-by-ID and list return the created record.
- Update persists the new value.
- Delete removes the record or follows the documented soft-delete behavior.
- Duplicate/constraint violation returns the documented conflict or validation status (for example `409` or `422` where applicable).
- Invalid payloads return a safe, consistent client error.
- Missing resource returns the documented `404` or equivalent.
- Database error logs do not expose passwords, complete connection URLs, or secrets.
- Missing/invalid environment configuration reports an actionable error instead of hanging or silently succeeding.

### 5.2 Database-specific checks

**PostgreSQL:** verify connection configuration, migrations, data types/constraints used by the generated schema, create/read/update/delete, uniqueness, and rollback/cleanup behavior. Test with the project's actual PostgreSQL driver/ORM adapter.

**MySQL:** verify connection configuration, migrations, generated SQL dialect, identifier casing, uniqueness, date/time handling, string/index constraints where relevant, CRUD, and errors. A MySQL template that only scaffolds or typechecks must not be promoted to Supported until this works against the actual MySQL server.

**SQLite:** continue the fast zero-Docker path; use a fresh database file per test, run migrations, boot the app, exercise CRUD, and remove the file after each run. Do not share a persistent developer DB file in CI.

**Prisma:** run Prisma generation as required, apply the project's chosen migration/setup command, then run a real query. Avoid relying on typechecking alone; the generated client may compile while its schema or connection setup is wrong.

**Drizzle:** run the generated migration path and query real data. Prefer committed/generated migration artifacts and a documented migration command; if a template intentionally uses a schema-push command for development, document that clearly and test the exact documented command.

**FastAPI + SQLAlchemy/Alembic:** install using the declared Python toolchain, apply Alembic migrations, boot Uvicorn, exercise endpoints and verify PostgreSQL state for the PostgreSQL path.

**Laravel + Eloquent:** run Composer inside the pinned PHP CLI test container with the extensions required by the selected template; run the generated migration/test commands against PostgreSQL/MySQL Compose services; run Node asset compilation in a separate Node container when the selected Laravel starter kit uses Vite/Inertia. Boot the generated server or run Laravel feature tests and verify CRUD/auth behavior before promoting each combination to Supported.

---

## 6. Authentication end-to-end test plan

### 6.1 Current baseline and expansion boundary

The current issue #23 documents Better Auth email/password support for Express + Drizzle. It records an end-to-end test on SQLite. Start from that passing regression path; do not replace it with only mocked unit tests.

Better Auth's Drizzle adapter documentation lists provider values for SQLite, PostgreSQL (`pg`), and MySQL (`mysql`): <https://better-auth.com/docs/adapters/drizzle>. This makes those dialects relevant test targets when the corresponding OmniCraft auth + stack combinations are implemented and registered. It does not mean the integration is automatically correct for each database.

### 6.2 Better Auth test matrix

| Auth + generated stack | Initial status | Required action |
|---|---|---|
| Express + Drizzle + SQLite | Existing E2E proof documented in issue #23 | Keep as mandatory regression test; make it repeatable in CI if feasible |
| Express + Drizzle + PostgreSQL | Base stack documented as supported; auth is not yet proven by the SQLite test | Add real PostgreSQL-container auth E2E before declaring auth supported for PostgreSQL |
| Express + Drizzle + MySQL | Base MySQL combination is listed as scaffold-verified in the current matrix | First complete base MySQL migration/CRUD E2E; then auth migration + E2E; only then promote both statuses |
| Express + Prisma | Not the current auth integration contract | Do not show Better Auth as supported until a distinct Prisma auth adapter/schema path is implemented and tested |
| Fastify/Hono/other server frameworks | Auth handler currently documented for Express | Treat as unsupported for auth until framework-specific wiring, middleware order, and tests exist |

### 6.3 Required authentication flow tests

Run against SQLite, PostgreSQL, and MySQL as each path becomes supported:

1. Auth schema/migrations apply to a fresh database.
2. Application boots and auth endpoint is reachable.
3. Registration with a valid email/password succeeds.
4. Registration with the same email twice is rejected cleanly and leaves only one valid account.
5. Invalid/missing fields are rejected with a safe response.
6. Valid login succeeds.
7. Wrong password and unknown-account login fail without revealing sensitive details.
8. Session lookup returns the authenticated user when the correct cookie is sent.
9. Session lookup is unauthenticated when no cookie or an invalid/expired cookie is sent.
10. Protected `/api/me` (or the current generated protected-route example) rejects an unauthenticated request and accepts a valid session.
11. Logout succeeds; the old session is no longer valid afterward.
12. A new process/restart does not accidentally invalidate a still-valid persisted session unless that behavior is explicitly intended by the implementation.
13. Database records contain no plaintext password; the secret and connection URL are not emitted in logs or generated committed files.
14. Cookie options, trusted origins/CORS, and production-only secure-cookie configuration match the generated security guidance.
15. Schema uniqueness, foreign keys, timestamps, and dialect-specific column mappings work on the chosen database.

Use the actual API paths and response contracts produced by the current generated auth implementation; do not hard-code hypothetical endpoints from this plan if the integration defines a different path.

Better Auth documents cookie-based session behavior and database schema/migrations in its official [session management](https://better-auth.com/docs/concepts/session-management) and [database](https://better-auth.com/docs/concepts/database) guides.

### 6.4 Test initial-create auth and `omnicraft add auth` as separate entry points

If the interactive scaffold wizard gains `Include authentication? Yes/No`, test it separately from `omnicraft add auth`.

**Create-time path:**

- Answer Yes and select Better Auth; generated project contains the auth integration, dependencies, required schema/migration files, and documentation.
- Answer No; no auth dependency, auth route, auth schema, or secret requirement should appear accidentally.
- Unsupported auth + stack combinations are hidden or explicitly rejected before any files are written.

**Post-scaffold path (`omnicraft add auth`):**

- Apply to an eligible generated project without auth.
- Verify existing user routes, scripts, package manifest, environment files, and template-owned files are preserved or intentionally patched.
- Run `omnicraft add auth` twice and verify idempotency or a clear “already installed” response; never duplicate dependencies/routes/schema.
- Apply to unsupported projects and conflicting files; fail safely with no partial writes.

Both entry points should call the same auth integration definition/compatibility checks so they cannot drift into different security defaults. They may use different generation orchestration because an empty destination and a modified existing project have different collision risks.

### 6.5 Managed auth providers later

Do not make real Clerk or hosted Supabase credentials a requirement for the regular pull-request suite. For future integrations:

- Unit-test provider configuration, callback/route wiring, and environment validation with test doubles.
- Run local-service or sandbox-based integration tests only where the provider supports it.
- Put any real provider smoke test in a dedicated, permission-restricted workflow using sandbox credentials stored in GitHub Actions secrets/environments, never in pull-request-controlled scripts.
- Never print tokens/cookies/credentials or commit browser storage state. Playwright warns that saved browser auth state can impersonate a user; see <https://playwright.dev/docs/auth>.

---

## 7. Other integration behaviors worth testing

Beyond databases and auth, use the same real-resource approach where a generated feature depends on a service.

### 7.1 Environment/configuration

- Required variables present and valid.
- Missing database URL produces an actionable startup/configuration error.
- Invalid URL fails safely without an infinite retry loop.
- No secret values are included in console output, error reports, `.env.example`, README, or committed artifacts.
- `.env` is ignored by Git; `.env.example` contains placeholders only.
- Production-like cookie/secret configuration is not silently weakened by test defaults.

### 7.2 Migrations and startup

- Fresh database can be initialized from scratch.
- Migration command exits non-zero on failure.
- Re-running the documented migration command is safe where the migration tool promises idempotent behavior.
- App fails with an actionable message when the database is unavailable at startup or during a request.
- App recovers after a transient database failure only if retry/reconnection is part of the documented template contract.
- Generated README commands match actual `package.json`/project scripts.

### 7.3 HTTP/API behavior

- Health endpoint and CRUD contract.
- Validation errors and not-found behavior.
- Duplicate/unique constraint behavior.
- Unexpected database errors return safe error bodies; stack traces/credentials are not sent to clients.
- CORS/trusted-origin configuration allows the configured frontend origin and rejects an untrusted origin where the app's security model requires it.
- Server starts on a dynamically selected port for test execution where supported, preventing host-port collisions.

### 7.4 Email and external dependencies

If a future auth flow includes email verification or password reset, introduce a local mail catcher such as Mailpit/MailHog in its own test phase; assert that messages are emitted to the local test server. Avoid actually sending email in normal CI.

Only add Redis, object storage, queues, or other containers if a supported template actually depends on them. Do not add a generic pile of service containers preemptively.

### 7.5 Browser-level testing

Use HTTP-level tests first for backend auth because they are fast and exercise the generated server/session behavior directly. Add Playwright when OmniCraft generates a real browser sign-in form, protected page, or client session workflow. Playwright's API request support can also test API endpoints and inspect state without loading a browser: <https://playwright.dev/docs/api-testing>.

---

## 8. CI design

### 8.1 Keep fast checks separate from container-backed checks

Retain the current multi-OS checks for Node version compatibility, unit tests, build, and scaffold generation. Use separate Linux-hosted jobs for Node database tests and PHP/Laravel integration tests. GitHub documents service containers as ephemeral services automatically created/destroyed for a job; see the [service-container overview](https://docs.github.com/en/actions/tutorials/use-containerized-services/use-docker-service-containers).

The Node database job should use Testcontainers with a working Docker daemon. The PHP/Laravel job should build/run the PHP + Composer test image and use a dedicated Compose profile so the PHP process and the selected database share an internal network. Do not put these untrusted PR workloads on the persistent self-hosted Windows runner.

### 8.2 Proposed CI jobs

1. **`unit-and-scaffold`** — existing OS/Node matrix, no Docker dependency.
2. **`generated-install-build`** — install/typecheck/lint/build representative generated project combinations and any changed templates.
3. **`db-integration-node`** — Ubuntu + Docker; run SQLite regression and PostgreSQL/MySQL integration tests for Node-generated applications. Testcontainers owns DB lifecycle in this job.
4. **`auth-integration-node`** — Better Auth + Express + Drizzle; preserve the SQLite regression, and add PostgreSQL/MySQL after each relevant combination is implemented.
5. **`php-laravel-integration`** — Ubuntu + Docker; run Composer and PHP commands inside the pinned PHP CLI test image, with PostgreSQL/MySQL selected through Compose. Run platform checks, migrations, Laravel tests, and real database-backed behavior.
6. **`laravel-assets`** — run only when a tested Laravel starter-kit choice requires Vite/Inertia/React/Vue/Svelte assets; use a pinned Node environment and the project's lockfile/build script.
7. **`package-artifact`** — test the packed CLI in a clean temporary project and smoke-test selected integrations.
8. **`nightly-full-support-matrix`** — run installation, build, migration, boot, CRUD, and auth checks for every combination listed as Supported, using the proper runtime (Node, Python, or PHP).
9. **`release-gate`** — all mandatory checks for advertised Supported combinations pass before tagging/publishing.

Do not run the expensive matrix on every OS. Use Linux for container-backed integration, while Windows/macOS remain valuable for path, process, packaging, and CLI compatibility. Use nightly/release workflows for broader matrix coverage.

### 8.3 Failure diagnostics and artifacts

On failure, CI should preserve only non-sensitive diagnostics:

- test logs and step name;
- redacted application stdout/stderr;
- selected stack identifier and database image tag;
- migration command and exit code;
- health-poll result and timeout;
- container logs after redacting configured secrets.

Never upload `.env`, full environment dumps, auth cookies, Playwright storage state, or raw DB connection strings as artifacts.

### 8.4 Self-hosted runner security

The current CI file documents a guard intended to keep fork pull requests away from the persistent self-hosted Windows runner. Preserve this boundary. The new database tests should use a GitHub-hosted runner unless the self-hosted runner is explicitly trusted and isolated for the workload. GitHub's security guidance warns that public-repository pull-request code can compromise self-hosted runners: <https://docs.github.com/en/actions/reference/security/secure-use>.

---

## 9. Stack matrix and promotion rules

Do not promote every row in the stack matrix at once. Work from existing template families and current status.

### Phase-one target matrix

| Target | Why first | Required evidence before status changes |
|---|---|---|
| Express + Drizzle + SQLite | Existing base CRUD and Better Auth SQLite baseline; no Docker needed | CI migration, boot, CRUD, conflict/validation, auth end-to-end regression |
| Express + Drizzle + PostgreSQL | Existing base path already has more verification than most DB combinations | Fresh PostgreSQL container, migration, boot, real CRUD; add auth flow before claiming auth is supported on PostgreSQL |
| Express + Drizzle + MySQL | Current matrix lists this as `Scaffold-verified` | Install/build, migration, boot, CRUD; then run Better Auth MySQL schema + full auth flow if that combination is advertised |
| Express + Prisma + PostgreSQL | Existing representative Prisma path | Verify generated client, migration/setup, boot and real CRUD/error path; add auth only if a dedicated adapter is implemented |
| Fastify + Drizzle + PostgreSQL/SQLite | Current matrix lists these as supported | Add/retain CI runtime/DB tests for the combos most likely to be touched by shared layers |
| Fastify + Drizzle + MySQL | Current matrix lists this as `Scaffold-verified` | Full MySQL migration + CRUD before promotion |
| Raw SQL variants | Several are scaffold-verified | Use the same DB E2E contract; promote one by one |
| FastAPI + SQLAlchemy + PostgreSQL | Current matrix lists it as scaffold-verified | Install Python dependencies, apply Alembic, boot Uvicorn, run CRUD against PostgreSQL container |
| Laravel + Eloquent + PostgreSQL | Current matrix lists this as scaffold-verified | Use PHP CLI + Composer container and PostgreSQL Compose service; verify platform requirements, migrate, run Laravel tests, and test real DB-backed behavior |
| Laravel + Eloquent + MySQL | Current matrix lists this as scaffold-verified | Use PHP CLI + Composer container and MySQL Compose service; verify platform requirements, migrate, run Laravel tests, and test real DB-backed behavior |
| Laravel starter kit using Inertia/Vite assets | Framework/frontend-mode dependent | Build frontend assets in a separate Node container or isolated Node step; don't assume Composer alone validates frontend integration |

The current support matrix is the source of truth for current claims. Re-read it before implementation because statuses may change after this plan is written. A row's exact status must be updated in the same PR that adds its passing evidence.

### Promotion definition

A combination can be marked **Supported** only when all relevant requirements have passed:

- scaffold generation;
- dependency installation;
- generated project typecheck/lint/build where applicable;
- migrations/schema initialization;
- application boot and health check;
- at least one actual database operation and the normal endpoint contract;
- auth E2E if auth is advertised for that combination;
- required platform-specific checks and documentation;
- a passing CI job or linked reproducible evidence.

A combination that only generates files remains `Scaffold-verified` (or the repository's equivalent status). Never infer support for MySQL because PostgreSQL passed: SQL dialects, schemas, drivers, and type mappings differ.

---

## 10. Implementation phases

### Phase 0 — Baseline and design lock

**Goal:** verify what exists and lock the runtime/container approach before writing test infrastructure.

Tasks:

- Read current `AGENTS.md`, master plan, `docs/development/testing-strategy.md`, support matrix, auth issue #23, and `.github/workflows/ci.yml`.
- Inspect current generated Compose files, database image tags, Laravel/PHP templates, and the source's actual PHP/backend support claims.
- Inspect Laravel template `composer.json`/`composer.lock`, PHP version constraints, Laravel version, required extensions, scripts, and starter-kit mode (Livewire vs Inertia/Vite).
- Determine which Laravel configurations require Node-based asset compilation and which are PHP/API-only.
- Confirm existing package scripts, test discovery patterns, Docker availability locally, and Docker availability on GitHub-hosted Ubuntu.
- Choose pinned database image tags and a PHP CLI image version compatible with the actual template constraints; do not use `latest`.
- Decide the required PHP extensions and Composer version strategy. Prefer the official PHP CLI image plus the Composer binary, not the Composer-only image as the app runtime.

**Deliverable:** a baseline matrix of combinations/status/evidence/missing tests, a PHP version/extensions table, and an explicit mapping of which suites use Testcontainers versus Compose. No application/template changes are required in this phase.

### Phase 1 — Reusable container and process harness

**Goal:** create safe test lifecycles for the Node database lane and the PHP/Laravel lane.

Tasks:

- Add Testcontainers PostgreSQL/MySQL development dependencies for Node-generated app tests and lock them in `package-lock.json`.
- Add common Node container startup/readiness/connection helpers and generated-project subprocess helpers with timeouts/output capture.
- Add a test-only PHP CLI Dockerfile based on a pinned official PHP image, containing the needed extensions and Composer binary.
- Add a Compose-backed PHP/Laravel profile that runs the PHP test container and one selected PostgreSQL/MySQL service on the same isolated Docker network.
- Add a separate pinned Node asset-build container/step only when Laravel Inertia/Vite variants need it.
- Add temporary `.env` generation and robust teardown for generated projects, child processes, Compose projects, containers, and temporary directories.
- Add smoke checks: Node harness queries PostgreSQL/MySQL; PHP image reports PHP/Composer versions, includes required extensions, passes `composer check-platform-reqs` for a fixture, and can connect to each DB.
- Keep container-backed suites separate from the normal `npm test` command.

**Acceptance criteria:** Node DB containers start/query/clean up; PHP/Composer image is compatible with a fixture's runtime constraints; PHP can access the selected DB over the Compose network; tests need no host PHP/Composer; failed tests still clean up; unit tests remain Docker-free.

### Phase 2 — General PostgreSQL/MySQL generated-project E2E

**Goal:** test a generated project against real database servers before testing auth.

Tasks:

- Implement the reusable flow: scaffold → install → configure test DB → migrate → boot → health-check → CRUD → shutdown.
- Start with Express + Drizzle + PostgreSQL and Express + Drizzle + MySQL.
- Keep SQLite E2E in a separate no-Docker path.
- Assert migration scripts actually apply schema to an empty database.
- Add constraint, invalid-payload, not-found, and database connection error tests where part of the contract.
- Store sanitized logs for diagnosing failed CI jobs.

**Acceptance criteria:** MySQL's current scaffold-verified row is not promoted until the full MySQL flow passes; PostgreSQL E2E runs in CI and no longer relies exclusively on manual evidence.

### Phase 3 — Better Auth database matrix

**Goal:** make the authentication integration reliable across supported dialects.

Tasks:

- Preserve and automate the existing Express + Drizzle + SQLite auth test.
- Add a PostgreSQL auth test using the generated project's real auth schema/migration command.
- Add MySQL base CRUD verification before MySQL auth; then add the Better Auth MySQL path.
- Run registration, login, session, protected route, wrong password, duplicate email, logout/session invalidation, and security checks.
- Test no secret is written into tracked files or logged.
- Ensure cookie, trusted-origin, CORS, and middleware/handler-order behavior matches the server framework.

**Acceptance criteria:** a fresh database can be migrated; full documented auth flows pass on every dialect marked Supported; tests demonstrate sessions persist in the DB as intended; the support matrix accurately identifies the verified dialects.

### Phase 4 — Creation-time auth and `omnicraft add auth` parity

**Goal:** allow both user journeys without duplicating auth implementation.

Tasks (when the creation-time prompt is implemented):

- Add `Include authentication? Yes/No` to the creation wizard after stack/database selection.
- Display only auth providers compatible with the selected stack and actually implemented.
- Reuse the same auth integration adapter/definition as `omnicraft add auth`.
- Test both paths on the same supported stack/dialect with the same core auth assertions.
- Test No means auth files, dependencies, schema requirements, and env variables are not added unintentionally.
- Test add-auth idempotency, file collision rejection, and unsupported combinations.

**Acceptance criteria:** the two entry paths produce functionally equivalent supported auth setup; adding auth twice doesn't duplicate routes/dependencies; failures do not leave a partially modified project.

### Phase 5 — Expand database runtime verification to the rest of the matrix

**Goal:** close the gap between `Scaffold-verified` and `Supported` with the correct runtime for each ecosystem.

Order:

1. Fastify + Drizzle + MySQL through the Node/Testcontainers lane.
2. Raw SQL PostgreSQL/SQLite variants.
3. Fastify/Hono raw SQL variants as resources permit.
4. FastAPI + SQLAlchemy + PostgreSQL using a pinned Python container or documented Python CI toolchain.
5. Laravel + Eloquent + PostgreSQL and MySQL using the PHP CLI + Composer test image and Compose DB network.
6. Laravel starter modes: run PHP/framework tests for Livewire and Inertia variants; build assets in a separate Node container/step for the modes that require it.
7. Prisma and other ORM paths according to the support matrix.

For Laravel, match the test PHP version to the template's `composer.json` platform constraints, include all required extensions, install from `composer.lock`, run platform checks, migrations, framework tests, and at least one actual DB-backed operation. Do not treat `composer install` or a test that only uses SQLite as evidence for the PostgreSQL/MySQL variant. Avoid adding new frameworks in this phase until existing advertised rows have clear verification status.

**Acceptance criteria:** each row is fully tested and marked Supported or remains honestly marked Scaffold-verified/Planned with a tracked reason. PHP/Laravel verification does not require PHP or Composer on the host.

### Phase 6 — CI/release/documentation enforcement

**Goal:** make the evidence durable and prevent documentation drift.

Tasks:

- Add a Linux Node database integration job to `.github/workflows/ci.yml`.
- Add a separate PHP/Laravel integration job that builds/runs the PHP + Composer test image and uses the matching Compose PostgreSQL/MySQL service.
- Add a Node asset-build check only for Laravel starter modes that require Vite/Inertia assets.
- Run targeted DB/runtime checks on pull requests; run the full Supported stack matrix nightly and before publishing.
- Keep regular unit/scaffold tests fast and preserve cross-platform CLI coverage.
- Include exact evidence and runtime/toolchain requirements in the support matrix.
- Update `docs/development/testing-strategy.md` with Docker prerequisites, PHP/Composer requirements, commands, timeouts, cleanup, and troubleshooting.
- Update `docs/templates/adding-an-integration.md` to require a real DB test for database/ORM integrations.
- Update the master plan and release checklist so DB-backed Supported configurations require integration evidence.
- Ensure CI fails if a combination is marked Supported but its required test target is missing or no longer passes.

**Acceptance criteria:** a release cannot ship with a Supported database/PHP configuration whose mandatory integration test fails or is disabled; docs distinguish scaffold, install, platform, build, runtime, DB, and auth verification.

### Phase 7 — Future auth/UI/external services

Only when those features are implemented:

- Add Playwright browser tests for generated sign-in forms/protected pages.
- Add a local mail catcher for email verification/password reset flows.
- Add service containers for Redis, object storage, queues, or other dependencies only when a supported generated template requires them.
- Add constrained sandbox tests for Clerk/Supabase hosted features only when necessary; do not require real provider credentials in routine PR CI.

---

## 11. Proposed test commands and developer workflow

After scripts are implemented, the target local workflow should be documented with actual tested commands. Example command names below are proposals:

```bash
# Fast, no Docker required
npm test
npm run build
npx tsx packages/cli/scripts/smoke-e2e.ts .tmp/smoke

# Node-generated app tests against real databases; requires Docker Engine/Desktop
npm run test:integration:db

# PHP/Laravel generated-project tests; requires Docker Engine/Desktop, but not host PHP/Composer
npm run test:integration:php

# Optional focused test targets (exact arguments depend on the harness implementation)
npm run test:integration:db -- --project postgres
npm run test:integration:db -- --project mysql
npm run test:integration:db -- --project auth
npm run test:integration:php -- --database postgres
npm run test:integration:php -- --database mysql
```

Before running the DB suite locally, contributors should confirm that Docker is working:

```bash
docker info
docker version
```

If Docker is unavailable, the fast unit/scaffold suite should still run. The DB suite should stop immediately with a clear prerequisite message; it should not silently skip and report success.

For debugging a failed generated project, the test report should print the generated temporary path only when useful and safe, describe how to preserve the generated directory for inspection, and clean up containers automatically. A deliberate `--keep-output`/debug mode can be added later, but must never preserve secrets by default.

---

## 12. CI resource, runtime, and reliability expectations

- Use Ubuntu for Docker-backed DB tests; keep the existing cross-platform tests for filesystem and CLI concerns.
- Use the Testcontainers lifecycle for Node-generated app tests, and the dedicated Compose + PHP/Composer runner for PHP/Laravel tests. Do not start a second copy of the same database through another tool in one suite.
- Start one DB type per matrix job by default. Run PostgreSQL and MySQL in parallel only if job resource limits and test timing remain acceptable.
- Run PostgreSQL and MySQL tests against pinned image tags; do not use `latest`.
- Use bounded container startup and health checks; retry only transient readiness failures, not application assertion failures.
- Cache npm/Python/Composer dependency downloads where safe, but do not cache database data volumes or generated `vendor/` folders across incompatible PHP versions/extensions. If caching Composer's download cache, key it on the PHP version, composer.lock hash, and relevant platform configuration.
- Avoid pulling and starting every possible database image on every OS. Use a focused PR matrix plus a complete nightly/release matrix.
- Keep the existing self-hosted Windows runner away from untrusted public fork PRs. Database jobs should run on GitHub-hosted Ubuntu unless the trust boundary is deliberately changed and reviewed.
- Publish test artifacts only after redaction. Never upload `.env`, auth state, cookies, raw connection strings, or environment dumps.

---

## 13. Security requirements for the test suite

1. Test-only database credentials must be synthetic and local to the disposable test environment.
2. Test auth secrets must be generated for the run and passed as process environment values; they must not be hardcoded into templates or committed files.
3. Integration tests must only target test-owned databases. Include a defensive validation guard against production-like connection targets.
4. Do not print raw environment variables. Redact `DATABASE_URL`, `BETTER_AUTH_SECRET`, cookies, authorization headers, and provider secrets in logs.
5. Ensure temporary `.env` files are removed. The generated `.gitignore` should ignore `.env` but retain `.env.example`.
6. Use test accounts and synthetic data only.
7. Never execute fork-controlled pull-request workflows with database secrets or on a persistent self-hosted runner.
8. Do not use real Clerk, Google, GitHub OAuth, email, or paid provider credentials in the ordinary test job.
9. Delete containers and temporary directories even on timeout or assertion failure.
10. Verify the test process cannot accidentally connect to a user's existing database due to inherited environment variables.

---

## 14. Acceptance criteria / definition of done

This plan is complete when:

- [ ] A dedicated Node DB integration test command exists and is separate from fast unit tests.
- [ ] The Node test harness starts, waits for, connects to, and tears down disposable PostgreSQL and MySQL containers.
- [ ] A PHP CLI test image is built from a pinned official PHP image and contains Composer plus all PHP extensions required by the Laravel templates being tested.
- [ ] Composer installs dependencies inside the matching PHP version/extension environment; the generic Composer-only image is not treated as the app runtime.
- [ ] PHP/Laravel integration tests can run without host PHP or Composer installed.
- [ ] The PHP test runner and the selected PostgreSQL/MySQL database share an isolated Compose network; credentials and data are ephemeral.
- [ ] Laravel variants using Vite/Inertia assets build those assets in a pinned Node environment, separate from the PHP runtime.
- [ ] At least one real generated app works against PostgreSQL in CI.
- [ ] At least one real generated app works against MySQL in CI.
- [ ] SQLite integration tests remain repeatable and Docker-free.
- [ ] Database tests execute the generated migrations/initialization path and at least one real operation; they do not only compile.
- [ ] Better Auth's existing SQLite E2E tests run as an automated regression test.
- [ ] Better Auth + PostgreSQL and + MySQL are only marked supported after their full real-DB auth flows pass.
- [ ] Authentication checks cover registration, login, wrong credentials, session retrieval, protected-route denial/allowance, logout/session invalidation, duplicate accounts, and secret handling.
- [ ] Create-time auth (if implemented) and `omnicraft add auth` use the same integration definition and have separate workflow tests.
- [ ] CI runs targeted Node DB and PHP/Laravel Docker-backed integration jobs on GitHub-hosted Linux runners and runs a fuller supported matrix before release.
- [ ] Failure logs are useful but redact credentials and cookies.
- [ ] `docs/development/testing-strategy.md` and `docs/templates/stack-support-matrix.md` are updated with exact evidence.
- [ ] No stack is promoted from Scaffold-verified based solely on generation/typechecking.
- [ ] The normal unit test suite remains runnable without Docker.

---

## 15. Suggested issues / pull requests

Create separate issues or PRs so work remains reviewable:

1. **DB testing Phase 0: reconcile testing baseline** — audit template image versions, test scripts, current support statuses, auth schemas, PHP version constraints, required extensions, and generated frontend modes.
2. **Testcontainers harness for Node PostgreSQL/MySQL tests** — test-only dependencies, readiness, cleanup, and diagnostics.
3. **PHP + Composer test image and Compose profiles** — pinned PHP CLI runtime, platform extensions, Composer binary, internal DB networking, cleanup, and basic platform smoke checks.
4. **E2E PostgreSQL generated-project test** — scaffold, migrate, boot, CRUD, and failure-path checks in CI.
5. **E2E MySQL generated-project test** — close current MySQL scaffold-only gaps one by one.
6. **Laravel + PostgreSQL/MySQL integration lane** — Composer install from lockfile, platform checks, migrations, Laravel tests/CRUD, and optional Node asset builds for Inertia/Vite variants.
7. **Better Auth + PostgreSQL and MySQL E2E** — extend the SQLite regression suite after each base adapter is verified.
8. **Creation-time auth prompt + parity tests** — only when ready to implement the wizard option; reuse the `add auth` integration contract.
9. **Full support-matrix CI/release gate** — make promotion and release criteria enforceable.

Recommended first PR: **Phase 0 baseline plus container-toolchain decision**, followed by the Testcontainers smoke test and PHP/Composer image smoke test. Do not start by expanding Clerk/Supabase or adding more backend frameworks. First prove each runtime test lane, then use them to verify existing generated stacks.

---

## 16. Official research references

The plan is based on the following current official documentation. Re-check versions and URLs when implementation starts.

- Testcontainers for Node.js — PostgreSQL module: <https://node.testcontainers.org/modules/postgresql/>
- Testcontainers for Node.js — MySQL module: <https://node.testcontainers.org/modules/mysql/>
- Testcontainers for Node.js — general docs: <https://node.testcontainers.org/>
- GitHub Actions — service containers: <https://docs.github.com/en/actions/tutorials/use-containerized-services/use-docker-service-containers>
- GitHub Actions — PostgreSQL service container: <https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers>
- GitHub Actions — security of self-hosted runners: <https://docs.github.com/en/actions/reference/security/secure-use>
- Docker official PHP image: <https://hub.docker.com/_/php>
- Docker PHP guide, including development/test containers: <https://docs.docker.com/guides/php/>
- Composer official Docker usage: <https://getcomposer.org/doc/00-intro.md#docker-image>
- Composer Docker/BuildKit guidance on matching PHP/extensions to the application runtime: <https://getcomposer.org/doc/articles/caching.md#docker-and-buildkit>
- Composer platform dependencies and extension validation: <https://getcomposer.org/doc/articles/composer-platform-dependencies.md>
- Laravel 13.x server requirements: <https://laravel.com/docs/13.x/deployment#server-requirements>
- Laravel 13.x installation and PHP/Composer prerequisites: <https://laravel.com/docs/13.x/installation>
- Laravel Sail (Laravel's own Docker development environment): <https://laravel.com/docs/13.x/sail>
- Better Auth — Drizzle adapter and SQLite/PostgreSQL/MySQL providers: <https://better-auth.com/docs/adapters/drizzle>
- Better Auth — database schema and migrations: <https://better-auth.com/docs/concepts/database>
- Better Auth — session management: <https://better-auth.com/docs/concepts/session-management>
- Drizzle — migration management: <https://orm.drizzle.team/docs/kit-overview>
- Drizzle — PostgreSQL: <https://orm.drizzle.team/docs/get-started-postgresql>
- Drizzle — MySQL: <https://orm.drizzle.team/docs/mysql/get-started-mysql>
- Vitest — setup and teardown hooks: <https://vitest.dev/guide/learn/setup-teardown>
- Playwright — API tests: <https://playwright.dev/docs/api-testing>
- Playwright — authentication and sensitive storage state: <https://playwright.dev/docs/auth>
- PostgreSQL versioning policy: <https://www.postgresql.org/support/versioning/>
- MySQL 8.4 LTS release model: <https://dev.mysql.com/doc/refman/8.4/en/mysql-releases.html>
- MySQL official Docker image tags: <https://hub.docker.com/_/mysql>
- PostgreSQL official Docker image tags: <https://hub.docker.com/_/postgres>

---

## Final recommendation

Implement real-database testing incrementally, starting with the existing Express + Drizzle + PostgreSQL path and the existing Better Auth + SQLite path, then extend to MySQL and broader stack combinations. Use Testcontainers to manage databases for Node-generated application tests. For PHP/Laravel, add a dedicated Dockerized PHP CLI test image with Composer, required PHP extensions (including the appropriate PDO database driver), paired with a Compose database service on the same internal network; use a separate Node container only when the selected Laravel starter kit needs frontend asset compilation. Keep host PHP/Composer optional, keep fast tests Docker-free, and make release support claims depend on measured evidence.

This gives OmniCraft a repeatable way to answer the most important question for a project generator: **does the generated application actually work when installed, connected to a real database, migrated, started, and exercised—not merely when its files have been written?**
