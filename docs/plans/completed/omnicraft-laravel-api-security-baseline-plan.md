# OmniCraft Laravel API Security Baseline

**Status:** Complete — strict gate
[42452309157](https://github.com/doofx0071/omnicraft/actions/runs/42452309157) green on `70786fc`;
the None-path fixture passed in the first run
([42451055454](https://github.com/doofx0071/omnicraft/actions/runs/42451055454)) and the corrected
Sanctum fixture in the second<br>
**Opened:** 8 November 2026<br>
**Closed:** 8 November 2026<br>
**Repository:** <https://github.com/doofx0071/omnicraft><br>
**Basis:** the Laravel residual recorded by the
[generated-app quality follow-up](../completed/omnicraft-generated-app-quality-follow-up-plan.md)
work item 3: "the Laravel 12 API and integrated Laravel 13 have no OmniCraft security
header/rate-limit baseline."

## Goal

Give the Laravel 12 API paths the same baseline the four JSON API runtimes received in v1.0.8:
security headers on every response and an env-configurable per-IP API rate limit whose 429
responses share the JSON contract (`{ "error": "Too many requests" }` with a numeric
`Retry-After`). Verified against the real Laravel 12 framework sources before implementation.

## Framework findings (verified 8 November 2026, laravel/framework 12.x)

- The default `api` middleware group contains `throttle:{apiLimiter}` only when
  `$middleware->throttleApi()` is configured (`Configuration\Middleware.php` line 497) — today's
  generated API ships without it, so adding the limiter cannot collide with skeleton behavior.
- `Limit::perMinutes($decayMinutes, $maxAttempts)` sets the window in minutes.
- A custom limiter response (`Limit::response(callable)`) receives `($request, $headers)` from
  `ThrottleRequests::buildException`, and `$headers` already contains the numeric `Retry-After`
  plus `X-RateLimit-*` — merging them into the JSON response preserves the contract without
  recomputing anything.
- Laravel's rate limiter uses the framework cache; the generated app sets `CACHE_STORE=file`, and
  feature tests run with per-test applications, so a dedicated 429 test can set
  `rate-limit.max` via `config()` and use the array cache for a self-contained burst.

## Work items

### 1. Both Laravel 12 API overlays (`server/php/laravel/`, `server/php/laravel-sanctum-spa/`)

- New `app/Http/Middleware/SecurityHeaders.php`: `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: SAMEORIGIN` (matching the helmet/hono default the other stacks generate),
  `Referrer-Policy: no-referrer`. Registered globally via `$middleware->append(...)` so web routes
  get the headers too; the Sanctum overlay keeps `$middleware->statefulApi()` first.
- New `app/Providers/AppServiceProvider.php` (intentional overwrite of the skeleton's empty
  provider): registers `RateLimiter::for('api', ...)` keyed by `$request->ip()` with
  `Limit::perMinutes(config('rate-limit.window_minutes'), config('rate-limit.max'))` and the shared
  429 JSON response merging the framework headers.
- New `config/rate-limit.php`: `max` / `window_minutes` read from env with 300 / 15 defaults —
  config-cache-safe (no `env()` outside config).
- `bootstrap/app.php`: `$middleware->append(SecurityHeaders::class); $middleware->throttleApi();`.
- `.env.example`: the `RATE_LIMIT_*` block, matching the Node stacks' wording.
- New `Rate-limit` troubleshooting rows in the three `fullstack-php` root READMEs.

### Framework-ordering finding (hosted gate, first run)

Laravel sorts the merged group+route middleware stack by its priority list, and `Authenticate` is
priority-listed while `ThrottleRequests` is not — so in the Sanctum overlay `auth:sanctum` runs
before the api throttle and unauthenticated requests are rejected before the limiter counts. The
per-IP api limit therefore protects authenticated traffic; the anonymous abuse vector stays
covered by the auth routes' own `throttle:10,15`. The Sanctum feature tests authenticate exactly
like a real SPA session before bursting. The None overlay has no route middleware, so its throttle
counts every request (both fixtures assert the same 429 contract). The same ordering also means
the global `SecurityHeaders` middleware (Kernel global stack, outside any sort) lands on every
response, including 401s and 404s.

### 2. Generated-project evidence

- `tests/php/OmniCraftDatabaseApiTest.php` (None path) and
  `tests/php/OmniCraftLaravelSanctumAuthTest.php` (Sanctum path) gain two tests: security headers
  present on an API response, and a bounded 429 burst asserting the exact JSON body, JSON
  content type, and numeric `Retry-After` (config-overridden `rate-limit.max`, array cache —
  self-contained per test; runs no other behavior through the limiter).
- `src/engine.test.ts` asserts both overlays ship the middleware, provider, config, wiring, and
  env entries.

### 3. Documentation

- `template-contract.md` rule 6: the Laravel 12 API joins the baseline list; only the Next.js
  integrated overlay and integrated Laravel 13 remain without one, with the reason recorded.
- `testing-strategy.md` Level 3 Laravel row; CHANGELOG `Unreleased`.

## Hosted evidence

- `php-laravel-integration` (None overlay, SQLite/PostgreSQL/MySQL): migrations, feature tests with
  the security-headers and 429-contract assertions — passed in both gate runs.
- `php-laravel-sanctum-spa-auth-integration` (Sanctum overlay, three databases): the first run
  caught the auth-before-throttle ordering (documented above, fixture corrected in `70786fc`);
  the second run passed the full auth lifecycle plus the baseline assertions.
- Local probes were partially blocked by a Packagist CDN outage from the dev network
  (`repo.packagist.org` unreachable, diagnosed via DoH cross-checks); the smoke scaffold verified
  the generated wiring (22/22 paths, both overlays carry the middleware, provider, config, and
  env entries) and the hosted gate ran the real feature tests.

## Explicit non-goals

- **Integrated Laravel 13 (Livewire/Inertia):** HTML applications generated from the official
  starter kits with session/CSRF semantics; a per-IP JSON 429 would be the wrong shape for page
  routing, and retrofitting middleware into the starters' own structure is a separate design
  decision. Headers-only for those starters is a possible later item.
- **Next.js integrated overlay:** same reasoning as recorded in the follow-up plan — no OmniCraft
  security baseline there yet; Next middleware runtime semantics (edge vs node) need their own
  evidence before a limiter ships.
- No support-matrix status changes from this batch.
