# OmniCraft `add testing` React Runtime Fix Plan

**Status:** Active
**Created:** 2026-10-29
**Base:** PR #47 head `7f0f8075939304e0d46c4e2561b8037161ff9d40`
**Scope:** Existing production compositions and the existing `testing` module only.

## Goal

Fix the generated `omnicraft add testing` failures for existing React/Vite project paths and reject
existing non-React paths that the current React-specific sample cannot serve. Do not add framework,
provider, template-variant, or stack-combination support. Keep matrix claims tied to exact hosted
generated-project results.

## Paths

Expected to work after the focused fix:

- React/Vite JavaScript frontend-only.
- React/Vite TypeScript and JavaScript with Express/Drizzle/SQLite separate API.
- React/Vite TypeScript with FastAPI/SQLite.
- React/Vite TypeScript with Laravel/SQLite.
- Preserve the existing React/Vite TypeScript frontend-only supported control.

Reject `omnicraft add testing` before any writes for Vue/Vite, Svelte/Vite, and integrated Next.js.
Their generated app entry files do not match the module's current React `src/App` sample. This does not
reject those stacks or change their existing stack support.

## Implementation

1. Add a module preflight guard for non-React frontends and unit coverage proving rejected paths leave
   files, dependencies, scripts, and the manifest unchanged.
2. Place the Vitest config at the project root, where the module's `npm test` script and dependencies
   are installed. For separate frontend/API projects, configure Vitest's root as `client`; keep the
   sample and setup files alongside the generated React app. Configure JSX helper injection for the
   existing JavaScript React files; render the sample without a JSX transform.
3. Update the existing `module-runtime-integration` scenarios to require successful install and
   generated-test execution for the five React paths, plus generated build/typecheck checks where
   applicable. Assert pre-write rejection for Vue, Svelte, and Next.js. Keep bounded commands,
   redacted diagnostics, and reliable cleanup.
4. Run focused tests, full unit tests, typecheck, build, support-evidence validation, and all eight
   originally failing generated scenarios locally. Push the implementation to a separate branch based
   on PR #47.
5. Require hosted CI on the exact implementation commit. Only after the exact hosted results succeed,
   update support evidence and the matrix for paths that met the documented bar; record the three
   explicit module rejections and leave unrelated or untested paths provisional. Run hosted CI again
   on the final PR head.

## Definition of done

- [x] Five existing React/Vite `add testing` paths install and execute the generated test successfully
      in hosted CI; the existing TypeScript frontend-only control remains green.
- [x] Vue, Svelte, and Next.js are rejected before module files, dependency/script changes, or manifest
      changes are written.
- [x] Relevant local unit, typecheck, build, and generated-project checks pass.
- [x] Support evidence and documentation match observed results; no path is promoted before its exact
      hosted generated-project checks pass.
- [ ] Final hosted CI passes on the exact PR head and the PR remains open and unmerged.

## Verified results

Hosted implementation run [#40880427361](https://github.com/doofx0071/omnicraft/actions/runs/40880427361)
passed on commit `fd4d3888037e330ac160a997e91f2a5b6b4e70c9`. All six exact React/Vite module scenarios
passed generated production composition, the real add operation, dependency installation, generated
sample-test execution, client build, Vite preview boot, bundle fetch, and missing-asset checks. TypeScript
client paths also passed `npx tsc --noEmit`. The Vue, Svelte, and Next.js scenarios passed their expected
pre-write rejection checks without changing package/manifest files or writing module files. The same run
passed the support-evidence job and strict release gate; 51 jobs succeeded and the tag-only publish job
was skipped.

Local checks after evidence registry updates:

```text
npm test                         # 148 tests in 14 files passed
npx tsc --noEmit                 # passed
npx tsup                         # passed
npm run check:support-matrix     # 39 Supported rows map to CI evidence
git diff --check                 # passed
```

The final documentation/evidence head still requires hosted CI before this plan can be closed.

## Out of scope

No new test frameworks or module behaviors, framework adapters, template variants, stack combinations,
database evidence, auth-provider work, or edits to the completed runtime-evidence plans.
