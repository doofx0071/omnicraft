# Adding a stack

This procedure covers new **runtime and backend framework** adapters (for example NestJS, Django,
Symfony, or a future runtime). For a database, ORM, or extra, see
[adding-an-integration](adding-an-integration.md).

OmniCraft has separate frontend + API, integrated Next.js, frontend-only, and native Expo/Tauri
architectures. A client framework, integrated full-stack framework, and native platform need different
adapter paths; consult the [system overview](../architecture/system-overview.md) and do not assume that
they share one composition shape.

## 0. Preconditions

- The [feature workflow](../development/feature-development-workflow.md) and
  [template contract](template-contract.md) are followed; this addition must not regress existing
  combinations.
- Official setup researched: runtime/framework version support, prerequisites (is it a shell shim? does
  it need a service install?), non-interactive invocation options, dependency peer ranges.

## 1. Identify the adapter and its compatibility boundary

Choose whether the change adds a frontend, integrated full-stack framework, native platform, runtime,
backend framework, database/ORM, or extra. State its architecture kind, prerequisites, valid combinations,
and the exact combinations that the tests will cover. Keep frontend-level support distinct from a full
frontend/backend/database combination.

## 2. Capability registration — `src/prefill.ts` and prompt flow

- Add the framework to `AVAILABLE.backend[<runtime>]` (new runtime: add it to `AVAILABLE.runtime` and a
  `backend`/`db` entry). `AVAILABLE` currently lists dimensions and does not encode every cross-dimension
  constraint; explicitly validate framework × ORM/database compatibility.
- New runtime → extend `resolveAnswers`' default-framework mapping.

## 3. CLI plumbing

- `src/types.ts`: extend `BackendFramework` union + `BACKEND_FRAMEWORK_LABELS`.
- `src/prompts/run-prompts.ts`: add the framework to `frameworkChoices[<runtime>]` (and the runtime row
  itself if new); `(soon)` entries stay `available: false`.
- New flag values come free via `parseEnumChoice` — update `HELP_TEXT` in `src/args.ts` and the README
  "Options" block **identically**.

## 4. Templates — follow the [template contract](template-contract.md)

For a **node framework**:

- `templates/server/node/<framework>/base/` — entry (graceful shutdown, JSON error handler with
  DB-error mapping), zod `src/env.ts`, `src/routes/{index,health}.ts`, `tsconfig.json`, `package.json`,
  `.env.example`.
- `templates/server/node/<framework>/<orm>/` — per supported ORM: `src/routes/index.ts` +
  `<orm>`-specific users routes + `src/env.ts` (with DATABASE_URL). Copy the closest sibling and adapt —
  the users routes are shared-shaped across express/fastify/hono.
- If the framework can't share the existing `db/<orm>/<database>` adapters (different file layout), that's
  an [integration](adding-an-integration.md) addition too.

For a **new runtime** additionally:

- `templates/server/<runtime>/<framework>/base/…` in the runtime's native layout,
- `templates/db/<orm-for-runtime>/<database>/…` adapters (python: `db/sqlalchemy/<database>`),
- `templates/root/fullstack-<runtime>/<database>/` variants: root `package.json` (workspaces +
  `dev:server` script + db passthrough scripts), `_gitignore`, `README.md`, `_github/workflows/ci.yml`,
  `docker-compose.yml` only for containerized DBs,
- `src/scaffold/compose.ts`: route the runtime in `composeLayers` + root-prefix selection,
- `src/index.ts`: post-scaffold dependency step if the runtime isn't npm-managed (see the python/uv and
  php/composer branches),
- `src/next-steps.ts`: runtime-aware database/next-step lines.

If the framework must be created by its own package manager (like Laravel/Composer), it's a **post-X
overlay**: predicate in `compose.ts` (model: `isPostComposerLayer`), CLI step in `index.ts` running the
generator, overlay applied after, engine tests asserting the overlay files.

## 5. Tests — follow the [testing strategy](../development/testing-strategy.md)

1. Engine tests (`src/engine.test.ts`): a new `it` (or matrix rows) scaffolding the combo into a temp
   dir; assert the layer files, rendered tokens, env, root variant, absence of sibling artifacts
   (e.g. no docker-compose for sqlite).
2. Prefill tests: flag validation for the new values, `resolveAnswers` mapping.
3. Prompts test: extend the scripted clack mock if the flow shape changed.

## 6. Verify (the support bar)

Level 3 from the [testing strategy](../development/testing-strategy.md), for **every database** you
claim: scaffold via `smoke-e2e.ts` → install → typecheck both workspaces → boot → `curl /api/health` →
CRUD cycle on `/api/users` including the duplicate-email error code → (python) `uv sync` +
`alembic upgrade head` → (php) migrate/seed/artisan serve.

## 7. Wire into CI + smoke

- Add the combo to `combos` in `scripts/smoke-e2e.ts` (one entry per verified combination).
- If the runtime needs tooling in CI, add it to the workflow (see `shivammathur/setup-php` for php,
  `astral-sh/setup-uv` for python) on the jobs that need it.

## 8. Documentation (same PR)

- [Stack support matrix](stack-support-matrix.md): new row(s) with status + evidence.
- README: "Supported stacks" table, flow diagram if a prompt changed, Options if flags changed.
- `src/args.ts` `HELP_TEXT`.
- The generated READMEs if the stack ships root docs.
- ROADMAP: tick the issue if it maps to a phase item.

## 9. Close

Bump version + publish if releasing (see [CONTRIBUTING.md](../../CONTRIBUTING.md)); close the issue with
the verification evidence comment.
