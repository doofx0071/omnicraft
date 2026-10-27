# OmniCraft Post-Master-Plan Audit and Next Steps

> **Closeout status (2026-10-28):** Implementation and local evidence are ready; final archival is
> waiting for the hosted `supported-stack-release-gate` on the review commit. The original review below
> is a dated snapshot and its live-registry limitation has since been resolved.

## Current closeout ledger

- **Published package:** `npm view create-omnicraft version` and `dist-tags` report `1.0.1` / `latest`;
  npm metadata records `gitHead` `7bd88683dbc36414937af096b56f50921797531e`, matching the tested
  merged source. Clean install, scaffold, dependency install, client/server typecheck and build, SQLite
  migration, and generated API checks (health, CRUD, duplicate and invalid requests) passed for the
  published artifact. Better Auth is exercised separately by the generated-project DB integration suite.
- **Release template pin:** GitHub tag `v1.0.1` points at that exact published source commit. A built
  CLI `--latest --yes --skip-install` scaffold fetched templates from `v1.0.1` and generated the
  expected files.
- **Registry and compatibility:** prompts/flags derive selectable values from `src/capabilities.ts`;
  compatibility validation covers prompt, flags, composition, and Better Auth pre-write checks.
  `src/support-evidence.ts` maps each currently Supported matrix row to its exact test scenario; CI
  checks the mappings and fails the aggregate release gate on missing/failed evidence.
- **Module and auth verification:** Better Auth rejects incompatible stacks before writing; module-add
  tests cover dry-run, idempotency, collisions, missing anchors, rollback, and output paths. Existing
  Express + Drizzle Better Auth flows run against SQLite, PostgreSQL, and MySQL in the DB integration
  suite.
- **Runtime coverage added in this closeout:** FastAPI + SQLite and Laravel + SQLite generated-project
  integration jobs passed locally. Their matrix rows remain `Scaffold-verified` until the new hosted
  jobs pass; no other support status is promoted.
- **Deferred work:** remaining selectable runtime paths and native build evidence are tracked in the
  [existing-stack runtime evidence plan](omnicraft-stack-runtime-evidence-plan.md). `doctor`, project
  inspection, and upgrade ideas remain in the roadmap. Auth-provider/PHP expansion remains in its
  separate active plan.
- **Remote template reproducibility:** `--latest` resolves to the immutable `v<CLI_VERSION>` tag and
  fails with a specific missing-tag instruction. The audit found and fixed the missing `v1.0.1` tag;
  the exact tagged remote scaffold passed.

**Review date:** 2026-10-27
**Repository:** https://github.com/doofx0071/omnicraft
**npm package:** https://www.npmjs.com/package/create-omnicraft
**Purpose:** Reconcile the completed master-plan work with the current source, documentation, roadmap, release metadata, and issues, then define the next implementation sequence.

> **Audit limitation:** This review inspects the main-branch package metadata, README, ROADMAP, CHANGELOG, master plan, support matrix, architecture/development/template guides, capability registry, key CLI source, CI workflow, and the roadmap issues #17–#27. It is a repository review, not a local execution of the project. A line-by-line runtime validation of every template combination has not been performed here. The npm registry endpoints were not directly available to this review, so the actual live npm `latest` dist-tag must be checked from a terminal.

## Executive summary

OmniCraft has reached a meaningful milestone: the repository's CLI package is at `1.0.0`; the project documents React/Vite, Next.js, Vue, Svelte, Node/Python/PHP backends, multiple databases, mobile/desktop paths, and `omnicraft add` modules. The docs foundation and template-support concepts exist.

**The next task should not be another stack addition. It should be a post-master-plan reconciliation and release-verification pass.** Several key documents still describe a `0.3.0` baseline or show features as planned even though the roadmap and changelog say they shipped. Other parts of the roadmap contradict their own progress summary. These discrepancies make it difficult for users and coding agents to know what is genuinely supported.

### Highest-priority findings

1. **README capability table is stale.** The README flow shows mobile/desktop and React/Next.js/Vue/Svelte choices, but its supported-stack table still labels many of those features as roadmap items and lists only React as available.
2. **ROADMAP has contradictory completion status.** Its summary says v1.0.0 is 5/5 complete, but issue #27 is still unchecked in the task list. The versioning prose also describes v0.1.0 as the current public launch and v1.0.0 as a future goal, despite the v1.0.0 changelog and package manifest.
3. **The master plan is stale in `docs/plans/active/`.** It declares the baseline as `create-omnicraft@0.3.0` and still has old implementation checklists for work now listed as delivered. It should be reconciled and moved to completed/archived status, while genuinely unfinished follow-ups become a new post-v1 plan.
4. **Support matrix and architecture docs are stale.** The stack matrix says it was last reconciled for v0.3.0; the system overview, add-a-stack guide, and testing guide contain old assumptions or numbers. Update only after checking actual current code and test output.
5. **CHANGELOG has contradictions.** The v1.0.0 section says auth was added, while the v0.6.0 notes say auth is the remaining v1.0.0 item. Its introductory versioning description still says 0.x is the active rapid-iteration model despite a v1.0.0 section.
6. **Feature support is not uniform across combinations.** `omnicraft add auth` is documented as supported for Express + Drizzle first; Node server JavaScript overlays and Vue/Svelte JavaScript support are described as future increments. These boundaries should be explicit in the wizard, docs, registry, and tests.
7. **Published npm state must be confirmed separately.** The source package manifest says `1.0.0`; that alone does not prove the current npm `latest` tag points to `1.0.0` or that the published tarball contains the same source/templates as GitHub main.

---

## 1. Evidence checked

The review examined these repository areas:

- Root `README.md`, `ROADMAP.md`, and `CHANGELOG.md`.
- `packages/cli/package.json` and the current CLI capability/prompt source.
- CLI command entry and argument handling, including the `omnicraft add` path.
- `docs/index.md`, architecture guides, development standards, template contract, stack-addition/integration guides, and support matrix.
- `docs/plans/active/omnicraft-master-plan.md`.
- `.github/workflows/ci.yml` and its OS/Node matrix and runner-boundary notes.
- GitHub roadmap issues #17–#27 and their descriptions/comments, including Next.js, Vue, Svelte, native platforms, auth, `omnicraft add`, JavaScript variants, CI, and template documentation.

This does not mean every file under every framework template has been run. Actual generation/install/build/runtime checks should be performed by CI and in the package smoke test described below.

## 2. Repository health: what to keep

### Keep the composable-template engine

The current design combines layers for the frontend, backend/runtime/framework, database/ORM, extras, and root workspace. It remains a reasonable core for OmniCraft's differentiator: creating a working stack from compatible choices rather than only downloading one framework starter.

Do not replace the engine just to adopt official generators everywhere. Use a framework's official generator when it measurably reduces maintenance, but retain OmniCraft's templates and adapters where they provide necessary full-stack integration.

### Keep the project manifest and module workflow

The `.omnicraft/project.json` manifest is the right foundation for stack-aware follow-up commands. Continue to use it for compatibility checks and module tracking. Preserve `omnicraft add` behavior such as dry-run, idempotency, no silent overwrites, and explicit conflict reporting.

### Keep the CI split for public contributions

The workflow's separation of untrusted fork pull requests onto hosted runners from trusted runs on the self-hosted Windows runner is an important security boundary. Preserve that boundary when editing CI. Ensure no untrusted pull-request workflow can execute on the sensitive self-hosted host.

### Keep status distinctions

The stack matrix already defines different verification levels. Preserve and consistently apply that concept instead of describing all options as “supported.” A stack should only be marked Supported when it satisfies the repository's stated testing requirements. Scaffold/build-only results should not be represented as full database/runtime verification.

---

## 3. P0 — Reconcile all documentation with the current implementation

Create a focused PR, for example:

**`docs: reconcile v1.0.0 docs and supported-stack status`**

Do not add features in this PR. The goal is a reliable public description of the release.

### Files to update

#### `README.md`

- Correct the supported-stack table to reflect the current implementation, not the old v0.3 state.
- The introductory prompt flow already shows platforms and frontend frameworks that the supported table still lists as future work. Fix this contradiction.
- Clearly distinguish frontend framework support from complete full-stack support.
- State that native platform scaffolding has separate prerequisites and verification limits.
- State the actual scope of JavaScript support: the changelog currently records a React/Vite frontend-only JS variant, with server-side JS overlays and Vue/Svelte JS described as future increments.
- Explain that `omnicraft add auth` has a narrower tested compatibility scope than the general scaffold catalog.
- Do not claim every theoretical runtime × framework × ORM × DB combination is supported merely because each option exists in a prompt or type union.
- Keep the quick start short; link to the stack support matrix for the detailed per-combination status.
- Check sample commands against the CLI's actual current `--help` output and flags.

#### `ROADMAP.md`

- Update the versioning paragraph to describe v1.0.0 as released/current only once npm/release checks are confirmed.
- Reconcile the summary row that says v1.0.0 is 5/5 with the task list where #27 remains unchecked.
- Since GitHub issue #27 is reported closed and the documentation files exist, mark it complete only after confirming its actual acceptance criteria are in the repository.
- Replace old “current state v0.1.0” and “we'll cut v1.0.0” wording with the actual post-v1 roadmap.
- Remove or rewrite stale comments about a self-hosted runner being unlimited/free; describe the present hosted/self-hosted split accurately.
- Make future roadmap items about v1.1.x+ maintenance, compatibility expansion, `doctor`, `add` modules, and tested adapter coverage. Do not leave already-shipped Next.js, Vue, Svelte, Expo, Tauri, auth, or module support listed as future work.

#### `CHANGELOG.md`

- Fix the contradiction where v1.0.0 says `omnicraft add auth` was added, but v0.6.0 notes say auth is the remaining v1.0.0 item.
- Keep historical release notes historically accurate; do not rewrite a past release's meaning merely to make today's implementation look consistent.
- Update the introductory versioning note to describe semver behavior after 1.0.0.
- Correct “3 node ORMs” if the third option is `none`; count actual ORMs separately from the no-ORM option.
- Describe verification boundaries precisely: e.g. auth end-to-end verified on SQLite vs scaffold/build-only checks for other DBs/frameworks.

#### `docs/templates/stack-support-matrix.md`

- Reconcile the stated last-updated baseline from `0.3.0` to the release/current branch actually checked.
- Audit every row against the real prompt capability registry, template directories, adapter branches, tests, and issue acceptance criteria.
- Keep the status definitions strict: `Supported`, `Scaffold-verified`, and `Planned` must have evidence and must not be inferred only from a prompt option.
- Report combinations separately when verification differs by backend, ORM, database, or platform.
- Explicitly describe the partial support boundaries for auth, JS variants, and native platform verification.

#### `docs/architecture/system-overview.md`

- Replace stale references to the v0.3 baseline where they no longer reflect the current release.
- Document the current platform/framework choices, project manifest, `omnicraft add`, and which integrations are implemented vs limited.
- Keep the architecture model explicit: Vite + separate API differs from Next.js integrated server architecture; Expo/Tauri projects can rely on a separately running backend.

#### `docs/templates/adding-a-stack.md`

- Remove completed tasks that still read as future work (for example, Next.js implementation if it is now shipped).
- Document how to add client frameworks, integrated full-stack frameworks, native platform adapters, and runtime/backend templates as distinct adapter categories.
- Require compatibility metadata, tests, evidence, docs updates, and support-matrix rows as part of a stack addition.

#### `docs/development/testing-strategy.md`

- Update the hard-coded test count and file count only after running the current test suite and recording actual output.
- Distinguish source/unit tests, generated-project smoke tests, install/build checks, and functional runtime/database tests.
- Make the support matrix verification level derive from test evidence, not a stale manually copied claim.

#### `docs/plans/active/omnicraft-master-plan.md`

- The plan still says it was prepared against CLI `0.3.0`, and includes unchecked steps for capabilities later marked completed.
- Preserve the plan's history, but do not leave it presented as an active next-step checklist if its implementation is complete.
- Move it to `docs/plans/completed/omnicraft-master-plan.md` after mapping each accepted task to completed code/docs/CI or an issue/commit.
- Any genuinely unfinished recommendations should be extracted into a fresh post-v1 plan with only the remaining tasks. Do not carry the old unchecked phase list forward wholesale.

#### `docs/index.md`, `AGENTS.md`, and `CONTRIBUTING.md`

- Check links and scope descriptions after moving the plan.
- Ensure the root `AGENTS.md` points to the correct active roadmap/plan and tells agents to consult stack-specific docs for stack work.
- Avoid duplicating the entire roadmap in `AGENTS.md`; keep it as a compact entry point.

### Acceptance criteria for this PR

- No doc claims a shipped feature is “coming soon” if the current release exposes it as implemented.
- No stack is marked fully supported without the defined evidence.
- Roadmap checkboxes, issue status, changelog, package version, and support matrix agree.
- Internal links work; no active-plan link points to a moved/renamed file.
- No source/templates are changed in this docs-only PR unless a real mismatch is discovered and split into a separate code PR.

---

## 4. P0 — Verify the published npm package

GitHub main currently specifies `create-omnicraft@1.0.0`, with executables `create-omnicraft` and `omnicraft`, package files `dist` and `templates`, and Node.js `>=20.12.0`. That is source metadata, not proof that the npm registry's current `latest` dist-tag matches it.

Run these checks from a terminal with npm registry access:

```bash
npm view create-omnicraft version
npm view create-omnicraft dist-tags --json
npm view create-omnicraft engines --json
npm view create-omnicraft time --json
```

Then inspect what the package will publish from `packages/cli`:

```bash
npm pack --dry-run
```

Verify that the package tarball contains the expected entry point, compiled output, and embedded templates. Confirm that no tests, local secrets, unneeded workspace files, or missing template directories are included.

Finally test the published package from a clean temporary directory using the actual npm latest version:

```bash
npm create omnicraft@latest -- --help
```

Then perform one fully non-interactive or manual scaffold using the exact flags shown by `--help`; install dependencies and run the generated project's verification commands. Do not assume example flags in old docs still exist.

Record the tested npm package version and date. If npm's `latest` tag is not `1.0.0`, decide whether to publish, fix the tag, or update the plan before making a release claim.

**Acceptance:** the npm version/dist-tag, package manifest, changelog, README, GitHub tag/release, and actual installed package agree; clean install + scaffold + generated-project checks pass.

---

## 5. P1 — Make the support matrix and capability registry one source of truth

The current source has an `AVAILABLE` capability registry used by the prompts, while types, templates, documentation, and changelog also describe support. These definitions can drift if maintained separately.

Recommended direction:

1. Make one typed registry authoritative for selectable frameworks, runtimes, backends, databases, ORMs, extras, platforms, languages, modules, prerequisites, and compatibility constraints.
2. Include an explicit verification status/evidence field or a linked test fixture per supported configuration.
3. Derive prompt options and non-interactive validation from the registry; do not allow a CLI flag to bypass prompt compatibility rules.
4. Generate the supported-stack docs from the registry where practical, or add a CI consistency test if generation would be excessive.
5. Keep type unions aligned with the registry; if a type includes a planned future adapter, never let that alone make it selectable.
6. Ensure unsupported combinations fail before writing files, with a clear reason and valid alternatives.
7. Distinguish per-layer capability from complete combination support. Having a Vue template, a PostgreSQL adapter, and Prisma template separately does not prove every Vue × backend × Prisma × PostgreSQL combination works.

**Acceptance:** adding/removing a selectable option requires updating one authoritative capability definition, its implementation/test, and generated or checked documentation; stale/unsupported combinations are detected by CI.

---

## 6. P1 — Close the partial feature gaps before expanding more stacks

### JavaScript language support

The changelog says JavaScript is currently available for the React/Vite frontend-only path, while Node-server JS overlays and Vue/Svelte JavaScript variants remain future increments. The issue title “JavaScript template variants” can therefore overstate its delivery if interpreted as all frontends and server templates.

Next action:

- Decide the contract: either JavaScript changes only the React client and the backend remains TypeScript, or JavaScript is allowed only for combinations with a full JS template overlay.
- Make the wizard and `--lang` flag communicate/enforce that contract.
- Reject unsupported full-stack JS combinations before file writes, unless mixed-language projects are deliberately supported and documented.
- Add matrix tests for React/Vite frontend-only JS and every other combination where the JS option appears.
- Add Node-server JS overlays and Vue/Svelte JS variants only as explicit follow-up features with tests.

### Authentication module

The changelog says `omnicraft add auth` currently supports Better Auth email/password for Express + Drizzle as its first supported path; it says Hono/Fastify wiring is a future increment. Auth was end-to-end verified on SQLite. Other database variations should be labeled according to real verification, not assumed to be equivalent just because schema variants exist.

Next action:

- Ensure `omnicraft add auth` validates framework, ORM, runtime, and database before any write.
- Test dry-run, idempotency, collision handling, manifest update/rollback behavior, environment output, registration/login/session/logout, and protected route outcomes.
- Document exactly which combinations are supported vs merely scaffolded.
- Add Fastify/Hono integration separately once the shared module patch contract supports their route/handler structure safely.

### Native projects

The release notes describe Expo scaffold/install/typecheck verification, and Tauri scaffold/frontend build verification with Rust prerequisite limitations. Keep their status separate from fully verified native release builds. Add actual platform build/launch verification when suitable CI runners and SDK/toolchains are available.

---

## 7. P1 — Strengthen test evidence and publish verification

The CI workflow already has a multi-OS/Node matrix and a deliberate runner boundary for fork PRs. Preserve this. The next work is coverage and evidence rather than an unnecessary full CI rewrite.

Recommended CI gates:

1. Typecheck, unit tests, build the CLI.
2. Run the CLI help/argument-validation checks.
3. Generate each declared supported combination or a declared pairwise matrix, and test all critical combinations individually.
4. Install dependencies and build generated projects for combinations marked scaffold/build verified.
5. For combinations marked Supported, start the generated app and execute a basic health/CRUD/database smoke test where applicable.
6. Run `omnicraft add` module tests: dry-run, idempotent repeat, unsupported combination, file conflict, manifest consistency, and resulting build/test.
7. Run package tarball tests, not only source-workspace tests.
8. Check documentation/status drift and unresolved template tokens.
9. Verify on a clean environment so developer-local dependencies or cache do not hide missing package contents.

Do not make every one of hundreds of theoretical stack combinations a CI job if the matrix grows large. Test each supported base and every interaction boundary; use pairwise coverage where it is justified, and label combinations unverified until adequate evidence exists.

---

## 8. P2 — Remote template reproducibility

The `--latest` path fetches templates from the GitHub repository. A moving branch is convenient, but the exact output can change without the CLI package changing.

Recommended improvements:

- Display the source (bundled or remote) and template revision used.
- Prefer an immutable release/tag/commit reference for reproducible runs, with an explicitly opt-in latest-branch mode if needed.
- Record template source/version/commit in `.omnicraft/project.json`.
- Fail clearly if remote fetching fails; do not silently pretend a different template version was used.
- Test the embedded and remote paths against the same expected composition contract.
- Document that remote-template use executes/copies code from the selected source and must be treated as a trust boundary.

Do not change `--latest` semantics without checking backwards compatibility. If needed, add a clearer alias and deprecate old behavior gradually.

---

## 9. P2 — Next product roadmap after reconciliation

Once documentation and package truth are aligned, prioritize reliability/value rather than adding many new stacks at once.

### Suggested order

1. **Post-v1 reconciliation:** current docs, support matrix, changelog, issue status, and master-plan archival.
2. **Published-package smoke tests:** verify the exact npm artifact.
3. **Capability registry + compatibility enforcement:** eliminate drift in prompts/flags/docs.
4. **Finish partial JS support** or explicitly narrow/rename the feature scope.
5. **Expand auth integration** to Fastify/Hono only with the contract and tests in place.
6. **`omnicraft doctor`:** check Node/npm/Docker/native toolchains, required environment variables, database reachability, migrations, and project-manifest consistency; never print secret values.
7. **Project inspection:** `omnicraft info` reports framework/backend/database/modules and verification status from `.omnicraft/project.json`.
8. **Future integrations/stacks:** add only with a verified stack specification, tests, support-matrix update, and release notes.
9. **Upgrade workflow:** consider updating templates/modules only after a safe diff-first strategy exists; never overwrite user files blindly.

Avoid starting with an automatic “update generated project” command. Updating starter templates after users have modified the app is much more dangerous than generating a new project.

---

## 10. Proposed PR sequence

### PR 1 — `docs: reconcile v1.0.0 docs and support status`

Scope: README, ROADMAP, CHANGELOG, support matrix, architecture overview, testing strategy, adding-a-stack guide, docs index, master-plan status/links.

Done when: the documentation no longer contradicts itself and every support status has evidence.

### PR 2 — `release: verify npm 1.0.0 artifact end to end`

Scope: package metadata audit, tarball contents, npm dist-tag, clean installed-package scaffold test, generated project verification.

Done when: source and published artifact match, and the current npm latest package passes the smoke path.

### PR 3 — `refactor: make stack capability registry authoritative`

Scope: central registry, validation for prompts and flags, documentation generation/consistency check, compatibility tests.

Done when: unsupported combinations are rejected before filesystem writes and docs cannot silently describe nonexistent support.

### PR 4 — `fix: define JavaScript support boundaries`

Scope: prompt/flag behavior, clear mixed-language vs pure-JS semantics, support matrix, JS tests.

Done when: every selectable JS option results in exactly the documented language/configuration combination.

### PR 5 — `test: harden add-module/auth compatibility`

Scope: auth scope, module contracts, idempotency/conflicts/dry-run/rollback, DB behavior tests.

Done when: unsupported combinations fail safely and each supported path has actual evidence.

### PR 6 — `feat: add omnicraft doctor`

Scope: diagnostics for project manifest, toolchain, env presence (names only), database and migration state.

Done when: diagnoses are actionable, secret values never print, tests cover absent/malformed config, and docs describe the supported checks.

---

## 11. Exact next action

**Start with PR 1: documentation and support-matrix reconciliation. Do not start a new framework yet.**

Before editing, run the repository's documented commands from a clean install and save the actual outputs for test counts and CLI help. Check npm's current version/dist-tag. Then edit the docs to reflect measured facts.

Suggested coding-agent prompt:

> Read `AGENTS.md`, `ROADMAP.md`, `CHANGELOG.md`, `README.md`, `docs/index.md`, the active master plan, architecture guides, template contract, stack support matrix, the current capability/prompt source, module implementation, and CI workflow. Compare every user-facing claim in those docs with the current code and test evidence. Implement only a docs/release-truth reconciliation PR: correct stale version baselines, resolve roadmap #27 status contradictions, fix the changelog auth/versioning conflict, update the supported-stack matrix with truthful per-combination verification levels, document JS/auth/native-platform limitations, and archive the master plan only after mapping every task to evidence. Do not add framework features or refactor source code unless a doc claim cannot be corrected without a small separately justified code fix. Run available checks, validate all internal links, report actual test output and every item that remains unverified. Do not claim npm latest is 1.0.0 unless registry metadata confirms it.

---

## 12. Release validation commands

Run from a network-enabled terminal:

```bash
npm view create-omnicraft version
npm view create-omnicraft dist-tags --json
npm view create-omnicraft engines --json
```

Run from the CLI package directory:

```bash
npm ci
npm run test
npm run build
npm pack --dry-run
```

Use the command listed by `npm view` and the actual `--help` output to test a clean package install. Afterwards, generate a small project, install dependencies, run its checks, and verify at least one representative runtime/database operation for each stack whose docs claim “Supported.”

Record:

- Git commit/tag tested.
- npm package version/dist-tag tested.
- Node/npm version and OS.
- Commands executed and exit codes.
- Stack/configuration tested.
- Whether scaffold, install/build, runtime, and database operation were verified.

Do not turn expected output into a claimed test result. Only record what was actually executed.

---

## Final recommendation

The master plan has served its purpose as a broad implementation guide. Your next step is to **close the loop between code, release metadata, documentation, support claims, and tests**. Then establish a small post-v1 roadmap based on the genuine remaining gaps.

OmniCraft's next maturity step is not “more stacks.” It is that every selected stack generates what the CLI promises, every claim has evidence, every partial feature has a clear boundary, and every new integration follows the same contract.
