# AGENTS.md — OmniCraft

Interactive project-scaffolding CLI. npm package **`create-omnicraft`** → users run `npm create omnicraft@latest`. Monorepo-lite: private root workspace + `packages/cli` (all source). GitHub: `doofx0071/omnicraft` (private, branch `main`).

## Commands

All from `packages/cli/` unless noted:

- Install workspace deps: `npm install` (repo root)
- Typecheck: `npx tsc --noEmit` (no lint script in this repo)
- Tests: `npx vitest run` (or `npm test` from root)
- Build (tsup → `dist/index.js` with shebang): `npx tsup`
- Run CLI from source: `npm run dev` (interactive — needs a real TTY)
- Scaffold every stack combo without prompts: `npx tsx scripts/smoke-e2e.ts <out-dir>`

## Architecture

- `src/prompts/run-prompts.ts` — the interactive question flow (clack). Returns a full `Answers` object.
- `src/scaffold/compose.ts` — maps answers → ordered `Layer[]` (`{src, dest}` relative to `templates/`). **Later layers overwrite earlier files; `package.json` deep-merges** (deps/scripts union). That's why `src/env.ts`, `src/routes/index.ts`, `.env.example`, `vite.config.ts`, `index.css` exist in several template layers — the overrides are intentional. Do not "dedupe" them.
- `src/scaffold/engine.ts` — copy + `{{token}}` render + dotfile restore + manifest merge. `src/scaffold/merge.ts` — the package.json deep merge.
- `src/templates/` — the embedded template tree (published in the npm package; also the remote source for `--latest`).
- `src/config.ts` — `TEMPLATE_REPO` must match the GitHub repo/branch/subdir (`gh:doofx0071/omnicraft/packages/cli/templates#main`, fetched by giget for `--latest`). `TEMPLATES_ROOT` resolves via `import.meta.url` and requires config.ts to stay one level below the package root (works bundled in `dist/` and in `src/`).

## Template rules

- Files starting with `_` (`_gitignore`, `_prettierignore`) are restored to dotfiles on copy — npm won't reliably publish them otherwise. The rule applies to directories too (`_github/` → `.github/`). `.env.example` ships as-is.
- Tokens: `{{projectName}}`, `{{clientPackageName}}`, `{{serverPackageName}}`, `{{databaseName}}` (underscores, for Postgres). Engine tests assert no token leaks into output.
- Dependency versions in templates are chosen for peer-compat, not "latest tag": TypeScript `^5.9.3` (typescript-eslint peers require <6.1 — TS7 breaks it), Prisma `^7.10.1` (npm's `latest` tag currently points at an 8.0 RC). Check peers before bumping.
- Prisma 7 specifics: schema datasource has **no `url` property** (P1012 error if added) — URL lives in `prisma.config.ts`; `prisma-client` generator with `output = "../src/generated/prisma"`; `@prisma/adapter-pg`; `postinstall: prisma generate` requires `server/.env` to exist, which the CLI creates from `.env.example` **before** installing deps.
- Ports are standardized: server 3000, client 5173 (Vite dev proxy `/api` → 3000).

## Windows / terminal constraints (dev machine is win32)

- All child processes go through `src/exec.ts` (`runCommand`, `runCommandVisible`). On win32 they join the command into a single string with `shell: true` — never pass an args array with `shell: true` (Node 24 DEP0190), and npm/git are `.cmd` shims that cannot spawn without a shell. Safe only because every caller passes hardcoded literals.
- `restoreTerminal()` in `src/index.ts` is registered on exit/SIGINT/uncaughtException: clack drives the console in raw mode, and a hard exit otherwise leaves cmd.exe garbled (`^[[A` keystrokes). Never remove it.
- Install step uses `runCommandVisible` (inherited stdio) so npm's live progress streams; don't wrap it back in a spinner.
- Non-TTY guard: the CLI refuses to run piped (clack prompts can't be driven without a TTY).

## Conventions

- Cancel handling: wrap clack prompt results in `unwrap<T>()` / `unwrapMany<T>()` (`src/cancel.ts`) which throw `CancelledError`; `main()` is the single catch site. clack 1.x gotchas: prompt results are typed `T | symbol` (always pass explicit generics to `unwrap`), and `Option<Value>` can't be satisfied by an unresolved generic — constrain to `string` (see `selectWithSoon`).
- Non-interactive mode: `--yes` + stack flags (`src/prefill.ts`) answer prompts; flags are validated by `validateStackFlags` before any prompt. Non-TTY runs require `--yes`.
- Engine tests (`src/engine.test.ts`) scaffold all 5 supported combos (express/fastify × drizzle/prisma + frontend-only) into temp dirs — keep them passing when touching templates or the engine.
- Publish checklist lives in the root README (bump `packages/cli/package.json` version; templates version-lock to the CLI).
- `packages/cli/planmo-v3/` is the user's locally generated test project (own git repo) — gitignored, leave it alone.
