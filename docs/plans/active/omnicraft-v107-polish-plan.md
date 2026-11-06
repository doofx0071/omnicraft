# OmniCraft v1.0.7 Polish Plan

**Status:** Active — core reliability and documentation slices merged; generated-app and CI polish remain in progress<br>
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

**Completed in merged commits:**

- Production generation now uses pinned `create-expo-app@5.0.0`, `create-tauri-app@4.7.5`,
  `shadcn@4.23.0`, and `prettier@3.9.10` constants; update the support-matrix wording only where it
  now exactly matches production behavior.
- Creation-time Better Auth persists `authentication: "better-auth"`, creates a blank
  `BETTER_AUTH_SECRET=` placeholder in the server env files, prints module next steps, and remains
  idempotent for a later `omnicraft add auth`.
- Captured commands have a 300-second default timeout; all six official generator calls use a
  600-second timeout and shared 64 MiB output ceiling.
- Composer's visible Sanctum install is not wrapped in a spinner; patch replacements treat `$` text
  literally; create-flow failures identify the target path and recovery action.
- Tauri's generator does not offer a dependency-install/skip-install flag. The CLI handles its
  optional npm installation separately, records the actual package manager, and honors
  `--skip-install`.
- Update checks skip non-TTY runs and use the cache directory correctly; `validateStackFlags` is
  pure; collision previews use an explicit safe-file list; stale Livewire database hint is corrected.

**Deferred from this polish cycle:**

- AI-agent detection hint, scaffold-wide `--dry-run`, and a `--no` decline-defaults flag.
- Remaining support-evidence registry behavior is unchanged; structural split is complete.

### B — Generated-app quality (`codex/polish-templates`)

**Completed:** native Expo/Tauri `_env.example` files, with engine tests proving each variable is
rendered and copied to `.env`; renderer allowlist and `__init__.py` behavior remain covered.

**Deferred after dependency-metadata review:** per-stack `engines`/`.nvmrc`/`.editorconfig` and
manifest descriptions; generated eslint CI; Node/Python/PHP test/lint harnesses; JSON 404 parity,
security headers and rate limiting; `.vscode` recommendations; generated `AGENTS.md`;
`SKIP_ENV_VALIDATION`; port troubleshooting; auth busy-state unification; Supabase exact-pin note.
The required Node floors vary by actual selected dependency graph (Vite/ESLint, better-sqlite3,
Expo, and Laravel Vite Plus have different floors), so a universal root declaration would be false.
These need a per-composition design and generated-output tests rather than a broad shared fragment.

**Still required before closing this plan:** choose and implement the next smallest safe generated-app
polish slice (recommended: JSON 404 parity plus package-manager-independent env docs) or create a
follow-up plan that lists the deferred items with exact validation scope.

### C — CI, flake, and packaging (`codex/polish-ci`)

**Completed:** `fail-fast: false` on the Unix matrix, 30-second Vitest/hook timeouts, a single
cross-ref serialized CI queue with no cancellation (release tags cannot be cancelled by a main push),
bounded pinned Livewire retrieval retry (fetch + output marker only; no Composer/migration retry), one
bounded Tauri relaunch with diagnostic inventory, `dwait` adoption in both remaining Docker scripts,
Node 20 helper docstring fix, package bin-shim check, and update-check temp cleanup. Strict release
required-job set remains unchanged.

**Deferred:** Composer/Rust/Gradle caches, Actions-major SHA bumps, PR-gate tiering, a scaffold/build
freshness matrix for the selectable tail, and a written flake/rerun policy. The freshness matrix was
kept out of this release to avoid increasing CI cost and failure surface before the current gate is
stable; consider it separately after v1.0.7 main/tag runs are green.

### D — Documentation truth (`codex/polish-docs`)

**Completed:** v1.0.6 release-state and 244/42 evidence counts; removed stale Next.js pending-CI claim;
documented the dotfile allowlist and Win32 command quoting; corrected capability registry paths;
updated contributor command/test inventories and broken links; recorded C4 (add help) as deferred;
clarified `{{authSetup}}` in both token catalogs.

### F — Structural (`codex/polish-structural`)

**Completed:** split `support-evidence.ts` into five `support/` modules behind the stable barrel;
all exports preserved; typecheck, unit suite, and checker passed. Matrix behavior unchanged.

## Definition of done

- [x] Completed slices merged; `tsc` clean; full unit suite green (**337 tests**); smoke self-asserts
      22/22; `check-support-evidence` green (49 Supported rows). Re-run after any further code changes.
- [ ] Remaining intended polish items are either implemented with tests or explicitly moved to a
      linked follow-up plan with rationale and owner.
- [ ] Independent generated-output audit covers each changed template family (native env, root defaults,
      and any added security/testing layers); no unresolved tokens or incorrect engine claims.
- [x] Current docs for merged slices reflect the landed code; README Options and HELP_TEXT parity
      passes. Add-command help remains explicitly deferred (C4) and must be finished or split before
      plan closure.
- [ ] Hosted CI main gate is green on the final polish commit; tag path repeats the strict gate without
      main/tag cancellation or missing required jobs.
- [ ] v1.0.7 prepared per CONTRIBUTING (version, CHANGELOG, ROADMAP), then published through the
      automated Trusted Publishing pipeline with GitHub Release and bot snapshot verification.

## Explicit non-goals

- No new stacks, runtimes, databases, providers, or auth modes (next-targets plan domain, gated on
  owner approval).
- No community module registry / changesets this cycle (recorded as future work; L-sized).
- No support-status upgrades without the exact hosted runtime evidence the matrix requires.
- No CI optimization that weakens the strict release gate for main/tag/nightly.
