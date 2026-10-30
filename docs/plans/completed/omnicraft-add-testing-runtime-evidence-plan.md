# OmniCraft `add testing` Non-Native Runtime Evidence Plan

**Status:** Complete — all scoped path outcomes recorded; paths remain unverified
**Created:** 2026-10-29
**Scope:** Existing production compositions and the existing `testing` module only.

## Goal

Record generated-project runtime evidence for the current **Selectable — unverified**
`omnicraft add testing` paths outside React/Vite TypeScript frontend-only. Do not add module
features, framework support, template variants, or stack combinations. The existing Supported
frontend-only TypeScript row remains unchanged. Keep the broader non-native row
**Selectable — unverified** unless its exact required evidence passes.

## Existing path set

Use only production compositions already exposed by current capabilities and templates:

- React/Vite JavaScript frontend-only.
- React/Vite TypeScript + Express/Drizzle/SQLite separate frontend/API.
- React/Vite JavaScript + Express/Drizzle/SQLite separate frontend/API.
- Vue/Vite and Svelte/Vite + Express/Drizzle/SQLite separate frontend/API.
- React/Vite TypeScript + FastAPI/SQLAlchemy/Alembic/SQLite.
- React/Vite TypeScript + Laravel/Eloquent/SQLite.
- Next.js integrated full-stack + raw SQL/SQLite, using the production Next.js generator and
  overlay layers.

These cases cover the existing non-native client layouts, frontend contracts, language modes, and
backend runtime families that have distinct module installation paths. They do not establish evidence
for other backend frameworks, ORMs, databases, native platforms, or the full cross-product. Do not
infer their results from a passing case.

## Runtime evidence requirements

For each listed case, in an isolated fresh project:

1. Generate the base project from `composeLayers` and existing template layers. For Next.js, first
   create the base with the currently pinned production generator, then apply OmniCraft's production
   overlay.
2. Run the real `omnicraft add testing <project>` operation and verify its generated files and manifest.
3. Install the generated project's dependencies.
4. Run the generated `npm test` command from the package where the module added it (project root or
   `client`). Record the exact exit result and sample assertion output.
5. Bound child-process timeouts, redact inherited secrets from diagnostics, and always clean up the
   temporary project and child processes.

A failed generated test is recorded as a failure and remains unverified; it must not be converted into
support evidence. CI may assert a known observed failure only when it verifies the exact failure result
and clearly reports that the path is not supported. Unexpected result changes fail CI. No changes to
module behavior or compatibility rules are in scope for this evidence slice.

## Documentation and CI

- Extend the existing module runtime integration target and its scenario registry; keep the strict
  release-gate dependency intact.
- Update the unverified matrix row only with exact hosted results and remaining limits. Do not add a
  Supported registry entry or promote the row unless its full required evidence is available.
- Leave `omnicraft-stack-runtime-evidence-plan.md` and the active auth-provider/PHP plan unchanged.

## Definition of done

- [x] Every listed case has a hosted result for fresh generation, `add testing`, dependency install,
  and the generated test command on exact commit `b1c8a2096d83dbc5b2c39c726442a1c568d1ef54` in
  [run #40801915094](https://github.com/doofx0071/omnicraft/actions/runs/40801915094).
- [x] Expected and unexpected failures are distinguished; no failure is counted as support.
- [x] The matrix reflects the observed results and remains Selectable — unverified because each
  generated sample test failed.
- [x] `supported-stack-release-gate` and all required dependencies succeeded in hosted run #40801915094 on commit `b1c8a2096d83dbc5b2c39c726442a1c568d1ef54`; the tag-only publish job was skipped.
- [x] PR [#47](https://github.com/doofx0071/omnicraft/pull/47) is open and unmerged.

## Hosted results

Each job below generated a fresh project from the existing production composition, ran the real `add testing` command, installed dependencies, executed the generated root `npm test`, and cleaned its temporary project. The Next.js path used the configured `create-next-app@16` generator before applying production layers. The module-runtime job passes these expected failures only after matching the exact failure output and logs each affected path as unverified; the generated test itself exited 1.

| Scenario and existing path | Hosted generated `npm test` result |
| --- | --- |
| `add-testing-react-vite-js-frontend-only` — React/Vite JavaScript, frontend-only | Exit 1: `React is not defined` ([job log](https://github.com/doofx0071/omnicraft/actions/runs/40801915094/job/123211763081)) |
| `add-testing-react-vite-ts-separate-api` — React/Vite TypeScript + Express/Drizzle/SQLite separate API | Exit 1: `document is not defined` ([job log](https://github.com/doofx0071/omnicraft/actions/runs/40801915094/job/123211763197)) |
| `add-testing-react-vite-js-separate-api` — React/Vite JavaScript + Express/Drizzle/SQLite separate API | Exit 1: `React is not defined` ([job log](https://github.com/doofx0071/omnicraft/actions/runs/40801915094/job/123211763396)) |
| `add-testing-vue-express-drizzle-sqlite` — Vue/Vite + Express/Drizzle/SQLite | Exit 1: unresolved `./App` (“Does the file exist?”) ([job log](https://github.com/doofx0071/omnicraft/actions/runs/40801915094/job/123211763136)) |
| `add-testing-svelte-express-drizzle-sqlite` — Svelte/Vite + Express/Drizzle/SQLite | Exit 1: unresolved `./App` (“Does the file exist?”) ([job log](https://github.com/doofx0071/omnicraft/actions/runs/40801915094/job/123211763077)) |
| `add-testing-fastapi-sqlite` — React/Vite TypeScript + FastAPI/SQLAlchemy/Alembic/SQLite | Exit 1: `document is not defined` ([job log](https://github.com/doofx0071/omnicraft/actions/runs/40801915094/job/123211763079)) |
| `add-testing-laravel-sqlite` — React/Vite TypeScript + Laravel/Eloquent/SQLite | Exit 1: `document is not defined` ([job log](https://github.com/doofx0071/omnicraft/actions/runs/40801915094/job/123211763268)) |
| `add-testing-nextjs-sqlite` — Next.js integrated full-stack + raw SQL/SQLite | Exit 1: unresolved `./App` (“Does the file exist?”) ([job log](https://github.com/doofx0071/omnicraft/actions/runs/40801915094/job/123211763848)) |

The existing React/Vite TypeScript frontend-only testing path and shadcn frontend-only path also passed their existing module-runtime controls in this run. These results do not alter the eight paths' Selectable — unverified status.
