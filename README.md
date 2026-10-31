# ⚡ OmniCraft

[![CI](https://github.com/doofx0071/omnicraft/actions/workflows/ci.yml/badge.svg)](https://github.com/doofx0071/omnicraft/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/create-omnicraft)](https://www.npmjs.com/package/create-omnicraft)
[![roadmap](https://img.shields.io/badge/roadmap-ROADMAP.md-8A2BE2)](./ROADMAP.md)

**Compose a project from compatible stack choices.** OmniCraft is an interactive CLI for web, mobile, and desktop starters. The selectable catalog is broader than the combinations with end-to-end verification; check the [support matrix](docs/templates/stack-support-matrix.md) for exact evidence.

```bash
npm create omnicraft@latest
```

![OmniCraft scaffolding a full-stack React app — the full interactive flow from app name to installed dependencies](docs/demo.gif)

<details>
<summary>Prefer an interactive demo?</summary>
Open <a href="docs/demo.html">docs/demo.html</a> in a browser — the same flow as a replayable terminal player.
</details>

## The flow

```
┌  ⚡ OmniCraft — compose a project
│
◆  What is the name of your app?          ▸ becomes the folder name
◆  What are you building?                 ● Web App · Mobile (Expo) · Desktop (Tauri)
◆  Select a frontend framework:           ● React · Next.js · Vue · Svelte · Laravel + Livewire · Laravel + Inertia React
◆  Select a language:                     ● TypeScript · JavaScript (React/Vite client only)
◆  Full-stack?                            Adds backend + database
◆  Select a backend runtime:              ● Node.js · Python · PHP
◆  Select a backend framework:            ● Express · Fastify · Hono / FastAPI / Laravel
◆  Select a database:                     ● PostgreSQL · SQLite (zero setup) · MySQL
◆  Select an ORM:                         ● Drizzle · Prisma  (node only)
◆  Select an authentication setup:        ● None · Better Auth (compatible React + Express + Drizzle) · Laravel native (Livewire or Inertia React)
◆  Pick extras:                           ◉ Tailwind CSS  ◉ ESLint + Prettier
└  Scaffolds → git init → installs deps → prints next steps
```

Next.js skips the separate backend, ORM, authentication, and extras prompts. Its `create-next-app` base always includes Tailwind and ESLint. The auth prompt is filtered by stack: Better Auth appears only for TypeScript React/Vite + Node/Express + Drizzle with SQLite, PostgreSQL, or MySQL; Laravel native auth appears only for integrated Laravel + Livewire or Inertia React with SQLite. Choose `None` to leave the app without an optional auth layer. Better Auth uses the same integration as `omnicraft add auth`; set a private `BETTER_AUTH_SECRET` in `server/.env` and run `npm run db:push` before using its endpoints. OmniCraft never creates or stores a real provider secret.

### Laravel + Livewire

`--frontend livewire` creates an integrated Laravel 13 + Livewire 4 app with SQLite; it does not add a separate React/Vite client or Node auth service. `None` uses Laravel's official blank Livewire starter. `Laravel native` uses its official authenticated starter with Fortify. This path requires PHP 8.3+, Composer, and Node 22.18+, 24.11+, or 26+ for the starter kit's Vite Plus tooling. Laravel Composer setup still runs with `--skip-install`; that flag skips optional JavaScript/Python setup and Livewire asset installation/build.

### Laravel + Inertia React

`--frontend inertia-react` creates an integrated Laravel 13 app with Inertia, React, TypeScript, and SQLite. `None` uses Laravel's official blank React starter kit; `Laravel native` uses its Fortify-enabled React starter kit. Laravel routes, sessions, and the React UI live in one `server/` app; this is separate from the React/Vite + Express API architecture and the Laravel 12 API/data scaffold. Only one auth owner is configured, with no account linking. Laravel Composer setup still runs with `--skip-install`; that flag skips the optional npm install and asset build. This path requires PHP 8.3+, Composer, Node.js, and npm.

## What you get (full-stack React)

This example is the default React + Vite client with a Node.js Express + Drizzle API and PostgreSQL. Other frontends, runtimes, ORMs, and databases have different verification levels; see the matrix before treating the choices as interchangeable.

A workspace with everything talking to everything on first run:

```
my-app/
├── client/                 # Vite + React + TypeScript (+ Tailwind)
│   └── src/lib/api.ts      # typed fetch wrapper for your API
├── server/                 # Express + TypeScript
│   ├── src/db/             # ORM client, users schema, seed script
│   ├── src/routes/         # /api/health + working users CRUD
│   └── src/env.ts          # zod-validated environment variables
├── docker-compose.yml      # PostgreSQL 16, ready to `up`
└── package.json            # workspaces root — `npm run dev` runs both
```

For this example, the generated demo is **end-to-end**: the React page lists, creates, and deletes users through the API in PostgreSQL. Start crafting your own feature from there instead of wiring plumbing.

```bash
cd my-app
docker compose up -d     # start PostgreSQL
npm run db:push          # create tables from the schema
npm run dev              # client :5173 + server :3000 together
```

## Selectable choices and support status

The prompt and flags expose these choices. A choice in one row does not imply every cross-product with choices in other rows works or has been verified. Status applies to exact combinations in the [support matrix](docs/templates/stack-support-matrix.md).

| Layer | Selectable choices | Scope notes |
| --- | --- | --- |
| Platform | Web, Mobile (Expo), Desktop (Tauri) | Mobile and desktop projects pair with a separately run backend. Native build and device verification limits are in the matrix. |
| Frontend | React + Vite, Next.js, Vue + Vite, Svelte + Vite, Laravel + Livewire, Laravel + Inertia React | Next.js, Laravel + Livewire, and Laravel + Inertia React are integrated; the Vite clients use a separate API when full-stack is selected. |
| Language | TypeScript, JavaScript | JavaScript is selectable only for the web React/Vite client; Vue, Svelte, Next.js, Expo, Tauri, and Inertia React use TypeScript. Livewire uses PHP and does not ask for a separate frontend language. A selected backend keeps its runtime language. |
| Backend | Node: Express, Fastify, Hono · Python: FastAPI · PHP: Laravel | Framework, ORM, and database compatibility is combination-specific. |
| Data access | Separate Node API: Drizzle, Prisma, or raw SQL · Next.js route handlers: raw SQL · Python: SQLAlchemy + Alembic · Laravel: Eloquent | Prisma is PostgreSQL-only and unavailable for Hono. Raw SQL is not an ORM. |
| Database | PostgreSQL, SQLite, MySQL (availability varies by runtime and mode) | Laravel + Livewire and Laravel + Inertia React currently allow SQLite only. The matrix lists which combinations have scaffold or runtime evidence. |
| Extras | Tailwind CSS, ESLint + Prettier, shadcn/ui | Next.js always includes Tailwind + ESLint from create-next-app; shadcn/ui is web React/Vite-only and implies Tailwind. |
| Authentication setup | `None`, Better Auth email/password, Laravel native auth (Fortify) | Better Auth is limited to TypeScript React/Vite + Node/Express + Drizzle + SQLite/PostgreSQL/MySQL. Laravel native auth is limited to integrated Laravel + Livewire or Inertia React + SQLite; it owns Laravel sessions and does not add a second provider layer. Check the matrix for each status. |
| `omnicraft add` modules | `docker`, `testing`, Better Auth email/password (`auth`) | `testing` has exact generated-runtime checks for 260 React/Vite paths (six original plus 254 additional); 52 JavaScript + shadcn paths reject before writes because required aliases are absent. Vue, Svelte, and Next.js testing requests also reject before writes. These module checks do not establish backend/database behavior. Auth requires a React frontend with a separate Node + Express + Drizzle API; hosted database flows cover SQLite, PostgreSQL, and MySQL. |

## Options

```
npm create omnicraft@latest [project-name] [options]

  --yes                Accept all defaults, skip every prompt (CI-friendly;
                       also allows running without a TTY)
  --lang <name>        Skip the language prompt (typescript, javascript; JS is web React/Vite only)
  --platform <name>    Skip the "What are you building?" prompt (web, mobile, desktop)
  --full-stack         Force the full-stack flow (default: yes; backend/database/ORM, non-None auth, or integrated frontend flags imply it)
  --no-full-stack      Frontend only (cannot be combined with backend/database flags)
  --runtime <name>     Skip the runtime prompt (node, python, php)
  --frontend <name>    Skip the frontend prompt (react, nextjs, vue, svelte, livewire, inertia-react; integrated modes include Next.js, Livewire, and Laravel Inertia React)
  --backend <name>     Skip the framework prompt (node: express, fastify, hono ·
                       python: fastapi · php: laravel)
  --db <name>          Skip the database prompt (node: postgres, sqlite, mysql ·
                       python: postgres, sqlite · php: postgres, sqlite, mysql)
  --auth <name>        Authentication setup (none, better-auth, laravel-native; Better Auth requires
                       TypeScript React + Node/Express/Drizzle; Laravel native requires integrated
                       Livewire or Inertia React + SQLite)
  --orm <name>         Skip ORM selection (drizzle, prisma, none; Prisma is PostgreSQL-only and
                       unavailable for Hono). Separate Node APIs only; Next.js uses raw SQL and
                       rejects --runtime, --backend, --orm, and --no-full-stack
  --extras <list>      Comma-separated extras (tailwind, eslint, shadcn;
                       default: tailwind,eslint). shadcn is web React/Vite-only and
                       implies tailwind. Next.js always includes Tailwind + ESLint;
                       if set with Next.js, use --extras tailwind,eslint. Use none on other stacks to skip all.
  --latest             Pull templates from this CLI version's release tag
                       instead of the embedded templates
  --skip-install       Skip optional JS/Python/Livewire/Inertia React frontend setup; Laravel Composer setup still runs
  --debug              Print stack traces on errors
  -h, --help           Show this help
  -v, --version        Show version
```

Scripted use in CI:

```bash
npm create omnicraft@latest my-app -- --yes --skip-install
npm create omnicraft@latest api -- --no-full-stack --extras none
npm create omnicraft@latest web -- --yes --auth better-auth --skip-install
npm create omnicraft@latest livewire-app -- --yes --frontend livewire --auth laravel-native
npm create omnicraft@latest inertia-app -- --yes --frontend inertia-react --auth laravel-native
```

## How it works

- **Composable templates** — the React client, each server base, and each ORM adapter are separate layers. OmniCraft assembles them at scaffold time (later layers may overwrite files; `package.json` manifests deep-merge). `src/capabilities.ts` supplies selectable choices, `src/compatibility.ts` rejects unsupported combinations, and the support matrix links exact Supported claims to CI evidence.
- **Hybrid template delivery** — templates ship embedded in the CLI package. `--latest` fetches the release tag matching this CLI version via [giget](https://github.com/unjs/giget), so it does not silently follow `main`.
- **Destination behavior** — interactive runs show a collision preview and ask before continuing; `--yes` refuses any non-empty destination. Existing environment files are preserved. See the [template engine notes](docs/architecture/template-engine.md) for overwrite and failure limits.
- **Install handling** — Ctrl+C cancels cleanly; JavaScript/frontend dependency installation failures are non-fatal and print a manual command. Laravel Composer dependencies are installed during generation so its app key and SQLite migrations can be prepared.

## Development

```bash
npm install            # install the monorepo
npm run dev -w create-omnicraft   # run the CLI from source
npm test               # vitest — engine, prompts, validators
npm run build          # tsup → packages/cli/dist
npm run check:support-matrix -w create-omnicraft  # verify every Supported row has a CI target

# scaffold the combinations listed in the smoke script
npx tsx packages/cli/scripts/smoke-e2e.ts ../omnicraft-smoke
```

### Repo layout

```
packages/cli/
├── src/
│   ├── prompts/        # the interactive question flow
│   ├── scaffold/       # engine: layer composition, rendering, install
│   ├── config.ts       # template repo + paths (edit TEMPLATE_REPO.owner!)
│   └── templates/      # embedded template tree — the published artifact
└── scripts/smoke-e2e.ts
```

## Publishing checklist

1. Update `TEMPLATE_REPO.owner` in `packages/cli/src/config.ts` if the repo moves to another GitHub
   org/user (needed for `--latest`).
2. In a release PR, bump `packages/cli/package.json`, update `package-lock.json` and `CHANGELOG.md`,
   and mark the version as a release candidate in `ROADMAP.md`.
3. Merge after `supported-stack-release-gate` passes for the release commit, then push its matching
   `v<version>` tag.
4. The `CI` tag workflow reruns the release gate, publishes to npm, creates the GitHub Release from
   `CHANGELOG.md`, and updates `ROADMAP.md` and the [system overview](docs/architecture/system-overview.md).
   Configure npm Trusted Publishing
   once for `doofx0071/omnicraft` and workflow `ci.yml` before the first automated release.
5. Verify `npm view create-omnicraft version dist-tags --json` and `gh release view v<version>`.
   `--latest` fetches the matching release tag.

## Inspiration & credits

OmniCraft stands on the shoulders of: [create-t3-app](https://github.com/t3-oss/create-t3-app) (interactive full-stack modular scaffolding), [create-vite](https://github.com/vitejs/vite) (framework picker UX, giget templates) and [create-next-app](https://github.com/vercel/next.js). Prompts by [@clack/prompts](https://github.com/bombshell-dev/clack).

## Roadmap

Where the project is headed — versions, phases and progress: [ROADMAP.md](ROADMAP.md) (tracked as GitHub issues).

## License

[MIT](LICENSE)
