# Testing strategy

How OmniCraft verifies itself. Commands run from `packages/cli/` unless noted.

The merged 2026-10-27 baseline passed 82 unit tests in 10 files, typecheck, build, and scaffold smoke.
Its database jobs exercised Express + Drizzle with SQLite, PostgreSQL, and MySQL, and Laravel with
PostgreSQL and MySQL. The current release matrix also runs FastAPI + SQLite/PostgreSQL and Laravel +
SQLite/PostgreSQL/MySQL. Each result applies only to the exact generated combinations exercised;
source checks and smoke scaffolding do not prove that every generated project installs or runs.

The 2026-10-28 runtime-evidence branch passed `npx vitest run` (**142 tests in 14 files**),
`npx tsc --noEmit`, `npx tsup`, and `npm run check:support-matrix` (34 Supported rows). The smoke
command generated all 17 listed paths.

The v1.0.3 release candidate passes locally with 209 unit tests in 17 files, typecheck, build, the
support-evidence checker (43 Supported rows), and all 17 smoke paths. These local checks supplement,
but do not replace, the required exact-head hosted release gate.

Generated-project integration commands also passed locally:

```text
npm run test:integration:db       # Express + Drizzle: SQLite, PostgreSQL, MySQL
npm run test:integration:node      # Express, Fastify, and Hono ORM/raw-SQL scenarios
npm run test:integration:nextjs    # Next.js integrated full-stack: SQLite, PostgreSQL, MySQL
npm run test:integration:python   # FastAPI + SQLite, Python 3.12
npm run test:integration:php      # Laravel 12: SQLite, PostgreSQL, MySQL, pinned PHP/Composer image
npm run test:integration:php-livewire # production CLI: Laravel 13 + Livewire, None/Fortify, SQLite
npm run test:integration:php-inertia  # production CLI: Laravel 13 + Inertia React, None/Fortify, SQLite
```

The local Livewire integration check also sets caller `DB_CONNECTION` and `DB_DATABASE` values to a
separate empty SQLite file for each mode, then verifies that file remains untouched while the
generated app's SQLite database is initialized.

The `php-laravel-livewire-auth-integration` job uses the production CLI to generate the official blank
and authenticated Livewire starters, checks that incompatible Livewire/PostgreSQL flags fail before
creating files, proves caller `DB_*` settings cannot redirect the initial migration away from the
generated SQLite file, runs the generated SQLite migrations and feature tests, and installs/builds the
starter's assets. It is a required dependency of `supported-stack-release-gate`. Hosted
[run #41094120972 on commit `1c9283c`](https://github.com/doofx0071/omnicraft/actions/runs/41094120972/job/124195318304)
passed for both exact SQLite modes; the support matrix records them separately. The existing Laravel
12 API evidence does not cover either integrated mode.

The `php-laravel-inertia-react-auth-integration` job uses the production CLI to generate the official
blank React and Fortify-enabled React kits pinned to reviewed upstream commits. It exercises `None` and
Laravel-native auth on SQLite, checks migrations and Inertia TypeScript/build commands, tests
public/no-auth and registration/login/dashboard/logout behavior, and verifies `/api/users` middleware
if that sample route exists. PostgreSQL, MySQL, Better Auth, JavaScript, extras, ORM flags, and Node
runtime flags must reject before creating a target directory. This job is a required dependency of
`supported-stack-release-gate`.

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

The `add testing` runtime fixes passed hosted [run #40880427361](https://github.com/doofx0071/omnicraft/actions/runs/40880427361)
on commit `fd4d3888037e330ac160a997e91f2a5b6b4e70c9`, including the support-evidence check and strict
release gate. Six exact React/Vite paths generated production layers, applied `add testing`, installed,
and ran the generated sample test; they also built the client, booted Vite preview, and checked its
bundle and missing-asset response. TypeScript client paths ran typecheck. The same run confirmed that
Vue, Svelte, and Next.js module requests reject before module files, dependencies, scripts, or manifests
change. This is module-path evidence only; backend and database claims remain tied to their own rows.

The later exhaustive [runtime-evidence run #40918121708](https://github.com/doofx0071/omnicraft/actions/runs/40918121708)
checked the remaining 306 compatible React/Vite tuples: 254 passed for the testing module and 52
JavaScript + shadcn tuples reject before writes because their template paths lack shadcn's required
aliases. The additional module evidence does not establish backend or database support.

The Fastify/Hono runtime slice passed all 15 Node runtime scenarios and the release gate on
[run #40612114736](https://github.com/doofx0071/omnicraft/actions/runs/40612114736), commit
`14adbf9d9805e74f44f66d8101077d0d68878f0d`. The exact Fastify/Hono rows now link to those generated
install/setup, boot, database-operation, and failure checks.

## Test levels

### Level 1 — CLI unit and engine tests (`npx vitest run`)

The current suite covers:

| File | Coverage |
| --- | --- |
| `src/args.test.ts` | Flag parsing, Livewire/Inertia React auth help text, and help/README option parity. |
| `src/validators.test.ts` | Project-name normalization and npm-name validation. |
| `src/renderer.test.ts` | Token substitution, unresolved-token detection, dotfile renaming, and binary detection. |
| `src/merge.test.ts` | `package.json` deep merge semantics. |
| `src/prefill.test.ts` | Available flag values, runtime-scoped databases/frameworks, Prisma/PostgreSQL validation, authentication flag preflight, and `--yes` answer resolution. |
| `src/update-check.test.ts` | Version comparison, mocked registry fetch, offline behavior, and cache. |
| `src/prompts/run-prompts.test.ts` | Scripted prompt flow, frontend-only branch, unavailable-option retry, cancellation, and invalid names. |
| `src/next-steps.test.ts` | Integrated Next.js commands/endpoints, container startup for PostgreSQL, and Laravel Livewire/Inertia React commands. |
| `src/exec.test.ts` | Fixed-command output, timeout handling, and stopping a child process. |
| `src/scaffold/laravel-env.test.ts` | Keeps inherited `DB_*` settings from redirecting Laravel's initial SQLite migration. |
| `src/engine.test.ts` | Selected generated files, layer overrides, manifests, env files, token scans, protected-path examples, selected engine combinations, creation-time auth compatibility, the no-auth `None` scaffold, and both Livewire and Inertia React starter overlays. |
| `src/compatibility.test.ts`, `src/manifest.test.ts` | Exact creation-time auth choices and constraints, plus manifest separation between active authentication and `modules`. |
| `src/capabilities.test.ts` | Available prompt/flag choices derive from the typed capability registry; the auth catalog records setup categories and requirements; the module menu matches its registered module IDs. |
| `src/add-run.test.ts` | Module dry-run, success, idempotency, creation-time auth application, collisions, unsupported stacks, missing patch anchors, and rollback after a failed write. |
| `src/support-evidence.test.ts` | Every Supported row resolves through selectable values, prompt/flag/composition, module and creation-time auth guards, renders from its exact combination, and maps to the matching scenario, script, job, and aggregate release check. |
| `src/modules/auth.test.ts` | Better Auth compatibility and secret setup guidance. |

The engine fixtures cover Express + Drizzle with PostgreSQL/SQLite/MySQL, Express + Prisma + PostgreSQL,
Fastify + Drizzle with PostgreSQL/SQLite/MySQL, Fastify + Prisma + PostgreSQL, FastAPI with
PostgreSQL/SQLite, the Laravel SQLite overlay, React frontend-only, Vue/Svelte client overlays, selected
Next.js adapters, and shadcn's React/Vite overlay. This is a selected set, not the full runtime ×
framework × ORM × database product.

Hosted native checks generate Expo and Tauri projects through their production commands and apply the
production layers. Expo runs iOS and Android prebuild/native Debug builds, installs and launches the apps
on an iPhone simulator and Android emulator, and checks that the Android app process stays alive; it does
not run a browser web build. Tauri builds the Vite frontend and native executable, then launches a visible
window on Linux/Xvfb, macOS, and Windows. These checks verify builds and launch behavior, not full app
functionality or database operations. Simulators and emulators are not physical devices; physical Android
and iOS device paths remain Selectable — unverified. The support matrix records exact hosted jobs while
keeping the broader Expo and Tauri rows Scaffold-verified. `omnicraft add testing` is Supported for the
six original and 254 additional exact React/Vite module paths listed in the
[support matrix](../templates/stack-support-matrix.md). Runs [#40880427361](https://github.com/doofx0071/omnicraft/actions/runs/40880427361)
and [#40918121708](https://github.com/doofx0071/omnicraft/actions/runs/40918121708) passed generated
installation, sample-test execution, client build, Vite preview, bundle, and missing-asset checks. The
52 JavaScript + shadcn tuples reject before writes because their template paths lack required aliases;
Vue, Svelte, and Next.js `add testing` paths also reject before module writes. The module tests exercise
frontend behavior only and do not establish backend/database support.

### Level 2 — Scaffold smoke (`scripts/smoke-e2e.ts`)

Run with:

```bash
npx tsx scripts/smoke-e2e.ts <out-dir>
```

The script currently produces 19 project paths when `create-next-app` succeeds: 13 backend/database
entries, two Inertia React auth-mode root overlays, React frontend-only, Vue and Svelte paired with
Express + Drizzle + SQLite, and Next.js integrated full-stack + SQLite. It does not include Expo or
Tauri. The Next.js script step runs the
external `create-next-app` command and logs/skips the overlay if that command fails, so an overall
successful script exit does not guarantee Next.js was generated.

This level copies and renders template files; it does not install or boot each generated application.
The smoke command succeeded for all 19 paths on the Windows checkout. The dedicated Inertia React
integration separately generates both complete projects through the production CLI.

### Level 3 — Generated-project verification

For a specific combination, install dependencies, run the stack's typecheck/build or equivalent setup,
boot the generated application, and exercise a successful database operation plus a relevant failure
case. Examples include:

- Node: install, typecheck client and server, start server, check `/api/health`, and perform a CRUD cycle.
- Python: `uv sync`, apply Alembic migrations, boot Uvicorn, and exercise API/database behavior.
- Laravel: install through Composer, migrate/seed, boot Artisan, and exercise API/database behavior.
- Frontend-only React/Vite: database operations do not apply; install and build the generated app, boot
  its preview server, load the emitted JavaScript bundle, and verify that a missing asset fails.
- Native apps: record the scaffold, web build (when applicable), native build, and launch as separate
  results for the named target. A simulator or desktop launch applies only to that platform, and database
  operations are not required for native scaffolds that do not include a database.

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
   For each database, generated projects exercise both creation-time Better Auth and a fresh
   auth-module application through the `add auth` handler. Each project is installed and typechecked,
   then builds, migrates, boots, and exercises CRUD and authentication. Both paths also verify their
   manifest state and repeated `add auth` idempotency. The generated API also checks Better Auth's default
   session-cookie attributes in development HTTP and production HTTPS-base-URL modes, then removes the
   disposable SQLite/PostgreSQL session table or stops the disposable MySQL database container and
   verifies that a failed session lookup returns a generic 500 response without database details or
   secrets.
5. Runs hosted Ubuntu `node-runtime-integration` for the 20 registered Express, Fastify, and Hono
   Prisma, Drizzle, and raw-SQL paths, including the exact Vue, Svelte, and JavaScript React client/API
   pairings. Each generated project is installed, client-built, API-typechecked, initialized or
   migrated, booted, and checked for CRUD, duplicate, invalid-input, and missing-record behavior. All
   20 scenarios passed hosted run #40614408163 on commit `336622e`.
6. Runs hosted Ubuntu `nextjs-runtime-integration` for integrated Next.js + raw SQL on SQLite,
   PostgreSQL, and MySQL. It runs the pinned-major `create-next-app@16`, applies OmniCraft's exact
   production layers, installs, builds and typechecks the project, runs SQL migrations, boots the
   production server, and verifies CRUD and failure cases. All three database scenarios passed hosted
   run #40614408163 on commit `336622e`.
7. Runs hosted Ubuntu `frontend-runtime-integration` for React/Vite JavaScript frontend-only. It
   installs, builds, boots Vite preview, fetches the generated bundle, and checks missing-asset
   behavior; database operations do not apply. The generated-project check passed hosted run
   #40614408163 on commit `336622e`.
8. Runs hosted Ubuntu `docker-module-integration` for the generated Express + Drizzle + PostgreSQL and
   MySQL paths. It checks the default Compose-file conflict, successful module addition and idempotency,
   validates and starts the Compose database, installs and checks the generated app, migrates, boots the
   API, and verifies CRUD and failure cases. Both scenarios passed hosted run #40615980612 on commit
   `77ef06645421edb3977019f63683af3ea531ccbb`.
9. Runs hosted Ubuntu `module-runtime-integration` for the `add testing` and shadcn frontend-only paths.
   The six original and 254 additional exact React/Vite `add testing` cases generate through production composition, run the real
   add operation, install, execute the generated `npm test`, build the client, boot Vite preview, and
   check the bundle and missing-asset response. TypeScript client cases also typecheck. The Vue, Svelte,
   and Next.js `add testing` cases assert pre-write rejection and unchanged manifests/packages; the 52
   JavaScript + shadcn tuples reject because the template lacks required aliases. The original six
   paths passed run [#40880427361](https://github.com/doofx0071/omnicraft/actions/runs/40880427361)
   and the 254 additional paths passed run [#40918121708](https://github.com/doofx0071/omnicraft/actions/runs/40918121708).
   The support-evidence check and strict release gate passed in the latter run. See the [support matrix](../templates/stack-support-matrix.md)
   for exact path-level evidence. This module test does not establish backend/database behavior.
10. Runs `native-platform-integration` for Expo iOS (`macos-26`), Expo Android (`ubuntu-24.04`), Tauri
   Linux (`ubuntu-24.04`), macOS (`macos-26`), and Windows (`windows-2025`). It generates each project
   through its production command, applies production layers, and installs dependencies. Expo builds and
   launches native apps on the simulator/emulator; Tauri builds the frontend/native executable and checks
   a visible window on each desktop OS. All five scenario checks passed on exact head
   `689fbaa24f6e3a30ff142551ccfbe84b0d514d50` in run
   [#41146678113](https://github.com/doofx0071/omnicraft/actions/runs/41146678113), including the pinned
   Tauri app generator. The support-evidence check and strict release gate passed in the same run; the
   tag-only publish job was skipped for the pull-request event.
   The support matrix records the exact job links and evidence limits. Physical-device paths remain
   Selectable — unverified.
11. Runs hosted Ubuntu `python-fastapi-integration` with `setup-uv` 0.13.5 and Python 3.12. It installs
   generated dependencies, runs Alembic migrations, boots Uvicorn, and checks SQLite and PostgreSQL
   CRUD and failure responses. PostgreSQL runs in an isolated Testcontainers instance.
12. Runs hosted Ubuntu `php-laravel-integration` for SQLite/PostgreSQL/MySQL. The SQLite case uses the
   pinned PHP/Composer test image without a database service; networked databases use isolated Compose
   services. Each case installs Composer dependencies, checks platform requirements, migrates, and
   runs database/API feature tests.
13. Runs hosted Ubuntu `php-laravel-inertia-react-auth-integration` for Laravel 13 + Inertia React on
   SQLite. It generates the None and Laravel-native projects through the production CLI, installs and
   checks Composer/npm dependencies, runs migrations and Laravel feature tests, and enforces pre-write
   rejection of incompatible flags. The job is required by the aggregate gate; the support matrix
   contains only exact modes with passing generated-project and hosted evidence.
14. Runs `support-evidence` to resolve every exact Supported flag combination through available values,
   prompt/flag and answer compatibility, production composition, and module guards; it also checks the
   rendered matrix label, matching scenario, job command, and release aggregate dependency.
   `supported-matrix` fails unless the OS/Node matrix, runtime jobs, support evidence, and package
   artifact all pass. It runs for PRs, main pushes, nightly, and version-tag pushes;
   `workflow_dispatch` supports an explicit pre-release run. The scheduled run uses GitHub-hosted jobs.
15. Version-tag pushes run the complete hosted release gate on the tagged commit. Only after it passes,
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
  Level 3 evidence for its documented scope. A hosted native check on one simulator or desktop target
  does not establish support on other platforms.
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
