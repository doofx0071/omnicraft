# OmniCraft Existing-Stack Runtime Evidence Plan

**Status:** Active
**Created:** 2026-10-28
**Source:** Explicit runtime and registry-to-documentation deferrals from the
[post-masterplan audit](../completed/omnicraft-post-masterplan-audit.md) and
[testing-infrastructure plan](../completed/omnicraft-testing-infrastructure-plan.md).

## Goal

Close the remaining generated-project verification gaps for combinations that OmniCraft already exposes, and make the support matrix's exact combinations consistent with the authoritative selectable capability and compatibility definitions. Do not add frameworks, template variants, providers, or stack combinations in this plan. Keep each row at its current support status until the exact generated project passes the required hosted CI evidence.

The current release gate covers the `Supported` rows in the [stack support matrix](../../templates/stack-support-matrix.md). The work below concerns existing `Scaffold-verified` and `Selectable — unverified` paths, plus auxiliary project modules and native toolchains.

## Phase 1 — Remaining runtime and database combinations

Add focused integration scenarios for the existing selectable paths below. Each scenario should generate from the exact production layers, install dependencies in the matching runtime, apply the generated initialization/migration path, boot the app, perform a real database operation, and check a relevant failure case. Keep credentials synthetic, logs redacted, timeouts bounded, and cleanup unconditional.

### Node.js

- Express + Prisma + PostgreSQL.
- Express + raw SQL (`none`) + SQLite, PostgreSQL, and MySQL.
- Fastify + Drizzle + PostgreSQL, SQLite, and MySQL.
- Fastify + Prisma + PostgreSQL.
- Fastify + raw SQL (`none`) + PostgreSQL, SQLite, and MySQL.
- Hono + Drizzle + PostgreSQL, SQLite, and MySQL.
- Hono + raw SQL (`none`) + PostgreSQL, SQLite, and MySQL.
- Next.js integrated full-stack + raw SQL + SQLite and PostgreSQL; separately evaluate the currently selectable MySQL path against the actual adapter and CLI compatibility contract before adding runtime coverage.
- Exact Vue/Svelte + Express + Drizzle + SQLite client/API pairings, with client install/build plus API/database operation.
- React/Vite JavaScript frontend-only and JavaScript client + separate API, using their exact current language contract.

### Python

- FastAPI + SQLAlchemy/Alembic + PostgreSQL.

### Module and platform paths

- `omnicraft add docker`: compatibility, idempotency, conflicts, Compose output, and a generated-project run where the added database path is applicable.
- `omnicraft add testing`: install dependencies and execute the generated sample test in a clean generated project.
- shadcn React/Vite: verify the post-scaffold component install path in addition to the existing overlay fixture.
- Expo and Tauri: run the available platform-specific build/launch checks on suitable runners; preserve prerequisite notes and do not equate web/typecheck results with a native build.

Laravel starter-kit modes are **not applicable** to the current CLI: it generates an API project and exposes no Livewire/Inertia starter-mode selection. Revisit only if those modes become selectable.

## Phase 2 — Evidence and status updates

For each completed exact path:

1. Add its scenario to the appropriate runtime test target and CI job.
2. Add a uniquely identified matrix row and evidence mapping if, and only if, it meets the repository's `Supported` criteria.
3. Make the evidence consistency check require the scenario and release-gate dependency.
4. Record the exact hosted run and tested commit in the support matrix.
5. Keep incomplete paths `Scaffold-verified` or `Selectable — unverified`; do not promote based on prompt visibility, template presence, scaffolding, install, or typecheck alone.

Do not change the supported-stack release gate to accept skipped, cancelled, or missing required jobs as success.

## Phase 3 — Capability and support-matrix consistency

The typed `CAPABILITY_REGISTRY` drives selectable values and prompt metadata; `compatibility.ts`
defines cross-option constraints. The exact `Supported` status and CI scenario live in
`support-evidence.ts`, and `check:support-matrix` verifies matrix support IDs, scenarios, scripts,
workflow commands, and aggregate job dependencies. The Markdown matrix remains hand-authored, and this
checker does not yet verify each documented combination against the selectable capability and
compatibility definitions.

Close this remaining documentation-consistency gap without duplicating selectable values or making
selectability imply support:

- Establish a narrow machine-checkable representation for each exact Supported combination that can
  be evaluated through the existing capability and compatibility definitions.
- Reject a matrix Supported row if its combination is unavailable or rejected by prompt/flag/composition
  rules, while preserving its independent runtime-evidence requirement.
- Keep explanatory evidence text human-readable and ensure documentation changes cannot silently
  diverge from the exact registered combination.
- Add focused tests to the existing support-evidence test structure; do not create a second catalog of
  selectable frontend/runtime/backend/database values.

**Acceptance criteria:** every exact Supported matrix combination is both selectable/compatible and
has a passing generated-project evidence target in the release gate; unsupported combinations remain
rejected or provisional.

## Definition of done

- [ ] Every path in Phase 1 has an explicit status and a tested/not-tested reason in the support matrix.
- [ ] Each path promoted to `Supported` passes generated install/setup, runtime, and real-operation checks in hosted CI for its exact combination.
- [ ] Every `Supported` row maps to an existing script, scenario, workflow job, and aggregate release check.
- [ ] Every exact `Supported` row is checked against the selectable capability and compatibility definitions without duplicating the selectable catalog.
- [ ] The full Supported matrix passes on the exact commit before release.
- [ ] Deferred paths remain accurately labeled, with no support claim inferred from an adjacent framework, frontend, ORM, database, or platform.
- [ ] Native platform evidence distinguishes scaffold, web build, native build, and device/simulator launch.

## Out of scope

- Better Auth expansion to Fastify or Hono, new auth providers, and a creation-time auth prompt remain deferred to the separately managed auth-provider/PHP stack expansion plan.
- New template variants or framework/database/ORM combinations.
- `omnicraft doctor`, a third-party registry, telemetry, or a project-upgrade command; these remain roadmap ideas until separately specified.
