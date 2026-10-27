# OmniCraft — Master Engineering, Documentation, and Implementation Plan

> **Archive note (2026-10-27):** This plan is preserved as a historical record of the 0.3.0 baseline and
> is no longer an active checklist. The release since then added the template contract and contributor
> guides, project manifest and `omnicraft add`, release-tag template fetching, multi-OS/package CI, the
> Next.js/Vue/Svelte frontends, Expo/Tauri projects, Better Auth, and the React/Vite JavaScript client.
> The current implementation and exact verification levels are in the [support matrix](../../templates/stack-support-matrix.md)
> and [testing strategy](../../development/testing-strategy.md). Selectable choices and module ids now
> come from `packages/cli/src/capabilities.ts`; compatibility rules and module-write safety have
> regression tests. Remaining existing-stack runtime gaps are tracked in
> [the active runtime evidence plan](../active/omnicraft-stack-runtime-evidence-plan.md), not treated as
> completed work in this historical plan.

- **Prepared:** 26 October 2026
- **Repository reviewed:** https://github.com/doofx0071/omnicraft
- **Baseline:** public `main` branch snapshot, CLI package `create-omnicraft@0.3.0`

**Purpose:** A single master plan combining repository hardening, template-engine architecture, stack expansion, development standards, Markdown documentation, coding-agent instructions, testing, and release governance. It defines both what OmniCraft should improve and how future changes must be implemented consistently.

> This master plan merges two related workstreams: repository/implementation improvements and the development-documentation/agent-governance system. It is based on the public repository snapshot, not a claim that proposed changes have already been implemented. Re-check branch, package, file paths, and issue status before beginning each phase.

---

## 1. Executive recommendation

**Keep the current composable-template engine as OmniCraft’s core, selectively use official generators when they reduce framework maintenance, and establish a documentation-and-agent-governance system that keeps future features consistent.**

OmniCraft's differentiator is not simply downloading a React starter. It is combining compatible pieces into a useful application: frontend, backend runtime/framework, ORM, database, developer tooling, workspace scripts, environment templates, and working example features. The existing custom-template system is already aimed at that problem.

The recommended direction combines a **hybrid generator architecture** with **documentation-driven engineering governance**. The documentation should not be a passive wiki: it should define the process, and CI/tests should enforce the rules that can be checked deterministically.

The generator strategy is:

1. Keep OmniCraft-maintained templates for the stacks that already work well with composition, especially the React + separate API + database workspace and the current Node.js, Python, and PHP paths.
2. Continue to use official package managers to install project dependencies. Installing npm packages is different from generating the starter files.
3. For a new framework such as Next.js or React Router Framework Mode, evaluate its official initializer as a base-project adapter. If this keeps the framework foundation current and the generated output remains composable, use it; otherwise maintain a tested OmniCraft template for that framework.
4. Never make an official initializer or a remote template source an unpinned, implicit dependency of a reproducible release. Pin or record generator/template versions and test the exact combination.
5. Before adding more frameworks, harden file-conflict handling, template manifests, compatibility validation, end-to-end tests, release verification, and CI security.

### Recommended order of work

1. **P0 — Protect user files and make generation failures safe.** Define destination/collision behavior, validate the full configuration before writing, and handle secrets safely.
2. **P0 — Establish documentation and coding-agent rules.** Keep the root `AGENTS.md` as the entry point; add the highest-value architecture, coding, workflow, template, and testing references under `docs/`.
3. **P0 — Make template composition explicit and reproducible.** Define template contracts, merge rules, token validation, and versioned remote templates.
4. **P0 — Harden CI and test the published package.** Do not execute untrusted public pull-request code on a sensitive self-hosted runner.
5. **P1 — Establish one source of truth for capabilities.** Keep prompts, flag validation, composition, tests, stack-support documentation, and README aligned.
6. **P1 — Add a consistent feature/stack workflow.** Use required checklists and reusable Markdown spec templates; enforce deterministic rules in CI where possible.
7. **P1 — Deliver the Next.js path and select the next full-stack React framework.** Model integrated full-stack separately from frontend plus API.
8. **P1 — Build `omnicraft add` only after the template contract and project manifest are stable.** Make it idempotent, dry-runnable, conflict-aware, and manifest-driven.
9. **P2 — Add auth, JavaScript variants, Vue/Svelte, mobile, and desktop incrementally.** Each new platform must follow the same documented process and be verified before it is marked supported.

---

## 2. Current state confirmed in the repository

The following describes the public code observed in this review. These items should be re-checked against the actual working tree before changes are made.

### 2.1 Package and CLI

- The CLI package is named `create-omnicraft`, currently version `0.3.0`, with executable names `create-omnicraft` and `omnicraft`.
- It uses ESM, TypeScript, `tsup`, Vitest, `@clack/prompts`, `giget`, and `validate-npm-package-name`.
- The package declares Node.js `>=20.12.0`.
- The intended primary command is `npm create omnicraft@latest`.
- The interactive experience is the default; `--yes`, stack flags, `--skip-install`, `--latest`, `--debug`, `--help`, and `--version` support scripted and advanced use.
- The current prompt code shows Vite + React as available, and marks React Router/Next.js/Vue/Svelte or other future frontend choices as not yet available.

### 2.2 Existing composition engine

The current implementation lives primarily under `packages/cli/src/scaffold/` and uses the template tree under `packages/cli/templates/`.

- `compose.ts` maps answers to ordered template layers.
- `engine.ts` copies files, restores dotfile names, renders string tokens, and merges `package.json` files.
- `merge.ts` deep-merges manifest objects; later scalar/array values take precedence.
- `renderer.ts` substitutes `{{token}}` placeholders. Unknown tokens are currently left in the output rather than rejected.
- `remote.ts` uses `giget` to download the template subtree from the configured GitHub `main` branch when `--latest` is used.
- Laravel is an exception to simple copying: Composer creates a base Laravel project, then OmniCraft applies an overlay.
- The regular full-stack design creates a React/Vite `client`, a backend `server`, and a workspace/root setup, with database and ORM layers added according to the selection.

### 2.3 Current documented and prompted choices

The repository currently documents or exposes these paths:

- Frontend: React + Vite + TypeScript.
- Node.js backend: Express, Fastify, Hono.
- Python backend: FastAPI with SQLAlchemy/Alembic.
- PHP backend: Laravel with Eloquent.
- Databases: PostgreSQL, SQLite, MySQL for compatible stacks.
- ORM/data access: Drizzle and Prisma for supported Node paths, SQLAlchemy for Python, Eloquent for Laravel.
- Extras: Tailwind CSS and ESLint + Prettier.

The smoke-generation script builds a list of representative combinations, including Express with Drizzle/Prisma, SQLite/MySQL, Fastify, Hono, FastAPI, Laravel, and frontend-only. However, the CI workflow only installs and typechecks a smaller subset of generated combinations. Generating a folder is not equivalent to proving it installs, builds, starts, and performs database operations.

### 2.4 Current roadmap and open issues

The roadmap marks v0.1, v0.2, and v0.3 complete. It has 10 open issues in the frontend expansion, platform expansion, and v1.0 maturity groups:

- **#17** Next.js frontend / full-stack-in-one path.
- **#18** Vue + Vite frontend.
- **#19** Svelte + Vite frontend.
- **#20** Evaluate TanStack Start versus React Router Framework Mode.
- **#21** React Native + Expo mobile scaffolding.
- **#22** Tauri desktop scaffolding.
- **#23** Authentication boilerplate.
- **#24** `omnicraft add <module>` post-scaffold generator.
- **#25** JavaScript (non-TypeScript) template variants.
- **#27** Template composition/contributor guide.

The roadmap notes **#26 multi-OS CI as already completed**. Do not re-add it as an open task unless the current CI status changes.

### 2.5 Important inconsistencies and risks discovered

1. **Documentation drift:** the README's illustrative flow says Python/Laravel or SQLite/MySQL are “soon” or “coming,” while the current prompt/catalog and supported-stack table show several of these as available. Make the README reflect the actual tested support level.
2. **File overwrite behavior:** template layers overwrite same-path non-`package.json` files. The prompt warns if the destination directory is non-empty and asks whether to continue, but this is broader than confirming exactly which files will be replaced. `package.json` is merged, with later values taking precedence. This needs a clear conflict policy.
3. **Mutable remote templates:** `--latest` downloads from `main`, so two invocations of the same CLI version can generate different projects. A commit on `main` can also introduce an untested template before the CLI adapter is updated.
4. **Unresolved tokens:** the renderer leaves unknown `{{token}}` placeholders unchanged; the generation pipeline should fail if unresolved template tokens remain.
5. **Capability duplication:** availability logic appears in prompt choices, `AVAILABLE`/flag validation, composition rules, and the smoke-test list. Duplication allows the prompt, flags, generator, tests, and README to drift apart.
6. **Test depth:** the smoke script scaffolds many combinations, but CI verifies only a subset with dependency installation/typechecking/linting. There is no demonstrated end-to-end check of real DB CRUD for every supported stack.
7. **Self-hosted runner exposure:** current CI triggers on `pull_request` and has a self-hosted Windows job. Because the repository is public, untrusted pull-request code must not execute on a sensitive, persistent self-hosted runner.
8. **Non-empty destination and secrets:** the generator can proceed into a confirmed non-empty directory, then apply templates. Existing `.env`, configuration, or source files must not be overwritten merely because the user agreed to scaffold into the folder generally.
9. **“Full-stack” ambiguity:** the current boolean model is natural for React + separate API, but does not adequately model Next.js or other frameworks with integrated server capabilities. Add explicit architecture kinds before implementing #17.

---

## 3. Product and architecture decisions to lock

### Decision A — Keep custom templates as the core

**Recommended:** keep the current composition engine and do not replace the existing stack generator wholesale.

Use official generators in a per-framework adapter when they provide a stable, useful base project. For example:

- **Vite + React:** keep the current template or run a small proof-of-concept comparing your template against the official Vite generator. Vite's starter is simple, so the maintenance benefit may be modest.
- **Next.js:** strongly consider the official initializer for the base project, because Next.js has framework-specific conventions, configuration, and evolving setup options. Apply OmniCraft's database, quality, and example-feature integrations afterward.
- **React Router Framework Mode / TanStack Start:** make a framework-selection decision first, then determine whether the chosen framework's official initializer can be invoked predictably and non-interactively.
- **Fastify/Express/Hono/FastAPI/Laravel:** retain composable backend templates where they are useful; continue to use Composer for Laravel's upstream base project if that is the established tested workflow.

Do not run `@latest` official generators as an unpinned hidden step for every project. The adapter should record and test the generator version/arguments it expects and should give users actionable errors if required tooling is unavailable.

### Decision B — Represent architecture explicitly

Replace the conceptual dependence on `fullStack: boolean` with a validated architecture model. A migration can keep the boolean internally for older templates at first, but new generators should use explicit architecture values.

Recommended initial kinds:

```ts
type ProjectArchitecture =
  | { kind: "frontend-only" }
  | { kind: "integrated-fullstack"; framework: "nextjs" | "react-router" | "tanstack-start" }
  | {
      kind: "separate-frontend-api";
      frontend: "react-vite";
      backendRuntime: string;
      backendFramework: string;
    };
```

This is illustrative and should be reconciled with the repository's actual `types.ts` before implementation.

Benefits:

- Vite-only means browser frontend, not direct server-side PostgreSQL access.
- Vite + Fastify means separate client/API/database apps.
- Next.js means server capability is part of the framework; a separate API is optional, not mandatory.
- Mobile and desktop can later be represented as separate platform adapters without pretending they are ordinary web frontends.

### Decision C — Keep a single authoritative capability registry

Create a typed registry or validated manifest that describes each platform, framework, backend, database, ORM, extra, supported architecture, required runtime, prerequisites, template IDs, and verification commands.

Use it to power:

- Prompt choices and disabled/“coming soon” options.
- Validation of CLI flags.
- Composition planning.
- The generated stack matrix for CI.
- Supported-stack documentation.
- Future `omnicraft add` eligibility checks.

Avoid hand-maintaining separate unrelated lists of “supported” options. There must be one definition of what “supported” means.

### Decision D — Define the meaning of “supported”

A technology should only be shown as available when all of these are true:

1. There is a template or official-generator adapter.
2. The combination passes configuration and compatibility validation.
3. It can scaffold cleanly into an empty directory.
4. Dependencies install in a clean environment.
5. The output's static checks/build pass.
6. Its documented startup steps are accurate.
7. If a database is advertised as wired end-to-end, at least one database-backed operation has been verified in a dedicated test.

If a combination only scaffolds but hasn't passed install/build/functional testing, label it **experimental**, do not describe it as production-ready or fully supported.

---

## 4. Phase 0 — Correctness, safety, and documentation baseline (P0)

Complete this before adding another framework. Suggested release target: a maintenance release after current v0.3.0, not an automatic version bump; select the version based on semver and existing release policy.

### 4.1 Destination safety and generation transaction

**Current concern:** the prompt allows proceeding into a non-empty directory after a broad confirmation, and layers can overwrite files. The CLI creates the destination and writes incrementally. A mid-generation failure can leave a partially written project.

Implement:

- Resolve the final destination to an absolute path and verify it is not a filesystem root or another unsafe target.
- Before writing, produce a generation plan containing every destination path and each operation (create, merge, replace, run external generator).
- Refuse to overwrite a non-empty directory by default.
- If the directory is non-empty, show a collision summary and require an explicit choice. “Continue” must not imply that secrets or arbitrary user files can be overwritten.
- Never overwrite `.env`, local credentials, an existing `.git` directory, or unrelated user files silently.
- Generate into a sibling temporary staging directory where possible, verify the scaffold structure, then move it into the final destination if the final path is still safe and free.
- If the user explicitly chooses an overlay into an existing directory, back up/record colliding files or require per-file approval. Keep this feature out of the first hardened release if safe implementation is not ready.
- Make staging cleanup conservative: only remove directories created by the current OmniCraft invocation and only when their ownership/path is known.
- Use argument arrays for child processes; never assemble shell commands by interpolating project names or paths.
- Ensure the smoke test's destructive cleanup is restricted to an explicitly designated temporary output directory, never a user-supplied arbitrary project path.

**Acceptance criteria:** unit tests cover new directory, empty existing directory, non-empty directory, `.env` collision, `.git` collision, cancellation, mid-generation failure, and path normalization on Windows/macOS/Linux. No existing file is overwritten without a clear, scoped consent path.

### 4.2 Template-layer collision policy

Replace “later layers silently overwrite earlier files” with a documented and testable rule.

Recommended initial semantics:

- New path: create it.
- Same path and byte-identical content: treat as identical or report a harmless duplicate.
- `package.json`: merge according to explicit manifest-specific rules.
- Known safe merge targets: only merge when a named strategy exists and is tested (for example, append to a designated config array, not arbitrary JavaScript/JSON text).
- Same path with different contents: fail with the two contributing layer IDs unless the manifest declares the collision as intentional and specifies its strategy.
- Binary files: do not overwrite on collision unless explicitly declared.
- User files in destination: treat as user-owned, not template-owned.

For `package.json`:

- Keep dependencies/devDependencies by dependency name and detect incompatible version ranges.
- Never silently override conflicting scripts, package manager fields, module type, engines, or workspace config.
- Define precedence field by field rather than letting a generic deep merge pick a winner for every scalar and array.
- Show conflicts in the plan and fail before filesystem changes if they cannot be reconciled safely.

**Acceptance criteria:** tests cover duplicate files, intended override, unexpected override, dependency version conflict, script collision, nested config, binary collision, and deterministic output.

### 4.3 Template token and path validation

Improve the template renderer and layer loader:

- After rendering each text file, scan for unresolved `{{token}}` syntax and fail with the file path and missing token name.
- Validate required variables before any writes (project name, package names, DB name, runtime, etc.).
- Ensure `layer.src` remains inside the chosen template root and that output paths cannot escape the target directory via traversal components.
- Define which template files are treated as binary, and test file detection on nested paths.
- Keep `.env` and other secrets out of version control. Generate safe placeholders in `.env.example`; only create a local `.env` when the user requests it and it does not already exist.
- Clearly label any local-only database credentials generated for Docker Compose; never present them as production credentials.

**Acceptance criteria:** unresolved tokens, invalid layer roots, path traversal, missing required variables, and unexpected generated environment secrets fail automated tests.

### 4.4 Make remote templates reproducible

**Current behavior:** `--latest` pulls the template subtree from GitHub `main`, which is mutable.

Recommended options, in order of preference:

1. Fetch templates from a release/tag or commit corresponding to the CLI release.
2. Record source, resolved commit, template schema version, and checksum in the generation report and generated project manifest.
3. Validate remote template manifests against the CLI's supported schema and capability IDs before composition.
4. Do not silently mix a newer incompatible remote template with an older CLI. If incompatible, explain the mismatch and stop.
5. Keep embedded templates as the default for reproducibility. Make “use newest development templates” an explicit preview/experimental mode if fetching `main` is still useful.
6. Show the remote template source and resolved version before writing files; preserve the existing behavior of clearly failing if the fetch fails.

**Acceptance criteria:** generating twice from the same pinned CLI/template release yields the same file set and stable config contents (ignoring intentionally generated timestamps/IDs, which should preferably be avoided).

### 4.5 Reconcile docs with actual capability

The README currently describes some choices as “soon”/“coming” while the prompt code and stack table expose those choices as available. Correct this before marketing broader support.

- Generate the supported-stack tables from the authoritative registry or test fixture.
- Separate **available and tested**, **available but experimental**, and **planned**.
- Document that the current React path is Vite-based and that the existing full-stack default means a separate frontend + API + database workspace.
- Explicitly explain that React browser code cannot connect directly to a private PostgreSQL/MySQL connection string.
- Document prerequisites per runtime: Node/npm, Python/uv, PHP/Composer, and Docker where needed.
- Document install-skipped behavior, generated project startup, migration/seed commands, and troubleshooting.
- Avoid claiming every stack is end-to-end tested if CI only typechecks a subset.
- Keep README example commands identical to CLI help output and supported flags.

**Acceptance criteria:** automated docs consistency test compares advertised choices to the capability registry; every “available” combination links to a passing CI result or test category.

---

## 5. Phase 1 — CI, release, and compatibility test improvements (P0/P1)

### 5.1 Protect the self-hosted runner

The current CI workflow has a self-hosted Windows job and runs for `pull_request`. Since the repository is public, untrusted PR code could execute on a persistent self-hosted machine. Review this before inviting outside contributions.

Recommended setup:

- Run fork/public pull-request CI on GitHub-hosted runners (`windows-latest`, `ubuntu-latest`, `macos-latest`) where feasible.
- If the self-hosted Windows runner is needed for cost or environment reasons, restrict it to trusted push/release workflows or trusted contributors, not arbitrary fork PR code.
- Do not use `pull_request_target` to check out and execute untrusted PR code with elevated secrets.
- Grant minimal workflow `permissions`.
- Pin third-party actions to reviewed commit SHAs when practical.
- Separate release credentials from test workflows.

### 5.2 Test the minimum and current Node versions

The package declares Node `>=20.12.0`, but current CI uses Node 24. Establish a tested runtime policy:

- Test the declared minimum version (or raise the minimum if keeping it tested is not practical).
- Test a current supported Node LTS/current release appropriate to the project's support policy.
- Explicitly set the package `engines` and CI matrix from the same policy document.

### 5.3 Expand generated-project validation

The current smoke script creates multiple configurations, while full dependency/typecheck checks cover only a subset. Replace the hand-maintained list with a generated matrix derived from the capability registry.

Recommended levels:

1. **Level A — Unit:** name validation, argument parsing, capability compatibility, merge policy, template rendering, path safety, errors.
2. **Level B — Scaffold smoke:** every advertised combination generates all expected files; no unresolved tokens; manifests parse; no secrets included.
3. **Level C — Build/install:** install and typecheck/lint/build representative combinations for each distinct architecture, runtime, ORM, and database adapter.
4. **Level D — Functional:** launch API and frontend where practical; execute a small API CRUD path against a disposable database; verify migration and seed instructions.
5. **Level E — Published-package test:** run `npm pack`, install the tarball into a clean temp directory, run the actual `create-omnicraft` executable, scaffold one or more projects, and verify the package contents include all embedded templates.

Test coverage should be risk-based. At minimum, every unique adapter needs direct coverage and every distinct integration boundary needs at least one end-to-end test. Use pairwise combinations as the matrix expands, but never rely on pairwise coverage alone for core advertised workflows.

### 5.4 Release pipeline

Before publishing:

- Typecheck, unit tests, build, scaffold matrix, package audit, and generated-project checks pass.
- `npm pack --dry-run` or a real tarball inspection confirms templates and built files are included and repository-only files are excluded.
- The tarball is installed and tested independently of the monorepo checkout.
- Version and changelog match the release.
- The published npm version and dist-tag are verified afterward.
- Consider npm trusted publishing/provenance when the workflow and account support it; avoid long-lived tokens where possible.

**Acceptance criteria:** release CI fails if a required advertised stack is broken, the package lacks templates, metadata is inconsistent, or a published artifact smoke test fails.

**Current release-evidence policy (2026-10-28):** `src/support-evidence.ts` maps each `Supported`
matrix row to exact generated-project scenarios and CI jobs. The support-evidence check verifies those
links and the `supported-stack-release-gate` aggregates the cross-platform, package-artifact, and full
Supported runtime checks. The gate runs on pull requests, main pushes, nightly, and manual pre-release
dispatch. See [CONTRIBUTING.md](../../../CONTRIBUTING.md) for the release checklist.

---

## 6. Phase 2 — Template contract and project metadata (P1; prerequisite for #24)

### 6.1 Complete issue #27

Create `docs/TEMPLATE_GUIDE.md` covering:

- Template directory conventions and naming.
- Each template's responsibility (platform/framework/base/backend/ORM/database/extras/root).
- Layer ordering and destinations.
- Required/optional tokens and token escaping rules.
- Package manifest merge semantics.
- File-collision declaration and strategy.
- Prerequisites and compatibility declarations.
- How to add a runtime/framework/ORM/database adapter.
- How to run the generated matrix and functional tests.
- Versioning/release expectations for bundled and remote templates.

### 6.2 Add a template manifest

Add a manifest per template/adapter. The schema should be small now and extensible later.

Suggested properties:

- `id`, `version`, `kind`, `description`.
- `runtime` and supported platform/framework versions.
- `requires` and `conflictsWith`.
- Compatible architecture IDs, database IDs, and ORM IDs.
- Required environment variables and external tools.
- Declared file collision/merge behavior.
- Generation hooks and post-generation validation commands, if any.
- Supported schema version and documentation links.

Do not let arbitrary templates execute arbitrary JavaScript hooks. Prefer declarative manifests and a trusted adapter implementation. If hooks become necessary later, require a clear permission/security model.

### 6.3 Add `.omnicraft/project.json`

Generate a metadata file in the scaffolded project that records:

- OmniCraft CLI version.
- Template schema version.
- Template IDs and resolved versions/commit hashes.
- Architecture, frontend, backend runtime/framework, database, ORM, and extras.
- Whether dependencies were installed and which package manager was used.
- Optional project creation timestamp only if it is useful; avoid nondeterminism if not needed.

Do not store secret values. The metadata enables `omnicraft info`, `doctor`, and the future `omnicraft add` command without relying solely on `package.json` heuristics.

**Acceptance criteria:** a generated project manifest validates against a versioned schema and fully describes the selected stack; older/unknown schema versions produce a clear diagnostic.

---

## 7. Phase 3 — Deliver `omnicraft add` (issue #24) (P1)

This may become OmniCraft's strongest differentiator after initial generation. Do not implement it before the template contract and project manifest are in place.

### 7.1 Initial command scope

Start with a small set of non-destructive modules, e.g.:

- `omnicraft add testing`
- `omnicraft add docker`
- `omnicraft add crud`

Add `auth` after its supported stack/provider and security design are specified. Do not promise every module for every runtime initially.

Suggested UX:

```bash
omnicraft add testing --dry-run
omnicraft add testing
omnicraft info
omnicraft doctor
```

The default should remain interactive when user input is needed; advanced flags should make scripting possible.

### 7.2 Required behavior

- Locate and validate `.omnicraft/project.json`.
- Detect current framework/runtime/database, then validate module compatibility.
- Provide `--dry-run` that lists file changes, package updates, scripts, and environment variables without writing.
- Detect whether a module is already installed; repeat runs should be idempotent.
- Show exact colliding paths and use the shared collision policy.
- Back up or preserve files changed by the user; never silently overwrite user code.
- Merge package dependencies with semver conflict checks.
- Update `.omnicraft/project.json` only after all module operations succeed.
- Support rollback or clearly documented manual recovery if package installation or generation fails.
- Never run database migrations automatically without explicit user action.

### 7.3 Acceptance criteria

A test runs each initial module twice, confirms the second run makes no duplicate edits, tests incompatible stacks, tests conflicting files, tests failed installation, and verifies no credentials are added to Git.

---

## 8. Phase 4 — Frontend architecture expansion (v0.4 roadmap)

### 8.1 Issue #17 — Next.js full-stack-in-one path

Build this after architecture modeling and capability registry changes. Next.js must not be treated as another Vite-style `client` template by default.

Wizard behavior:

1. Choose Web App.
2. Choose Next.js.
3. Select TypeScript/JavaScript (when supported), styling and optional UI.
4. Choose no database, supported hosted backend integration, or server-side database + ORM.
5. Ask about a separate API only if the user explicitly wants another service.

Implementation:

- Evaluate the official `create-next-app` initializer as a base adapter, with explicit options and a supported version; prevent its nested prompts from conflicting with OmniCraft's wizard.
- Add database and tooling layers only after base generation succeeds.
- Database access must stay in server-only modules; never bundle server connection strings or secrets into client code.
- Choose and document the routing/app-directory convention as part of the adapter's supported version.
- Add a working sample feature and database migration when database support is enabled.
- Test the exact generated package tarball, not only source templates.

### 8.2 Issue #20 — research React Router Framework Mode vs TanStack Start

Keep this issue as a decision record first, not a promise to ship both. Evaluate:

- Official generator quality and non-interactive invocation.
- Server loader/action and request handling model.
- PostgreSQL/ORM integration pattern.
- Deployment/runtime options and supported Node versions.
- TypeScript, testing and build experience.
- Framework maturity, release stability and maintenance burden.
- Whether the integration can pass the same generation contract as Next.js.

Record the conclusion and why before implementing a template. If both are added eventually, each gets a distinct framework ID and adapter, not one generic “React full-stack” template.

### 8.3 Issues #18 and #19 — Vue and Svelte

Add only after the framework adapter contract works for at least two distinct frameworks (React/Vite and Next.js or another integrated framework).

For each framework:

- Use its official base generator if useful and stable.
- Start with frontend-only and a supported separate API architecture.
- Add styling and quality integrations only after verified.
- Reuse the core CLI, compatibility registry, and manifest; do not force React-specific assumptions into these templates.

### 8.4 Acceptance criteria for a new frontend

- The prompt only offers supported combinations.
- The starter builds with a clean dependency install.
- Selected tooling is actually wired into the app, not merely added to dependencies.
- README startup instructions match the generated scripts.
- The generated configuration is covered by smoke tests and a clean package test.

---

## 9. Phase 5 — Runtime, database, and module refinements

### 9.1 Database workflow quality

- Keep PostgreSQL as a strong full-stack default, but clearly state the Docker requirement.
- Consider offering SQLite as a “fastest first run” profile when the chosen ORM/framework supports it; the current CLI already has SQLite template paths for several stacks.
- Distinguish schema push, migrations, and seeding. Do not present a development `db:push` flow as a universal production migration process.
- Add optional commands such as `db:generate`, `db:migrate`, and `db:seed` where they align with the chosen ORM.
- Add connection diagnostics: DB service running, URL present, credentials accepted, migrations applied.
- For every “database connected end-to-end” claim, test one real read/write against a disposable DB in CI or a documented integration-test environment.

### 9.2 Issue #23 — authentication

Do not write bespoke authentication/security primitives. Choose a maintained library or provider for a narrowly defined first stack, then adapt it to additional stacks later.

Include tests and examples for:

- Register/login/logout flows.
- Password hashing and password policy when passwords are used.
- Session creation, expiry, invalidation, cookie attributes, and CSRF considerations where applicable.
- Unauthorized access to protected routes and data.
- Database schema/migrations and seed behavior.
- Environment variables and secrets that are never committed.
- Rate limiting/brute-force mitigations appropriate to the selected runtime.

Treat authentication as an opt-in module. Never imply that a starter auth sample is production-audited security software.

### 9.3 Issue #25 — JavaScript variants

Do not duplicate every template blindly. Decide the supported language dimension explicitly:

- Add JavaScript variants for the React/Vite frontend and supported Node.js backend paths first.
- Python and PHP are already in their native language ecosystems; the TypeScript/JavaScript choice should not appear for them unless it specifically applies to the frontend.
- Ensure every language choice updates scripts, file extensions, lint/typecheck commands, and documentation.
- Test TypeScript and JavaScript independently.

If this causes too much template duplication, investigate generating JavaScript from common template fragments or maintaining the smallest possible language-specific overlays.

---

## 10. Phase 6 — Mobile and desktop (v0.5 roadmap)

### Issue #21 — React Native + Expo

Treat mobile as its own project platform, not as a web frontend whose `client` folder is swapped. Define the API integration and environment strategy for connecting to an independently generated backend. Make clear that mobile apps run on devices and require reachable API endpoints; `localhost` in an emulator/device is not equivalent to localhost on the user's development PC.

Begin with one minimal Expo starter, then add API client configuration and optional shared types only after they are tested.

### Issue #22 — Tauri desktop

Treat Tauri as a distinct platform with native/Rust build prerequisites and platform-specific packaging considerations. First generate and build the simplest supported desktop project. Add a backend/database only when there is a clearly documented local-versus-remote architecture; avoid implying that a web backend automatically runs inside Tauri.

### Exit criteria

Each platform has a dedicated adapter, preflight prerequisite check, generated README, and at least one CI smoke path. Do not mark mobile or desktop available merely because a template directory exists.

---

## 11. CLI experience improvements

Keep interactive prompts as the default. Flags are for automation and power users, not the primary product experience.

Recommended additions:

- **Review step:** show the exact architecture, frameworks, database, ORM, extras, install behavior, and destination before writing files.
- **Back/edit:** allow users to correct choices without restarting the wizard, if the current prompt library/workflow supports it cleanly.
- **Dry run:** compute and display the generation plan without writing files or running package managers.
- **Prerequisite checks:** show missing Node/Python/uv/PHP/Composer/Docker tools before generation instead of failing late.
- **Install choice:** distinguish scaffolding from dependency installation; explain network access and allow `--skip-install`.
- **Progress status:** say “generated,” “dependencies installed,” “build verified,” and “database operation tested” separately. Do not display one generic success state if a step failed.
- **Failure recovery:** preserve the generated folder when it is useful, give the exact failed command and next manual step, and avoid deleting data during cleanup.
- **Project status commands:** later add `omnicraft info` and `omnicraft doctor` after project metadata exists.
- **Non-interactive consistency:** `--yes` and flags should produce the same validated configuration as the interactive prompts. Invalid/incompatible flags should fail before filesystem mutation.

Do not add many flags simply for completeness. Every flag should have documented behavior and tests, and all interfaces should flow through the same configuration validator.

---

## 12. Suggested repository/source layout after hardening

Do not restructure everything at once. Use this as the target direction as related code changes occur.

```text
packages/cli/
├── src/
│   ├── index.ts
│   ├── args.ts
│   ├── types.ts
│   ├── prompts/
│   ├── catalog/                 # one capability registry
│   ├── project/                 # schema + architecture validation
│   ├── planning/                # deterministic generation plan
│   ├── scaffold/
│   │   ├── compose.ts
│   │   ├── engine.ts
│   │   ├── merge.ts
│   │   ├── renderer.ts
│   │   ├── remote.ts
│   │   └── transaction.ts       # stage, validate, finalize, recover
│   ├── adapters/
│   │   ├── vite-react/
│   │   ├── nextjs/              # when implemented
│   │   └── react-router/        # only after research decision
│   ├── integrations/
│   │   ├── database/
│   │   ├── orm/
│   │   ├── styling/
│   │   └── quality/
│   └── commands/                # future add/info/doctor commands
├── templates/
├── scripts/
│   ├── smoke-e2e.ts
│   └── verify-package.ts
└── tests/
    ├── unit/
    ├── composition/
    ├── integration/
    └── generated-projects/
```

The current folder structure is already reasonably modular. The target is about responsibilities, not mandatory folder names. Avoid premature packages/plugins or a general-purpose hook system until there are proven extension needs.

---

## 13. Recommended test matrix and definition of done

### Required tests

| Area             | Minimum verification                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| CLI input        | Name normalization, flags, `--yes`, invalid combinations, no-TTY behavior                              |
| Compatibility    | All unsupported runtime/framework/ORM/database combinations rejected before writes                     |
| File system      | Existing/non-empty directories, collisions, `.env`, `.git`, cancellation, staging rollback             |
| Composition      | Same content, intentional merge, file conflict, manifest conflict, nested paths                        |
| Tokens           | Missing variable, unresolved token, special characters in variable values                              |
| Templates        | Every advertised template exists; no undocumented required layer                                       |
| Cross-platform   | Windows, Linux, macOS path handling and scripts where supported                                        |
| Package          | Packed artifact includes `dist` and templates; clean temp install launches the binary                  |
| Build            | Clean install + typecheck/lint/build for each distinct supported combination                           |
| Database         | Migrate/seed and basic CRUD where database-backed behavior is advertised                               |
| Remote templates | Pinned revision, bad schema/version, network failure, corrupted/incompatible payload                   |
| Security         | No committed secrets, no path escape, no command injection via user strings, safe workflow permissions |

### “Ready to release” checklist

- [ ] README, CLI help, capability registry, and generated matrix agree.
- [ ] All available choices are backed by passing tests and documented prerequisites.
- [ ] No unintentional file collision is silently overwritten.
- [ ] No unresolved template token can reach a generated project.
- [ ] The default templates are versioned with the CLI release.
- [ ] `--latest` has an explicit source/version and validates compatibility.
- [ ] `npm pack` has been inspected and the tarball has been tested from a clean directory.
- [ ] CI cannot run untrusted public PR code on a sensitive self-hosted runner.
- [ ] The release workflow verifies the actual published package.
- [ ] The changelog and roadmap reflect what shipped, not what is merely planned.

---

## 14. Updated roadmap proposal

Keep the existing issues where possible. Add new issues for cross-cutting gaps rather than hiding them under framework work. The suggested priority order is:

### Phase A — v0.3.x hardening / pre-v0.4 foundation

1. Establish `docs/index.md` and clarify root `AGENTS.md` as the concise project instruction entry point.
2. Add the core architecture, coding standards, development workflow, testing strategy, and documentation standards pages.
3. Fix README/help/capability inconsistencies.
4. Add generation-plan dry run and robust destination collision policy.
5. Add strict template conflict and unresolved-token validation.
6. Pin/version remote templates and record resolved revision.
7. Review public PR CI and self-hosted runner security.
8. Expand generated-project and packed-package tests.
9. Complete **#27 — Template composition guide** and the template-composition contract.
10. Add the authoritative capability registry and `.omnicraft/project.json` metadata.
11. Add reusable feature, stack, integration, implementation-plan, and ADR Markdown templates.

**Gate to exit:** generation is safe; advertised capability is accurate; the template contract is documented and tested; contributors/agents have one clear workflow to follow; CI enforces the highest-value rules.

### Phase B — v0.4.0 frontend architecture expansion

1. Implement **#17 — Next.js**, using explicit integrated-full-stack architecture.
2. Complete **#20 — framework evaluation** with a decision record; choose React Router Framework Mode or TanStack Start before coding both.
3. Implement the chosen framework as its own adapter if the evaluation passes.
4. Implement **#18 Vue** and **#19 Svelte** incrementally, sharing the registry and test contracts.

**Gate to exit:** each newly advertised frontend generates, installs, builds, and documents correctly.

### Phase C — v1.0 maturity features

1. Implement **#24 — `omnicraft add`** after manifest/contract work.
2. Implement **#23 — authentication** for a narrow, tested first stack with a maintained library/provider.
3. Implement **#25 — JavaScript variants** for selected JS-based frontend/backend stacks.
4. Add `omnicraft info` and `omnicraft doctor` if the project manifest and diagnostic utilities are stable.
5. Complete contribution guide, release automation, and public-package smoke tests.

**Gate to exit:** a stable, documented, tested generator and safe post-scaffold module workflow. Do not define v1.0 as “every imaginable stack exists.” Define it as a stable core with explicit support guarantees.

### Phase D — v0.5 platform expansion (can be scheduled according to demand)

- **#21 Expo** as a dedicated mobile platform adapter.
- **#22 Tauri** as a dedicated desktop platform adapter.

These may follow the maturity milestone if safety/quality needs attention first. Roadmap order is a business choice; do not let mobile/desktop delay fixing template corruption or CI security.

### Phase E — beyond v1.0

- More backend frameworks (NestJS, Django, Symfony, others) only with tested adapter contracts.
- More databases and ORMs, including MongoDB/Mongoose when a compelling end-to-end path exists.
- Community templates/plugin registry only after a trust, validation, versioning, and security model exists.
- Upgrade/update support only with a diff-first, non-destructive migration model.
- Opt-in telemetry only with transparent disclosure, privacy controls, and a clear reason to collect data.

---

## 15. Proposed additional GitHub issues

These are suggested issues, not existing GitHub issue IDs. Create them if they are not already tracked elsewhere.

1. **P0: Prevent destructive template collisions and stage generation transactionally**
   - Default non-empty destination to refusal.
   - Plan collision summary and explicit file policy.
   - Never silently overwrite `.env`, `.git`, or user files.
   - Unit tests for failure rollback and all platforms.

2. **P0: Version and validate remote template releases**
   - Pin `--latest` to a release/tag/commit.
   - Validate schema compatibility.
   - Record exact revision in generated manifest.

3. **P0: Generate compatibility matrix and docs from one registry**
   - Remove duplicated availability lists.
   - Sync prompt choices, flags, compose rules, tests, README.

4. **P0: Security review of self-hosted Windows PR CI**
   - Move untrusted PRs to hosted runners or restrict self-hosted runs to trusted events.
   - Minimal permissions and release credential separation.

5. **P1: Add `.omnicraft/project.json` manifest**
   - Record stack/template IDs and versions for inspection and post-scaffold modules.

6. **P1: Add package-tarball end-to-end test**
   - Pack, install in clean temporary workspace, generate, and verify the generated output.

7. **P1: Add generation dry-run and plan output**
   - Show files, manifest modifications, command executions, prerequisites, and conflicts before write.

8. **P1: Validate real database CRUD for supported stacks**
   - Use disposable test DBs/containers or dedicated integration jobs.

9. **P2: Add `omnicraft info` and `omnicraft doctor`**
   - Inspect the manifest, tools, environment configuration, and database connectivity without exposing secrets.

---

## 16. Implementation checklist index

Use **Section 20 — First pull requests to implement** as the authoritative PR-by-PR checklist. It combines the original repository-hardening tasks with the documentation/agent-governance work and avoids maintaining two subtly different checklists. Sections 4–13 define the technical requirements; Section 17 defines the documentation system; Section 18 defines the unified phase gates. If an implementation detail changes, update the authoritative checklist and its linked canonical documentation rather than copying the change into duplicate lists.

---

## 17. Documentation and coding-agent governance plan

This section defines how OmniCraft's development documentation should be organized and maintained. It is part of the engineering plan, not a separate documentation project: the documentation establishes the rules, source code implements them, and CI checks the parts that can be verified automatically.

### 17.1 Goals

- New features follow the same planning, implementation, testing, and documentation process.
- New stacks and integrations follow a repeatable template contract rather than contributor preference.
- Coding agents receive concise, relevant instructions and are directed to deeper references only when needed.
- Documentation describes the code that exists today, distinguishing supported, experimental, planned, and deprecated capabilities.
- The CLI prompts, compatibility resolver, composition engine, tests, README, and support matrix do not drift apart.
- Architecture decisions are recorded once and linked from relevant instructions.
- CI enforces deterministic rules instead of relying exclusively on Markdown instructions.

### 17.2 Target documentation structure

The following is the target structure, to be introduced incrementally. It is not a requirement to create empty pages for every future area immediately. Preserve existing documentation and demo assets in `docs/`; merge them into this structure where appropriate rather than deleting or moving them without a reason.

```text
omnicraft/
├── AGENTS.md
├── README.md
├── CONTRIBUTING.md
├── ROADMAP.md
├── CHANGELOG.md
├── docs/
│   ├── index.md
│   ├── product/
│   │   ├── vision.md
│   │   ├── scope-and-non-goals.md
│   │   └── terminology.md
│   ├── architecture/
│   │   ├── system-overview.md
│   │   ├── repository-structure.md
│   │   ├── cli-lifecycle.md
│   │   ├── template-engine.md
│   │   └── compatibility-model.md
│   ├── development/
│   │   ├── coding-standards.md
│   │   ├── naming-conventions.md
│   │   ├── feature-development-workflow.md
│   │   ├── testing-strategy.md
│   │   ├── dependency-management.md
│   │   └── documentation-standards.md
│   ├── cli/
│   │   ├── interactive-flow.md
│   │   ├── command-line-options.md
│   │   └── configuration-schema.md
│   ├── templates/
│   │   ├── template-contract.md
│   │   ├── composition-and-merge-rules.md
│   │   ├── tokens-and-rendering.md
│   │   ├── generated-project-conventions.md
│   │   ├── adding-a-stack.md
│   │   ├── adding-an-integration.md
│   │   └── stack-support-matrix.md
│   ├── security/
│   │   ├── filesystem-safety.md
│   │   ├── subprocess-safety.md
│   │   └── secrets-and-environment.md
│   ├── quality/
│   │   ├── ci-cd.md
│   │   ├── release-process.md
│   │   └── compatibility-testing.md
│   ├── decisions/
│   │   ├── README.md
│   │   └── 0001-template-composition.md
│   ├── plans/
│   │   ├── active/
│   │   └── completed/
│   └── _templates/
│       ├── feature-spec.template.md
│       ├── stack-spec.template.md
│       ├── integration-spec.template.md
│       ├── implementation-plan.template.md
│       └── adr.template.md
├── packages/
│   └── cli/
│       ├── AGENTS.md
│       └── src/
│           ├── scaffold/AGENTS.md
│           └── prompts/AGENTS.md
└── .github/
    ├── PULL_REQUEST_TEMPLATE.md
    └── workflows/
```

`packages/cli/templates/` contains generated-project templates; it is not the same as `docs/_templates/`, which contains reusable Markdown document templates. Do not confuse these two systems.

### 17.3 Responsibilities of the core documents

| File                                               | Contract / responsibility                                                                                                          |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                                        | Concise repository-wide rules, key commands, repository map, non-negotiable requirements, and links to relevant deeper docs.       |
| `README.md`                                        | User-facing overview, installation, quick start, real current support status, examples, and links to detailed guides.              |
| `CONTRIBUTING.md`                                  | Human contribution process, local setup, checks, issue/PR expectations, and review criteria.                                       |
| `ROADMAP.md`                                       | Planned milestones and links to tracked issues; never describe a proposal as an implemented feature.                               |
| `CHANGELOG.md`                                     | User-visible changes per release, including additions, fixes, deprecations, and breaking changes.                                  |
| `docs/index.md`                                    | Documentation directory, audience, reading paths, and links to each maintained guide.                                              |
| `docs/product/vision.md`                           | Long-term OmniCraft goal and product principles.                                                                                   |
| `docs/product/scope-and-non-goals.md`              | What belongs in OmniCraft and what intentionally remains out of scope.                                                             |
| `docs/product/terminology.md`                      | Canonical terms such as stack, architecture, adapter, integration, template layer, supported, experimental, and generated project. |
| `docs/architecture/system-overview.md`             | Main components, their responsibilities, and data flow.                                                                            |
| `docs/architecture/repository-structure.md`        | Purpose and ownership of source directories; where new files should live.                                                          |
| `docs/architecture/cli-lifecycle.md`               | Command entry, prompts, validation, plan, composition, install, verification, and reporting.                                       |
| `docs/architecture/template-engine.md`             | Template resolution, ordering, copying, rendering, composition, and failure handling.                                              |
| `docs/architecture/compatibility-model.md`         | How combinations of frontend, architecture, backend, database, ORM, and extras are resolved.                                       |
| `docs/development/coding-standards.md`             | TypeScript safety, modularity, error handling, async/subprocess handling, comments, and quality standards.                         |
| `docs/development/naming-conventions.md`           | Source files, directories, identifiers, package scripts, template IDs, environment keys, and CLI terms.                            |
| `docs/development/feature-development-workflow.md` | Repeatable path from issue/spec to implementation, tests, documentation, and review.                                               |
| `docs/development/testing-strategy.md`             | Unit, integration, CLI, template, package-artifact, and end-to-end requirements.                                                   |
| `docs/development/dependency-management.md`        | Version ranges, lockfiles, upstream generator versions, package-manager behavior, and dependency upgrades.                         |
| `docs/development/documentation-standards.md`      | Which documents must change with source behavior, new stacks, new commands, or releases.                                           |
| `docs/cli/interactive-flow.md`                     | Prompt order, defaults, cancellation, back navigation, conditional prompts, and review step.                                       |
| `docs/cli/command-line-options.md`                 | Supported commands/flags, argument validation, help output, exit codes, and scriptable usage.                                      |
| `docs/cli/configuration-schema.md`                 | Canonical validated configuration and migration expectations when it changes.                                                      |
| `docs/templates/template-contract.md`              | Template metadata, IDs, versions, prerequisites, outputs, capabilities, and required tests.                                        |
| `docs/templates/composition-and-merge-rules.md`    | Layer ordering, duplicate paths, package scripts/dependencies merge, conflict policies, and intentional overrides.                 |
| `docs/templates/tokens-and-rendering.md`           | Allowed placeholders, escaping, missing values, unresolved-token failures, and file-name rendering.                                |
| `docs/templates/generated-project-conventions.md`  | Generated README, environment samples, scripts, folder conventions, lint/build/test scripts, and runtime boundaries.               |
| `docs/templates/adding-a-stack.md`                 | Required implementation and validation steps for a framework/runtime/backend stack.                                                |
| `docs/templates/adding-an-integration.md`          | Required process for optional database, ORM, auth, styling, test, Docker, or other integration.                                    |
| `docs/templates/stack-support-matrix.md`           | Supported/experimental/planned/deprecated combinations and the exact evidence required for each status.                            |
| `docs/security/*`                                  | Path safety, shell/process boundaries, secret handling, generated-code security, and safe defaults.                                |
| `docs/quality/*`                                   | CI behavior, release policy, compatibility tests, and published package verification.                                              |
| `docs/decisions/*`                                 | Durable architectural decisions, alternatives, consequences, and supersession history.                                             |
| `docs/plans/active/`                               | Temporary plans for meaningful active work. Move completed plans to `completed/` or link them from the PR/release record.          |
| `docs/_templates/*`                                | Reusable Markdown forms for feature specs, stack specs, integrations, plans, and ADRs.                                             |

### 17.4 Root and scoped `AGENTS.md` rules

The root `AGENTS.md` must remain concise and actionable. Preserve existing OmniCraft-specific instructions already present, including template-composition conventions, supported commands, testing expectations, and platform-specific pitfalls. Refactor it carefully; do not replace it with a generic instruction file.

The root file should contain:

1. Brief project purpose and key repository map.
2. Correct install, test, typecheck, build, smoke, and pack commands.
3. Non-negotiable rules, including no silent overwrites, strict token validation, support-matrix accuracy, no secret leakage, and truthful reporting of tests.
4. A task-to-document map so agents know what to read for a change.
5. Required completion checks and a summary of what to report.

Add scoped instructions only where they add directory-specific rules:

- `packages/cli/AGENTS.md`: package architecture, scripts, build/test commands, exported CLI behavior.
- `packages/cli/src/scaffold/AGENTS.md`: composition, file safety, merge policies, token rendering, test requirements.
- `packages/cli/src/prompts/AGENTS.md`: prompt sequencing, conditional choices, cancellation, defaults, and input/output parity.
- `packages/cli/templates/AGENTS.md`: template-layer structure, tokens, file ownership/overrides, generated project conventions, and required smoke tests.

Scoped instructions add to root rules; they must not contradict or restate all root content. Keep `AGENTS.md` files as instruction indexes, not as the only home for long technical reference material.

### 17.5 Task-to-document reading matrix

| Work type                            | Required reading before implementation                                                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Any change                           | Root `AGENTS.md`, relevant issue, `feature-development-workflow.md`, and nearest source-area guidance.                                         |
| New prompt or CLI option             | `cli/interactive-flow.md`, `cli/command-line-options.md`, `cli/configuration-schema.md`, coding standards, and tests.                          |
| New framework/backend stack          | `adding-a-stack.md`, `template-contract.md`, `composition-and-merge-rules.md`, `compatibility-model.md`, support matrix, and testing strategy. |
| New ORM/database/auth/UI integration | `adding-an-integration.md`, template contract, compatibility model, security docs relevant to the integration, and test strategy.              |
| Template-engine change               | `template-engine.md`, `template-contract.md`, merge rules, tokens/rendering, filesystem safety, and regression tests.                          |
| Dependency/version upgrade           | dependency-management, support matrix, compatibility tests, and release docs if public behavior changes.                                       |
| Security-sensitive code              | relevant security guides, abuse/failure-path tests, and a careful review of command/path/credential flows.                                     |
| CI or release changes                | `quality/ci-cd.md`, `quality/release-process.md`, package metadata and security guidance.                                                      |
| Documentation-only change            | documentation standards; verify examples and internal links where possible.                                                                    |

Agents should not be instructed to read every page for every task. The root rules should point to the right subset based on task type.

### 17.6 Standard workflow for every feature

`docs/development/feature-development-workflow.md` should prescribe this sequence:

1. **Understand:** read the issue and relevant instructions; inspect actual source and current tests; state behavior, scope, non-goals, and unknowns.
2. **Plan:** identify affected code, template layers, public CLI behavior, compatibility effects, security concerns, and documentation. Write an active plan for complex work.
3. **Specify:** for non-trivial work, write or update a feature specification with user experience, acceptance criteria, failure behavior, compatibility, and test plan.
4. **Implement:** make the smallest complete change using established abstractions; avoid unrelated refactors and duplicated capability rules.
5. **Test:** run applicable unit, integration, generated-project, regression, and security tests. If a check cannot run, report it explicitly rather than implying success.
6. **Document:** update the relevant guides, matrix, README/help, ADR, roadmap, and changelog only when appropriate to the change.
7. **Review:** inspect diff for accidental changes, unresolved tokens, secrets, destructive commands, broken links, and drift between advertised and actual support.
8. **Report:** summarize files changed, behavior, tests actually run, known limitations, and follow-up work.

Use risk-based depth. A small typo fix does not require a new implementation plan; a new stack, generator lifecycle change, or public command generally does.

### 17.7 Standard workflow for adding a new stack

Every stack addition follows the same contract, regardless of the framework or runtime:

1. Research official setup, supported runtime/framework versions, system prerequisites, license/maintenance status, and deployment/runtime constraints.
2. Write `docs/_templates/stack-spec.template.md` into a concrete stack specification for proposed/complex work.
3. Define stack ID, display name, status, capabilities, prerequisites, dependencies, runtime, supported architectures, compatible database/ORM/integration combinations, and verification commands.
4. Register it in the authoritative capability registry; prompt choices, flag validation, composition, support-matrix output, and test generation must consume that same source or well-defined derived data.
5. Implement the template or official-generator adapter under the established directory convention. Keep upstream generator-specific behavior behind an adapter.
6. Define file ownership, explicit overrides, package.json merge behavior, template tokens, environment variables, scripts, README instructions, and security boundaries.
7. Add tests for compatibility success and failure, composition, collisions, missing prerequisites, generation into clean directories, and expected files.
8. Run clean installation/build and targeted runtime/database checks required by the claimed support level.
9. Update the support matrix, README, user-facing help, changelog, and architecture guide in the same change.
10. Mark as `Supported` only when all defined acceptance checks pass; otherwise mark `Experimental` or `Planned` accurately.

### 17.8 Standard workflow for adding an integration

Integrations such as Drizzle, Prisma, SQLAlchemy, Eloquent, authentication, Tailwind, testing, Docker, or CI follow a parallel but distinct process:

1. Define what the integration adds and the user problem it solves.
2. Declare compatible stack IDs and disallowed combinations.
3. Declare required package dependencies, generated files, script changes, environment variables, and prerequisites.
4. Define composition/merge behavior and how existing files are handled.
5. Generate an example of actual use when the integration implies runtime behavior (e.g., one database operation or auth-protected route).
6. Add tests for the integration alone and its supported stack combinations.
7. Document setup, local verification, production caveats, security settings, and removal/upgrade considerations where applicable.
8. Only advertise combinations that have passed their minimum verification contract.

### 17.9 Reusable Markdown templates

Create and maintain these reusable files only when the corresponding workflows are ready:

- `docs/_templates/feature-spec.template.md`: problem, users, desired behavior, scope/non-goals, UX/CLI flow, compatibility, edge cases, security, acceptance criteria, and test plan.
- `docs/_templates/stack-spec.template.md`: status, runtime/framework versions, capabilities, prerequisites, compatibility, template layout, environment setup, commands, security, tests, docs, acceptance criteria.
- `docs/_templates/integration-spec.template.md`: purpose, compatible stacks, dependencies, files/scripts/environment, merge policy, security, tests, and removal/upgrade behavior.
- `docs/_templates/implementation-plan.template.md`: background, goals/non-goals, phases, files/modules affected, implementation sequence, risks, tests, docs, rollout, and acceptance criteria.
- `docs/_templates/adr.template.md`: status, context, decision, alternatives, consequences, compatibility/migration.

Do not create a new plan/spec for every trivial change. Templates are for meaningful features, architectural choices, integrations, and stack additions.

### 17.10 Architecture Decision Records

Use `docs/decisions/` for decisions that are expensive or confusing to reverse. Candidates include template composition vs official-generator strategy, capability-registry design, architecture modeling, remote-template versioning, package-manager support, project metadata, and module-add behavior.

An ADR should record context, chosen decision, alternatives, consequences, compatibility/migration impact, and status (`Proposed`, `Accepted`, `Superseded`). Routine implementation details belong in code/docs instead. When a decision changes, create a superseding ADR rather than quietly rewriting history.

### 17.11 Documentation maintenance rules

- `README.md` describes only what the current release actually supports; use “planned” or “experimental” where appropriate.
- `ROADMAP.md` describes future work and links to issues. Completing an issue should update the roadmap in the same PR when the roadmap is affected.
- `CHANGELOG.md` records user-visible changes per release; do not pre-announce unreleased work as shipped.
- The support matrix must be derived from the capability registry when feasible, rather than updated manually in multiple places.
- Any new public command/flag must update command docs, help behavior, tests, and examples.
- Any new template or integration must update its specific guide and compatibility data.
- Architecture changes must update system/repository diagrams or descriptions and add an ADR when the decision is durable/significant.
- Keep command examples runnable and aligned with actual scripts; CI should test critical examples where feasible.
- Avoid duplicating the same detailed explanation across README, AGENTS, and multiple guides. Use links to the authoritative page.
- Clearly distinguish verified facts, proposals, and untested assumptions.

### 17.12 CI enforcement for documentation and standards

Markdown instructions cannot guarantee compliance alone. Add automated enforcement incrementally:

1. **Typecheck/lint/unit tests:** current basic checks remain required.
2. **Capability consistency:** every option advertised as supported must map to a real registered generator/composition path.
3. **Template token validation:** fail on unresolved or unknown mandatory tokens; test valid and invalid cases.
4. **Merge-conflict tests:** detect undeclared file collisions and invalid package-manifest merges while permitting explicitly declared overrides.
5. **Support-matrix validation:** ensure generated docs and CLI availability match registry status.
6. **Generated-project smoke tests:** generate representative or all feasible supported combinations, install, and build.
7. **Documentation links and structure:** check internal links, required headings/front matter if adopted, and references to moved files.
8. **Published package tests:** pack the CLI, install that exact tarball in a clean temp directory, run it, and verify generated output.
9. **Security checks:** avoid executing untrusted public pull-request code on a sensitive self-hosted runner; review workflow permissions and secrets.

Start with high-value deterministic checks. Avoid building a bespoke documentation framework before simple scripts and existing tooling prove inadequate.

### 17.13 Development-documentation acceptance criteria

The documentation-governance work is complete when:

- [ ] Root `AGENTS.md` points to the correct task-specific docs and preserves current repository rules.
- [ ] `docs/index.md` links to every active canonical engineering guide.
- [ ] Architecture and repository maps match the actual source tree.
- [ ] Coding, naming, feature, testing, dependency, and documentation standards are written and actionable.
- [ ] Template contract, merge/token rules, stack-add, and integration-add procedures are available before a new stack is added.
- [ ] Feature/stack/integration/plan/ADR templates exist and are used where warranted.
- [ ] Support terminology (`Planned`, `Experimental`, `Supported`, `Deprecated`) is consistent.
- [ ] New-stack guidance requires compatibility registration, generated-project checks, and documentation updates.
- [ ] CI enforces the highest-value machine-checkable rules.
- [ ] No document claims a feature or stack is supported unless the current implementation meets the documented bar.

---

## 18. Unified implementation phases for code and documentation

This combines the repository-hardening plan with the Markdown/agent-governance plan. Each phase should be delivered as small PRs, with docs and code changed together where applicable.

### Phase 0 — Establish the working baseline

- [ ] Confirm the active branch and compare this plan against current source, issues, and npm release state.
- [ ] Capture the real command list and current passing test/build results.
- [ ] Identify existing documentation and retain useful assets; do not create duplicate guide pages.
- [ ] Add `docs/index.md` and a compact map of canonical documentation.
- [ ] Review existing root `AGENTS.md` and preserve all valid OmniCraft-specific instructions.

**Exit gate:** contributors and coding agents can find the correct commands and canonical guidance, and the baseline accurately reflects current code.

### Phase 1 — Documentation baseline and capability parity

- [ ] Add system overview and repository structure guides.
- [ ] Add coding standards, naming conventions, feature workflow, testing strategy, and documentation standards.
- [ ] Reconcile CLI prompts/flags, composition options, smoke matrix, README, and roadmap.
- [ ] Define support statuses and the minimum bar for `Supported`.
- [ ] Create an authoritative capability registry or formalize the existing source if it already exists.

**Exit gate:** users, maintainers, tests, and documentation agree on what the current release can generate.

### Phase 2 — Generation correctness and safety

- [ ] Implement generation planning/dry run before filesystem writes.
- [ ] Define empty/non-empty destination behavior and explicit file collisions.
- [ ] Protect user-owned files, `.env`, `.git`, and unrelated lock/config files.
- [ ] Stage output and define safe rollback/recovery.
- [ ] Validate paths, template tokens, and required variables.
- [ ] Test network failures, cancellation, installer failures, and cross-platform paths.

**Exit gate:** invalid configurations fail before writes; collisions are explicit; failures are honest and recoverable.

### Phase 3 — Template contract and reproducibility

- [ ] Complete issue #27's contributor/template composition guide.
- [ ] Add a versioned template manifest and schema validation.
- [ ] Define file overrides and package manifest/script merge semantics.
- [ ] Pin or record remote template revision; avoid silent mutable-`main` generation.
- [ ] Add project metadata under `.omnicraft/project.json`.
- [ ] Add stack/integration spec templates and scoped template `AGENTS.md` rules.

**Exit gate:** template composition is documented, versioned, testable, and reproducible.

### Phase 4 — CI, security, and release verification

- [ ] Keep untrusted public PR code off sensitive self-hosted runners.
- [ ] Test supported Node versions, including the declared minimum.
- [ ] Generate the test matrix from the registry.
- [ ] Install/build generated projects for each supported combination or a justified representative matrix.
- [ ] Add targeted database CRUD verification for database claims.
- [ ] Test the actual npm tarball in a clean environment.
- [ ] Document and automate release steps and verify the published artifact.

**Exit gate:** the release process demonstrates package and generated-project behavior, not merely source-level unit tests.

### Phase 5 — `omnicraft add` and project inspection

- [ ] Require/validate project manifest where appropriate.
- [ ] Start with a lower-risk integration such as testing or Docker.
- [ ] Add dry run, idempotency, conflict detection, file protection, and rollback behavior.
- [ ] Add `omnicraft info` and `omnicraft doctor` only after metadata and diagnostics are reliable.
- [ ] Add CRUD and authentication modules after contracts/security/testing are mature.

**Exit gate:** module additions preserve user code, can be previewed, and do not duplicate changes on repeated runs.

### Phase 6 — React framework expansion

- [ ] Implement Next.js using an explicit integrated-full-stack architecture model.
- [ ] Create an ADR for React Router Framework Mode vs TanStack Start before implementing the next option.
- [ ] Implement the selected framework adapter with clear upstream-generator/version strategy.
- [ ] Verify database operations in server-safe modules.
- [ ] Add Vue and Svelte one at a time after shared contracts are stable.

**Exit gate:** every newly advertised frontend generates, installs, builds, and has accurate setup docs.

### Phase 7 — Maturity and platform expansion

- [ ] Add maintained authentication integration for a narrow supported stack.
- [ ] Add JavaScript variants where they can be maintained without duplicating templates unnecessarily.
- [ ] Add Expo and Tauri as separate platform adapters.
- [ ] Expand databases/backend frameworks only through the same contract and verification process.
- [ ] Define v1.0 around reliability, stable contracts, and explicit support guarantees—not an unlimited framework checklist.

---

## 19. Suggested GitHub issue organization

Keep existing issues #17–#27 where they still match current work. Before opening duplicates, verify whether each is already completed, closed, or superseded. Group the work with labels or milestones such as:

- `P0: safety` — file collisions, path validation, generation transaction, token validation.
- `P0: CI/security` — public PR runner review, package artifact verification, permissions.
- `P1: docs/governance` — canonical docs, AGENTS rules, feature workflow, stack/integration templates.
- `P1: templates` — manifest, merge contract, remote template pinning, project metadata.
- `P1: capability-registry` — align CLI options, composition, tests, and generated support matrix.
- `P1: module-add` — `omnicraft add` with safety/idempotency.
- `P2: frontend` — Next.js, framework decision, Vue, Svelte.
- `P2: product-expansion` — auth, JS variants, Expo, Tauri.

Each issue should include: problem, scope/non-goals, affected areas, acceptance criteria, test plan, documentation updates, dependency blockers, and a link to the relevant guide. The issue should not duplicate the entire engineering document; it should link to the canonical standard.

---

## 20. First pull requests to implement

### PR 1 — Documentation foundation and capability parity

- [ ] Add `docs/index.md` and link the active canonical guides.
- [ ] Add system overview, repository map, coding standards, feature workflow, testing strategy, and documentation standards.
- [ ] Preserve/refactor root `AGENTS.md`; add task-specific read pointers.
- [ ] Reconcile prompt choices, validation, composition, smoke tests, README, and ROADMAP.
- [ ] Establish support statuses and the actual generated/tested matrix.
- [ ] Add a CI assertion that every advertised supported combination is registered and composable.

### PR 2 — Safe destinations and collision behavior

- [ ] Generate/print a plan before file writes.
- [ ] Refuse unsafe non-empty targets by default and explain exact collisions.
- [ ] Never silently overwrite user-owned config or secrets.
- [ ] Define rollback/partial-output behavior.
- [ ] Add cross-platform tests for failure and cancellation paths.

### PR 3 — Template contract and authoring guide

- [ ] Complete issue #27.
- [ ] Define manifest schema, template ID/version, prerequisites, capabilities, and compatibility.
- [ ] Define file ownership, allowed overrides, package dependency/script merge policies.
- [ ] Reject unresolved or unknown required tokens.
- [ ] Add `docs/templates/adding-a-stack.md` and `adding-an-integration.md`.
- [ ] Add reusable stack/integration spec templates.

### PR 4 — Remote templates and project metadata

- [ ] Stop silently relying on mutable `main` for reproducible output.
- [ ] Identify source/version/commit used and check schema compatibility.
- [ ] Add `.omnicraft/project.json` with framework, architecture, selected templates, revisions, and generator version.
- [ ] Add tests for network error, incompatible remote schema, and fallback behavior.

### PR 5 — CI and npm artifact hardening

- [ ] Separate untrusted PR validation from trusted self-hosted/release jobs.
- [ ] Test supported Node versions and platform-specific behavior.
- [ ] Derive generation matrix from the capability registry.
- [ ] Pack and install the actual tarball in a clean workspace.
- [ ] Add install/build/runtime/DB tests matching each support claim.
- [ ] Document release and changelog rules.

### PR 6 — Framework expansion decision and Next.js

- [ ] Add architecture kinds for frontend-only, integrated full-stack, and separate frontend/API.
- [ ] Record the official-generator vs owned-template decision in an ADR.
- [ ] Implement the Next.js adapter with pinned/tested initializer behavior where appropriate.
- [ ] Add a supported database integration in server-only code.
- [ ] Test and document the generated result.

### PR 7 — `omnicraft add`

- [ ] Require project identification/manifest and validate compatibility.
- [ ] Provide dry-run preview, idempotency, merge/conflict policies, and safe failure behavior.
- [ ] Start with testing or Docker before higher-risk CRUD/auth integrations.
- [ ] Test repeated execution and existing-file conflicts.

### PR 8+ — New stacks and platforms

- [ ] Complete framework decision ADR.
- [ ] Add one new frontend/platform at a time.
- [ ] Follow stack/integration spec templates and scoped `AGENTS.md` instructions.
- [ ] Update registry, docs, generated examples, and CI matrix in the same PR.
- [ ] Do not label the stack supported until its acceptance criteria pass.

---

## 21. Final recommendations

1. **Preserve the current composable-template engine.** It fits OmniCraft's cross-stack goal and avoids forcing all stacks through one framework's assumptions.
2. **Adopt official generators selectively.** Use them when the framework is complex and their starter is worth delegating; do not rewrite stable current templates just for architectural purity.
3. **Make safety and reproducibility the next release focus.** File overwrites, unversioned remote templates, and limited end-to-end coverage are more urgent than adding another framework.
4. **Use one registry as the source of truth.** The CLI, tests, generated metadata, docs, and future modules must agree on what each stack supports.
5. **Model integrated full-stack separately from frontend + API.** This is necessary before adding Next.js, React Router, or TanStack Start.
6. **Make `omnicraft add` the next flagship feature after the template contract.** It can turn OmniCraft from a one-time scaffold command into a project composition tool, provided it is safe and idempotent.
7. **Define v1.0 by reliability, not by completion of an endless framework list.** Stable contracts, compatibility guarantees, security, testable templates, and safe module additions are a stronger v1.0 bar than “everything implemented.”

The next concrete action should be **PR 1: capability/documentation parity**, followed by **PR 2: destination and collision safety**. These are small enough to review separately and directly reduce the risk of confusing users or damaging existing projects.

---

## 22. Sources reviewed

- Repository: https://github.com/doofx0071/omnicraft
- README: https://github.com/doofx0071/omnicraft/blob/main/README.md
- Roadmap: https://github.com/doofx0071/omnicraft/blob/main/ROADMAP.md
- Open issues: https://github.com/doofx0071/omnicraft/issues
- CLI package manifest: https://github.com/doofx0071/omnicraft/blob/main/packages/cli/package.json
- CLI entrypoint: https://github.com/doofx0071/omnicraft/blob/main/packages/cli/src/index.ts
- Prompt flow: https://github.com/doofx0071/omnicraft/blob/main/packages/cli/src/prompts/run-prompts.ts
- Composition map: https://github.com/doofx0071/omnicraft/blob/main/packages/cli/src/scaffold/compose.ts
- File composition engine: https://github.com/doofx0071/omnicraft/blob/main/packages/cli/src/scaffold/engine.ts
- Package manifest merge: https://github.com/doofx0071/omnicraft/blob/main/packages/cli/src/scaffold/merge.ts
- Token renderer: https://github.com/doofx0071/omnicraft/blob/main/packages/cli/src/scaffold/renderer.ts
- Remote template fetch: https://github.com/doofx0071/omnicraft/blob/main/packages/cli/src/scaffold/remote.ts
- Smoke generation matrix: https://github.com/doofx0071/omnicraft/blob/main/packages/cli/scripts/smoke-e2e.ts
- CI workflow: https://github.com/doofx0071/omnicraft/blob/main/.github/workflows/ci.yml
- Issue #27 template guide: https://github.com/doofx0071/omnicraft/issues/27
- Issue #24 add module: https://github.com/doofx0071/omnicraft/issues/24
- Issue #23 auth: https://github.com/doofx0071/omnicraft/issues/23
- Issue #17 Next.js: https://github.com/doofx0071/omnicraft/issues/17
- Issue #20 framework evaluation: https://github.com/doofx0071/omnicraft/issues/20
