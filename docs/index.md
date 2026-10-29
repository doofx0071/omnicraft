# OmniCraft Documentation

Engineering documentation for **OmniCraft** (`create-omnicraft`) — an interactive, composable
project-scaffolding CLI. Users run `npm create omnicraft@latest` and choose from web, native-platform,
runtime, framework, database, ORM, and tooling options. Verification applies to exact combinations;
the catalog is not a promise that every cross-product is equally supported.

## Reading paths

| If you want to…                 | Read                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| Understand the repo in one page | [AGENTS.md](../AGENTS.md)                                                             |
| Install and use the CLI         | [README.md](../README.md)                                                             |
| See what is supported today     | [Stack support matrix](templates/stack-support-matrix.md)                             |
| See the plan for what's next    | [ROADMAP.md](../ROADMAP.md) and the plans under `docs/plans/active/`                      |
| Contribute                      | [CONTRIBUTING.md](../CONTRIBUTING.md)                                                 |

## Reference

### Architecture — how the CLI works

- [System overview](architecture/system-overview.md) — components and flow, from arg parsing to post-scaffold steps.
- [Repository structure](architecture/repository-structure.md) — where source files, templates, tests, and docs live.
- [Template engine](architecture/template-engine.md) — layer composition, file-overwrite rules, manifest merging, token rendering.

### Development — how to work on the CLI

- [Coding standards](development/coding-standards.md) — TypeScript, subprocess, and error-handling rules for this codebase.
- [Feature development workflow](development/feature-development-workflow.md) — the repeatable path from issue to merged change.
- [Testing strategy](development/testing-strategy.md) — the four test levels and what each change type must run.
- [Database and authentication integration tests](development/database-auth-integration-testing.md) — real PostgreSQL/MySQL and Laravel test commands, prerequisites, and cleanup.
- [Documentation standards](development/documentation-standards.md) — which docs must change with which code.

### Templates — how to extend the stack matrix

- [Template contract](templates/template-contract.md) — what every template layer must provide; layer kinds and rules.
- [Adding a stack](templates/adding-a-stack.md) — step-by-step procedure for a new runtime/framework.
- [Adding an integration](templates/adding-an-integration.md) — procedure for a new database, ORM, or extra.
- [Stack support matrix](templates/stack-support-matrix.md) — exact combinations with their verification status and evidence.

## Status vocabulary

- **Supported** — the exact combination has recorded generated-project install/setup, typecheck or runtime-equivalent validation, boot, and a successful real database operation (where it uses a database). The [support matrix](templates/stack-support-matrix.md) states whether that evidence is CI-backed or a previous manual report.
- **Scaffold-verified** — an engine test or smoke run generates the exact combination; generated-project install/build or functional behavior is not fully verified.
- **Selectable — unverified** — the registry and template layers expose the combination, but no exact engine fixture or smoke entry verifies it.
- **Rejected — unsupported combination** — preflight validation rejects the combination, or the prompt omits it, because no compatible template/module path exists.
- **Planned** — appears in prompts as "(soon)" but has no template yet. Tracked in [ROADMAP.md](../ROADMAP.md).

For the current CI coverage and repository-recorded manual results, see the per-combination [support matrix](templates/stack-support-matrix.md). A CI scaffold or typecheck does not by itself establish database/runtime support.

- [Decision records](decisions/0001-frontend-framework-strategy.md) — durable architecture decisions (ADR 0001: frontend framework strategy).

## Plans

- [Completed: `add testing` React runtime fixes](plans/completed/omnicraft-add-testing-react-runtime-fix-plan.md) — corrected the existing React/Vite module paths and preflight-rejected
  incompatible framework paths.
- [Completed: `add testing` runtime evidence](plans/completed/omnicraft-add-testing-runtime-evidence-plan.md) — hosted generated-test outcomes for existing
  non-native module paths; paths with failing generated tests remain unverified.
- [Completed: master engineering plan](plans/completed/omnicraft-master-plan.md) — preserved as the historical plan based on the 0.3.0 baseline.
- [Completed: post-masterplan audit](plans/completed/omnicraft-post-masterplan-audit.md) — release, compatibility, support evidence, and explicit deferrals.
- [Completed: testing infrastructure](plans/completed/omnicraft-testing-infrastructure-plan.md) — database/auth integration coverage and the ten-row CI release gate.
- [Completed: existing-stack runtime evidence](plans/completed/omnicraft-stack-runtime-evidence-plan.md) — generated-project runtime checks, scoped native evidence, and capability-to-matrix consistency closeout.
- Current release status is summarized in [ROADMAP.md](../ROADMAP.md); active implementation plans live under `docs/plans/active/`.

## Related non-doc directories

- `packages/cli/templates/` — the **generated-project** templates (embedded in the npm package). Not to be confused with this `docs/` tree.
- `docs/demo.gif` / `docs/demo.html` — README demo assets, regenerated by `npm run demo` (root `scripts/make-demo.mjs`).
