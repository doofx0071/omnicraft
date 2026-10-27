# 🗺️ OmniCraft Roadmap

> **Versioning model:** `v0.1.0` = public launch (current state) → `v0.2–v0.5` = feature phases → **`v1.0.0` = "everything implemented"** (the full vision) → `v1.1.x+` = ongoing fixes & upgrades after 1.0.
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
| v1.0.0  | Maturity milestone                   | ✅ 5/5   | #23–#27 |

---

## v0.1.0 — Public launch

Ship what works today, start the feedback loop. CI runs on a **self-hosted runner** (unlimited free minutes — no hosted-minutes limits on private repos).

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

## v1.0.0 — Maturity milestone

The flagship features. When these land (plus everything above), the vision is complete and we cut **v1.0.0**.

- [x] #23 — Auth boilerplate wired to the users table
- [x] #24 — `omnicraft add <module>` post-scaffold generator
- [x] #25 — JavaScript (non-TypeScript) template variants
- [x] #26 — Multi-OS CI once repo is public _(done early — repo is public, all 3 OS green)_
- [ ] #27 — Contributor docs: template composition guide

## v1.1.x and beyond (unplanned parking lot)

Community template registry, opt-in telemetry, plugin API for third-party stacks, docs site. Nothing here is committed — revisit after v1.0.0.

---

**How to work a phase:** open the issues for the current version, close them one by one (they auto-tick here via the links when someone updates this file — or edit the checkboxes as part of the closing PR), bump the version in `packages/cli/package.json`, publish, then move the next phase to 🚧.
