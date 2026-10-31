# OmniCraft Auth Provider and PHP Stack Expansion Follow-up Plan

**Status:** Complete — every owner-approved in-scope target has exact generated-project and hosted release-gate evidence<br>
**Opened:** 31 October 2026  
**Owner decisions recorded:** 31 October and 1 November 2026  
**Repository:** <https://github.com/doofx0071/omnicraft>  
**Current repository path:** `docs/plans/completed/omnicraft-auth-provider-php-stack-expansion-follow-up-plan.md`<br>
**Previous plan:** [Archived proposal and scope disposition](../completed/omnicraft-auth-provider-php-stack-expansion-plan.md)  
**Decision record:** [Authentication provider and Laravel mode audit](../../research/auth-provider-laravel-decision-audit.md)  
**Current release baseline:** v1.0.4, main commit `0c5304679c2ddf7be41184b59252501e72e602c9`

## Goal

Continue the original auth/PHP expansion in small, evidence-backed slices without reopening verified paths. Laravel 13 Livewire and Inertia React are already implemented and supported on SQLite. The remaining approved work is one Supabase Auth target and first-party Laravel API authentication. Keep every other unverified combination unavailable or at its current support status until its exact generated project passes the required checks and hosted release gate.

The owner-approved choices below define this plan's scope and explicit deferrals. They do not establish support or authorize adding provider choices by inference.

## Verified baseline to preserve

The current `main` baseline includes:

- Creation-time `None` or Better Auth for the exact React/Vite TypeScript + Express + Drizzle database tuples listed in the [stack support matrix](../../templates/stack-support-matrix.md). Creation-time auth and `omnicraft add auth` share the auth setup catalog and compatibility rules; auth state stays separate from `manifest.modules`.
- Laravel 13 + Livewire 4 + SQLite and Laravel 13 + Inertia React + SQLite, each with `None` or Laravel-native Fortify auth. Hosted evidence is recorded in the [stack support matrix](../../templates/stack-support-matrix.md). The Laravel 12 API path remains separate and unchanged.
- Hosted support-evidence and release-gate checks for the exact rows that the matrix marks `Supported`.

This list summarizes implemented paths, not a general claim that all database, frontend, provider, or Laravel combinations work. The support matrix remains authoritative.

## Phase 0 — Owner decisions (updated 1 November 2026)

The project owner accepted the initial Laravel Inertia scope on 31 October and expanded the remaining scope on 1 November. These choices resolve the design questions in the linked audit; do not ask them again unless implementation uncovers a concrete conflict.

| Decision | Approved choice | Scope effect |
| --- | --- | --- |
| First managed provider | Supabase Auth is the first managed-provider scope. WorkOS AuthKit, Clerk, and Auth0 remain deferred and unselectable. | Implement only the exact target below; do not add provider choices by implication. |
| Supabase identity and data | Supabase Auth is the sole identity owner. Send the signed-in user's JWT through the Supabase Data API and enforce user ownership with RLS. Defer direct-Postgres claims bridging and third-party JWT issuers. | Do not use Drizzle or a service-role/secret key as a substitute for user-scoped Data API access. |
| Supabase implementation target | React + Vite + TypeScript frontend-only, backed by Supabase Auth and its Data API. The existing React/Vite frontend-only path is the smallest documented fit for browser-safe Supabase configuration and direct JWT/RLS behavior. | This is a narrow target choice for the first provider slice; it does not enable Supabase Auth on Express, Next.js, Laravel, JavaScript, or another database/framework tuple. |
| Provider setup and credentials | Manual project setup, placeholders only, no cloud provisioning, no real credentials in prompts/flags/generated output/logs, and no privileged key in browser code. Use the publishable key; the generated user-scoped path does not need a secret key. | Keep setup instructions explicit. Local CI uses only disposable local Supabase values with redacted output. |
| Laravel Inertia React | Use Laravel 13 integrated Inertia React with `None` or Laravel-native auth; account linking is out of scope. | Already implemented on SQLite and supported by exact hosted evidence; preserve it unchanged. |
| Laravel API-only auth | Use Laravel's native session guard with Sanctum SPA cookie sessions on the existing separate React/Vite + Laravel 12 API architecture. Defer personal access tokens, external JWTs, and account linking. | Add auth as an opt-in setup on SQLite first. Preserve the current `None` Laravel 12 API behavior and its existing SQLite/PostgreSQL/MySQL data support. Do not broaden authenticated database tuples in this slice. |
| Laravel Livewire databases | Keep native-auth Livewire SQLite-only. | Do not imply PostgreSQL/MySQL auth support. |
| Example `/api/users` behavior | Public in `None` mode; require authentication in auth-enabled modes. | Generated scenarios must test anonymous and authorized behavior where that resource exists. |
| Framework baseline | Use Laravel 13 for integrated Livewire and Inertia modes; keep the existing Laravel 12 API path separate. | No version unification or migration of the API path. |

## Implementation sequence

Each approved item is a separate reviewable slice or PR. Recheck official upstream SDK/framework documentation and pinned versions before implementation.

1. **Verified baseline:** retain Laravel 13 + Livewire 4 and Inertia React on SQLite with `None` or Laravel-native auth. Do not repeat or broaden those slices.
2. **Supabase Auth:** add `None`/Supabase prompt and flag parity only for React/Vite TypeScript frontend-only. Generate a local Supabase project config and ownership-RLS migration; use the public publishable key and user JWT through the Data API. Test setup, sign-in, session restoration, user A/B row isolation, and sign-out against a disposable local Supabase stack. Do not add an Express/Drizzle, Next.js, Laravel, JavaScript, or non-Supabase-Postgres provider target.
3. **Laravel API auth:** add an opt-in Sanctum SPA session path only for React/Vite TypeScript + Laravel 12 API + SQLite. Keep existing unauthenticated Laravel 12 behavior unchanged for `None`, and leave PostgreSQL/MySQL auth unavailable. Test registration, login, persisted cookie session, protected `/api/users`/`/api/me`, CSRF behavior, and logout.
4. **Deferred provider work:** keep WorkOS AuthKit, Clerk, Auth0, account linking, direct-Postgres JWT claims bridging, third-party JWTs, additional Supabase targets, and additional authenticated Laravel databases unselectable. Record follow-up scope in a focused successor plan when this plan's in-scope work has exact evidence.

Do not combine the Supabase and Laravel API slices into one implementation commit. Keep Better Auth, Laravel Livewire, and Laravel Inertia supported paths green throughout.

## Evidence and documentation requirements

For every approved combination:

- Validate prompt choices, flags, compatibility, composition, and pre-write rejection from one authoritative definition.
- Generate from production template layers; install dependencies; run the selected framework setup/migrations; boot the app; and exercise the selected auth lifecycle and protected-resource behavior.
- For Supabase, verify the exposed-table grants as well as RLS policies; Supabase's 30 October 2026 rollout no longer exposes new `public` tables to the Data API without explicit grants.
- Use real database tests for every database-backed row promoted to `Supported`. Use secret-free local tests by default and separate, opt-in provider sandbox checks where external credentials are required.
- Map each `Supported` row in `src/support-evidence.ts` to an exact scenario, hosted CI job, and `supported-stack-release-gate` requirement. Run the gate on the exact final PR head. A scaffold, compile, or adjacent-mode pass is not support evidence.
- Update README/help, generated README/setup instructions, support matrix, changelog, roadmap, and development/testing documentation for the behavior actually delivered. Never promote a status without the required evidence.
- Keep secrets out of prompts, generated files, logs, test artifacts, and commits. Do not automatically create external provider resources.

## Definition of done

- Owner decisions and their rationale are recorded before dependent implementation starts; deferred choices have an explicit home and status.
- Every implemented mode/provider has exact prompt/flag parity, safe compatibility checks, and generated-project tests for its selected tuple.
- Every advertised database/auth tuple has the required real-operation and provider evidence for its status.
- Current docs, capabilities, compatibility, support evidence, matrix, and release gate agree on the exact scope.
- The full required hosted CI and strict release gate pass on the exact final commit; no pending/cancelled required job is counted as passing.
- Unsupported or unselected paths remain unselectable or retain their existing evidence-based status.

## Out of scope

- Changing or broadening the v1.0.3 support claims without exact evidence.
- Automatically creating managed-provider accounts or cloud resources.
- Implementing multiple managed providers or PHP frameworks together.
- Changing the existing Laravel 12 API behavior for `None` projects or moving it to Laravel 13.
- Supabase Auth on any target besides React/Vite TypeScript frontend-only in this plan.
- Personal tokens, external JWTs, account linking, transaction-scoped JWT bridges, and managed providers besides Supabase Auth.
- Physical-device guarantees based only on simulator/emulator evidence.

## Completion evidence

The approved Supabase Auth and Laravel API Sanctum slices were verified on exact PR head
`3d5fd3cc43c32c90e3c4587d0cc681a3e5dda136` in hosted run
[#41239882961](https://github.com/doofx0071/omnicraft/actions/runs/41239882961). PR #58 remains open,
unmerged, and stacked on open PR #57; this evidence does not mean the changes are released.

| Target | Hosted evidence |
| --- | --- |
| Supabase Auth — React/Vite TypeScript frontend-only | [`supabase-auth-integration`](https://github.com/doofx0071/omnicraft/actions/runs/41239882961/job/124651400492) generated the production CLI output, ran the disposable local Supabase stack, checked explicit grants and owner RLS, tested sign-up/sign-in/session restoration/sign-out and two-user row isolation, and verified privileged credentials were absent from the browser bundle. |
| Laravel API Sanctum SPA — React/Vite TypeScript + Laravel 12 API + SQLite | [`php-laravel-sanctum-spa-auth-integration`](https://github.com/doofx0071/omnicraft/actions/runs/41239882961/job/124651400547) tested both `None` and native auth generation, pre-write rejection, public `None` behavior, registration/login, CSRF, session restoration, protected resources, per-user ownership, and sign-out. |
| Exact support mapping and release gate | [`support-evidence`](https://github.com/doofx0071/omnicraft/actions/runs/41239882961/job/124651400660) verified the exact registered rows; [`supported-stack-release-gate`](https://github.com/doofx0071/omnicraft/actions/runs/41239882961/job/124657718885) passed with 81 successful jobs. The expected npm publish/GitHub Release job was skipped for the pull-request event. |

Local validation on the same implementation included `npx vitest run` (18 files, 269 tests),
`npx tsc --noEmit`, `npx tsup`, `npm run check:support-matrix --workspace=create-omnicraft` (47
Supported rows mapped), and `npm run test:integration:php-sanctum-auth --workspace=create-omnicraft`.
The Laravel integration reported that `None` and Sanctum generation, SQLite, CSRF, sessions, ownership,
and sign-out passed. Targeted Markdown checks passed for the README, roadmap, and database/auth
integration guide, and the new successor plan was formatted. Prettier also flags `docs/index.md`, the
testing strategy, this plan, and the support matrix at their clean-base versions; those existing layouts
were preserved rather than broadly rewritten.

The remaining deferred provider, JWT, database, and Laravel mode expansions are tracked in the
[auth provider and PHP next-target plan](../active/omnicraft-auth-provider-php-next-targets-plan.md).
They remain unselectable and do not inherit support from this completion.
