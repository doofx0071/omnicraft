# OmniCraft v1.0.7 Polish Plan

**Status:** Active — round-2 scan complete; execution starting<br>
**Opened:** 6 November 2026<br>
**Repository:** <https://github.com/doofx0071/omnicraft><br>
**Basis:** five parallel round-2 audits at `83fb898` (core source, templates, tests/CI, docs, open-source
research across create-t3-app, create-astro, create-vite/vue, sv, shadcn CLI, giget, Wasp). Auth-provider
expansion stays deferred to the [next-targets plan](omnicraft-auth-provider-php-next-targets-plan.md).

## Goal

Polish everything shipped in v1.0.6 before growing the catalog: make the release gate stop flaking red,
close the guidance and consistency gaps the remediation left, bring generated apps up to modern
practice, and adopt the peer-proven UX patterns that fit the evidence-first philosophy.

## Workstreams

### A — CLI surface and robustness (`codex/polish-core`)

- Use the pinned generator constants in the shipped path (`src/index.ts` hardcodes `@latest` while
  `src/config.ts` pins exist for CI only); add a `create-tauri-app` pin constant. The support matrix
  currently claims a pin users do not get.
- Close the Better Auth create-flow guidance loop: print the auth module's next steps after
  "Configured Better Auth", template a `BETTER_AUTH_SECRET=` placeholder into `server/.env`, and make
  `omnicraft add auth` report idempotent after create-time Better Auth instead of refusing on a
  collision (manifest records `authentication: "none"` today).
- Spinner discipline in the separate-API Laravel flow (stop the spinner before visible composer
  output — the repo's own subprocess law).
- Production default timeouts in `src/exec.ts` (no child process blocks forever behind a spinner);
  extract the repeated 64 MB buffer constant; one-line `$`-pattern fix in add-run patch replacement.
- Create-flow failure guidance (print target dir + remediation hint; contrast with add-run rollback).
- `--skip-install` desktop behavior stated and honored where the generator allows; manifest records
  the package manager that actually installed.
- HELP_TEXT and README Options gain the `omnicraft add <module> [target] [--dry-run]` section (kept
  identical per the coupling rule — closes the untruthful C4 checkbox).
- Agent-detection hint printing the one-shot `--yes` command (create-vite pattern); `--dry-run` for the
  scaffold flow; a `--no` decline-defaults counterpart (create-astro pair).
- Update check skipped for non-TTY scripted runs; `dirname` fix; `validateStackFlags` made pure;
  collision-preview safelist (create-astro pattern); stale Livewire "SQLite only" hint refreshed.

### B — Generated-app quality (`codex/polish-templates`)

- Native `_env.example` for Expo (`EXPO_PUBLIC_API_URL`) and Tauri (`VITE_API_URL`) — still-open
  round-1 item breaking physical-device first runs.
- `engines` + `_nvmrc` (new dotfile-allowlist entry) + `.editorconfig` + `description` fields in
  generated manifests; Node floor per stack (22 for SQLite roots per `better-sqlite3`, 20.12+ elsewhere).
- ESLint extra enforces itself: generated CI gains a lint step when the extra is selected.
- JSON 404 fallback for Express and Hono (response-shape parity); helmet-equivalent security headers
  and one rate-limited route for Express/Fastify/Hono/FastAPI with exact cross-framework parity.
- Minimal test harness per stack: vitest health test for Node bases, pytest for FastAPI, ruff dev group
  for FastAPI, pint + artisan test steps in generated PHP CI.
- `.vscode/extensions.json` recommendations layered per extra (create-vue pattern); generated
  `AGENTS.md` per project with stack-specific commands and doc links (create-astro pattern);
  `SKIP_ENV_VALIDATION` escape hatch in generated `env.ts` so the shipped CI can build (T3 pattern).
- Port 3000/5173 troubleshooting rows; busy-state pattern unified via the shared helper; supabase-js
  exact-pin documented; `{{authSetup}}` added to the contract token list.

### C — CI, flake, and packaging (`codex/polish-ci`)

- Landed immediately on main: `fail-fast: false` on the unix matrix, `testTimeout`/`hookTimeout` 30s,
  workflow-level `concurrency` with `cancel-in-progress`.
- Bounded 3-attempt retry around pinned starter-kit retrieval; one bounded Tauri relaunch inside the
  window wait with real diagnostics capture (nightly still fails with empty output).
- Composer/rust/gradle caches for the heavy jobs; checkout/setup-node major bumps (SHA-pinned);
  `dwait` adoption in the two remaining Docker scripts; node20 docstring fix; bin-shim step in the
  package job; temp-dir hygiene in update-check tests.
- Tier the PR gate (fast subset for PRs, full gate for main/tag/nightly) and document the flake/rerun
  policy in testing-strategy + CONTRIBUTING.
- T3-style generated matrix script (driven by `capabilities.ts`/`compatibility.ts` so it cannot drift)
  scaffold + build-verifying the Scaffold-verified long tail on PRs.

### D — Documentation truth (`codex/polish-docs`, runs after A–C)

- ROADMAP v1.0.6 section rewritten in past tense; rejection re-scope (254/52 → 244/42) reconciled in
  README + testing-strategy; "still pending hosted CI" deleted; dotfile allowlist rule rewritten in
  AGENTS/contract/engine docs; coding-standards subprocess law updated for quoted target-path args;
  `AVAILABLE` references corrected; CONTRIBUTING command list completed; broken plan links fixed;
  repository-structure and AGENTS refreshed for everything A–C landed.

### F — Structural (`codex/polish-structural`, parallel with D)

- Split `support-evidence.ts` (1,515 lines, five concerns) into `support/` modules behind a barrel;
  checker and tests unchanged in behavior.

## Definition of done

- [ ] All workstreams merged; `tsc` clean; full unit suite green; smoke self-asserts 22/22;
      `check-support-evidence` green.
- [ ] Main's gate returns green and stays green across the polish PRs (no repeat of the observed
      flake modes).
- [ ] Generated outputs for affected combos re-verified (empirical spot audit before release).
- [ ] Docs (AGENTS, contract, engine, matrix-adjacent, testing-strategy, CONTRIBUTING) match the
      landed code; HELP_TEXT and README Options identical.
- [ ] v1.0.7 prepared per the CONTRIBUTING checklist (version, CHANGELOG, ROADMAP) and released
      through the automated pipeline.

## Explicit non-goals

- No new stacks, runtimes, databases, providers, or auth modes (next-targets plan domain, gated on
  owner approval).
- No community module registry / changesets this cycle (recorded as future work; L-sized).
- No support-status upgrades without the exact hosted runtime evidence the matrix requires.
- No CI optimization that weakens the strict release gate for main/tag/nightly.
