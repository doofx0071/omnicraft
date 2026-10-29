# React/Vite `add testing` combination evidence follow-up

**Status:** Active  
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

- [ ] Exhaustive inventory matches the current capability registry and compatibility rules; all 306 remaining tuples are listed or generated deterministically and individually reported.
- [ ] Every unverified tuple has a fresh production-composed project and an observed real add/install/generated-test outcome, or a pre-write rejection with unchanged module files, dependencies, scripts, and manifest.
- [ ] TypeScript paths typecheck; paths accepted for testing build and boot the generated Vite app with bundle and missing-asset checks.
- [ ] Local relevant unit, typecheck, build, generated-project, and support-evidence checks pass.
- [ ] Hosted exact-head generated-project jobs and the strict release gate pass on the recorded PR commit; no required job is missing, skipped, or cancelled.
- [ ] Matrix and evidence registry statements match only the observed exact results; unrelated and provisional paths remain unpromoted.
- [ ] This plan is moved to `docs/plans/completed/` with all items evidenced; completed plans and other checkout changes remain untouched.
- [ ] A separate `codex/` PR is open and unmerged, based on PR #50's current head.

## Initial open questions to resolve from generated-project results

- Whether the current Vitest configuration resolves shadcn's existing `@/` import aliases without the client Vite config.
- Whether the fixed default React heading assertion matches the existing shadcn React app.
- Whether each existing backend/data-access template installs successfully when the test module is applied to the generated workspace.

