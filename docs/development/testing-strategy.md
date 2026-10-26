# Testing strategy

How OmniCraft verifies itself. Commands run from `packages/cli/` unless noted. Current state:
**62 tests / 8 files, all green in CI** (windows self-hosted + ubuntu + macos).

## Test levels

### Level 1 — Unit tests (`npx vitest run`)

Fast, no network, no installs. Current coverage:

| File                                  | Covers                                                                                                                                                                                                                                                                                                              | Notes           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `src/args.test.ts` (7)                | flag parsing: booleans, `--flag value`, `--flag=value`, `--extras` lists + `none`, `--full-stack`/`--no-full-stack`, errors on missing values/unknown flags/extra positionals                                                                                                                                       |                 |
| `src/validators.test.ts` (7)          | slugify, npm-name validation, raw-name check                                                                                                                                                                                                                                                                        |                 |
| `src/renderer.test.ts` (7)            | token substitution (incl. unknown tokens kept), `_`→`.` rename, binary detection                                                                                                                                                                                                                                    |                 |
| `src/merge.test.ts` (4)               | package.json deep merge: union, overrides, arrays replaced, no input mutation                                                                                                                                                                                                                                       |                 |
| `src/prefill.test.ts` (12)            | `validateStackFlags` (valid/invalid/runtime-scoped/prisma-postgres-only), `resolveAnswers` (defaults, overrides, runtimes), `hasStackFlags`                                                                                                                                                                         |                 |
| `src/update-check.test.ts` (6)        | version comparison, registry fetch, offline silence, 24h cache                                                                                                                                                                                                                                                      | mocked fetch    |
| `src/prompts/run-prompts.test.ts` (5) | the full flow with mocked clack: answer sequences, frontend-only shortcut, "(soon)" re-prompt, cancel on decline, invalid names                                                                                                                                                                                     | scripted mock   |
| `src/engine.test.ts` (14)             | **the big one** — scaffolds every node combo (express/fastify × drizzle/prisma × postgres/sqlite/mysql) + fastapi × {postgres, sqlite} + laravel overlay + frontend-only into temp dirs and asserts files, tokens rendered, envs, CI/README assets, layer overrides; plus MissingLayerError and no-token-leak scans | real filesystem |

Requirement: any new module with behavior gets tests; any changed capability updates
`prefill.test.ts` + `engine.test.ts` + the prompts test script.

### Level 2 — Scaffold smoke (`scripts/smoke-e2e.ts`)

```bash
npx tsx scripts/smoke-e2e.ts <out-dir>
```

Scaffolds all **11 supported combos + frontend-only** without prompts (the combos list is the live
record of what's verified). CI runs this on every push/PR on all three OSes.

### Level 3 — Generated-project verification (per combo, local)

For any combo you touched or added:

```bash
cd <out>/<combo> && npm install --no-audit --no-fund
npx tsc --noEmit -p client && npx tsc --noEmit -p server   # node/laravel projects
cd server && node ../node_modules/tsx/dist/cli.mjs src/index.ts   # boot (or uvicorn / artisan serve)
# then curl /api/health and exercise /api/users (create → duplicate → expect 409/422 → list → delete)
```

Honesty rule: **scaffolded ≠ verified.** A combination counts as _supported_ only after its install +
typecheck + boot + at least one real DB operation pass. Record that evidence in the
[support matrix](../templates/stack-support-matrix.md). Python projects additionally: `uv sync`,
`alembic upgrade head`, `uvicorn` boot. Laravel: `migrate`, `seed`, `artisan serve`.

### Level 4 — CI (`.github/workflows/ci.yml`, all three OSes)

1. `npm ci` (root workspace) → typecheck → vitest → tsup build
2. scaffold all smoke combos
3. e2e: install + typecheck the `express-drizzle-postgres` (windows) / `express-prisma-postgres` (unix) project
4. windows job additionally: `eslint` + `prettier --check` of the generated project

CI currently does **not** boot servers or hit databases — that's Level 3, done per-change and recorded in
the matrix. Don't describe CI as covering more than it does.

## What's required for each change type

| Change                       | Required                                                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Source module change         | unit tests for the module; full suite green                                                                                             |
| Prompt/flag change           | prompts test script updated; `--yes` + error paths exercised via built CLI                                                              |
| Template change              | engine tests green; smoke scaffold; install+typecheck+boot for every combo whose templates you touched                                  |
| New combo                    | added to smoke `combos`; full Level 3 verification; support-matrix row with evidence                                                    |
| Engine/renderer/merge change | full suite + scaffold all combos + Level 3 on at least one node and one non-node combo (the engine tests cover all node combos already) |
| Docs only                    | links checked; claims match the matrix                                                                                                  |

## Conventions

- Tests are deterministic: engine tests use `mkdtempSync` dirs (cleaned in `afterAll`), no network.
- The prompts test mocks `@clack/prompts` with a scripted answer queue — extend the script, don't
  simulate real TTY.
- `--yes` mode is tested non-interactively (`< /dev/null`), mirroring CI's constraint.
