# Adding an integration

The procedure for a new **database, ORM, or extra** (e.g. MongoDB+Mongoose, MySQL for Prisma, an auth or
testing extra). For a runtime/framework, see [adding-a-stack](adding-a-stack.md).

Recent proofs: SQLite + MySQL drizzle adapters (v0.3.0) and the Tailwind/ESLint extras (v0.1.0) followed
these steps.

## Databases and ORMs

### 1. Decide the shape

- **New database for an existing ORM** (e.g. sqlite for prisma) → a new `db/<orm>/<database>/` adapter.
- **New ORM** (e.g. mongoose) → adapters per database **plus** `server/node/<framework>/<orm>/` wiring
  layers per framework — that's the heavier path (also do [adding-a-stack](adding-a-stack.md) §2).

Check the ORM's driver support honestly: Prisma 7's driver adapters are wired for PostgreSQL only right
now — a prisma+mysql adapter needs the adapter story settled first, and `validateStackFlags` currently
rejects the combination with a clear error. Keep that guard until the adapter is real and verified.

### 2. Adapter templates (node)

Under `templates/db/<orm>/<database>/` (following the [template contract](template-contract.md)):

- `package.json` fragment: driver + ORM deps, `db:*` scripts (`db:generate`, `db:migrate`, `db:push`,
  `db:seed`, `db:studio` — namespaced, never clobbering other layers' scripts).
- The ORM's db config (e.g. `drizzle.config.ts` with the right `dialect`, or `prisma.config.ts`).
- `src/db/index.ts` (client/pool), `src/db/schema.ts` (drizzle) or `prisma/schema.prisma` (prisma),
  `src/db/seed.ts` (idempotent: clear + insert Ada/Grace).
- `.env.example` with the correct URL scheme — note `{{databaseName}}` (underscores) for
  postgres/mysql; sqlite uses a `file:` URL.
- Prisma specifics: **no `url` in the schema datasource block** (P1012) — the URL lives in
  `prisma.config.ts`; the client uses the `@prisma/adapter-pg`-style driver adapter; `postinstall: prisma
generate` requires `server/.env` to exist (the CLI creates it before installing).

Python (sqlalchemy): `db/sqlalchemy/<database>/` = `pyproject.toml` deps (use `sqlalchemy[asyncio]`),
`app/database.py` (engine + session), `.env.example`.

### 3. Cross-database code

Code that stays shared must handle all supported databases' error codes (drizzle wraps driver errors in
`cause`): unique violation = `23505` (pg) / `ER_DUP_ENTRY` (mysql) / `SQLITE_CONSTRAINT_UNIQUE` (sqlite).
The users routes' `isUniqueViolation` is the pattern.

### 4. Root variant

`templates/root/fullstack[-python|-php]/<database>/` exists per database: workspaces package.json,
README (docker/prerequisites/troubleshooting tailored), `docker-compose.yml` (containerized DBs only —
sqlite ships none), `_github/workflows/ci.yml`, `_gitignore` (sqlite adds the data dir).

### 5. Registration + flow

- `AVAILABLE.db[<runtime>]` in `src/prefill.ts` (+ guard rules in `validateStackFlags`).
- Prompt choice in `dbChoices[<runtime>]` (`run-prompts.ts`); update `HELP_TEXT` + README Options.
- If the database changes the post-scaffold flow (like sqlite skipping docker), update
  `printNextSteps`.

### 6. Extras (tailwind-style overlays)

Under `templates/extras/<name>/`: only the files it adds or overrides (e.g. tailwind ships a
`vite.config.ts` that _replaces_ the client's, and an `index.css` that _replaces_ the client's). Must
compose with every stack that can select it. `--extras` accepts the name; `none` disables all.

## Verification bar (all integrations)

1. Engine tests: scaffold the affected combos (assert adapter files, env contents, root-variant
   differences like no docker-compose for sqlite).
2. Smoke scaffold: add/update combos in `scripts/smoke-e2e.ts`.
3. Level 3 per [testing strategy](../development/testing-strategy.md): install, typecheck, boot, and at
   least one real DB operation per database claimed. For extras: generated project lints/prettiers clean
   and the extra is actually active (tailwind styles applied, eslint rules enforced).
4. New combos go into CI's scaffold matrix by virtue of the smoke script.

## Documentation

- [Stack support matrix](stack-support-matrix.md) row(s) with evidence.
- README "Supported stacks" + flow diagram line if prompts changed.
- Generated README troubleshooting table if the integration adds new failure modes.
- ROADMAP tick if it closes a phase item.

## Known follow-ups (from the master plan)

- Per-database prisma adapters (mysql/sqlite) — blocked on driver-adapter support + verification.
- MongoDB/Mongoose — new ORM path (no SQL schema); see master plan §14 Phase E.
