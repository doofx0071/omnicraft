# OmniCraft Post-v1.0.8 Residuals

**Status:** Implemented — all three items landed (local: 410 tests, checker 49 rows, build; hosted
gate evidence pending the next main run)<br>
**Opened:** 8 November 2026<br>
**Repository:** <https://github.com/doofx0071/omnicraft><br>
**Basis:** residuals recorded by the [generated-app quality follow-up](../completed/omnicraft-generated-app-quality-follow-up-plan.md)
and the [v1.0.7 polish plan](../completed/omnicraft-v107-polish-plan.md).

## Goal

Close the small, well-defined residuals that survived v1.0.8 without reopening scope the plans
deliberately deferred (root-variant splitting, PR-gate tiering, Laravel security baseline).

## Work items

### 1. Generated root `package.json` descriptions

Every root variant ships a truthful, static one-line `description` that stays accurate for every
composition sharing that file (framework/ORM lists named explicitly, no token rendering). Server and
client workspace manifests intentionally stay without descriptions: they are private workspace
packages and a description adds nothing there. Engine tests assert every root variant has a
non-empty description.

### 2. Pin `actions/checkout` and `actions/setup-node` to verified SHAs

Replace the 20 `actions/checkout@v4` and 20 `actions/setup-node@v4` pins with
`actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1` and
`actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0` (SHAs resolved from the
upstream tags on 8 November 2026; both majors run on the node24 action runtime). The trusted
self-hosted runner (`omnicraft-runner-win`) reported version 2.338.2 on 7 November 2026, above the
node24-action minimum, so the self-hosted job is compatible. `shivammathur/setup-php@v2` and
`astral-sh/setup-uv@v10.3.2` keep their existing pins (out of this item's scope).

### 3. Exact-minimum Node floor evidence

The generated `engines.node` floors claim Node 20.19 / 22.13 / 22.18 minimums without boot/build
proof on those exact lines. Add `.github/workflows/node-floor-evidence.yml`: a scheduled (weekly,
plus `workflow_dispatch`) evidence workflow, separate from `ci.yml` so it neither joins the
serialized push queue nor the strict release gate, with three exact-version jobs:

- Node `20.19.0` — Express + Drizzle + PostgreSQL fullstack floor: install, client build, API
  typecheck, boot, CRUD against a disposable PostgreSQL.
- Node `22.13.0` — Express + raw SQL + SQLite fullstack floor: install (better-sqlite3 build),
  typecheck, boot, CRUD.
- Node `22.18.0` — Laravel 13 + Livewire (Vite Plus) floor: production CLI scaffold, Composer
  install, npm install, asset build.

## Non-goals

- No Laravel security-header/rate-limit baseline (needs its own design round against session/CSRF
  behavior).
- No root-variant splitting per frontend/extras combination, no PR-gate tiering, no freshness
  matrix (all recorded as deferred in their plans).
- No support-matrix status changes from this batch; the floor workflow is supplementary evidence.
