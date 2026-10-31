# Authentication Provider and Laravel Mode Decision Audit

**Reviewed:** 2026-10-29  
**Repository:** `codex/shared-auth-config` at `1e06f48f6d3b65dd2eb9b073a82d9ad12c219071`  
**Scope:** historical evidence and owner questions for the [auth-provider/PHP expansion follow-up plan](../plans/active/omnicraft-auth-provider-php-stack-expansion-follow-up-plan.md). The owner approved the choices recorded in that active plan on 31 October 2026; use it for current decisions. This audit is not an implementation or support-matrix update.

## Owner direction update — 1 November 2026

The owner expanded the remaining implementation scope after the historical audit above. The active follow-up plan now records the current direction:

- Supabase Auth is the first managed provider. Setup remains manual, uses placeholders, and never provisions cloud resources or collects real credentials. The first target is React/Vite + TypeScript frontend-only.
- Supabase Auth is the identity owner. Signed-in requests use the user's JWT through the Supabase Data API; PostgreSQL RLS enforces row ownership. Direct-Postgres claim bridging and third-party JWT issuers remain deferred.
- Laravel API-only first-party auth uses Laravel's native session guard with Sanctum SPA cookie sessions. The initial authenticated target is the existing React/Vite + Laravel 12 API path on SQLite. The current Laravel 12 `None` behavior and unauthenticated database rows remain unchanged.
- WorkOS AuthKit, Clerk, Auth0, account linking, personal tokens, external JWTs, additional Supabase targets, and additional authenticated Laravel databases remain unselectable.

The Supabase target is selected as the narrowest existing architecture that implements the approved user-JWT/Data API/RLS model without implying that an ordinary PostgreSQL connection forwards Supabase identity. The Laravel API database target is deliberately SQLite-first; the existing Laravel 12 database support does not prove authentication support for PostgreSQL or MySQL.

Supabase's current [API key guidance](https://supabase.com/docs/guides/getting-started/api-keys) distinguishes a browser-safe publishable key from a secret key that bypasses RLS. The [Data API exposure change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically) reached existing projects on 30 October 2026, so generated SQL must grant only the required operations to `authenticated` in addition to enabling RLS and adding owner policies. The selected browser-only path does not need a secret key.

Laravel's official [Sanctum 12.x SPA documentation](https://laravel.com/docs/12.x/sanctum#spa-authentication) describes first-party cookie/session authentication with CSRF protection and `statefulApi` middleware. This is the basis for the Laravel API mode; personal-access-token endpoints are not part of this scope.

This update records owner-approved direction and a narrow implementation target. It does not establish support. Support status changes only after exact generated-project runtime scenarios and the hosted release gate pass on the final PR head.

> Historical snapshot: this audit predates v1.0.3. Laravel 13 + Livewire 4 with `None` or Laravel-native Fortify on SQLite has since shipped and passed its hosted integration/release gate. The existing Laravel 12 API path remains separate. For current support status and owner-approved next steps, use the active follow-up plan and the matrix at its recorded main commit.

## Repository and PR state

At review time, PRs #45, #46, #48, and #49 were open and mergeable. PR #49 was based on PR #48 and its head matched this checkout. Hosted run [#40878479758](https://github.com/doofx0071/omnicraft/actions/runs/40878479758) passed the 43-job CI set and `supported-stack-release-gate`; npm publish was skipped. This run verifies the current branch's declared evidence, not any new Laravel auth mode or managed provider.

The working tree already contained an unstaged deletion of `docs/plans/active/omnicraft-master-plan.md` and untracked auth-plan/test-output paths. They were preserved. Neither the master-plan deletion nor the active auth plan was changed.

## Evidence matrix

| Choice or combination | Current status | Evidence and boundary |
| --- | --- | --- |
| `None` authentication | Selectable | `AuthenticationSetup` and `AUTHENTICATION_CATALOG` expose `none`; it means no optional auth layer is composed. It does not establish that every selectable stack is otherwise supported. Manifest authentication is separate from `manifest.modules`. |
| Better Auth: React + Vite + TypeScript, Node + Express, Drizzle, SQLite | Supported | The support matrix records creation-time Better Auth coverage. Hosted database integration exercises generated registration, login, session persistence/restart, protected access, logout, password hash storage, and CRUD. `omnicraft add auth` reuses the same implementation and compatibility guard. |
| Better Auth: same stack with PostgreSQL or MySQL | Supported | The same matrix row and hosted database integration scenario cover both dialects, with generated-project installation/typecheck, migration, API boot, auth/session assertions, and CRUD. |
| Better Auth on any other frontend, backend, ORM, or database combination | Rejected / unselectable | `AUTHENTICATION_CATALOG['better-auth'].requirements` and `authenticationCompatibilityReason` constrain it to the exact tuple above. No evidence here supports widening it. |
| Supabase PostgreSQL database use | Separate from Supabase Auth | Existing generic PostgreSQL/Laravel or Node database rows do not prove Supabase Auth, Data API identity propagation, RLS behavior, or hosted Supabase support. Review the relevant database row independently. |
| Supabase Auth with RLS/JWT | Unselectable; unverified | No Supabase Auth provider is in the catalog or generated auth path. Supabase documents distinct public and server-only API keys, user JWT claims, RLS policies, and third-party OIDC JWT validation; none of those flows is tested by generic PostgreSQL integration. |
| WorkOS, Clerk, Auth0 | Unselectable; unverified | No provider adapter or setup choice exists. Official docs show different client/server credential and callback requirements; a shared generic “provider” flag would hide materially different integration contracts. |
| Laravel 12 + Eloquent + SQLite/PostgreSQL/MySQL API/data scaffold | Supported for database/API behavior only | The stack matrix and `php-laravel-integration` verify install, migration, active DB driver, and generated API operation. The current Laravel overlay has no authentication middleware or login flow. This does not support any Laravel auth mode. |
| Laravel Livewire integrated application | Planned/unselectable | No Livewire starter-kit selection or generated Livewire auth is present. Upstream Laravel 13 docs offer Livewire starter kits; the repo currently creates Laravel 12 with Composer. Version and installer strategy are unresolved. |
| Laravel Inertia React integrated application | Planned/unselectable | No Inertia starter-kit selection or generated auth is present. Laravel's starter-kit docs describe React + Inertia as an integrated Laravel app; do not treat it as the existing React/Vite + separate Express API tuple. |
| Laravel API-only application | Not a distinct selectable mode; current scaffold is not authenticated | Current Laravel overlay registers `/api/users` CRUD and lacks auth. Laravel's `install:api` installs Sanctum and API routes; it is a post-create setup command, not a separate starter kit option in the current installer interface. |

Current implementation touchpoints include `packages/cli/src/types.ts`, `capabilities.ts`, `compatibility.ts`, `prompts/run-prompts.ts`, `prefill.ts`, `scaffold/compose.ts`, `manifest.ts`, and `modules/auth.ts`. Laravel generation is wired through `packages/cli/src/index.ts`, the post-Composer layer in `scaffold/compose.ts`, `templates/server/php/laravel/`, and `scripts/php-laravel-e2e.ts`. Existing focused tests are co-located in `src/capabilities.test.ts`, `compatibility.test.ts`, `prefill.test.ts`, `prompts/run-prompts.test.ts`, `manifest.test.ts`, `engine.test.ts`, `support-evidence.test.ts`, and `src/modules/auth.test.ts`; the Laravel feature test is `packages/cli/tests/php/OmniCraftDatabaseApiTest.php`.

## Credential and provider setup boundaries

The safe generator contract should be: never collect, provision, print, or persist real provider credentials; never accept secrets through CLI flags; put only empty placeholders in generated `.env.example`; document where the user creates credentials and the required callback/origin URLs; keep server secrets in a local untracked server environment file and browser-safe public keys only in explicitly public-prefixed variables. The current Better Auth implementation follows manual secret setup guidance and does not generate or store a real secret.

Provider configuration cannot be generalized without choosing the provider and app architecture:

| Provider | Evidence from official docs | Consequence for a future adapter |
| --- | --- | --- |
| Supabase | [API keys](https://supabase.com/docs/guides/getting-started/api-keys) distinguishes a public publishable key from a server-only secret key that bypasses RLS. [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) uses request JWT claims and warns against mutable user metadata for authorization. | Public client configuration and server service credentials must be separate; service-role access cannot be presented as user-scoped RLS. |
| WorkOS | [AuthKit](https://workos.com/docs/authkit) and [Laravel SDK](https://workos.com/docs/sdks/laravel) require app/provider setup and server credentials for server integrations. Some client SDK flows have public-client modes, which do not imply Laravel or OmniCraft support. | Must settle redirect URLs, session/cookie ownership, server key placement, and whether the app handles passwords. No provisioning from the generator. |
| Clerk | [Environment-variable docs](https://clerk.com/docs/guides/development/clerk-environment-variables) distinguish publishable client configuration from `CLERK_SECRET_KEY`. | Keep publishable browser key and server secret separate; verify frontend environment prefix and server framework integration. |
| Auth0 | [SPA guidance](https://support.auth0.com/center/s/article/Unauthorized-errors-seen-on-SPA-when-Calling-oauth-token) treats a browser SPA as a public client; [callback guidance](https://support.auth0.com/center/s/article/Callback-URL-Mismatch-Error-Is-Not-in-the-List-of-Allowed-Callback-URLs) requires exact callback allowlisting. | Never place a client secret in a SPA; generate clear callback/origin setup instructions and verify server-side token validation separately. |

These docs support a credential boundary and setup checklist, not a provider support claim. Provider sandbox tests would need separate, secret-gated CI and strict log/artifact redaction; they are not a substitute for a public no-secret generation test.

## Supabase Auth, JWT, and RLS boundary

Supabase's [Auth overview](https://supabase.com/docs/guides/auth) describes Auth as an identity service that issues user JWTs. Its [third-party auth guide](https://supabase.com/docs/guides/auth/third-party/overview) accepts certain third-party OIDC JWTs for Supabase services, subject to asymmetric signatures, issuer discovery, key IDs, and key refresh behavior; it also states Supabase Auth cannot currently be disabled. The [RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security) describes `auth.uid()` as derived from the request's JWT claims.

**Inference:** OmniCraft's direct PostgreSQL driver paths do not automatically forward the caller's Supabase user JWT into Supabase Data API request context. A direct SQL connection therefore cannot claim user-scoped RLS merely because it connects to the same Postgres database. A future design must choose a tested Data API path or an explicitly scoped, transaction-local identity/claims bridge with safe connection-pool cleanup. It must test anonymous denial, user A/B isolation, role/claim freshness, privileged-key isolation, and failed-request cleanup. It must also decide whether external-provider JWT bridging is required; that is a separate feature from accepting Supabase Auth as the sole provider.

## Laravel mode and auth ownership

The repo currently runs `composer create-project laravel/laravel:^12.0` and overlays its own routes, controller, model, and migration. Its current [PHP test](../../packages/cli/tests/php/OmniCraftDatabaseApiTest.php) exercises the database API. There is no auth mode selection, starter-kit integration, Sanctum/Fortify setup, Livewire UI, or Inertia UI.

Official Laravel 13 [starter-kit docs](https://laravel.com/docs/13.x/starter-kits) distinguish Livewire and React/Inertia kits. They offer Laravel-native auth and a WorkOS AuthKit variant; the WorkOS path needs configured provider credentials and redirect settings. Laravel's [authentication docs](https://laravel.com/docs/13.x/authentication) distinguish built-in session auth, Fortify's headless auth endpoints, Sanctum for first-party SPA/API flows, and Passport for full OAuth2. [API routing docs](https://laravel.com/docs/13.x/routing) describe `php artisan install:api` as an API setup step that installs Sanctum, rather than a separate starter kit.

| Laravel mode | UI/runtime shape | Possible single auth owner | Duplication to prevent |
| --- | --- | --- | --- |
| Livewire integrated | Laravel-rendered app with Livewire | Laravel-native Fortify/starter-kit auth, or one selected managed provider, or None | Do not add Better Auth's separate Node service or a second Laravel login/session system. |
| Inertia React integrated | Laravel routes/session + Inertia React UI | Laravel-native Fortify/starter-kit auth, or one selected managed provider, or None | Do not confuse this with separate React/Vite + Express; don't run native password auth alongside provider sign-in without approved account linking. |
| API-only | JSON API; browser/client is external or separately scaffolded | Sanctum for first-party session/token use, or one selected external issuer with server-side validation | Do not combine Sanctum-issued identity, native password endpoints, and provider tokens without a documented principal mapping and revocation policy. |

These are architectural candidates, not settled choices. The installer source currently exposes `--livewire`, `--react`, `--workos`, and `--no-authentication`; it does not expose a separate API-only starter-kit option. That source tracks `master`, so any implementation must inspect and pin the actual installer release and test its non-interactive behavior.

## Decisions that required project-owner input

The questions below preserve the options and trade-offs presented before the owner responded. The accepted choices are recorded in the active follow-up plan.

1. Which first managed provider, if any, should be prioritized, and for which exact frontend/backend tuple? The catalog should remain closed until a provider and target integration are selected.
2. For Supabase, should auth use Supabase's Data API so the user JWT reaches RLS, or should OmniCraft build and prove a direct-Postgres claims bridge? Is third-party OIDC bridging in scope, or is Supabase Auth the sole identity owner?
3. For each Laravel mode, who owns login/session state: Laravel-native auth, one managed provider, or None? Should modes allow only one choice, and is account linking explicitly out of scope initially?
4. Which Laravel generation baseline is intended: remain on Laravel 12 and identify compatible starter-kit tooling, or move the generator to Laravel 13 and take on a framework-version migration? The current repo baseline and current starter-kit docs differ.
5. For API-only, is the intended client first-party (Sanctum cookie/session), token-based (Sanctum personal tokens), or third-party bearer JWT? These are different modes and tests.
6. If credentials remain manual, confirm the contract above: no secrets in prompts/flags, only placeholders and dashboard instructions in generated output, and secret-gated provider tests are opt-in and redacted.
7. Should the existing public demo `/api/users` CRUD remain public in a `None` mode, or should auth-enabled modes protect it and include explicit unauthenticated/authorized behavior?

## Smallest conditional implementation slice (as of 29 October 2026)

At the time of this audit, no provider or Laravel mode should be implemented until the owner resolved the Laravel version and auth owner. The selected Livewire + Laravel-native auth slice has since shipped in v1.0.3. Inertia React, API-only auth, managed providers, Supabase Auth/RLS, and other Laravel database/auth tuples remain unselectable until separately implemented and verified. Do not update any Supported matrix row before exact hosted evidence passes.

Expected touchpoints for that conditional slice:

- CLI model and preflight: `packages/cli/src/types.ts`, `capabilities.ts`, `compatibility.ts`, `prefill.ts`, `prompts/run-prompts.ts`, `args.ts`, and `manifest.ts`; record auth/mode independently of `modules`.
- Generation and templates: `packages/cli/src/index.ts`, `packages/cli/src/scaffold/compose.ts`, and a dedicated `packages/cli/templates/server/php/laravel-livewire-native/` layer (new), preserving the current no-auth Laravel layer.
- Focused tests: `args.test.ts`, `capabilities.test.ts`, `compatibility.test.ts`, `prefill.test.ts`, `prompts/run-prompts.test.ts`, `manifest.test.ts`, and `engine.test.ts`; assert interactive/flag parity, rejection before writes, mode/auth separation, and no effect on `omnicraft add auth`.
- Generated app: add a dedicated `packages/cli/tests/php/OmniCraftLaravelAuthTest.php` plus `packages/cli/scripts/php-laravel-auth-e2e.ts` (new), or extend the existing PHP harness only if it cleanly keeps current API coverage independent. Cover install, migration, register/login/logout, protected and anonymous requests, session persistence/invalidation, and the generated UI route.
- Hosted evidence: add a narrowly scoped `php-laravel-livewire-auth-integration` job to `.github/workflows/ci.yml` with pinned PHP/Composer and SQLite; wire it into `supported-stack-release-gate`. Add the exact scenario in `packages/cli/src/support-evidence.ts` and its unit tests. Run full required CI on the exact PR head. Initially label the new tuple Scaffold-verified/Selectable only as justified; promote to Supported only after the generated app's exact database/auth scenario and gate pass.
- Docs after behavior exists: update README usage/options, `docs/development/testing-strategy.md`, `docs/development/database-auth-integration-testing.md`, the stack matrix only with evidence, and `CHANGELOG.md`. Do not edit the active expansion plan until its acceptance criteria have evidence.

This was a proposed sequence at audit time, not an authorization to implement unselected modes. Follow the approved current scope in the active follow-up plan.

## Official references checked

- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase third-party auth](https://supabase.com/docs/guides/auth/third-party/overview)
- [Supabase request-claims troubleshooting](https://supabase.com/kb/troubleshooting/permission-errors-when-granting-custom-roles-access-to-the-auth-schema)
- [Laravel 13 starter kits](https://laravel.com/docs/13.x/starter-kits)
- [Laravel 13 authentication](https://laravel.com/docs/13.x/authentication)
- [Laravel 13 API routing](https://laravel.com/docs/13.x/routing)
- [Laravel installer option source](https://github.com/laravel/installer/blob/master/src/NewCommand.php) (mutable upstream branch; pin a release before implementation)
- [WorkOS AuthKit](https://workos.com/docs/authkit), [WorkOS Laravel SDK](https://workos.com/docs/sdks/laravel)
- [Clerk environment variables](https://clerk.com/docs/guides/development/clerk-environment-variables)
- [Auth0 SPA secret guidance](https://support.auth0.com/center/s/article/Unauthorized-errors-seen-on-SPA-when-Calling-oauth-token) and [callback URL guidance](https://support.auth0.com/center/s/article/Callback-URL-Mismatch-Error-Is-Not-in-the-List-of-Allowed-Callback-URLs)
