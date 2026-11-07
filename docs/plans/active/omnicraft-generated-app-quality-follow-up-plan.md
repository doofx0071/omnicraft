# OmniCraft Generated-App Quality Follow-up

**Status:** Planned — owner: OmniCraft maintainer<br>
**Opened:** 6 November 2026<br>
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

**Partially implemented (November 2026):** the ESLint extra now ships a separate
`extras/eslint/_github/workflows/lint.yml` (a distinct file, since the engine overwrites rather than
merges same-path workflows) that runs `npm run lint` from the repo root on push/PR for every
non-integrated composition — the script lands in the root `package.json` on all of them. Next.js
integrated is excluded (create-next-app owns lint there and the root CI template already lints).
Engine tests assert placement, YAML validity, trigger parity, and the Next.js exclusion; real
frontend-only and fullstack probes ran `npm run lint` successfully. Verified by hosted gate run
42374012979 (all 77 jobs green).

- Still open: decide which stack families ship a default health/API test (Vitest for Node, pytest for
  FastAPI, framework tests for Laravel) and keep the command present only where the harness is actually
  added.
- Still open: Python lint/test and PHP Pint/Pest steps in generated CI, with pinned or bounded tooling
  and a clean generated-project runtime job.

### 3. API response and baseline security consistency

- After the initial v1.0.7 unmatched-API 404 slice lands, decide whether to extend its JSON error contract
  to additional stacks (Next.js/Laravel) without touching page/UI routing or known-resource 404 behavior.
- Decide a minimal security-header and rate-limit baseline per runtime. Any new package/middleware must
  be peer-checked and exercised by generated-project integration tests, including 429/error response
  shapes; do not infer security from the Sanctum-only throttle.

### 4. Generated-project guidance and UX

- Add optional per-stack `.vscode/extensions.json` recommendations without overwriting generator-owned
  settings.
- Consider a concise generated `AGENTS.md` with only exact stack commands, ports, database setup, env
  guidance, and evidence-qualified status; make the output deterministic and test rendered tokens.
- Add a documented `SKIP_ENV_VALIDATION` escape hatch only after its security/production semantics are
  explicit and covered by generated CI.
- Complete 3000/5173 port-collision troubleshooting, package descriptions, the Supabase exact-version
  rationale, and consistent auth busy-state handling across React clients.

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
