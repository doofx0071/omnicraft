# OmniCraft `add testing` Non-Native Runtime Evidence Plan

**Status:** Active — exact runtime outcomes remain to be recorded
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

- [ ] Every listed case has a hosted result for fresh generation, `add testing`, dependency install,
  and the generated test command on the exact tested commit.
- [ ] Expected and unexpected failures are distinguished; no failure is counted as support.
- [ ] The matrix reflects only observed results and remains Selectable — unverified wherever exact
  required evidence is incomplete.
- [ ] The existing module runtime job remains part of the strict release gate and passes hosted CI.
- [ ] The PR is opened and left unmerged.
