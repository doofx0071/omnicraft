# Template contract

What every template layer must provide, and the rules the engine applies. Mechanics (ordering, merge
algorithms, tokens) live in the [template engine](../architecture/template-engine.md) doc; this page is
the authoring contract. The tree layout is in the [repository structure](../architecture/repository-structure.md).

## Layer kinds

| Kind                         | Path                                                                                           | Contributes                                                                                                                                                                           | May override                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Frontend**                 | `web/<framework>/client/`                                                                      | A TypeScript client app; React also has `web/react/client-js/`                                                                                                                        | — (always first)                                                                    |
| **Integrated app**           | `web/nextjs/overlay/`, `web/nextjs/db-<database>/`                                             | Next.js routes, UI, and a raw-SQL database adapter; applied to a `create-next-app` skeleton                                                                                           | selected generator files; `package.json` merges                                     |
| **Integrated Laravel app**   | `root/fullstack-laravel-livewire/`, `root/fullstack-laravel-inertia-react/`                    | Root README/scripts for official Laravel 13 Livewire or Inertia React starters                                                                                                        | generated starter files; `package.json` merges                                      |
| **Native app**               | `platform/mobile/expo/`, `platform/desktop/tauri/`                                             | API-client and device-pairing overlays applied after official generators                                                                                                              | generated client files                                                              |
| **Server base**              | `server/<runtime>/<framework>/base/`                                                           | Entry, env validation, health route, tsconfig, package.json, `.env.example`                                                                                                           | client files only when `dest` overlaps (node: no)                                   |
| **Node db adapter**          | `db/<orm>/<database>/`                                                                         | deps + `db:*` scripts (package.json fragment), db config (drizzle.config / prisma.config), client, schema, seed, `.env.example` (overrides base's)                                    | server base                                                                         |
| **Node ORM wiring**          | `server/node/<framework>/<orm>/`                                                               | `src/routes/index.ts` + users routes + `src/env.ts` (adds DATABASE_URL)                                                                                                               | server base                                                                         |
| **Python db adapter**        | `db/sqlalchemy/<database>/`                                                                    | pyproject.toml deps, `app/database.py`, `.env.example`                                                                                                                                | —                                                                                   |
| **PHP overlay**              | `server/php/laravel/`                                                                          | Controller, api routes, bootstrap/app.php, migration, seeder, `.env.example` — applied **after `composer create-project`**                                                            | composer skeleton files                                                             |
| **Laravel API auth overlay** | `server/php/laravel-sanctum-spa/`                                                              | Laravel 12 user/session model, Sanctum SPA middleware, auth and owner-scoped API routes, SQLite migrations, `.env.example` — selected only for React/Vite + SQLite + `laravel-native` | Laravel 12 API files for that exact auth mode                                       |
| **Managed-auth overlay**     | `auth/<provider>-<client>/`                                                                    | Provider-specific client, safe `.env.example`, and setup README; composition selects it only for the exact capability tuple                                                           | Earlier frontend/root README files; never server secrets or privileged browser keys |
| **Extra**                    | `extras/<name>/`                                                                               | Tailwind → Vite client config + CSS; ESLint/Prettier → root; shadcn → React/Vite client only                                                                                          | earlier layers                                                                      |
| **Root variant**             | `root/fullstack` runtime/database variants, integrated Laravel roots, or `root/frontend-only/` | workspace or single-app `package.json`, `.gitignore`, README, database compose file where used, `_github/` CI                                                                         | later auth-specific overlay may replace its README                                  |

## Rules every template must follow

1. **`_`-prefix for dotfiles.** Anything npm won't publish (`_gitignore`, `_prettierignore`) and whole
   directories (`_github/`) use the underscore form; the engine restores the dot on copy.
2. **Tokens only from the documented set.** Current templates use `{{projectName}}`,
   `{{clientPackageName}}`, `{{serverPackageName}}`, `{{databaseName}}`, `{{backendFramework}}`, and
   `{{orm}}`. `templateVariables` also contains `dbConfig`, but no current template references it.
   Unknown expressions in non-`.vue` text files make generation fail with `UnresolvedTokenError`;
   `.vue` files are excluded because Vue uses `{{ }}` for interpolation. Document any new variable here
   and in the [template engine guide](../architecture/template-engine.md).
3. **Partial package.json.** Ship only the deps/scripts the layer adds. The engine deep-merges; script
   names must be namespaced enough to avoid clobbering (`db:*` belongs to db layers).
4. **`.env.example` (never `.env`).** Real `.env` is created post-scaffold by `createEnvFiles` and
   gitignored. Only safe local-dev placeholder credentials (matching docker-compose) are allowed.
5. **Every file may be overridden by a later layer.** If your layer provides `src/routes/index.ts` or
   `src/env.ts`, it is _designed_ to replace the base layer's version. Keep the set of overridden files
   minimal and intentional.
6. **Framework parity.** Node frameworks with the same ORM must expose the same routes
   (`/api/health`, `/api/users` GET/POST/DELETE), the same response shapes (camelCase `createdAt`),
   and the same behavior (duplicate email → 409 JSON) — see the
   [testing strategy](../development/testing-strategy.md) Level 3.
7. **Prettier-clean.** All template files pass prettier (`printWidth 100`); generated YAML avoids
   single quotes; generated READMEs are excluded from the _generated project's_ prettier check
   (table padding is token-dependent).
8. **Database-agnostic where possible.** Cross-DB code (e.g. unique-violation handling) covers
   postgres/mysql/sqlite codes including `cause`-wrapped errors.
9. **Ports fixed:** server 3000, client 5173 (Vite proxies `/api` → 3000).
10. **No new dependencies without peer checks.** TS `^5.9.3`, Prisma `^7.10.1` pins exist for a reason —
    see [coding standards](../development/coding-standards.md).
11. **Managed provider credentials.** Generated frontend configuration may use provider-approved
    publishable values and placeholders only. Secret/service-role keys, database passwords, and JWT
    signing secrets must not enter `VITE_` variables, browser bundles, prompts, logs, or committed
    files. Supabase Data API tables need explicit grants as well as RLS policies; the current
    Supabase Auth overlay grants only the authenticated role and scopes every operation to `auth.uid()`.

## Required files per layer kind

- **Server base (node):** `package.json`, `tsconfig.json`, `src/index.ts` (entry + graceful shutdown +
  JSON error handler + DB-error mapping), `src/env.ts` (zod), `src/routes/index.ts`, `src/routes/health.ts`,
  `.env.example`.
- **Node db adapter (drizzle):** `package.json` fragment, `drizzle.config.ts`, `src/db/index.ts` (client),
  `src/db/schema.ts` (users), `src/db/seed.ts`, `.env.example`.
- **Node db adapter (prisma):** `package.json` fragment, `prisma.config.ts`, `prisma/schema.prisma`,
  `src/db/index.ts` (adapter-pg client), `src/db/seed.ts`, `.env.example`.
- **Python db adapter:** `pyproject.toml`, `app/database.py`, `.env.example` (schema/models/migrations
  belong to the FastAPI base; adapter swaps engine + deps).
- **PHP overlay:** `routes/api.php`, `bootstrap/app.php`, `app/Http/Controllers/UserController.php`,
  `app/Models/User.php`, `database/migrations/…_create_users_table.php`,
  `database/seeders/DatabaseSeeder.php`, `.env.example`.
- **Laravel API auth overlay:** `routes/api.php`, `bootstrap/app.php`, auth and owner-scoped user
  controllers/models, user and owned-record migrations, `config/cors.php`, and `.env.example`. It uses first-party
  Sanctum cookie sessions; it does not add a second provider, personal access tokens, or account
  linking. Keep it separate from Laravel 13 integrated Livewire/Inertia React layers.
- **Managed-auth overlay:** provider client/configuration, placeholder-only `.env.example`, and
  generated setup README. Any browser integration uses publishable values only; server secrets stay
  outside the client layer. Provider-specific setup and lifecycle tests define the exact tuple.
- **Root variant:** `package.json` (workspaces, root scripts incl. `dev:server` for non-node runtimes,
  db passthrough scripts for node), `_gitignore`, `README.md`, `docker-compose.yml` (if containerized DB),
  `_github/workflows/ci.yml`.

## Applying a new layer kind

If the composition gains a fundamentally new kind (like the Laravel post-Composer overlay), it must:

1. get a predicate in `compose.ts` (e.g. `isPostComposerLayer`) and CLI handling in `index.ts`,
2. add engine-test coverage (see `python + php runtimes` describe-block),
3. update this contract and the [engine doc](../architecture/template-engine.md).

See [adding-a-stack](adding-a-stack.md) for the full procedure and
[stack-support-matrix](stack-support-matrix.md) for the verification bar.
