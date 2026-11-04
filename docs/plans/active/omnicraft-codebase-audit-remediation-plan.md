# OmniCraft Codebase Audit Remediation Plan

**Status:** Active — full codebase scan complete; remediation not started<br>
**Opened:** 4 November 2026<br>
**Repository:** <https://github.com/doofx0071/omnicraft><br>
**Audit basis:** six parallel audits at commit `6c99038` (post-v1.0.5): core source (28 files),
template tree (271 files), tests/CI/packaging (15 integration scripts, 18 test files, 2 workflows),
an empirical scaffold audit of 29 generated projects, documentation coherence (32 files, 172 links),
and support-evidence discipline (49 matrix rows verified bidirectionally). Baseline state at audit:
`tsc` clean, 278/278 unit tests green, `check-support-evidence` green.

## Goal

Fix the defects the audit found before any new capability expansion. The CLI's composition engine,
CLI surface, and release process carry three P0 bugs that ship broken projects or hang advertised
modes, several selectable-but-broken combinations, and a growing set of undocumented selectable
states. This plan owns remediation only; new stacks, providers, and auth targets remain owned by the
[auth provider and PHP next-target plan](omnicraft-auth-provider-php-next-targets-plan.md), and
physical-device evidence by the [native platform follow-up](omnicraft-native-platform-evidence-follow-up-plan.md).

Severity vocabulary: **P0** breaks users in shipped paths; **P1** breaks advertised or selectable
combinations, or breaks process integrity; **P2** hardening and polish.

## Audit basis and cross-confirmation

Findings below were confirmed by at least one audit; items marked ✚ were independently found by two
or more audits (highest confidence). Empirical claims were reproduced against real scaffold output.

| Audit | Coverage | P0 | P1 | P2/P3 |
| --- | --- | --- | --- | --- |
| Core source | `src/**` non-test, ~5,845 LOC, full reads | 1 | 3 | 10 |
| Template tree | 271 files, family diff-scan | — | 2 | 12 |
| Tests/CI/packaging | scripts, unit tests, workflows, `package.json` | — | 4 | 7 |
| Empirical scaffold | 29 generated projects vs contract | 2 | 1 | 4 |
| Docs coherence | 32 files, 172 links | — | 2 | 8 |
| Evidence discipline | matrix ↔ registry ↔ CI, gates run | — | 2 | 8 |

## Workstream A — Engine and scaffold correctness (P0)

- [ ] **A1 · Dotfile rename corrupts Python scaffolds (P0) ✚.** `restoreDotfileName` in
      `src/scaffold/renderer.ts` applies `/^_/` to every path segment, so `__init__.py` copies as
      `.__init__.py` in every generated FastAPI project (`server/app/._init__.py`,
      `server/app/routes/._init__.py`). Masked by PEP 420 namespace packages (hosted FastAPI CI still
      passes) but `pytest` import modes, `mypy`, `find_packages`, and `python -m app` break.
      Fix: restore dotfiles only for the documented npm-hostile set (`_gitignore`, `_prettierignore`,
      `_github/`, `_env.example`-style names) instead of any `_` prefix. Add an engine test asserting
      a FastAPI scaffold preserves both `__init__.py` files byte-for-byte.
- [ ] **A2 · Generator subprocess cwd hijack (P0).** npm 11 `npx` re-resolves cwd to the nearest
      `package.json` prefix. Smoke's `create-next-app` wrote its skeleton into the repo tree while the
      overlay applied to an empty dir, then exited 0 recording a broken project; the Tauri
      `create-tauri-app` hijack was reproduced, and production Next.js (bare `projectName`) crashes
      nested targets at the `renameSync` of the missing `created` path. Fix: pass the absolute target
      path to every official generator (Expo already does), assert the generator's output actually
      landed in `targetDir` before applying overlays, apply the same fix and `saveManifest` to the
      smoke script's Next.js block.
- [ ] **A3 · `--yes` does not skip three install confirms (P0).** The native-mobile, `uv sync`, and
      default package-manager confirms (`src/index.ts`, audit lines 226–232, 576–581, 692–697) are not
      gated on `args.yes`; clack then waits for keypresses that never arrive — an infinite hang in the
      advertised non-TTY mode. The Laravel counterparts are correctly gated. Fix: mirror the
      `args.yes ? true : unwrap(await p.confirm(...))` pattern at all three sites and add non-TTY
      regression tests for each install branch.

## Workstream B — Broken selectable combinations (P1)

- [ ] **B1 · React JS + Tailwind/shadcn ships a broken build (P1) ✚.** The tailwind and shadcn extras
      ship `vite.config.ts`; for a JS client Vite resolves the existing `vite.config.js` first, so
      `tailwindcss()` never loads (unstyled output, stray config file) and the shadcn demo never
      renders (`main.jsx` imports `App.jsx`, the extra ships `App.tsx`). Legal, selectable combination;
      no engine test covers JS + extras. Fix per the decision in [Decisions required](#decisions-required)
      (JS config variants, language gate, or same-basename override semantics), plus an engine fixture.
- [ ] **B2 · shadcn selectable on FastAPI/Laravel but wired only into the Node install branch (P1).**
      `supportsShadcn` passes for python/php separate-API stacks, the extra's files apply, but
      `npx shadcn init/add` runs only in the default Node install branch — generated clients import
      `@/components/ui/*` that do not exist. Fix per [Decisions required](#decisions-required); either
      way, warn whenever the layer is composed but the CLI step cannot run (`--skip-install`, declined
      install).
- [ ] **B3 · Raw-SQL seed scripts never load `.env` (P1).** `db/none/{postgres,mysql}/src/db/seed.ts`
      and `web/nextjs/db-{postgres,mysql}/seed.ts` lack the `import "dotenv/config"` every
      drizzle/prisma seed and every `migrate.ts` has, so the documented `npm run db:seed` fails out of
      the box (driver defaults to OS user / localhost). Fix: add the import to all six (sqlite
      variants for consistency) and add an engine test asserting `db:seed` resolves `DATABASE_URL` on
      at least one raw-SQL stack.
- [ ] **B4 · Next-steps misguides python databases (P1).** The full-stack detail line hardcodes
      `"SQLite file at server/data/app.db"` for `backendRuntime === "python"` regardless of
      `answers.database` (FastAPI + PostgreSQL users are told the wrong DB) and hardcodes `npm` for
      `db:studio` regardless of detected package manager. Fix: branch on `answers.database` and
      interpolate the pm; add a unit test sweeping `architecture × database`.

## Workstream C — CLI surface and hardening (P1/P2)

- [ ] **C1 · Win32 command quoting and the Expo path (P1).** The Expo branch embeds the absolute
      `answers.targetDir` unquoted into the joined cmd.exe string (`src/exec.ts` joins with single
      spaces): spaced paths break and cmd.exe metacharacters in a cwd directory name execute. Violates
      the coding-standards "hardcoded literals only" invariant. Fix: `basename()` like the Tauri
      branch, plus a quoting helper (`joinWin32Command`) used by all three spawn sites; test against a
      `John Doe`-style cwd.
- [ ] **C2 · Prototype-pollution guard in the deep merge (P2).** `src/scaffold/merge.ts` reassigns
      `__proto__` when a merged object carries it as an own key. Skip/defineProperty such keys.
- [ ] **C3 · `add` route robustness (P2).** No non-TTY guard (bare `omnicraft add` hangs in CI);
      `--dry-run=true` is not recognized and silently filtered; extra positionals are silently
      dropped. Guard, reject unknown forms, reject extra positionals.
- [ ] **C4 · HELP_TEXT and README document the `add` surface (P2).** `omnicraft add <module>
      [target] [--dry-run]` is absent from both; per the change-coupling rules the README Options
      block and `HELP_TEXT` change together and stay identical.
- [ ] **C5 · Dead and duplicated code (P2).** Delete `describeStack`/`PROJECT_TYPE_LABELS`; fold
      `hasStackFlags` (prefill) into `hasFullStackFlags` (compatibility) — they already disagree on
      `--extras`; decide `startCommand`'s fate (wire up or drop with its test).
- [ ] **C6 · Collision preview quality (P2).** `findCollisions` walks `node_modules`/`dist` (slow,
      noisy) and its `layerDirs` omits `app`, so Next.js integrated collisions are not previewed.
      Prune dependency/dot dirs; add `"app"`.
- [ ] **C7 · Binary-safe add snapshots (P2).** `add-run.ts` snapshots patch targets as utf8; a binary
      target would be restored corrupted. Snapshot as `Buffer` (latent today).
- [ ] **C8 · Prerelease-aware update check (P2).** `compareVersions` treats `1.0.5-beta.1` equal to
      `1.0.5`, so prerelease installs never see the stable notice.
- [ ] **C9 · ESLint extra on Next.js integrated (P2).** ESLint is not gated like Tailwind, so
      `eslint.config.js` shadows create-next-app's `eslint.config.mjs`. Ship the layer config as
      `.mjs` for the integrated path (replace, not shadow) or gate it; confirm intent first.
- [ ] **C10 · Template code nits (P3).** FastAPI `description=lifespan.__doc__` (dead description
      string), dead `Platform.OS === 'web'` branch and unreachable guard in the Expo overlay
      `api.ts`, mid-file imports in `db/none/{mysql,sqlite}/src/db/migrate.ts`.

## Workstream D — Template and documentation truth (P1/P2)

- [ ] **D1 · Unused `drizzle-orm` in raw-SQL postgres fragments (P2) ✚.** Remove from
      `templates/db/none/postgres/package.json` and `templates/web/nextjs/db-postgres/package.json`;
      the mysql/sqlite siblings are clean.
- [ ] **D2 · Next.js + SQLite database file not gitignored (P2).** `DATABASE_URL=file:./data/app.db`
      writes `data/` at the project root; `root/fullstack-next/` ships no `_gitignore` and CNA's
      `.gitignore` lacks `data/`. Add a root `_gitignore` with `/data/`.
- [ ] **D3 · README repo-layout path wrong (P1).** `src/templates/` → `packages/cli/templates/`.
- [ ] **D4 · `dbConfig` doc claims are false (P2) ✚.** AGENTS.md, `template-contract.md`, and the
      `templateVariables` docstring say `dbConfig` is unreferenced; the Laravel and Sanctum
      `.env.example` templates render it. Correct all three.
- [ ] **D5 · Root READMEs hardcode the React row (P2).** `root/fullstack/*`,
      `root/fullstack-php/*`, and `root/fullstack-python/*` READMEs say "React + Vite + TypeScript"
      while serving vue/svelte/js clients, and `root/frontend-only` hardcodes "React app" the same
      way. Tokenize via new contract-documented variables or split READMEs per frontend.
- [ ] **D6 · Laravel response-shape parity (P2).** Node/FastAPI emit `createdAt`; Laravel emits
      `created_at` (contract rule 6 parity). Serialize `createdAt` explicitly or amend rule 6 with the
      documented exception.
- [ ] **D7 · Prettier-clean templates (P2).** Seven template files fail `prettier --check` (react
      client-js family, expo/tauri overlays, `api.js`); run prettier or list exceptions in the
      contract.
- [ ] **D8 · Docs count and link drift (P1/P2 batch).** Smoke path count is 22 (AGENTS says 17,
      testing-strategy 20 — the two Sanctum scaffolds are counted nowhere); node-runtime coverage is
      20 (`database-auth-integration-testing.md` says 15); two plan links broke when the follow-up
      plan moved to `completed/`; `docs/index.md` misses one completed and one active plan; `npm run
      demo` is documented but the root script does not exist; testing-strategy cites run
      #40918121708 where the matrix's evidence is #40903557153 attempt 2; add the missing
      `supabase-busy-action.test.ts` row to testing-strategy's Level 1 table.
- [ ] **D9 · Matrix and hint staleness (P2).** Matrix's "prompts mark … PHP/MySQL … as unavailable"
      contradicts the Supported `laravel-eloquent-mysql` row; `capabilities.ts` laravel-native hint
      says Sanctum database evidence is "pending" though PG/MySQL rows are Supported; backfill
      hosted-run URLs for the six job-name-only Supported rows; pin commit hashes on the Livewire rows.

## Workstream E — Evidence and CI integrity (P1/P2)

- [ ] **E1 · Status the selectable-but-unverified space (P1) ✚.** ~60+ flag-valid combinations have
      no matrix row of any status: Vue/Svelte/React-JS with any backend pairing other than
      Express+Drizzle+SQLite, and every `omnicraft add docker` accepted stack except
      Express+Drizzle. Fix per [Decisions required](#decisions-required): add
      `Selectable — unverified` summary rows, or tighten the docker module guard so the guard and the
      matrix agree. The `Selectable — unverified` tier is currently used by zero rows.
- [ ] **E2 · Pin the three `@latest` generators (P1).** `create-expo-app@latest`, `shadcn@latest`,
      `prettier@latest` are unpinned while every other input is deliberately pinned. Pin exact
      versions in `src/config.ts` next to the existing pins.
- [ ] **E3 · Smoke must fail loudly and self-count (P1).** A `create-next-app` failure is logged and
      skipped with exit 0, so CI silently loses Next.js overlay coverage; the smoke path count is
      asserted nowhere. Fail under `CI=1` on generator failure, and log/assert the produced path
      count.
- [ ] **E4 · Symmetric rejection coverage in the checker (P2).** `check-support-evidence.ts` skips
      Rejected rows without `rejection-id` (7 of 8 invisible to CI); `validateCombination` builds a
      deterministic tmpdir without `mkdtemp`/cleanup. Require ids for all Rejected rows, register
      entries for Prisma+SQLite/MySQL, integrated-Laravel pg/mysql, and shadcn frontend limits; use
      the `mkdtemp`+`finally rm` pattern.
- [ ] **E5 · CI hygiene (P2).** Add `timeout-minutes` to the six jobs missing it (the self-hosted
      Windows runner can idle for hours); add one sqlite generated-project runtime scenario on Node 20
      (declared `engines` floor, currently zero generated runtime coverage there); extract the shared
      Docker readiness retry helper for `db-integration`/`fastapi-integration`; trim `pullfrog.yml`'s
      provider keys and SHA-pin actions per [Decisions required](#decisions-required).
- [ ] **E6 · Version-ladder constant (P2).** Move the hardcoded Node floor ladder in
      `php-livewire-auth-e2e.ts` to a named constant near the pinned starter kits.

## Workstream F — Release process (P1)

- [ ] **F1 · Prepare v1.0.6 and repair the release snapshot gap.** Post-1.0.5 merges (including the
      Sanctum PostgreSQL/MySQL support feature) have no changelog section and ROADMAP still presents
      v1.0.5 as an unpublished candidate while npm `latest` is 1.0.5. Bump the CLI version, write the
      CHANGELOG section, correct ROADMAP's publication state, and investigate why the
      `release-metadata.mjs` ROADMAP snapshot commit never landed on main (the CONTRIBUTING step-4
      process gap that will recur every release).

## Decisions required

These need an owner decision before the corresponding work item starts; everything else in this plan
has one obvious fix.

| Decision | Options | Affects |
| --- | --- | --- |
| Extras × JS clients | (a) ship `vite.config.js` variants in tailwind/shadcn extras; (b) gate extras to TypeScript; (c) engine treats same-basename-different-extension as override | B1 |
| shadcn on python/php | (a) restrict shadcn to Node stacks in capability/compatibility/prompt filter; (b) implement the shadcn step for python/php | B2 |
| Unverified selectable space | (a) document with `Selectable — unverified` rows; (b) tighten guards (docker → Express-only) so selection and matrix agree | E1 |
| `pullfrog.yml` secrets | trim keys / SHA-pin actions / keep as-is | E5 |

## Definition of done

- [ ] Every P0 and P1 item above is fixed with the regression test named in its entry.
- [ ] Engine tests cover: `__init__.py` preservation, generator-output-lands-in-target assertion,
      non-TTY `--yes` for all install branches, react-js + tailwind, raw-SQL seed env resolution.
- [ ] `npx tsc --noEmit` clean; full `npx vitest run` green; smoke-e2e passes with its asserted
      path count and no artifacts left in the repo tree.
- [ ] `check-support-evidence` and `support-evidence.test.ts` green with symmetric Rejected-row
      coverage; every selectable combination has an explicit matrix status.
- [ ] Docs updated in the same PR as the code they describe (change-coupling rules); README Options
      identical to `HELP_TEXT`; relative link check clean; doc counts reconciled to source.
- [ ] v1.0.6 prepared per the CONTRIBUTING publish checklist; ROADMAP records the true publication
      state of v1.0.5.
- [ ] This plan moves to `docs/plans/completed/` with per-workstream results recorded, and
      `docs/index.md` updated on the move.

## Explicit non-goals

- No new stacks, runtimes, databases, providers, or auth modes — that is the next-target plan's
  domain, gated on owner approval.
- No support-status upgrades without the exact hosted generated-project runtime evidence and strict
  release gate the matrix requires; scaffold-only results stay `Scaffold-verified`.
- No removal or "deduplication" of intentional template layer overrides.
- No CI optimization that skips, filters, or weakens a required release-gate job.
- No physical-device or Expo-web evidence work — owned by the native platform follow-up plan.
- Do not merge or publish as part of this planning document.
