# 🗺️ OmniCraft Roadmap

> **Versioning model:** `v1.0.0` is the first stable release. As checked on 2026-11-01, npm `latest` is `1.0.2`, published from Git commit `b359b91`, and GitHub tag `v1.0.2` points to that same commit. The repository's next release candidate is `v1.0.5`; v1.0.3 was tagged and v1.0.4 was prepared in the repository, but neither was published to npm. Future releases follow semver; release versions do not mean every selectable stack combination is fully verified.
>
> Progress is tracked with GitHub issues — this file is the big picture, the issues are the work. Check off here when the linked issue closes.

## Progress overview

| Version | Theme                                        | Progress             | Issues  |
| ------- | -------------------------------------------- | -------------------- | ------- |
| v0.1.0  | Public launch                                | ✅ 6/6               | #1–#6   |
| v0.2.0  | Scaffolder hardening                         | ✅ 5/5               | #7–#11  |
| v0.3.0  | Backend & database expansion                 | ✅ 5/5               | #12–#16 |
| v0.3.1  | Hardening (master-plan PR 2/3/5)             | ✅ tag               | —       |
| v0.4.0  | Frontend expansion                           | ✅ 4/4               | #17–#20 |
| v0.5.0  | Platform expansion (mobile, desktop)         | ✅ 2/2               | #21–#22 |
| v1.0.0  | First stable release                         | ✅ 5/5               | #23–#27 |
| v1.0.1  | SQLite first-run fix                         | ✅ published         | —       |
| v1.0.2  | Reliability fixes and runtime evidence       | ✅ published         | —       |
| v1.0.3  | Laravel Livewire, auth, and runtime evidence | 🟡 consolidated into v1.0.5 | —       |
| v1.0.4  | Laravel Inertia React scaffolding            | 🟡 consolidated into v1.0.5 | —       |
| v1.0.5  | Auth integrations and verified stack updates | 🟡 release candidate | —       |

---

## v0.1.0 — Public launch

Ship what works today and start the feedback loop. CI now uses hosted runners for public pull requests and also runs trusted push/same-repository jobs on the self-hosted Windows runner; see `.github/workflows/ci.yml`.

- [x] #1 — Set up self-hosted Windows runner for this repo
- [x] #2 — CI workflow: typecheck, build, test, template e2e smoke
- [x] #3 — Publish `create-omnicraft` v0.1.0 to npm
- [x] #4 — README launch polish: badges, install section, demo placeholder
- [x] #5 — Verify published package end-to-end (`npx create-omnicraft@latest`)
- [x] #6 — Decide repo visibility for `--latest` template fetching _(repo is public)_

## v0.2.0 — Scaffolder hardening

Make the CLI pleasant to script and the generated projects trustworthy.

- [x] #7 — Non-interactive mode: `--yes` and stack flags
- [x] #8 — Update check: notify when a newer `create-omnicraft` exists
- [x] #9 — Generated projects ship their own CI workflow
- [x] #10 — Friendlier DB connection errors + troubleshooting in generated README
- [x] #11 — Lint generated project output in CI

## v0.3.0 — Backend & database expansion

Widen the matrix, deepest-demand first. Order within the phase: SQLite (no Docker needed = fastest first run) → Hono (cheap — framework and ORM layers are already separated) → MySQL → Python (proves the multi-runtime architecture) → Laravel (stretch).

- [x] #12 — SQLite via Drizzle — zero-docker local dev option
- [x] #13 — Hono backend (Node + Drizzle)
- [x] #14 — MySQL database option (Drizzle + Prisma)
- [x] #15 — Python backend runtime: FastAPI + SQLAlchemy/Alembic
- [x] #16 — Laravel backend runtime (stretch)

## v0.4.0 — Frontend expansion

- [x] #17 — Next.js frontend (fullstack-in-one path — changes the prompt flow)
- [x] #18 — Vue + Vite frontend
- [x] #19 — Svelte + Vite frontend
- [x] #20 — Evaluate TanStack Start / React Router v7 as an option

## v0.5.0 — Platform expansion

The "What are you building?" branches become real.

- [x] #21 — Mobile app scaffolding: React Native + Expo
- [x] #22 — Desktop app scaffolding: Tauri

## v1.0.0 — First stable release

Published on 2026-10-27. Issue #27 was delivered early with the template contract, stack/integration guides, support matrix, and test workflow; the issue is closed.

- [x] #23 — Auth boilerplate wired to the users table
- [x] #24 — `omnicraft add <module>` post-scaffold generator
- [x] #25 — JavaScript (non-TypeScript) template variants
- [x] #26 — Multi-OS CI once repo is public _(done early — repo is public, all 3 OS green)_
- [x] #27 — Contributor docs: template composition guide _(delivered across `docs/templates/` and `docs/architecture/template-engine.md`; issue closed)_

## v1.0.5 — Release candidate

The repository baseline is version 1.0.4; npm `latest` remains 1.0.2. This candidate consolidates
the earlier v1.0.3 and v1.0.4 candidate scopes with the Supabase Auth and Laravel Sanctum changes
merged to `main`. It is the next version to publish to npm; the earlier versions were not published
as npm releases.

The release includes the exact supported combinations documented in the
[stack support matrix](docs/templates/stack-support-matrix.md): Laravel 13 + Livewire 4 and Laravel
13 + Inertia React on SQLite, each with `None` or Fortify; creation-time Better Auth for React/Vite
TypeScript + Express + Drizzle on SQLite, PostgreSQL, and MySQL; Supabase Auth for React/Vite
TypeScript frontend-only apps using the Supabase Data API and user-scoped RLS; and Laravel 12 API
Sanctum SPA sessions for React/Vite TypeScript + SQLite, PostgreSQL, and MySQL. PostgreSQL and MySQL
auth evidence is limited to the pinned test images, and Laravel sessions remain file-based. No
managed-provider, third-party JWT bridge, or other Laravel mode is implied by these rows. Deferred
targets remain in the active
[auth next-target plan](docs/plans/active/omnicraft-auth-provider-php-next-targets-plan.md).

The `omnicraft add testing` evidence covers 260 compatible React/Vite paths, including six earlier
checks and 254 additional paths. Fifty-two JavaScript + shadcn paths reject before writing because
the templates lack required aliases. These results concern the testing module only and do not
establish backend or database support. Expo Android-emulator/iOS-simulator checks and Tauri desktop
checks remain Scaffold-verified; physical Android/iOS paths remain Selectable — unverified.

The release PR must pass the `supported-stack-release-gate` on its exact versioned commit before it
is merged. Pushing the matching `v1.0.5` tag will trigger the npm publishing workflow.

## v1.0.3 and v1.0.4 — candidate scopes consolidated into v1.0.5

The v1.0.3 tag and repository-only v1.0.4 candidate captured separate stages of this work. Neither
version was published to npm. Their changes are included in the v1.0.5 candidate above.

## v1.1.x and beyond — post-v1 priorities

These are follow-up priorities, not release commitments. The post-masterplan audit, testing-infrastructure,
stack-runtime-evidence, and React/Vite `add testing` follow-up plans are archived under
`docs/plans/completed/`; their remaining physical-device scope is tracked in the active
[native platform evidence follow-up](docs/plans/active/omnicraft-native-platform-evidence-follow-up-plan.md).
Track roadmap-only features as issues before implementation:

- [x] Keep README, changelog, roadmap, CLI help, and the support matrix aligned with implementation evidence.
- [x] Derive prompt and flag choices from the typed capability registry; reject unsupported combinations before writing files.
- [x] Require evidence mappings for Supported rows and gate release on the complete supported runtime matrix.
- [x] Exercise compatible React/Vite `omnicraft add testing` paths and reject unsupported JavaScript + shadcn paths before writes; see the completed runtime plans.
- [ ] Add physical Android/iOS device evidence if a device runner or attached devices become available; emulator/simulator results do not cover physical devices.
- [x] Narrow the JavaScript language contract to the implemented React/Vite client and reject unsupported frontend/platform choices.
- [x] Tighten `omnicraft add auth` compatibility and regression coverage for the existing Better Auth path.
- Add `omnicraft doctor` only after project metadata and diagnostic checks have reliable contracts.
- Consider a community template registry, telemetry, a third-party plugin API, and a documentation site after core compatibility and verification gaps are closed.

---

**How to work a phase:** define its scope and evidence in an issue, complete and verify that work, update the support matrix and related docs in the same change, then bump `packages/cli/package.json` and publish when the phase is a release. Use semver after `1.0.0`; do not treat the roadmap as a claim that all selectable combinations are equally verified.
