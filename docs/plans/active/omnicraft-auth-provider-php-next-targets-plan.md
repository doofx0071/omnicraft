# OmniCraft Auth Provider and PHP Next-Target Plan

**Status:** Active — Laravel Sanctum PostgreSQL/MySQL target approved; generated-project and hosted evidence pending<br>
**Opened:** 1 November 2026<br>
**Repository:** <https://github.com/doofx0071/omnicraft><br>
**Completed foundation:** [Auth provider and PHP expansion follow-up](../completed/omnicraft-auth-provider-php-stack-expansion-follow-up-plan.md)
**Decision record:** [Authentication provider and Laravel mode audit](../../research/auth-provider-laravel-decision-audit.md)

## Goal

Track provider and PHP expansion choices deliberately deferred by the completed follow-up plan and
the approved Laravel database-auth slice. Only the target below is selectable while implementation
and evidence are in progress. The current
[stack support matrix](../../templates/stack-support-matrix.md) remains authoritative until an exact
target is approved, generated, tested, and covered by the hosted release gate.

## Verified foundation

- Supabase Auth is Supported only for React/Vite TypeScript frontend-only apps using the Supabase Data
  API, explicit grants, user JWTs, and owner RLS.
- Laravel API native auth is Supported only for React/Vite TypeScript + Laravel 12 API + SQLite using
  Sanctum SPA cookie sessions. The existing unauthenticated Laravel API retains its own database rows.
- PostgreSQL and MySQL have been approved for Sanctum SPA auth only on React/Vite TypeScript + Laravel
  12 API + Eloquent. Until the exact generated-project integration and final hosted release gate pass,
  these tuples remain Selectable — unverified. The database choice stores users/application records;
  the generated session store remains file-based.
- Laravel 13 Livewire and Inertia React remain separate integrated modes with `None` or Laravel-native
  auth on SQLite.
- The exact generated-project and release-gate evidence is recorded in the completed follow-up plan.

## Deferred targets

| Area                       | Deferred scope                                                              | Required decision before implementation                                                                                                                                                                     |
| -------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Managed providers          | WorkOS AuthKit, Clerk, and Auth0                                            | Select one provider, its exact framework target, and whether setup remains manual with placeholders and server-only secrets. No real credentials or cloud provisioning in CLI flows or tests.               |
| Supabase Auth expansion    | Other frontend/backend frameworks, database targets, or server integrations | Select one exact target and its identity/data boundary. The existing browser path continues to use user-scoped Data API requests and RLS.                                                                   |
| JWT and database claims    | Transaction-scoped PostgreSQL claims bridging and third-party JWT issuers   | Decide whether to adopt a claims bridge or accept an external issuer, then define issuer trust, claims mapping, transaction scoping, and RLS isolation tests. Both remain out of scope until that decision. |
| Laravel API auth expansion | Personal access tokens, external JWTs, and account linking                  | These remain deferred. The approved PostgreSQL/MySQL slice adds only the existing first-party Sanctum SPA session mode; it does not add token auth, an external issuer, or account linking.                 |
| Additional Laravel modes   | New integrated modes, auth owners, databases, or PHP frameworks             | Select one exact mode and its single auth owner. Preserve Laravel 13 Livewire/Inertia and Laravel 12 API boundaries; do not layer native and provider auth without an explicit account-linking design.      |

## Entry and evidence requirements

For each owner-approved target, create a small implementation issue or PR that:

1. Confirms pinned upstream framework/SDK behavior and template feasibility before adding a selectable
   choice.
2. Names exactly one identity owner and keeps auth configuration separate from `manifest.modules`.
3. Keeps provider secrets out of prompts, flags, generated browser bundles, logs, and commits; privileged
   credentials remain server-side.
4. Tests production CLI generation, prompt/flag parity, compatibility, and pre-write rejection for the
   exact approved tuple.
5. Exercises setup, sign-in, session restoration, authorization or user isolation, and sign-out in a
   generated project. Supabase work also checks explicit Data API grants and RLS behavior; database
   expansion uses real operations against that database.
6. Updates support evidence, matrix, generated setup documentation, README, testing guidance, and
   changelog only when behavior changes. `Supported` requires the exact hosted runtime job and strict
   release gate on the final PR head.

## Explicit non-goals

- Do not add a provider, auth mode, framework, or database choice based only on a scaffold, compile,
  local harness, package availability, or neighboring supported row.
- Do not expose service-role keys or introduce a second auth owner implicitly.
- Do not provision provider projects or use real credentials in standard CI.
- Do not merge or publish as part of this planning document.
