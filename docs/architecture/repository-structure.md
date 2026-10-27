# Repository structure

Where things live and where new files belong. Paths are relative to the repo root.

```
omnicraft/
├── AGENTS.md                     # agent entry point: commands, rules, doc links
├── README.md                     # user-facing overview (kept in sync with CLI help)
├── CONTRIBUTING.md               # contribution process
├── ROADMAP.md                    # milestones + GitHub issue links (product view)
├── LICENSE                       # MIT
├── package.json                  # private root workspace; delegates build/dev/test to the CLI package
├── .prettierrc.json              # root formatting (printWidth 100)
├── .github/workflows/ci.yml      # CI: windows (self-hosted) + ubuntu + macos
├── scripts/
│   └── make-demo.mjs             # regenerates docs/demo.gif + docs/demo.html (`npm run demo`)
├── docs/                         # THIS documentation tree (see docs/index.md)
│   ├── index.md
│   ├── demo.gif / demo.html      # README demo assets (generated)
│   ├── architecture/             # how the CLI works
│   ├── development/              # how to work on it
│   ├── templates/                # how to extend the stack matrix
│   └── plans/                    # active plans and completed historical plans
└── packages/
    └── cli/                      # the npm package `create-omnicraft` — all product source
        ├── package.json          # bin: create-omnicraft + omnicraft; files: dist, templates
        ├── tsconfig.json         # strict, noEmit (types: node)
        ├── tsup.config.ts        # bundles src/index.ts → dist/index.js with a node shebang
        ├── vitest.config.ts
        ├── scripts/
        │   └── smoke-e2e.ts      # scaffolds the combinations currently listed in the script
        ├── src/
        │   ├── index.ts          # entry: orchestration + single catch site
        │   ├── args.ts           # flag parsing + help text
        │   ├── config.ts         # CLI_NAME/VERSION, TEMPLATE_REPO, TEMPLATES_ROOT, ports
        │   ├── types.ts          # Answers + label maps (single source for prompt/summary text)
        │   ├── prefill.ts        # AVAILABLE capability tables + flag validation + --yes resolution
        │   ├── validators.ts     # slugify, npm-name validation, dir-conflict check
        │   ├── cancel.ts         # CancelledError, unwrap, unwrapMany
        │   ├── update-check.ts   # cached npm registry update notice
        │   ├── next-steps.ts     # per-stack outro panel
        │   ├── validate-npm-package-name.d.ts  # module declaration (package ships no types)
        │   ├── exec.ts           # runCommand / runCommandVisible (win32-safe subprocess)
        │   ├── prompts/
        │   │   └── run-prompts.ts  # the interactive wizard (one file; split when it grows)
        │   ├── scaffold/
        │   │   ├── compose.ts    # Answers → Layer[] (+ external generator adapters)
        │   │   ├── engine.ts     # layer application: copy/render/rename/merge
        │   │   ├── renderer.ts   # tokens, dotfile rename, binary detection
        │   │   ├── merge.ts      # package.json deep merge
        │   │   ├── remote.ts     # giget fetch for --latest
        │   │   ├── env.ts        # .env.example → .env bootstrap
        │   │   ├── git.ts        # git init
        │   │   └── pkg-manager.ts# pm detection + install
        │   └── *.test.ts         # unit/engine tests (vitest) — co-located with source
        └── templates/            # generated-project template tree (published)
            ├── web/{react,vue,svelte}/client/ # Vite client adapters; React also has client-js/
            ├── web/nextjs/                 # integrated full-stack overlays + database adapters
            ├── platform/{mobile,desktop}/  # Expo/Tauri overlays
            ├── server/node/{express,fastify,hono}/base/   # framework bases
            ├── server/node/{express,fastify,hono}/{drizzle,prisma,none}/ # framework×data wiring (not every path exists)
            ├── server/python/fastapi/base/  # FastAPI app + alembic (initial migration included)
            ├── server/php/laravel/          # overlay applied after composer create-project
            ├── db/{drizzle}/{postgres,sqlite,mysql}/   # node db adapters (config, client, schema, seed)
            ├── db/prisma/postgres/          # prisma 7 adapter (postgres only)
            ├── db/none/{postgres,sqlite,mysql}/ # Node raw-SQL adapters
            ├── db/sqlalchemy/{postgres,sqlite}/         # python db adapters (pyproject + database.py)
            ├── extras/{tailwind,eslint,shadcn}/ # opt-in overlays; shadcn is React/Vite-only
            └── root/
                ├── frontend-only/           # root files when fullStack = false
                ├── fullstack/{postgres,sqlite,mysql}/   # node+laravel root variants
                ├── fullstack-python/{postgres,sqlite}/   # python root variants
                ├── fullstack-php/{postgres,sqlite,mysql}/ # php root variants
                └── fullstack-next/{postgres,sqlite,mysql}/ # integrated Next.js root variants
```

## Placement rules

| New artifact                   | Location                                               | Notes                                                                                                |
| ------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| CLI source module              | `packages/cli/src/` (grouped: `prompts/`, `scaffold/`) | Co-locate its test as `<name>.test.ts`.                                                              |
| New prompt                     | `src/prompts/run-prompts.ts`                           | Split into `src/prompts/<topic>.ts` if the flow grows; keep `run-prompts.ts` as the orchestrator.    |
| Capability/availability change | `src/prefill.ts` (`AVAILABLE`), `src/compatibility.ts`, and prompt/validation/composition code | Keep cross-option constraints shared; verify actual template paths and test prompt, flag, and composition behavior. |
| Framework base template        | `templates/server/<runtime>/<framework>/base/`         | Entry, env validation, health route, tsconfig, package.json, .env.example.                           |
| Node ORM wiring                | `templates/server/node/<framework>/<orm>/`             | Route registrations + ORM-specific users routes.                                                     |
| Node db adapter                | `templates/db/<orm>/<database>/`                       | package.json (deps+scripts), db config, client, schema, seed, .env.example.                          |
| Python db adapter              | `templates/db/sqlalchemy/<database>/`                  | pyproject.toml (deps), app/database.py, .env.example.                                                |
| Runtime root files             | `templates/root/fullstack[-<runtime>]/<database>/`     | Workspaces package.json, .gitignore, README, docker-compose (containerized DBs only), `_github/` CI. |
| Extra overlay                  | `templates/extras/<name>/`                             | Merged files only; must compose cleanly with any stack.                                              |
| Smoke combo                    | `packages/cli/scripts/smoke-e2e.ts` (`combos`)         | Add exact scaffold coverage; smoke generation alone does not establish Supported status.             |
| Generated demo                 | `scripts/make-demo.mjs` (root)                         | Writes `docs/demo.gif` + `docs/demo.html`; never hand-edit those.                                    |
| Engineering doc                | `docs/<area>/<topic>.md`                               | Linked from `docs/index.md`.                                                                         |
| Plan                           | `docs/plans/active/`                                   | Move to `completed/` when done.                                                                      |
| CI change                      | `.github/workflows/ci.yml`                             | Keep windows + unix jobs' step sets in sync.                                                         |

## Not in this repository

- `packages/cli/planmo-v3/` — a locally generated test project (own git repo); gitignored. Leave it alone.
- `.zcode/` — session data; gitignored. Note: the original master plan has been preserved at
  `docs/plans/completed/omnicraft-master-plan.md`.
