# OmniCraft Auth Provider and PHP Stack Expansion Plan

**Prepared:** 27 October 2026  
**Closed:** 31 October 2026  
**Repository:** <https://github.com/doofx0071/omnicraft>  
**Archived location:** `docs/plans/completed/omnicraft-auth-provider-php-stack-expansion-plan.md`  
**Status:** Closed and split — delivered slices have evidence; unfinished scope has an active follow-up plan.  
**Parent plan:** `docs/plans/completed/omnicraft-master-plan.md`  
**Related plan:** `docs/plans/completed/omnicraft-testing-infrastructure-plan.md`

---

## Closeout — 31 October 2026

This broad proposal is retired as one execution checklist. **Its original expansion goals are not all implemented.** The active follow-up at [`../active/omnicraft-auth-provider-php-stack-expansion-follow-up-plan.md`](../active/omnicraft-auth-provider-php-stack-expansion-follow-up-plan.md) owns the remaining implementation and explicit deferrals; do not infer support from this archive.

PR #54 merged the release scope into `main` at `37f89cc7b892bccbec7a375314179ab22111dd98`. Exact-head PR run [#41151281881](https://github.com/doofx0071/omnicraft/actions/runs/41151281881) and main-push run [#41154038666](https://github.com/doofx0071/omnicraft/actions/runs/41154038666) passed the required checks and `supported-stack-release-gate`; the tag-only publish check was expectedly skipped in those runs.

The release delivered a shared create-time auth catalog for the existing `None`/Better Auth choices on the exact React/Vite + Express + Drizzle database tuples, plus Laravel 13 + Livewire 4 on SQLite with `None` or Laravel-native Fortify auth. The existing Laravel 12 API path remains separate. Each combination keeps the exact status and evidence recorded in the [stack support matrix](../../templates/stack-support-matrix.md).

The successor plan records the owner's approved Laravel Inertia React scope and the remaining implementation work and explicit deferrals for managed providers, API-only auth, and expansion beyond the verified Laravel Livewire SQLite path. No provider or support-matrix claim is implied by archiving this proposal.

## 1. Executive recommendation

Create this as a **separate, focused execution plan**. Do not merge all of its implementation details into the master plan or database-testing plan.

- The **master plan** remains the high-level engineering and product roadmap.
- The **database/auth testing plan** defines the shared infrastructure for integration tests against real databases and generated applications.
- This plan defines the implementation of authentication choices and the PHP/Laravel stack family.
- `ROADMAP.md` should summarize milestones and link to GitHub issues and this plan; it should not duplicate this document.

The work has two related but distinct tracks:

1. A **provider-aware authentication integration system** used from both initial scaffolding and `omnicraft add auth`.
2. A **PHP stack family**, starting with Laravel and its supported application modes, then evaluating Symfony and lightweight API frameworks.

Implement the integration contracts and testing foundation first. Do not make all listed providers or PHP frameworks selectable until the exact combinations are implemented and verified.

## 2. Goals

1. Offer authentication during initial interactive project creation.
2. Keep `omnicraft add auth` for projects that were created without authentication.
3. Make both workflows use shared provider adapters, compatibility rules, security requirements, and test fixtures.
4. Add Laravel as a first-class stack without treating Livewire as a backend framework or as a standalone frontend framework.
5. Clarify the distinction between Laravel's integrated full-stack app and a separate React frontend + Laravel API.
6. Add a controlled path for WorkOS AuthKit, Supabase Auth, Clerk, Auth0, existing Better Auth support, Laravel's native authentication, and no authentication.
7. Validate actual database and auth behavior with repeatable tests, not just template-copy or compile checks.
8. Keep PHP frameworks extensible, while beginning with Laravel rather than attempting to support every PHP framework simultaneously.

## 3. Non-goals for the first implementation phase

- Do not immediately support every auth provider on every framework/database pair.
- Do not implement a custom password/session system when a maintained framework/library or managed provider already handles the problem.
- Do not auto-create paid cloud resources, external auth applications, OAuth credentials, or provider dashboards without explicit user action and a dedicated authenticated integration.
- Do not treat all auth choices as interchangeable. Some are application libraries, some are hosted identity platforms, and some are tied to a database/backend platform.
- Do not force all Laravel projects to use React, or treat every Laravel project as an API-only backend.
- Do not add Symfony, Slim, and CodeIgniter concurrently with the initial Laravel implementation.
- Do not mark support based on a successful scaffold alone.

## 4. Current repository baseline to verify before coding

The public repository currently documents these relevant facts:

- The CLI package is `create-omnicraft`, invoked through `npm create omnicraft@latest`.
- The interactive flow includes a PHP backend runtime and Laravel as a backend-framework option.
- Issue #23 documents `omnicraft add auth` with Better Auth email/password support for Express + Drizzle, and reports functional testing on SQLite.
- The support matrix must be reconciled with current code and test evidence before expanding it.
- The master plan's stated package baseline may be stale; re-read the live repository, package manifest, roadmap, and issue history before implementing this plan.

Sources:
- Repository: <https://github.com/doofx0071/omnicraft>
- `AGENTS.md`: <https://raw.githubusercontent.com/doofx0071/omnicraft/main/AGENTS.md>
- `ROADMAP.md`: <https://raw.githubusercontent.com/doofx0071/omnicraft/main/ROADMAP.md>
- `README.md`: <https://raw.githubusercontent.com/doofx0071/omnicraft/main/README.md>
- Current stack support matrix: <https://raw.githubusercontent.com/doofx0071/omnicraft/main/docs/templates/stack-support-matrix.md>
- Existing auth issue: <https://github.com/doofx0071/omnicraft/issues/23>
- Template guide issue: <https://github.com/doofx0071/omnicraft/issues/27>

These are audit starting points, not a substitute for inspecting the current checkout. Confirm the actual source behavior before modifying code or marking any compatibility as supported.

---

## 5. Authentication model: distinguish the categories

OmniCraft should call the overall selection **Authentication setup** or **Authentication solution**. Do not call every choice a “provider” in internal code because the options have different architectures.

| Choice | Category | Typical responsibility | Implementation rule |
|---|---|---|---|
| None | No authentication | No auth-related dependencies, routes, schema, or middleware | Omit all auth setup unless the base framework inherently includes it; provide an explicit no-auth starter if the selected official starter kit defaults to auth. |
| Better Auth | Application-integrated auth library | App/server-owned auth endpoints, sessions, database adapter/schema, auth client | Keep current support for verified Node stack combinations; extend framework/database coverage only with tests. Not a default Laravel choice. |
| Supabase Auth | Managed auth integrated with Supabase platform | Hosted identity/session APIs, Supabase clients, JWT/RLS-aware access | Offer with Supabase platform/database choices and compatible standalone setups. Do not assume selecting Supabase Postgres automatically enables auth. |
| WorkOS AuthKit | Managed identity/auth platform | Hosted auth/session integration, social login, passkeys, MFA/SSO capabilities depending on configuration | Use official SDKs/starter variants where supported; keep credentials external and document dashboard setup. |
| Clerk | Managed authentication/user-management service | Framework/client SDKs and server-side session/user verification | Only offer for framework/backend combinations with a tested SDK integration and documented authorization model. |
| Auth0 | Managed identity platform | OIDC/OAuth login, server-side token/session handling, provider-specific configuration | Validate the exact maintained SDK and framework integration; do not rely on stale quickstarts as proof of current support. |
| Laravel native auth | Framework-provided auth | Laravel authentication scaffolding, sessions, routes, password reset, email verification, etc. depending on starter-kit features | Offer only for Laravel stack modes. Use official Laravel starter kit support where practical. |

**Retain Better Auth** as an option for the compatible Node.js stack. The requested new list should not accidentally remove an existing feature.

### 5.1 Authentication is different from authorization

Authentication answers “who is the user?” Authorization answers “what can this user do?”

The first auth milestone covers the chosen provider's appropriate sign-in/session lifecycle and a protected-route/resource example. RBAC, organization roles, permissions, and policy generation should be separate optional integrations unless the chosen provider/framework starter explicitly includes them and OmniCraft documents that fact.

### 5.2 Avoid duplicate “None” controls

Choose one UI design and use it consistently:

**Recommended simple UI:** ask `Authentication setup?` and present `None` plus the compatible solutions in one selection. This avoids asking “Include authentication? Yes/No” and then also including “None” in the next list.

**Alternative two-step UI:** ask `Include authentication? Yes/No`; only if Yes, show the compatible provider list. In that design, do not include “None” in the provider list because No already represents it.

Either model is acceptable. The important rule is to avoid asking the same decision twice.

---

## 6. Initial CLI flow and context-aware authentication prompts

### 6.1 Recommended high-level flow

1. Project name and destination.
2. Application type (initially Web App; other existing supported types remain governed by the support matrix).
3. Architecture:
   - Frontend-only app.
   - Integrated full-stack framework.
   - Separate frontend + backend/API.
4. Select framework/runtime based on the architecture.
5. If applicable, select frontend mode, backend framework, database, and ORM.
6. Select authentication setup from the **compatible choices for the selected stack**.
7. Select optional auth features only when supported: email/password, social providers, passkeys, MFA, etc.
8. Select styling, testing tools, and other extras.
9. Review the complete configuration; allow back navigation.
10. Generate, configure, install if requested, verify, and show setup instructions.

Do not allow the displayed menu to become the compatibility engine. Prompt choices must be derived from the authoritative capability registry or validated against it before generation.

### 6.2 Supabase-specific prompt behavior

If the selected backend/database platform is Supabase, make its auth integration explicit and context-aware.

Suggested prompt copy:

> **You selected Supabase. Which authentication setup would you like?**
> - Supabase Auth (recommended for a Supabase-native setup)
> - Use another compatible auth solution
> - No authentication

If `Supabase Auth` is selected, configure its appropriate client/session handling and document the project's RLS policies. If “another solution” is selected, only present providers with a verified integration for the selected framework and Supabase's data-access model.

Do not silently enable auth just because the user chose Supabase as a database. A database can be used with Laravel's own auth, Better Auth, or another compatible identity provider. The choice of identity provider and the authorization model for Supabase data must both be explicit.

Supabase documents first-class third-party auth support for Clerk, Auth0, WorkOS, and other OIDC-compatible providers for its Data API, Storage, Realtime, and Functions. However, OmniCraft still needs to configure and test each relevant combination, especially JWT claims and Row Level Security (RLS): <https://supabase.com/docs/guides/auth/third-party/overview>.

### 6.3 Do not conflate auth configuration with account provisioning

Initial project generation may create config files and tell the user where to get keys. It must not invent or expose secrets, and must not claim a hosted provider project has been provisioned unless OmniCraft actually authenticated and performed that action.

Use `.env.example` with placeholders, never populated credentials. Validate required variables at startup and generate setup instructions for redirect URLs, callback URLs, local origins, and provider dashboard settings.

---

## 7. Share the auth integration between initial generation and `omnicraft add auth`

Both entry points should call the same integration definitions.

```text
           Auth integration catalog
    (provider, requirements, templates, tests)
                      |
          +-----------+-----------+
          |                       |
          v                       v
 Initial CLI generation       omnicraft add auth
          |                       |
 New-project composition      Existing-project detection
          |                       |
          v                       v
 Generated files             Patch/merge existing files safely
          |                       |
          +-----------+-----------+
                      v
             Shared verification suite
```

### 7.1 Shared provider adapter contract

Use a typed contract or equivalent pattern consistent with the current architecture. It should describe:

- Stable provider/integration ID and display name.
- Category: native framework auth, application library, or managed provider.
- Supported framework and backend/runtime combinations.
- Supported database/ORM requirements, if any.
- Required variables (names and purpose only; never actual values).
- Files/assets to add.
- Dependencies to install.
- Scripts/migrations to add.
- Existing configuration anchors/patch strategies needed for `omnicraft add`.
- Preflight requirements and incompatibility reasons.
- Verification profile and test cases.
- Documentation link and onboarding instructions.

The provider adapter may have different operations for `composeNewProject()` and `addToExistingProject()`, but security-sensitive config and compatibility logic must not be duplicated.

### 7.2 `omnicraft add auth` safety rules

- Inspect the project's OmniCraft manifest and actual package/framework configuration.
- Detect whether auth is already installed; do not duplicate it.
- Offer only auth integrations compatible with the detected stack.
- Show a dry-run summary of changed files, dependencies, scripts, environment variables, and migrations.
- Validate all patch anchors before writing.
- Preserve user files; fail with clear conflict details if a safe merge is not possible.
- Never automatically run a destructive database migration.
- Make repeated invocation idempotent.
- Record applied integration ID/version in project metadata.
- Do not claim provider dashboard configuration is complete if the user must still configure it manually.

### 7.3 Initial generation behavior

On a new project, the selected provider should be composed before dependency installation. Provider-specific post-steps (for example, generating an ORM schema, running a framework command, or formatting) should be explicit, reproducible, and part of the adapter contract. If an external credential is unavailable, generation can still finish with a valid `.env.example` and clearly identified follow-up steps when that is safe for the integration.

---

## 8. Laravel is both a backend and an integrated full-stack framework

Do not model Laravel as only “PHP backend + arbitrary separate frontend”. Laravel can render its own UI and provide authentication, routes, database access, and server logic. Its official starter kits include Livewire and Inertia-based React/Vue/Svelte approaches; Laravel 13 documentation describes these choices and built-in or WorkOS-based authentication variants.

Official sources:
- Laravel starter kits: <https://laravel.com/docs/starter-kits>
- Laravel installation: <https://laravel.com/docs/installation>
- Laravel frontend options: <https://laravel.com/docs/13.x/frontend>
- Livewire 4: <https://livewire.laravel.com/docs/4.x/installation>
- Laravel installer source/options: <https://github.com/laravel/installer/blob/master/src/NewCommand.php>

### 8.1 Laravel application modes

When the user chooses PHP → Laravel, ask what kind of Laravel project they want:

1. **Laravel + Livewire** — integrated Laravel application using Blade and Livewire for reactive UI. UI logic can be primarily PHP-driven. This is not a separate frontend app and is not “a separate backend framework.”
2. **Laravel + React via Inertia** — a single Laravel app whose UI uses React and Inertia. It is not the same architecture as a standalone Vite SPA talking to a separate API service.
3. **Laravel + Vue via Inertia** — same general integration model with Vue.
4. **Laravel + Svelte via Inertia** — only offer when supported by the selected Laravel starter kit/version and tested by OmniCraft.
5. **Laravel API-only** — Laravel provides an API for a separately generated frontend. It should not install Livewire/Inertia scaffolding by accident.
6. **Laravel minimal/blank** — a framework base with no UI starter or auth if that option is implemented and clearly documented.

Only expose choices that OmniCraft can generate in the target platform/tooling environment.

### 8.2 Preserve the separate frontend + API architecture

If the user chooses `React + Vite` and then `PHP + Laravel`, default to a **separate frontend + Laravel API** workspace only if OmniCraft has a verified integration for it. This has distinct CORS, authentication, cookie/token, and deployment concerns.

Do not silently convert that selection to Laravel + Inertia React, because it changes project architecture and where the frontend code lives. Instead, offer an explicit architecture choice:

- `Separate React SPA + Laravel API`
- `Laravel full-stack + React via Inertia`

Explain briefly what differs. The code layout, auth flow, routing, scripts, and deployment model will differ too.

### 8.3 Use the official Laravel starter generator where practical

Prefer the official Laravel installer/starter kits for a maintained foundation. The Laravel installer supports framework/starter choices including React, Vue, Svelte, and Livewire, and authentication choices including Laravel's built-in auth, WorkOS, and no auth in its current source. It also supports non-interactive option flags; exact flags must be verified against the pinned installer version at implementation time.

Do not require users to install a global Laravel CLI without giving a clear error or setup path. Decide and document whether OmniCraft will:

- Detect and use the Laravel installer if available, with clear prerequisite messaging; or
- Safely bootstrap/invoke a pinned official installer in an isolated way; or
- Use another reproducible official starter-kit method.

Choose one implementation strategy after a prototype. Never allow Laravel's own wizard to unexpectedly start a second interactive setup sequence when OmniCraft is meant to own the user interaction.

### 8.4 Database support for Laravel

Start with SQLite for the lowest-friction local path, then PostgreSQL and MySQL with actual migration and runtime testing. Use Laravel's native database configuration/Eloquent where appropriate rather than forcing Drizzle or Prisma into PHP projects.

Generated database configuration must include correct environment placeholders, safe connection defaults, migration commands, and troubleshooting. If Supabase is selected as a hosted PostgreSQL database, distinguish:

- Laravel's own native authentication tables/guards with Supabase Postgres as storage; versus
- Supabase Auth as the identity service.

These are separate configurations. Supabase's Laravel quickstart currently illustrates Laravel's own `users` table and authentication with Supabase PostgreSQL, not Supabase Auth: <https://supabase.com/docs/guides/getting-started/quickstarts/laravel>.

---

## 9. PHP framework expansion strategy

Implement **Laravel first**, then evaluate additional frameworks. Do not add PHP frameworks merely to fill a list.

| Priority | Framework | Intended initial role | Rationale |
|---|---|---|---|
| P0 | Laravel | Integrated full-stack app, Livewire/Inertia UI, or API-only backend | Closely matches the requested use case, has official starter kits, and has well-defined authentication/database conventions. |
| P2 | Symfony | Full-stack Symfony app and API backend | Mature framework with a distinct security/configuration model; requires its own adapter and test suite. |
| P3 | Slim | Lightweight PHP API | Useful for minimal APIs; requires OmniCraft to compose routing, validation, auth, and database conventions explicitly. |
| P3 | CodeIgniter | Lightweight full-stack web app/API | Consider after a concrete user demand and a clear starter/compatibility contract. |

This is a proposed order; the implementation should verify currently maintained versions and the official documentation for each framework before adding it to the supported matrix.

### 9.1 PHP should be a runtime/language dimension

Define the PHP stack in the capability catalog as:

- Runtime/language: PHP.
- Framework: Laravel, Symfony, Slim, CodeIgniter, etc.
- Application mode: integrated full-stack, rendered web app, or API-only.
- UI approach: framework-specific options (e.g. Livewire, Inertia React/Vue/Svelte) where applicable.
- Database: SQLite, PostgreSQL, MySQL only when the chosen adapter is tested.
- Authentication: native framework auth, a compatible external provider, or none.

Don't assume an ORM selection model that is designed for Node can apply to PHP. Laravel normally uses Eloquent, and Symfony commonly uses Doctrine; each adapter must follow its framework ecosystem. Database providers and data-access libraries should be separately modeled.

### 9.2 Supported PHP/version policy

At implementation time, verify current PHP/framework supported-version policies from official sources. Laravel 13 documentation currently identifies PHP 8.3+ as its baseline, and PHP's support table changes over time. Set and test an explicit support range rather than depending on the developer machine's PHP version.

Sources:
- PHP supported versions: <https://www.php.net/supported-versions.php>
- Laravel release/support policy: <https://laravel.com/docs/13.x/releases>

---

## 10. Authentication provider rollout order

The goal is a provider catalog with honest per-framework support, not a single binary flag that claims every provider works everywhere.

### Phase A — Stabilize existing Better Auth

- Preserve the currently verified Express + Drizzle + SQLite path.
- Use the testing-infrastructure plan to add disposable PostgreSQL and MySQL coverage where intended.
- Verify migrations/schema generation, registration, login, logout, session validation/invalidation, protected resource, invalid credentials, cookie/security attributes, and server error handling.
- Keep provider keys/secrets out of generated files and logs.
- Do not automatically generalize Better Auth to Fastify, Hono, Python, or PHP without stack-specific adapter work and tests.

### Phase B — Add the common auth catalog and initial CLI prompt

- Add the auth selection to the configuration schema and interactive wizard.
- Preserve the same config semantics for interactive and `--yes`/flag mode.
- Filter provider choices based on the selected architecture/framework/backend/database.
- Add `none` behavior that proves no auth dependencies/routes/schema are injected.
- Connect create-time composition to the same provider adapter used by `omnicraft add auth`.
- Add tests that prove both flows use the same compatibility decisions.

### Phase C — Supabase Auth and Supabase-aware data access

- Add a dedicated Supabase Auth integration only when the target client/server architecture has a documented supported path.
- For Vite, use browser-safe public project config and secure RLS policies; never expose service-role keys or database passwords in browser code.
- For SSR/framework backends, implement the appropriate server/browser client separation and cookie/session handling.
- If using external identity providers with Supabase, implement the correct third-party JWT and RLS configuration rather than assuming the provider's SDK alone completes the integration.
- Test auth-aware user data access against disposable or controlled test projects and ensure tenant/user isolation policies are verified.
- Keep Supabase Postgres + Laravel native auth distinct from Supabase Auth + Supabase Postgres.

### Phase D — WorkOS AuthKit

- Use official WorkOS SDKs or starter-kit integrations for the framework being implemented.
- WorkOS documents SDK paths for Next.js, React, React Router, Node/Express, PHP, and Laravel. Laravel also has official starter-kit variants for WorkOS AuthKit.
- Start with the combination that offers the clearest official starter path, likely Laravel starter-kit modes and one Node web framework; expand only after each is validated.
- Generate environment placeholders, callback/redirect URL guidance, session middleware/client integration, protected-route examples, and tests.
- Do not claim provider application provisioning is complete unless OmniCraft actually performed it.

Sources: <https://workos.com/docs/authkit> and <https://workos.com/docs/sdks/laravel>.

### Phase E — Clerk

- Verify first-party framework SDK/support for each target stack at implementation time.
- Use supported client/server components and server-side identity verification; don't treat a frontend-only SDK as sufficient to secure API routes.
- For Supabase integration, use the official Supabase third-party-auth setup and validate JWT claims/RLS.
- Start with one mature React framework path before expanding to Laravel/PHP. A PHP SDK or backend API wrapper does not automatically mean every Laravel starter kit is fully supported.

Sources: <https://clerk.com/docs> and <https://clerk.com/docs/reference/overview>.

### Phase F — Auth0

- Use current official Auth0 SDK/quickstart guidance for the target stack and pin a known compatible package range.
- Verify login/callback/logout, session/state validation, protected endpoints, token audience/issuer validation when APIs are involved, and environment handling.
- The discovered Laravel quickstart refers to older Laravel 9/10 versions, so do not treat it as sufficient evidence for modern Laravel support without checking the current SDK maintenance status and doing an implementation spike.
- Add Supabase third-party-auth configuration only through a separate, tested combination.

Source starting point: <https://auth0.com/docs> (select current framework-specific quickstarts; verify package maintenance and version compatibility before implementation).

### Phase G — Expand auth support to other frameworks

After the initial provider integrations are stable, expand framework-by-framework using the same contract. The support matrix should be precise: for example, `WorkOS + Laravel Livewire` and `WorkOS + Laravel Inertia React` are separate target configurations for verification, even if they share an SDK or some files.

---

## 11. Laravel authentication selection

Laravel requires an additional distinction because its official starter kits already include authentication choices.

For a Laravel integrated-app mode, offer only verified choices such as:

- **Laravel native authentication** — official starter kit's built-in authentication scaffolding.
- **WorkOS AuthKit** — available through official Laravel starter-kit variants for supported UI modes.
- **Supabase Auth** — planned only after a Laravel-specific integration has been implemented and tested; do not assume pointing Laravel's DB connection at Supabase automatically uses Supabase Auth.
- **Clerk** — offer only after the specific Laravel/PHP server/client integration and authorization model are validated.
- **Auth0** — offer only after the current supported Laravel/PHP integration is verified.
- **None** — select an official blank/no-auth path or remove starter-kit auth through a verified supported path; do not scaffold auth then try to silently delete arbitrary files.

For API-only Laravel, provider integration is different from Laravel Livewire/Inertia. The generated app must protect the API correctly and document whether it accepts provider-issued access tokens or uses Laravel-managed sessions. Never show a provider option in API-only mode solely because it works in the integrated full-stack starter.

### Avoid duplicated auth scaffolding

If the selected Laravel official starter kit already provides Laravel native auth or WorkOS AuthKit, do not separately add a second auth integration. The selected auth choice must be passed into the Laravel generator or applied by a tested Laravel-specific adapter, not layered on top of a conflicting auth implementation.

---

## 12. Testing strategy and Docker/Testcontainers

This plan depends on the test infrastructure plan. Maintain separate fast and integration test tiers.

### Tier 1 — Unit tests (no Docker)

- Auth prompt branching and defaults.
- Provider compatibility filtering.
- Supabase-specific behavior when Supabase is selected.
- `none` produces no auth modules/dependencies.
- Invalid provider/framework/database combinations fail before filesystem writes.
- Project manifest and adapter selection.
- Correct no-auth/native-auth/provider choice for each architecture.

### Tier 2 — Composition tests (no live auth provider)

- Generated files and dependency manifests.
- Environment example contents and secret redaction rules.
- Routes, middleware/client wrappers, scripts, migrations, and documentation.
- No accidental duplicate auth implementation.
- No unresolved tokens or conflicting file writes.
- `omnicraft add auth` dry run, conflict, idempotency, and existing-project detection.

### Tier 3 — Runtime + real database tests (Docker/Testcontainers)

Use disposable containerized databases for real integration checks where the adapter supports them:

- SQLite: native local database; no container required.
- PostgreSQL: disposable container.
- MySQL: disposable container.
- Redis: only if/when a supported auth/session integration actually requires it.

Test migrations, startup, registration/login/session flows, protected routes/resources, CRUD, isolation, errors, and teardown. Avoid fixed public ports when using Testcontainers; wait for service readiness and clean up containers even on failure.

For Laravel, run Composer installation, framework migrations, the appropriate Pest/PHPUnit suite, and a basic HTTP/database workflow. For Node stacks, run package installation, typecheck/build, and HTTP-level integration tests.

### Tier 4 — Real provider sandbox tests (manual/nightly or explicitly gated)

External providers may require accounts, dashboard settings, callback URLs, API secrets, and actual OAuth redirects. Do not make every normal PR depend on a personal live provider account.

- Use deterministic local mocks/stubs for unit and adapter tests, but do not count these as full provider E2E verification.
- Add a separate secret-gated integration workflow or documented manual verification for real WorkOS, Clerk, Auth0, and Supabase projects.
- Use sandbox/test applications and rotate credentials where appropriate.
- Never log tokens, cookies, authorization codes, secret keys, or full auth headers.
- Test callback URL validation, state/nonce handling where applicable, rejected/malformed tokens, session invalidation, unauthorized access, and provider outage/error behavior.

### Tier 5 — Browser E2E

Use Playwright for browser-based sign-in journeys where the architecture calls for web UI. Cover redirect/callback, login state, protected page, logout, and unauthenticated access. For Laravel native auth, test Laravel routes and middleware with framework tests as well; browser tests supplement rather than replace them.

### CI design

- Keep unit/fast scaffold checks in normal CI.
- Use a Linux runner with Docker for Testcontainers/PostgreSQL/MySQL integration tests.
- Retain a Windows runner for Windows-specific path/process behavior when needed; don't assume Linux service-container instructions automatically work on Windows.
- Run real provider tests only in a separate secret-gated workflow.
- Ensure all generated-project reports distinguish scaffold success, install/build success, database/runtime success, and provider-auth E2E success.

---

## 13. Support matrix model

Track support across dimensions instead of marking an entire provider as simply “supported”.

At minimum, capture:

- Framework/app mode.
- Runtime and version.
- Database and ORM/data-access mechanism.
- Authentication choice.
- Generation method and pinned generator/framework version.
- Environment configuration required.
- Test evidence level.

Recommended status vocabulary:

- **Planned:** not implemented; not selectable as a working option.
- **Scaffold-verified:** files generate and static/template checks pass.
- **Install/build-verified:** dependencies install and typecheck/build pass.
- **Integration-verified:** real DB or server integration tests pass.
- **Provider-E2E-verified:** auth round-trip and protected-resource journeys pass against a sandbox provider or an accepted real equivalent.
- **Supported:** meets the documented required verification profile for the advertised feature.
- **Deprecated:** no longer recommended; migration guidance exists.

Support status must be attached to a concrete combination. “WorkOS supported” without naming framework modes is too broad. Examples are `Laravel 13 + Livewire + WorkOS` and `Next.js + WorkOS`; each needs its own evidence.

The support matrix should be updated in the same PR that changes the registry or templates. Generate the matrix from the capability registry if practical, or add CI consistency checks.

---

## 14. Suggested internal code organization

Adapt to the actual repository structure after inspection; these names illustrate responsibility boundaries rather than mandating a large refactor.

```text
packages/cli/src/
├── prompts/
│   └── authentication.ts
├── catalog/
│   ├── authentication.ts
│   ├── php-frameworks.ts
│   └── compatibility-rules.ts
├── integrations/
│   └── auth/
│       ├── types.ts
│       ├── better-auth/
│       ├── supabase-auth/
│       ├── workos-authkit/
│       ├── clerk/
│       ├── auth0/
│       └── laravel-native/
├── stacks/
│   └── php/
│       ├── laravel/
│       │   ├── integrated/
│       │   ├── api-only/
│       │   └── adapters/
│       ├── symfony/          # future
│       ├── slim/             # future
│       └── codeigniter/      # future
└── ...
```

Do not create all folders upfront if that conflicts with the existing template layout. Follow current `AGENTS.md`, `docs/architecture/repository-structure.md`, `docs/templates/template-contract.md`, and `docs/templates/adding-a-stack.md`.

The auth catalog should describe capabilities declaratively; provider-specific code belongs in adapters. Avoid scattering conditions like `if provider === "clerk"` throughout prompts, generation, and tests.

---

## 15. Phased implementation roadmap

### Phase 0 — Repository audit and design freeze

**Deliverables**
- Inspect current `main`, package version, prompt flow, auth implementation, capability registry, templates, and master/test plans.
- Confirm the current Better Auth integration behavior and current support statuses.
- Decide the canonical auth prompt UX (one choice incl. None, or Yes/No then provider).
- Define the initial architecture taxonomy and Laravel modes.
- Verify versions and command-line options against current official generator documentation.

**Acceptance criteria**
- No discrepancy between proposed support and actual code is treated as done.
- A concrete provider/framework/database matrix is approved before adapter implementation begins.

### Phase 1 — Testing infrastructure prerequisite

**Deliverables**
- Complete or implement the database/auth testing plan's Testcontainers harness.
- Establish PostgreSQL and MySQL integration test profiles.
- Add test-project generation helpers and deterministic cleanup.
- Keep existing SQLite tests fast and available without Docker.

**Acceptance criteria**
- A generated supported Node project runs migrations and passes a real DB operation in a disposable container.
- Testcontainers failure/cleanup does not leave containers or leak secrets.

### Phase 2 — Shared auth catalog + create-time prompt

**Deliverables**
- Auth config schema and provider catalog.
- Compatibility filtering across runtime/framework/database/app mode.
- `None` behavior and appropriate Supabase context-aware UX.
- Create-time composition using the same adapter definitions as `omnicraft add auth`.
- Updated README/demo and support-matrix entries.

**Acceptance criteria**
- Each unsupported provider choice is hidden or explicitly rejected before generation.
- `none` adds no optional auth integration.
- Existing Better Auth behavior does not regress.
- Interactive and non-interactive configurations resolve to equivalent internal project configuration.

### Phase 3 — Better Auth stability across supported databases

**Deliverables**
- Keep SQLite baseline.
- Add PostgreSQL and MySQL where confirmed compatible with the existing Drizzle adapter/schema.
- Improve `omnicraft add auth` conflict/dry-run/idempotency tests.

**Acceptance criteria**
- Real database migrations and functional auth journeys pass in all advertised combinations.
- The matrix states exactly which Express/backend + ORM + DB combinations are verified.

### Phase 4 — Laravel foundation and application modes

**Deliverables**
- Laravel adapter using the pinned current official installer/starter-kit strategy.
- Laravel Livewire and Laravel Inertia React as first UI modes; add Vue/Svelte only if implementation/test bandwidth allows and official starter paths are verified.
- Laravel API-only mode for separate frontends.
- Laravel native authentication and no-auth options.
- SQLite first, followed by PostgreSQL and MySQL.
- Composer/Node prerequisites and cross-platform setup documentation.

**Acceptance criteria**
- OmniCraft does not launch an unexpected nested prompt.
- Integrated Laravel + Livewire, Laravel + Inertia React, and Laravel API-only are represented as distinct architectures.
- Generated projects install, migrate, run, and pass framework tests on the declared supported environment.

### Phase 5 — Supabase Auth

**Deliverables**
- Supabase-aware provider prompt.
- Browser/server client configuration for the first supported frontend modes.
- Safe environment placeholders, SQL/RLS example and setup guide.
- Optional supported third-party auth bridge for Clerk/Auth0/WorkOS only after separately scoped implementation.

**Acceptance criteria**
- RLS is tested for authorized and unauthorized user access.
- No service-role or database secret enters client bundles.
- Supabase Postgres + Laravel native auth is clearly distinct from Supabase Auth.

### Phase 6 — WorkOS AuthKit

**Deliverables**
- Start with one official framework integration and Laravel official starter-kit mode.
- Add environment and callback setup guidance.
- Add auth-flow and protected-route tests.

**Acceptance criteria**
- The exact provider/framework combination is verified with a sandbox integration.
- Existing middleware/configuration is preserved and changes are reviewable.

### Phase 7 — Clerk and Auth0

**Deliverables**
- One framework adapter at a time, selected based on official SDK maturity and user demand.
- Validate client/server boundaries, token/session checks, redirect/callbacks, logout, and error handling.
- Document whether Supabase Data API integration is supported for the provider.

**Acceptance criteria**
- Each advertised combination has installation/build, framework integration, and provider-specific E2E evidence appropriate to its support level.
- No provider is advertised across PHP or every React framework without verification for each.

### Phase 8 — Symfony and other PHP frameworks

**Deliverables**
- Evaluate Symfony as the next PHP framework after Laravel's contract is stable.
- Consider Slim for lightweight APIs and CodeIgniter based on demand.
- Define each framework's native frontend mode, security/auth model, database mechanism, and generator source separately.

**Acceptance criteria**
- New framework adapters pass the same template contract, support matrix, and testing standards.
- No Laravel-specific behavior is assumed to apply to Symfony/Slim/CodeIgniter.

---

## 16. GitHub issue breakdown

Create or update issues after Phase 0 confirms the exact source changes. Avoid creating one giant issue covering every provider and every PHP framework.

1. **Auth integration catalog and prompt schema** — shared provider model, compatibility rules, `none`, context-aware Supabase flow.
2. **Use the auth integration in both create and add flows** — same adapters, different generation/patch operations.
3. **Better Auth PostgreSQL/MySQL E2E coverage** — uses Testcontainers plan.
4. **Laravel stack architecture spike** — test Laravel installer options, starter kits, non-interactive invocation, and project modes.
5. **Laravel Livewire starter integration** — built-in auth and no-auth; DB matrix.
6. **Laravel Inertia React starter integration** — distinct from standalone React + API.
7. **Laravel API-only integration** — separate frontend + Laravel backend.
8. **Supabase Auth integration** — client/server setup, RLS, environment, and security tests.
9. **WorkOS AuthKit integration** — start with official-supported target framework(s), then expand.
10. **Clerk integration** — start with one supported React framework; later PHP evaluation.
11. **Auth0 integration** — verify current SDK and then implement one supported path.
12. **Symfony evaluation** — research and prototype only after Laravel contract stabilizes.
13. **Support matrix generation / consistency tests** — keep capability claims tied to code and evidence.

The issue order should follow the phases above. Close tasks only when the acceptance criteria pass.

---

## 17. Documentation updates required

When each feature is implemented, update:

- `AGENTS.md` — link to auth/PHP stack procedures for relevant changes; do not dump the full provider list here.
- `README.md` — show only actual, verified options. Explain Laravel's UI modes briefly.
- `ROADMAP.md` — add milestone links; do not reproduce the full plan.
- `docs/templates/stack-support-matrix.md` — exact provider/framework/database support plus evidence level.
- `docs/templates/adding-a-stack.md` — Laravel/PHP requirements and official generator strategy, where generalizable.
- `docs/templates/adding-an-integration.md` — auth provider adapters, environment keys, tests, and `add` behavior.
- `docs/architecture/compatibility-model.md` — include auth provider and app architecture as compatibility dimensions.
- `docs/development/testing-strategy.md` — testing tiers for provider auth and real databases.
- `CHANGELOG.md` — user-visible features and supported combinations by version.
- Generated README files — provider setup, required env variables, callback URLs, migrations, auth commands, and security caveats.

Do not state “supports Clerk/Auth0/WorkOS/Supabase Auth” globally when only one or two combinations are verified. Wording should name the supported stack mode.

---

## 18. Original acceptance criteria and closeout disposition

The original criteria below were **not all satisfied**. This document is archived because the broad proposal has been replaced by a scoped active follow-up with explicit ownership of every remaining item, not because every provider and PHP mode shipped.

| Original scope | Disposition |
| --- | --- |
| Shared create-time auth catalog, `None`, Better Auth parity, and verified database baseline | Delivered for the exact choices and tuples recorded in the support matrix and v1.0.3 changelog. |
| Laravel integrated Livewire with no-auth and native auth | Delivered for Laravel 13 + Livewire 4 + SQLite. Laravel Inertia and API-only modes are not implemented. |
| Supabase Auth, RLS/JWT, and third-party JWT bridging | Supabase Data API with user JWT/RLS and Supabase as sole identity owner is the approved future direction; implementation and target selection are deferred. Direct-Postgres claims bridging and third-party JWT issuers are out of scope. |
| WorkOS, Clerk, Auth0, or another managed provider | Deferred; select a provider and exact target before implementation or claims. |
| Provider credentials, secret/setup boundary, and provider sandbox evidence | Deferred with managed-provider work; credentials must remain external and tests must be opt-in/redacted. |
| Laravel database expansion beyond the verified Livewire SQLite path | Deferred; no broader Laravel database support is inferred. |
| Symfony, Slim, CodeIgniter, or other PHP frameworks | Kept unselectable and deferred until Laravel scope and demand are reviewed. |
| Documentation and evidence consistency | Completed for the shipped v1.0.3 scope; future changes must update docs and exact CI evidence in their own slices. |

---

## 19. Follow-up ownership

Continue only from [`docs/plans/active/omnicraft-auth-provider-php-stack-expansion-follow-up-plan.md`](../active/omnicraft-auth-provider-php-stack-expansion-follow-up-plan.md) and the [historical authentication/Laravel decision audit](../../research/auth-provider-laravel-decision-audit.md). Follow the approved choices recorded in the active plan. Ship each selected combination in a separate reviewable slice and keep its support status unchanged until exact generated-project checks and hosted release-gate evidence pass.

---

## 20. Research references

Official/current sources reviewed while preparing this plan (recheck versions immediately before implementation):

- OmniCraft repository: <https://github.com/doofx0071/omnicraft>
- OmniCraft issue #23 (existing Better Auth integration): <https://github.com/doofx0071/omnicraft/issues/23>
- OmniCraft issue #27 (template contract/documentation): <https://github.com/doofx0071/omnicraft/issues/27>
- Laravel 13 starter kits: <https://laravel.com/docs/starter-kits>
- Laravel 13 installation: <https://laravel.com/docs/installation>
- Laravel 13 frontend choices: <https://laravel.com/docs/13.x/frontend>
- Laravel installer (current options/source): <https://github.com/laravel/installer/blob/master/src/NewCommand.php>
- Laravel Livewire starter kit: <https://github.com/laravel/livewire-starter-kit>
- Livewire 4 installation: <https://livewire.laravel.com/docs/4.x/installation>
- Laravel releases/support: <https://laravel.com/docs/13.x/releases>
- PHP supported versions: <https://www.php.net/supported-versions.php>
- WorkOS AuthKit: <https://workos.com/docs/authkit>
- WorkOS Laravel SDK: <https://workos.com/docs/sdks/laravel>
- WorkOS AuthKit supported frameworks/installer: <https://workos.com/docs/authkit/cli-installer>
- Supabase Auth overview: <https://supabase.com/docs/guides/auth>
- Supabase third-party auth (Clerk, Auth0, WorkOS, OIDC): <https://supabase.com/docs/guides/auth/third-party/overview>
- Supabase + Laravel quickstart: <https://supabase.com/docs/guides/getting-started/quickstarts/laravel>
- Clerk documentation: <https://clerk.com/docs>
- Clerk SDK references: <https://clerk.com/docs/reference/overview>
- Auth0 documentation: <https://auth0.com/docs>
- Symfony security documentation: <https://symfony.com/doc/current/security.html>
- CodeIgniter documentation: <https://codeigniter.com/user_guide/intro/index.html>

