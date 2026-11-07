# OmniCraft Generated-App Quality Follow-up

**Status:** Complete — shipped in v1.0.8 (npm `latest` 1.0.8 from `fb6a990`, published 2026-11-08); residuals remain per work item (exact-minimum Node boot proof, Laravel security-baseline decision, generated root package.json descriptions)<br>
**Opened:** 6 November 2026<br>
**Closed:** 8 November 2026<br>
**Repository:** <https://github.com/doofx0071/omnicraft><br>
**Prerequisite:** v1.0.7 polish plan closes with its exact-head hosted release gate green.<br>
**Scope note:** Native `.env` ignore preservation is an in-flight v1.0.7 item in the generated-api
worktree and is not part of this follow-up. The first unmatched-API 404 slice is also scoped to the
v1.0.7 continuation; this follow-up owns only broader generated-app quality after those slices land.

## Goal

Improve the maintainability and first-run quality of generated applications without publishing
composition-wide compatibility claims that the dependency graph and runtime tests do not support. Every
change is scoped to explicit template families and receives generated-project tests before its matrix
status or guidance changes.

## Work items

### 1. Per-composition Node requirements

**Status: Implemented with evidence (worktree slice, November 2026) — generated root variants carry
truthful `engines.node` and `.nvmrc` files. Expo/Tauri native overlays and the native-app family are
not covered (they have no OmniCraft root variant; the official generators own their manifests).**

- Derive engine requirements from the actual selected dependency versions (Vite/ESLint, SQLite,
  Expo, Livewire/Inertia toolchains), not the CLI's own Node floor.
  Evidence was gathered from the npm registry against the exact pinned versions
  (`npm view <pkg>@<version> engines`, November 2026): vite@8.3.5/8.3.6 and
  @vitejs/plugin-react@6.1.2 / @vitejs/plugin-vue@6.0.10 → `^20.19.0 || >=22.12.0`;
  @sveltejs/vite-plugin-svelte@7.3.1 → `^20.19 || ^22.12 || >=24`; eslint@10.x (the extra's
  `^10.13.0`) → `^20.19.0 || ^22.13.0 || >=24`; better-sqlite3@13.0.3 → `>=22`;
  @supabase/supabase-js@2.118.0 → `>=22.0.0`; prisma/@prisma/client@7.10.1 →
  `^20.19 || ^22.12 || >=24`; next@16.4.3 (create-next-app@16, which ships `eslint: "^9"`, floor
  `^18.18 || ^20.9 || >=21.1`) → `>=20.9.0`; the pinned Laravel starter kits' vite-plus@1.4.0 →
  `^22.18 || ^24.11 || >=26`; typescript@5.9.3, tsx, zod, drizzle-orm/-kit, pg, mysql2, cors,
  dotenv, tailwindcss/@tailwindcss/vite@4.3.4 declare weaker or no floors.
- Decide whether requirements belong in each generated root's `engines`, a generated `.nvmrc`, or
  stack-specific README guidance; do not use one shared root fragment until every composition using
  it has the same valid floor.
  Decision: each root variant's `package.json` declares `engines.node` as a single honest semver
  range — the conservative intersection across every composition sharing that static root template
  (root variants apply after extras, so extras cannot carry engines; the intersection is the only
  claim that is true for all of them). Each root also ships an `_nvmrc` (restored to `.nvmrc` via a
  new renderer allowlist entry) holding the primary floor line. Floors: fullstack/{postgres,mysql}
  `^20.19.0 || ^22.13.0 || >=24.0.0` (nvmrc 20.19); fullstack/sqlite `^22.13.0 || >=24.0.0`
  (nvmrc 22.13); fullstack-next/{postgres,mysql} `>=20.9.0` (nvmrc 20.9); fullstack-next/sqlite
  `>=22.0.0` (nvmrc 22); frontend-only `^22.13.0 || >=24.0.0` (nvmrc 22.13, dominated by the
  supabase-js and eslint-extra floors); fullstack-python/* and fullstack-php/*
  `^20.19.0 || ^22.13.0 || >=24.0.0` (nvmrc 20.19); fullstack-laravel-{livewire,inertia-react}
  `^22.18.0 || ^24.11.0 || >=26.0.0` (nvmrc 22.18 — the pinned starters' vite-plus@1.4.0 floor; the
  aliased vite-plus-core is weaker, and the Inertia README now documents the same floor the
  Livewire README already documented). concurrently was downgraded `^10.0.6` → `^9.2.5` in every
  OmniCraft root variant that ships it: concurrently 10 declares `engines: node >=22`, which would
  make the fullstack floors unsatisfiable on Node 20 and contradict the node20-postgres-runtime
  job; concurrently 9.2.5 declares `>=18`. The starter kits' own concurrently pin is untouched.
- Test representative low/high-floor compositions and prove the generated install/build on each
  declared minimum Node version before documenting the floor.
  Partially satisfied: `src/engine.test.ts` asserts the exact `engines.node` + `.nvmrc` content per
  representative composition (fullstack pg/mysql/sqlite, fullstack-next pg/sqlite against a
  simulated CNA skeleton, frontend-only react, python/postgres, php/sqlite, both integrated Laravel
  roots) and pins concurrently at `^9.2.5`. Install resolution was proven on Node 24.22.0 by
  scaffolding frontend-only react and fullstack sqlite through the built CLI and running
  `npm install` in both (zero EBADENGINE warnings; vite 8.3.6, better-sqlite3 13.0.3,
  concurrently 9.2.5, eslint 10.14.0 resolved). Exact-minimum boot/build proof on Node 20.19.x,
  22.13.x, and 22.18.x runtimes remains open (see residuals).

Node 20 CI interaction: the `node20-postgres-runtime` job's setup-node `node-version: 20` resolves
to the latest Node 20.x release (≥20.19), which satisfies the fullstack/postgres floor's `^20.19.0`
branch; on Node 20.12–20.18 the vite 8 client would emit EBADENGINE warnings. npm treats engines
mismatches as warnings (no `engine-strict` exists anywhere in the repo or templates), so the job
still installs, boots, and CRUDs the express + raw SQL + postgres composition on Node 20.19.x with
the generated manifest now truthfully declaring a satisfiable floor.

Residuals for this work item:

- Exact-minimum runtime proof: boot/build each floor family on its declared minimum Node line
  (Node 20.19.x for the `^20.19.0` floors, 22.13.x for the sqlite/frontend-only floors, 22.18.x for
  the Laravel Vite Plus floor) — requires CI matrix additions, which this slice did not own.
- AGENTS.md's dotfile-allowlist sentence still lists only `_gitignore`, `_prettierignore`,
  `_env.example`, and `_github`; the maintainer must add `_nvmrc` there (this slice could not edit
  AGENTS.md).
- Per-composition exact floors are deliberately conservative for shared roots: e.g. frontend-only
  react without extras actually works on `^20.19.0 || >=22.12.0`, but the shared root declares
  `^22.13.0 || >=24.0.0` because supabase-js (>=22) and the eslint extra (22.13) co-select with it.
  Splitting root variants per frontend/extras combination would sharpen this and is deferred.
- The extras/eslint package intentionally carries no `engines` field (the root variant overwrites
  engines as the later manifest writer); work item 2 must keep that ordering in mind when it wires
  lint into generated CI.

### 2. Generated CI and test harnesses

**Implemented (November 2026):**

- The ESLint extra ships a separate `extras/eslint/_github/workflows/lint.yml` (a distinct file, since
  the engine overwrites rather than merges same-path workflows) that runs `npm run lint` from the repo
  root on push/PR for every non-integrated composition — the script lands in the root `package.json`
  on all of them. Next.js integrated is excluded (create-next-app owns lint there and the root CI
  template already lints). Engine tests assert placement, YAML validity, trigger parity, and the
  Next.js exclusion; real frontend-only and fullstack probes ran `npm run lint` successfully. Verified
  by hosted gate run 42374012979.
- Test-harness decision taken: every Node separate-API base ships a Vitest health harness
  (`health.test.ts`, `"test": "vitest run"`, vitest devDependency, tsconfig test exclusion) with a
  generated-CI "Test server" step ordered after Build; FastAPI ships a pytest dev group,
  `tests/test_health.py`, a ruff config, and "Lint API"/"Test API" CI steps; fullstack-php CI gains
  "Code style (Pint)" (`vendor/bin/pint --test`) and "API tests" (`php artisan test`) steps after the
  migrate step, with phpunit.xml pinning sqlite/`:memory:` so the suite is host-independent; the
  integrated Laravel roots keep their `php artisan test` root script; frontend-only compositions ship
  no tests and their CI stays free of test steps. The Pint/PHPUnit runners match the Laravel 12
  skeleton's own tooling (PHPUnit ^11.5, laravel/pint ^1.24 — not Pest). `src/engine.test.ts` asserts
  every harness and CI step across all families with parsed YAML. Verified by hosted gate run
  42383546799 (strict gate, all jobs green).

### 3. API response and baseline security consistency

**Implemented (November 2026):** the unified JSON 404 contract (`{ "error": "Not found" }`,
method-agnostic) now also covers the Next.js integrated overlay (an optional `app/api/[[...notfound]]`
catch-all that loses to static and `[id]` routes by Next specificity and leaves page routing untouched)
and the Laravel 12 API (a `Route::any('/{any?}', …)->where('any', '.*')` catch-all, because Laravel 12's
`Route::fallback()` registers GET/HEAD only and cannot match bare `/api`; known-resource 404s keep
Laravel's exception body). The four JSON API runtimes also gained a generated security baseline:
Express ships `helmet` + `express-rate-limit`, Fastify ships `@fastify/helmet` +
`@fastify/rate-limit` (with the error handler registered before plugin registration — Fastify freezes
error-handler contexts at boot), Hono uses its built-in `secureHeaders()` plus a dependency-free
in-memory fixed-window limiter, and FastAPI uses two pure-ASGI middlewares with CORS kept outermost so
429s still carry CORS headers. Rate limits are per-IP, env-configurable via `RATE_LIMIT_MAX` /
`RATE_LIMIT_WINDOW_MINUTES` (documented in each stack's `.env.example` and root README
troubleshooting), and every 429 returns JSON `{ "error": "Too many requests" }` with a numeric
`Retry-After`. CSP is deliberately left off (JSON APIs; the SPA is served by the Vite client).
Peer/engines evidence for each new dependency is recorded in the slice commits. Local probes passed for
express/fastify/hono raw-SQLite, FastAPI SQLite, Next.js SQLite, and the Laravel 12 API SQLite php-e2e
(fixing a pre-existing win32 double-quoting bug in `scripts/php-laravel-e2e.ts` along the way);
hosted-gate evidence and any matrix wording updates follow the next strict-gate run.

Residuals for this work item:

- Integrated Laravel 13 (Livewire/Inertia) and the Laravel 12 API have no OmniCraft security
  header/rate-limit baseline (Sanctum's route throttle remains its own scope); adding one means
  deciding Laravel-native middleware against the generated apps' session/CSRF behavior.
- The rate limiters are per-process by design (in-memory Map / module state). Multi-worker,
  multi-instance, or serverless deployments need a shared store; generated guidance says so in code
  comments rather than a README claim.
- `.env.example` for FastAPI lives in the SQLAlchemy db adapters (the base has none); a future base
  env file must keep the two adapter files as the effective override.

### 4. Generated-project guidance and UX

**Implemented (November 2026), one residual:** the guidance slice added per-stack
`.vscode/extensions.json` recommendations (merged into the generated root via `mergeExtensionsJson`),
a deterministic generated `AGENTS.md` in every root variant that has one (fullstack-next excluded —
create-next-app 16 generates its own), a documented `SKIP_ENV_VALIDATION=1|true` escape hatch with
explicit placeholder values in all 11 Node `env.ts` variants, the 3000/5173/5432 port-collision
troubleshooting rows in the root READMEs, the "Why these Supabase versions are pinned" rationale
section in the Supabase Auth overlay README, and consistent auth busy-state handling through the
shared `runBusyAction` helper with disabled controls.

Residual for this work item:

- Generated root `package.json` files still carry no `description` field; add a truthful
  per-composition description (and decide whether server/client manifests need one) as a small
  follow-up.

## Acceptance criteria

- [ ] Each work item is split into an exact stack-family scope before implementation; no catalog or
      support-matrix row is broadened by prose alone.
- [ ] Engine tests verify layer composition, token rendering, generated env/docs, and package metadata.
- [ ] Generated-project tests install/build/boot the affected family and exercise the relevant HTTP,
      environment, or lint/test contract.
- [ ] `Selectable — unverified`/`Scaffold-verified` status is retained unless the support matrix's exact
      hosted runtime evidence and strict release gate justify an upgrade.

## Explicit non-goals

- No new runtime, framework, database, ORM, auth provider, or auth mode.
- No universal Node engine floor, template registry, telemetry, or third-party code execution.
- No security claim based solely on dependency presence or generated build success.
