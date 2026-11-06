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

- Derive engine requirements from the actual selected dependency versions (Vite/ESLint, SQLite,
  Expo, Livewire/Inertia toolchains), not the CLI's own Node floor.
- Decide whether requirements belong in each generated root's `engines`, a generated `.nvmrc`, or
  stack-specific README guidance; do not use one shared root fragment until every composition using
  it has the same valid floor.
- Test representative low/high-floor compositions and prove the generated install/build on each
  declared minimum Node version before documenting the floor.

### 2. Generated CI and test harnesses

- Decide which stack families ship a default health/API test (Vitest for Node, pytest for FastAPI,
  framework tests for Laravel) and keep the command present only where the harness is actually added.
- Make the optional ESLint/Prettier extra enforce `npm run lint` in generated CI when selected; preserve
  create-next-app's own lint workflow and avoid duplicate jobs.
- Add Python lint/test and PHP Pint/Pest steps only with pinned or bounded tooling and a clean
  generated-project runtime job.

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
