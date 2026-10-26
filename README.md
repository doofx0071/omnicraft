# ⚡ OmniCraft

[![CI](https://github.com/doofx0071/omnicraft/actions/workflows/ci.yml/badge.svg)](https://github.com/doofx0071/omnicraft/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/create-omnicraft)](https://www.npmjs.com/package/create-omnicraft)
[![roadmap](https://img.shields.io/badge/roadmap-ROADMAP.md-8A2BE2)](./ROADMAP.md)

**Craft any stack** — an interactive CLI that scaffolds full-stack-ready projects. No flags to memorize: answer a few prompts and get a running app with the database wired end-to-end.

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
┌  ⚡ OmniCraft — craft any stack
│
◆  What is the name of your app?          ▸ becomes the folder name
◆  What are you building?                 ● Web App · Mobile (Expo) · Desktop (Tauri)
◆  Select a frontend framework:           ● React · Next.js · Vue · Svelte
◆  Full-stack?                            Adds backend + database
◆  Select a backend runtime:              ● Node.js · Python · PHP
◆  Select a backend framework:            ● Express · Fastify · Hono / FastAPI / Laravel
◆  Select a database:                     ● PostgreSQL · SQLite (zero setup) · MySQL
◆  Select an ORM:                         ● Drizzle · Prisma  (node only)
◆  Pick extras:                           ◉ Tailwind CSS  ◉ ESLint + Prettier
└  Scaffolds → git init → installs deps → prints next steps
```

## What you get (full-stack React)

A workspace with everything talking to everything on first run:

```
my-app/
├── client/                 # Vite + React + TypeScript (+ Tailwind)
│   └── src/lib/api.ts      # typed fetch wrapper for your API
├── server/                 # Express or Fastify + TypeScript
│   ├── src/db/             # ORM client, users schema, seed script
│   ├── src/routes/         # /api/health + working users CRUD
│   └── src/env.ts          # zod-validated environment variables
├── docker-compose.yml      # PostgreSQL 16, ready to `up`
└── package.json            # workspaces root — `npm run dev` runs both
```

The generated demo is **end-to-end**: the React page lists, creates and deletes users through the real API into real PostgreSQL. Start crafting your own feature from there instead of wiring plumbing.

```bash
cd my-app
docker compose up -d     # start PostgreSQL
npm run db:push          # create tables from the schema
npm run dev              # client :5173 + server :3000 together
```

## Supported stacks (v1 — per-combo status: [docs/templates/stack-support-matrix.md](docs/templates/stack-support-matrix.md))

| Layer    | Available                                                     | On the roadmap                           |
| -------- | ------------------------------------------------------------- | ---------------------------------------- |
| Platform | Web App                                                       | Mobile (React Native/Expo), Desktop, API |
| Frontend | React (Vite + TS)                                             | Next.js, Vue, Svelte, Solid              |
| Backend  | Node: Express, Fastify, Hono · Python: FastAPI · PHP: Laravel | NestJS, Django, Symfony                  |
| Database | PostgreSQL, SQLite, MySQL                                     | MongoDB                                  |
| ORM      | Drizzle, Prisma, or None (raw SQL) · SQLAlchemy · Eloquent    | Mongoose                                 |
| Extras   | Tailwind CSS, shadcn/ui, ESLint + Prettier                    | Auth boilerplate, JS (non-TS) templates  |

## Options

```
npm create omnicraft@latest [project-name] [options]

--yes                accept all defaults, skip every prompt (CI-friendly)
--full-stack         force the full-stack flow (default: yes)
--no-full-stack      frontend only
--frontend <name>    skip the frontend prompt (react)
--runtime <name>     skip the runtime prompt (node, python, php)
--backend <name>     skip the framework prompt (node: express, fastify, hono · python: fastapi · php: laravel)
--db <name>          skip the database prompt (node: postgres, sqlite, mysql · python: postgres, sqlite · php: postgres, sqlite, mysql)
--orm <name>         skip the ORM prompt — node only (drizzle, prisma; prisma is postgres-only)
--extras <list>     comma list: tailwind,eslint,shadcn — or "none" (default: tailwind,eslint)
--latest             pull the newest templates from GitHub instead of the
                     ones pinned to this CLI version
--skip-install       generate without installing dependencies
--debug              print stack traces on errors
```

Scripted use in CI:

```bash
npm create omnicraft@latest my-app -- --yes --skip-install
npm create omnicraft@latest api -- --no-full-stack --extras none
```

## How it works

- **Composable templates** — the React client, each server base, and each ORM adapter are separate layers. OmniCraft assembles them at scaffold time (later layers may overwrite files; `package.json` manifests deep-merge), so `Express + Drizzle` and `Fastify + Prisma` share one source of truth.
- **Hybrid template delivery** — templates ship embedded in the CLI package (deterministic, offline, pinned to the CLI version — downgrade by installing an older `create-omnicraft`). `--latest` fetches the newest templates from this repo via [giget](https://github.com/unjs/giget).
- **Graceful everything** — Ctrl+C cancels cleanly, non-empty folders are never deleted, install failures are non-fatal with a printed hint.

## Development

```bash
npm install            # install the monorepo
npm run dev -w create-omnicraft   # run the CLI from source
npm test               # vitest — engine, prompts, validators
npm run build          # tsup → packages/cli/dist

# scaffold every stack combo without prompts (for manual testing)
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

1. Update `TEMPLATE_REPO.owner` in `packages/cli/src/config.ts` if the repo moves to a different GitHub org/user (needed for `--latest`).
2. `npm test && npm run build` — must be green.
3. Bump `version` in `packages/cli/package.json` (semver; templates and CLI version together).
4. `cd packages/cli && npm pack` — inspect the tarball (templates + dist included).
5. `npm publish` (public registry; `create-*` packages publish public by default).
6. Tag the repo: `git tag v0.x.y && git push --tags` — `--latest` pulls from `main`.

## Inspiration & credits

OmniCraft stands on the shoulders of: [create-t3-app](https://github.com/t3-oss/create-t3-app) (interactive full-stack modular scaffolding), [create-vite](https://github.com/vitejs/vite) (framework picker UX, giget templates) and [create-next-app](https://github.com/vercel/next.js). Prompts by [@clack/prompts](https://github.com/bombshell-dev/clack).

## Roadmap

Where the project is headed — versions, phases and progress: [ROADMAP.md](ROADMAP.md) (tracked as GitHub issues).

## License

[MIT](LICENSE)
