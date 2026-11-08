# OmniCraft Post-v1.0.8 Residuals

**Status:** Complete — all three items landed with hosted evidence: strict gate
[42440036692](https://github.com/doofx0071/omnicraft/actions/runs/42440036692) on `ae552c7` and
[42442912081](https://github.com/doofx0071/omnicraft/actions/runs/42442912081) on `f8df2cf`; all three
floor jobs green in node-floor-evidence run
[42444517954](https://github.com/doofx0071/omnicraft/actions/runs/42444517954) on `f8df2cf`<br>
**Opened:** 8 November 2026<br>
**Closed:** 8 November 2026<br>
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

The generated `engines.node` floors claim Node 20.19 / 22.14 / 22.18 minimums without boot/build
proof on those exact lines. Add `.github/workflows/node-floor-evidence.yml`: a scheduled (weekly,
plus `workflow_dispatch`) evidence workflow, separate from `ci.yml` so it neither joins the
serialized push queue nor the strict release gate, with three exact-version jobs:

- Node `20.19.0` — Express + Drizzle + PostgreSQL fullstack floor: install, client build, API
  typecheck, boot, CRUD against a disposable PostgreSQL.
- Node `22.14.0` — Express + raw SQL + SQLite fullstack floor: install (better-sqlite3 build),
  typecheck, boot, CRUD.
- Node `22.18.0` — Laravel 13 + Livewire (Vite Plus) floor: production CLI scaffold, Composer
  install, npm install, asset build.

First hosted evidence (workflow dispatch run 42442045084 on `ae552c7`, 8 November 2026): the Node
20.19.0 PostgreSQL job and the Node 22.18.0 Laravel job passed. The Node 22.13.0 SQLite job
**caught a real floor bug**: the `better-sqlite3@13` prebuilt binary segfaults at first use on
Node 22.13.0 (exit 139 in `db:migrate`), matching upstream reports that place the boundary at
22.14.0. The sqlite-bearing floors were therefore corrected — `root/fullstack/sqlite` to
`^22.14.0 || >=24.0.0` (nvmrc `22.14`) and `root/fullstack-next/sqlite` to `>=22.14.0` (nvmrc
`22.14`) — and the floor job now runs `22.14.0`. This is exactly the hazard class the floor work
was meant to catch: `better-sqlite3` declares `engines: >=22`, which npm accepts silently.

Second dispatch ([42444517954](https://github.com/doofx0071/omnicraft/actions/runs/42444517954) on
`f8df2cf`): all three floor jobs green — Node 20.19.0 (install, Vite client build, typechecks,
migrate, boot, PostgreSQL CRUD), Node 22.14.0 (same against SQLite with the better-sqlite3
native build), and Node 22.18.0 (production CLI Livewire scaffold with Composer/npm installs and
a required Vite asset build). The floors are now boot/build-proven on their exact minimum lines,
and the weekly schedule keeps the evidence fresh.

## Non-goals

- No Laravel security-header/rate-limit baseline (needs its own design round against session/CSRF
  behavior).
- No root-variant splitting per frontend/extras combination, no PR-gate tiering, no freshness
  matrix (all recorded as deferred in their plans).
- No support-matrix status changes from this batch; the floor workflow is supplementary evidence.
