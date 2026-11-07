# OmniCraft v1.0.7 Polish Plan

**Status:** Complete — shipped in v1.0.7 (npm `latest` 1.0.7 from `ed76478`, published 2026-11-06); residuals owned by the [generated-app quality follow-up](../active/omnicraft-generated-app-quality-follow-up-plan.md)<br>
**Opened:** 6 November 2026<br>
**Closed:** 7 November 2026<br>
**Repository:** <https://github.com/doofx0071/omnicraft><br>
**Basis:** five parallel round-2 audits at `83fb898` (core source, templates, tests/CI, docs, open-source
research across create-t3-app, create-astro, create-vite/vue, sv, shadcn CLI, giget, Wasp). Auth-provider
expansion stays deferred to the [next-targets plan](../active/omnicraft-auth-provider-php-next-targets-plan.md).

## Goal

Polish everything shipped in v1.0.6 before growing the catalog: make the release gate stop flaking red,
close the guidance and consistency gaps the remediation left, bring generated apps up to modern
practice, and adopt the peer-proven UX patterns that fit the evidence-first philosophy.

## Workstreams

### A — CLI surface and robustness (`codex/polish-core`)

**Completed in merged commits:**

- Production generation uses pinned `create-expo-app@5.0.0`, `create-tauri-app@4.7.5`,
  `shadcn@4.23.0`, and `prettier@3.9.10` constants.
- Creation-time Better Auth persists `authentication: "better-auth"`, creates a blank
  `BETTER_AUTH_SECRET=` placeholder in server env files, prints module next steps, and is idempotent
  with a later `omnicraft add auth`.
- Captured commands use a 300-second default timeout; all six official generator calls pass a
  600-second timeout and the shared 64 MiB output ceiling.
- Patch replacements insert literal `$` sequences. Unit tests cover the update-check predicate and
  `dirname` cache-directory creation, the explicit collision-directory prune list (while keeping
  `.github` visible), and the partial-scaffold formatter helper.

**Remaining core items:**

- Wire the update-check TTY/CI/opt-out predicate at the entry point; validate malformed-but-valid JSON
  cache shapes.
- Make `validateStackFlags` pure (it currently appends `tailwind` to the parsed `extras` array).
- Wire partial-scaffold guidance into create failures; the formatter helper is tested but the create-flow
  failure path does not call it.
- Stop the Sanctum visible Composer command from running beneath an active spinner.
- Resolve native install/package-manager behavior before claiming `--skip-install` or install success:
  Expo passes `--no-install` to its generator but hardcodes npm for the optional post-scaffold install;
  Tauri passes `--manager npm`, has no explicit CLI install step or `--skip-install` branch, yet logs
  that dependencies were installed. The manifest still records the caller-detected manager, and native
  manager helpers are not wired into production. Verify generator output, then align install behavior,
  skip semantics, status messages, and manifest values with regression tests.
- AI-agent hint, scaffold-wide `--dry-run`, and `--no` remain deferred.

The `support-evidence.ts` structural split is complete; matrix behavior and support statuses are unchanged.

### B — Generated-app quality (`codex/polish-templates`)

**Completed:** native Expo/Tauri `_env.example` files, with engine tests proving each variable is
rendered and copied to `.env`; renderer allowlist and `__init__.py` behavior remain covered.

The native `.env.example` files are copied to local `.env`, but the official Expo/Tauri `.gitignore`
does not currently ignore that generated file. **In flight:** native `.env` ignore preservation is being
implemented in the generated-api worktree; no commit is recorded yet. Keep this bounded fix in v1.0.7,
not in the broader generated-app follow-up, and verify both generated files and ignore behavior before
closing the item.

**Deferred to the linked [generated-app quality follow-up](omnicraft-generated-app-quality-follow-up-plan.md):**
per-composition `engines`/`.nvmrc`/`.editorconfig`/descriptions; generated ESLint CI and per-stack test/lint
harnesses; security headers and rate limits; `.vscode` recommendations; generated `AGENTS.md`;
`SKIP_ENV_VALIDATION`; port troubleshooting; auth busy-state unification; and the Supabase exact-pin note.
Dependency engine floors differ by composition (Vite/ESLint, better-sqlite3, Expo and Laravel Vite Plus),
so a universal root declaration would be false. The follow-up requires per-composition floors and
runtime/build tests before documenting them.

The first bounded template slice is native `.env` ignore preservation (in flight above); follow it with
the separately scoped JSON 404 contract for unmatched `/api/*` routes in the Node/FastAPI APIs. Neither
changes support status without the existing hosted runtime evidence. Broader engine metadata, generated
lint/test defaults, security middleware, and agent/editor guidance are tracked in the
[generated-app quality follow-up](omnicraft-generated-app-quality-follow-up-plan.md).

### C — CI, flake, and packaging (`codex/polish-ci`)

**Completed:** `fail-fast: false` on the Unix matrix, 30-second Vitest/hook timeouts, one cross-ref
serialized CI queue with `queue: max` and `cancel-in-progress: false`, bounded pinned Livewire retrieval
retry (retrieval/output-marker step only), one bounded Tauri relaunch with diagnostics, `dwait` adoption
in the remaining Docker waiters, Node 20 helper docstring fix, package bin-shim check, and update-check
temp cleanup. Strict release required-job set remains unchanged.

**Deferred:** Composer/Rust/Gradle caches, Actions-major SHA bumps, PR-gate tiering, and a
scaffold/build freshness matrix for the selectable tail. CI concurrency serializes all refs but GitHub
permits up to 100 queued runs and does not promise release-tag priority. The freshness matrix remains
out of this release to avoid increasing CI cost/failure surface. Rerun policy is recorded in the
[testing strategy](../../development/testing-strategy.md) and [contributor guide](../../../CONTRIBUTING.md).

### D — Documentation truth (`codex/polish-docs`)

**Completed:** v1.0.6 release-state and 244/42 evidence counts; removed stale Next.js pending-CI claim;
documented the dotfile allowlist and Win32 command quoting; corrected capability registry paths;
updated contributor command/test inventories and broken links; documented the `omnicraft add` command
in `HELP_TEXT` and README Options with parity coverage; clarified `{{authSetup}}` in both token catalogs.

### F — Structural (`codex/polish-structural`)

**Completed:** split `support-evidence.ts` into five `support/` modules behind the stable barrel;
all exports preserved; typecheck, unit suite, and checker passed. Matrix behavior unchanged.

## Definition of done

- [x] Re-run typecheck, the full unit suite, smoke (22 listed paths), and
      `check-support-evidence` (49 Supported rows) on the final integrated head before pushing
      (358/358 tests across 24 files at integration; re-verified on `main` after release).
- [x] Remaining correctness items implemented with focused tests; broader generated-app work moved to
      the linked [generated-app quality follow-up](../active/omnicraft-generated-app-quality-follow-up-plan.md)
      with per-item validation scope.
- [x] Independent generated-output audit covers native `.env` ignore behavior and the unmatched-API 404
      contract; `/apix` and known-resource 404 semantics preserved; no unresolved tokens or tracked local
      `.env`.
- [x] Documentation workstream: README Options and HELP_TEXT parity passes; `omnicraft add` is documented;
      54 Markdown pages/links were checked in the docs workstream.
- [x] Hosted CI gates green on the exact heads: PR gate run 42246819578 (78 jobs, on `8e1cc1c`), main
      release-commit run 42252215088 (attempt 2 — attempt 1's single failure was the diagnosed
      npm/cli#4828 transient, [#64](https://github.com/doofx0071/omnicraft/issues/64)), and tag run 42264033428.
- [x] v1.0.7 published: npm `latest` = 1.0.7 from `ed76478`; GitHub Release created from the CHANGELOG;
      bot snapshot commit `84ce7ad` recorded the release state in ROADMAP and the system overview.

## Post-release residuals

- Broader generated-app quality work (per-composition Node floors, generated CI lint/test tooling,
  security baselines, project guidance) is owned by the
  [generated-app quality follow-up](../active/omnicraft-generated-app-quality-follow-up-plan.md).
- Two starter-pin staleness events (Tiged resolves named refs only) and the Tailwind 4.3.5 upstream
  incident are documented at their pin sites; revisit pins on the next retrieval failure per the
  documented procedure.

## Explicit non-goals

- No new stacks, runtimes, databases, providers, or auth modes (next-targets plan domain, gated on
  owner approval).
- No community module registry / changesets this cycle (recorded as future work; L-sized).
- No support-status upgrades without the exact hosted runtime evidence the matrix requires.
- No CI optimization that weakens the strict release gate for main/tag/nightly.
