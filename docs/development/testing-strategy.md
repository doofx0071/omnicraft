# Testing strategy

How OmniCraft verifies itself. Commands run from `packages/cli/` unless noted.

The merged 2026-10-27 baseline passed 82 unit tests in 10 files, typecheck, build, and scaffold smoke.
Its database jobs exercised Express + Drizzle with SQLite, PostgreSQL, and MySQL, and Laravel with
PostgreSQL and MySQL. The current release matrix also runs FastAPI + SQLite/PostgreSQL and Laravel +
SQLite/PostgreSQL/MySQL. Each result applies only to the exact generated combinations exercised;
source checks and smoke scaffolding do not prove that every generated project installs or runs.

The 2026-10-28 runtime-evidence branch passed `npx vitest run` (**131 tests in 14 files**), `npx tsc --noEmit`,
`npx tsup`, and `npm run check:support-matrix` (15 Supported rows). The smoke command generated all
17 listed paths.
Generated-project integration commands also passed locally:

```text
npm run test:integration:db       # Express + Drizzle: SQLite, PostgreSQL, MySQL
npm run test:integration:node      # Express, Fastify, and Hono ORM/raw-SQL scenarios
npm run test:integration:python   # FastAPI + SQLite, Python 3.12
npm run test:integration:php      # Laravel 12: SQLite, PostgreSQL, MySQL, pinned PHP/Composer image
```

The hosted [closeout PR run #40562224821](https://github.com/doofx0071/omnicraft/actions/runs/40562224821)
passed on commit `2a1e581312af0e1a84f604c9c86541ea8bdf9eed`, including the full OS/Node matrix, package
smoke, ten-row evidence checker, database integrations, FastAPI + SQLite, Laravel + SQLite/PostgreSQL/
MySQL, and the aggregate supported-stack release gate. The FastAPI + SQLite and Laravel + SQLite rows
are Supported based on their generated-project install, migration, boot, and database-operation checks
in that run.

The follow-up [runtime-evidence run #40609596120](https://github.com/doofx0071/omnicraft/actions/runs/40609596120)
passed the release gate on commit `b4c26273eaab033fee604bd77c04e0a2ab1d7e19`. It ran Express + Prisma/PostgreSQL,
Express + raw SQL on SQLite/PostgreSQL/MySQL, and FastAPI + PostgreSQL through generated install/setup,
boot, real database operations, and failure checks. The exact jobs are linked from their matrix rows.

## Test levels

### Level 1 — CLI unit and engine tests (`npx vitest run`)

The current suite covers:

| File | Coverage |
| --- | --- |
| `src/args.test.ts` | Flag parsing and help text. |
| `src/validators.test.ts` | Project-name normalization and npm-name validation. |
| `src/renderer.test.ts` | Token substitution, unresolved-token detection, dotfile renaming, and binary detection. |
| `src/merge.test.ts` | `package.json` deep merge semantics. |
| `src/prefill.test.ts` | Available flag values, runtime-scoped databases/frameworks, Prisma/PostgreSQL validation, and `--yes` answer resolution. |
| `src/update-check.test.ts` | Version comparison, mocked registry fetch, offline behavior, and cache. |
| `src/prompts/run-prompts.test.ts` | Scripted prompt flow, frontend-only branch, unavailable-option retry, cancellation, and invalid names. |
| `src/next-steps.test.ts` | Integrated Next.js commands/endpoints and container startup for PostgreSQL. |
| `src/exec.test.ts` | Fixed-command output, timeout handling, and stopping a child process. |
| `src/engine.test.ts` | Selected generated files, layer overrides, manifests, env files, token scans, protected-path examples, and selected engine combinations. |
| `src/capabilities.test.ts` | Available prompt/flag choices derive from the typed capability registry, and the module menu matches its registered module IDs. |
| `src/add-run.test.ts` | Module dry-run, success, idempotency, collisions, unsupported stacks, missing patch anchors, and rollback after a failed write. |
| `src/support-evidence.test.ts` | Every Supported matrix row maps to an existing CI script, scenario, job, and aggregate release check. |
| `src/modules/auth.test.ts` | Better Auth compatibility and secret setup guidance. |

The engine fixtures cover Express + Drizzle with PostgreSQL/SQLite/MySQL, Express + Prisma + PostgreSQL,
Fastify + Drizzle with PostgreSQL/SQLite/MySQL, Fastify + Prisma + PostgreSQL, FastAPI with
PostgreSQL/SQLite, the Laravel SQLite overlay, React frontend-only, Vue/Svelte client overlays, selected
Next.js adapters, and shadcn's React/Vite overlay. This is a selected set, not the full runtime ×
framework × ORM × database product.

Native Expo/Tauri build tests remain unavailable because their platform SDK/toolchains are not installed
in the hosted CLI matrix. `omnicraft add testing` is scaffold-verified; the unit suite checks its
generated files and manifest changes, while the generated sample test is not installed and run in CI.

### Level 2 — Scaffold smoke (`scripts/smoke-e2e.ts`)

Run with:

```bash
npx tsx scripts/smoke-e2e.ts <out-dir>
```

The script currently produces 17 project paths when `create-next-app` succeeds: 13 backend/database
entries, React frontend-only, Vue and Svelte paired with Express + Drizzle + SQLite, and Next.js
integrated full-stack + SQLite. It does not include Expo or Tauri. The Next.js script step runs the
external `create-next-app` command and logs/skips the overlay if that command fails, so an overall
successful script exit does not guarantee Next.js was generated.

This level copies and renders template files; it does not install or boot each generated application.
The smoke command succeeded for all 17 paths on the Windows checkout during this reconciliation.

### Level 3 — Generated-project verification

For a specific combination, install dependencies, run the stack's typecheck/build or equivalent setup,
boot the generated application, and exercise a successful database operation plus a relevant failure
case. Examples include:

- Node: install, typecheck client and server, start server, check `/api/health`, and perform a CRUD cycle.
- Python: `uv sync`, apply Alembic migrations, boot Uvicorn, and exercise API/database behavior.
- Laravel: install through Composer, migrate/seed, boot Artisan, and exercise API/database behavior.
- Native apps: record platform-specific prerequisites and test the native build/launch separately from
  frontend-only checks.

Record evidence for the exact combination in the [support matrix](../templates/stack-support-matrix.md).
Do not infer one database/framework/frontend combination from a successful test of another.

### Level 4 — CI (`.github/workflows/ci.yml`)

The current workflow:

1. Runs CLI typecheck, unit tests, build, and scaffold smoke on Ubuntu, macOS, and Windows with Node 20
   and 24.
2. On Node 24, installs and typechecks the generated Express + Drizzle + PostgreSQL project on the
   hosted OS jobs; the trusted Windows self-hosted job does the same and also lints that generated
   project.
3. Builds the CLI tarball, installs it into a clean workspace, runs the packaged binary, and checks
   expected files in the default scaffold. The generated project's dependencies are not installed in
   this package job.
4. Runs hosted Ubuntu `database-integration` cases for Express + Drizzle + SQLite/PostgreSQL/MySQL.
   Each generated project is installed and typechecked; migrations, API boot, CRUD, and Better Auth
   flows are exercised.
5. Runs hosted Ubuntu `node-runtime-integration` for the 15 registered Express, Fastify, and Hono
   Prisma, Drizzle, and raw-SQL paths. Each generated project is installed, client-built,
   API-typechecked, initialized or migrated, booted, and checked for CRUD, duplicate, invalid-input,
   and missing-record behavior. The Fastify/Hono cases are pending their first hosted run.
6. Runs hosted Ubuntu `python-fastapi-integration` with `setup-uv` 0.13.5 and Python 3.12. It installs
   generated dependencies, runs Alembic migrations, boots Uvicorn, and checks SQLite and PostgreSQL
   CRUD and failure responses. PostgreSQL runs in an isolated Testcontainers instance.
7. Runs hosted Ubuntu `php-laravel-integration` for SQLite/PostgreSQL/MySQL. The SQLite case uses the
   pinned PHP/Composer test image without a database service; networked databases use isolated Compose
   services. Each case installs Composer dependencies, checks platform requirements, migrates, and
   runs database/API feature tests.
8. Runs `support-evidence` to check matrix row ids, registered test scenarios, job commands, and the
   release aggregate. `supported-matrix` fails unless the OS/Node matrix, runtime jobs, support evidence,
   and package artifact all pass. It runs for PRs, main pushes, nightly, and version-tag pushes;
   `workflow_dispatch` supports an explicit pre-release run. The scheduled run uses GitHub-hosted jobs.
9. Version-tag pushes run the complete hosted release gate on the tagged commit. Only after it passes,
   the release job publishes to npm using OIDC, creates the GitHub Release from the version's changelog
   section, and updates the release snapshots in `ROADMAP.md` and `docs/architecture/system-overview.md`.
   The self-hosted Windows job runs only for main-branch pushes and same-repository pull requests.

These hosted runtime jobs add real database and API checks for those exact combinations; they do not
verify other framework/database combinations. The matrix marks a stack Supported only when its row
links to a concrete scenario in `src/support-evidence.ts` and the corresponding CI target passes. The
self-hosted Windows runner is restricted to main-branch pushes and same-repository pull requests; fork
pull requests, release tags, and scheduled runs use hosted runners only.

## Support statuses

- **Supported** requires Level 3 evidence for the exact combination and a passing hosted CI result
  recorded on a tested commit; a smoke scaffold, local result, or typecheck alone is insufficient.
- **Scaffold-verified** means the exact combination has an engine fixture or smoke entry but lacks full
  Level 3 evidence.
- **Selectable — unverified** means the registry and layers expose the choice but no exact fixture/smoke
  or passing hosted runtime result covers it.
- **Rejected — unsupported combination** means preflight rejects the combination, or the prompt omits
  it, because no compatible adapter or module path exists.

Some existing matrix rows cite manual verification performed before this documentation pass. The matrix
labels those as repository-recorded history; they were not rerun as part of the 2026-10-27 source test
baseline above.

## What each change must test

| Change | Required |
| --- | --- |
| Source module change | Add focused unit tests and run the full suite. |
| Prompt/flag/capability change | Update prompt/flag tests; derive selectable values from `src/capabilities.ts`, exercise `--yes` and invalid combinations, and run the support-evidence check. |
| Template change | Run engine tests and smoke; install/build/boot every exact combination whose behavior changed before promoting it. |
| New combination | Add an exact engine or smoke entry and Level 3 evidence before calling it Supported. |
| Engine/renderer/merge change | Full suite, all smoke entries, token/collision checks, and Level 3 checks for affected runtime families. |
| Documentation only | Check local links and confirm claims match the matrix and source. |

Tests use temporary directories and mocked prompt/network paths where possible. Prompt tests script the
Clack answer queue rather than emulating a real TTY.
