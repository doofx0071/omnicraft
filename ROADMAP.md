# 🗺️ OmniCraft Roadmap

> **Versioning model:** `v1.0.0` is the first stable release. As checked on 2026-10-28, npm `latest` is `1.0.1`; its published metadata points to Git commit `7bd8868`, and GitHub tag `v1.0.1` points to that same commit. Version `1.0.2` is prepared but remains unpublished until its release gate passes and the package is published. Future releases follow semver; `1.0.1` does not mean every selectable stack combination is fully verified.
>
> Progress is tracked with GitHub issues — this file is the big picture, the issues are the work. Check off here when the linked issue closes.

## Progress overview

| Version | Theme                                | Progress | Issues  |
| ------- | ------------------------------------ | -------- | ------- |
| v0.1.0  | Public launch                        | ✅ 6/6   | #1–#6   |
| v0.2.0  | Scaffolder hardening                 | ✅ 5/5   | #7–#11  |
| v0.3.0  | Backend & database expansion         | ✅ 5/5   | #12–#16 |
| v0.3.1  | Hardening (master-plan PR 2/3/5)     | ✅ tag   | —       |
| v0.4.0  | Frontend expansion                   | ✅ 4/4   | #17–#20 |
| v0.5.0  | Platform expansion (mobile, desktop) | ✅ 2/2   | #21–#22 |
| v1.0.0  | First stable release                 | ✅ 5/5   | #23–#27 |
| v1.0.1  | SQLite first-run fix                 | ✅ published | — |
| v1.0.2  | Reliability fixes and runtime evidence | ⏳ release candidate | — |

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

## v1.1.x and beyond — post-v1 priorities

These are follow-up priorities, not release commitments. The post-masterplan audit and testing-infrastructure plans are complete and archived under `docs/plans/completed/`; hosted PR run [#40562224821](https://github.com/doofx0071/omnicraft/actions/runs/40562224821) passed the ten-row Supported matrix. Exact remaining runtime-evidence and registry-consistency work is tracked in [the stack runtime evidence plan](docs/plans/active/omnicraft-stack-runtime-evidence-plan.md). Track roadmap-only features as issues before implementation:

- [x] Keep README, changelog, roadmap, CLI help, and the support matrix aligned with implementation evidence.
- [x] Derive prompt and flag choices from the typed capability registry; reject unsupported combinations before writing files.
- [x] Require evidence mappings for Supported rows and gate release on the complete supported runtime matrix.
- [ ] Expand generated-project runtime evidence for existing selectable combinations that remain Scaffold-verified or unverified; do not promote them before hosted CI passes. See the linked runtime evidence plan.
- [x] Narrow the JavaScript language contract to the implemented React/Vite client and reject unsupported frontend/platform choices.
- [x] Tighten `omnicraft add auth` compatibility and regression coverage for the existing Better Auth path.
- Add `omnicraft doctor` only after project metadata and diagnostic checks have reliable contracts.
- Consider a community template registry, telemetry, a third-party plugin API, and a documentation site after core compatibility and verification gaps are closed.

---

**How to work a phase:** define its scope and evidence in an issue, complete and verify that work, update the support matrix and related docs in the same change, then bump `packages/cli/package.json` and publish when the phase is a release. Use semver after `1.0.0`; do not treat the roadmap as a claim that all selectable combinations are equally verified.
