# Testing strategy

How OmniCraft verifies itself. Commands run from `packages/cli/` unless noted.

Current merged baseline checked on 2026-10-27: `npx vitest run` passed **82 tests in 10 files**;
typecheck, build, and scaffold smoke also passed. The database suite passed for Express + Drizzle with
SQLite, PostgreSQL, and MySQL, and the Laravel suite passed with PostgreSQL and MySQL. These results
apply only to the exact generated combinations exercised; source checks and smoke scaffolding do not
prove that every generated project installs or runs.

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

The engine fixtures cover Express + Drizzle with PostgreSQL/SQLite/MySQL, Express + Prisma + PostgreSQL,
Fastify + Drizzle with PostgreSQL/SQLite/MySQL, Fastify + Prisma + PostgreSQL, FastAPI with
PostgreSQL/SQLite, the Laravel SQLite overlay, React frontend-only, Vue/Svelte client overlays, selected
Next.js adapters, and shadcn's React/Vite overlay. This is a selected set, not the full runtime ×
framework × ORM × database product.

The suite currently has no automated `omnicraft add` module tests and no native Expo/Tauri build tests.

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
4. Runs the hosted Ubuntu `database-integration` job against SQLite, PostgreSQL, and MySQL. For each
   generated Express + Drizzle project it installs dependencies, typechecks client and API, applies
   migrations, boots the API, and exercises CRUD plus Better Auth.
5. Runs the hosted Ubuntu `php-laravel-integration` job against PostgreSQL and MySQL. It creates a
   Laravel 12 project, checks Composer platform requirements, migrates, and runs database/API feature
   tests.

The hosted Linux integration jobs add real database and API checks for those exact combinations; they
do not verify other framework/database combinations. On PR #28 head
`88f7d4261087f97ac909ded92c41dd407a6c4f25`, all ten jobs passed in [run #40532522380](https://github.com/doofx0071/omnicraft/actions/runs/40532522380),
and the matrix records Supported only for the exact combinations exercised by its integration jobs. The
self-hosted Windows runner is restricted to pushes and same-repository pull requests; fork pull requests
use hosted runners only.

## Support statuses

- **Supported** requires Level 3 evidence for the exact combination; a smoke scaffold or typecheck alone
  is insufficient.
- **Scaffold-verified** means the exact combination has an engine fixture or smoke entry but lacks full
  Level 3 evidence.
- **Selectable — unverified** means the registry and layers expose the choice but no exact fixture/smoke
  covers it.
- **Invalid registry entry** means current flags/prompts accept a combination with a known missing
  adapter or compatibility guard; it must not be presented as supported.

Some existing matrix rows cite manual verification performed before this documentation pass. The matrix
labels those as repository-recorded history; they were not rerun as part of the 2026-10-27 source test
baseline above.

## What each change must test

| Change | Required |
| --- | --- |
| Source module change | Add focused unit tests and run the full suite. |
| Prompt/flag behavior change | Update prompt/flag tests; exercise `--yes`, invalid combinations, and built CLI help/validation. |
| Template change | Run engine tests and smoke; install/build/boot every exact combination whose behavior changed before promoting it. |
| New combination | Add an exact engine or smoke entry and Level 3 evidence before calling it Supported. |
| Engine/renderer/merge change | Full suite, all smoke entries, token/collision checks, and Level 3 checks for affected runtime families. |
| Documentation only | Check local links and confirm claims match the matrix and source. |

Tests use temporary directories and mocked prompt/network paths where possible. Prompt tests script the
Clack answer queue rather than emulating a real TTY.
