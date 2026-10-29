# React/Vite `add testing` combination evidence follow-up

**Status:** Completed
**Base:** PR #50 head `c5760bd9261ceece6c64599760f4cf2ae7e6c621`
**Scope:** Existing React/Vite web paths accepted by the current capability registry, compatibility rules, production composer, and `testing` module guard.

## Objective

Determine the exact runtime result of `omnicraft add testing` for every currently selectable React/Vite combination beyond the six exact paths already recorded in the support matrix. Make a path work with its generated project, or reject it before the module writes files when its current templates cannot support that test path. Record only results demonstrated by generated-project checks in hosted CI.

Do not add frameworks, providers, template variants, or stack combinations. Do not change the completed runtime evidence plans or completed React runtime-fix plan. Keep other checkout changes, including the primary checkout's master-plan deletion and untracked files, untouched.

## Registry inventory at plan start

The inventory is produced from the current `AVAILABLE` capability registry, `resolveAnswers`, `composeLayers`, and the `testing` module compatibility guard. The current production resolver accepts 312 exact React/Vite paths across the six valid extras sets:

| Existing path family | Valid paths | Already exact-supported | Remaining unverified |
| --- | ---: | ---: | ---: |
| Frontend-only, TypeScript/JavaScript | 12 | 2 | 10 |
| Node API: Express/Fastify/Hono × compatible ORM × database × language | 240 | 2 | 238 |
| FastAPI + SQLite/PostgreSQL × language | 24 | 1 | 23 |
| Laravel + SQLite/PostgreSQL/MySQL × language | 36 | 1 | 35 |
| **Total** | **312** | **6** | **306** |

The six normalized extras sets are: none; ESLint; Tailwind; Tailwind + ESLint; Tailwind + shadcn; Tailwind + ESLint + shadcn. JavaScript is valid only for React/Vite. Node ORM/database combinations come from the existing backend ORM map and PostgreSQL-only Prisma rule. `shadcn` implies Tailwind and is available for React frontend-only and separate-API architectures. No other frontend or native path is in this plan.

Every one of the 306 remaining paths currently passes answer validation, production composition, and the `testing` module guard. No active plan owned this remaining inventory when this plan was created.

## Implementation and evidence steps

1. Build an exhaustive scenario inventory from the registries and compatibility functions. Assert that each tuple resolves and composes, each supported tuple is excluded from the new follow-up set, and no exact tuple is duplicated or omitted.
2. Generate each unverified project using production layers and manifest/env creation. For shadcn tuples, run the existing production shadcn initialization, component-add, and formatting steps before adding testing.
3. Invoke the real `omnicraft add testing` operation in each generated project. Verify generated module files, scripts, dependencies, idempotency, and that expected preflight rejections leave package manifests and module files unchanged.
4. Install generated npm dependencies, run the generated `npm test`, typecheck TypeScript client paths, build the client, boot Vite preview, and verify its app bundle and missing-asset response. This module path does not establish backend/database runtime support.
5. Run the relevant unit, typecheck, build, integration, and support-evidence checks locally. Add the exact generated-project scenarios to hosted CI and require them through the existing strict release gate. A missing, failed, skipped, or cancelled required check is a failure.
6. Update support evidence and the matrix only for exact paths whose required generated-project checks pass on the recorded hosted commit. Keep every unproven path `Selectable — unverified`; record pre-write rejections only for paths whose current templates demonstrate that limitation.
7. Move this plan to `docs/plans/completed/` only after every definition-of-done item has exact hosted evidence. Open a PR based on the current PR #50 head and leave it unmerged.

## Definition of done

- [x] Exhaustive inventory matches the current capability registry and compatibility rules: 312 exact tuples total, six previously supported, and 306 follow-up tuples generated deterministically from production rules.
- [x] Every follow-up tuple has an exact hosted result: 254 accepted paths passed the real add/install/generated-test flow; 52 JavaScript + shadcn paths were rejected before module files, dependencies, scripts, or manifest changes.
- [x] Accepted TypeScript paths typecheck; accepted paths build and boot Vite preview with bundle and missing-asset checks.
- [x] Local relevant unit, typecheck, build, generated-project, and support-evidence checks pass.
- [x] Hosted exact-head generated-project groups and the strict release gate passed on PR #51 commit `ccd48955bcb23b05b798a0293506c2c3d8930a6b` in run [#40903557153, attempt 2](https://github.com/doofx0071/omnicraft/actions/runs/40903557153). Attempt 1 had a runnerless cancelled macOS Node 24 job and correctly failed the gate; attempt 2 reran that required job and the gate passed. The tag-only publish job was skipped for the pull request event.
- [x] The support matrix and evidence registry match those exact observed results; no backend/database support was inferred from testing-module evidence.
- [x] This plan is moved to `docs/plans/completed/`; earlier completed plans and other checkout changes remain untouched.
- [x] PR #51 is open and unmerged, based on PR #50's head `c5760bd9261ceece6c64599760f4cf2ae7e6c621`.

## Results

The 306 follow-up tuples comprise 238 Node paths, 23 FastAPI paths, 35 Laravel paths, and 10 frontend-only paths. The hosted scenario registry covers all 306 in 23 groups. It records 254 working testing-module paths and 52 JavaScript + shadcn module-path rejections; six existing exact paths remain supported by their earlier evidence. These results describe `omnicraft add testing`; they do not promote the underlying backend/database combinations.

Local validation after the evidence-registry update: `npx vitest run` passed 14 files and 153 tests; `npx tsc --noEmit`, `npx tsup`, and `npm run check:support-matrix --workspace=create-omnicraft` passed. Generated-project groups `react-vite-testing-node-none` (38 paths), `react-vite-testing-node-tailwind` (40 paths), and `react-vite-testing-node-eslint` (40 paths) also passed locally; hosted CI covered all 23 groups.

## Initial generated-project findings

- The JavaScript + shadcn combinations fail production shadcn initialization because the existing JavaScript template has no path-alias configuration. Their testing module guard now rejects that template path before module writes; runtime coverage verifies the production failure and pre-write rejection.
- The testing module now configures Vitest's `@/` alias from the generated app root and uses the shadcn app's actual heading. The TypeScript frontend-only shadcn path passes the generated install, test, typecheck, build, preview, bundle, and missing-asset checks locally.
