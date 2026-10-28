# Contributing to OmniCraft

Thanks for helping craft stacks! This repo is a small monorepo: all product code lives in
`packages/cli` (the npm package `create-omnicraft`).

## Setup

Prerequisites: **Node.js ≥ 20.12** (24 recommended), npm 11. The FastAPI integrations use Python 3.12
and [uv](https://docs.astral.sh/uv/); its PostgreSQL case also needs Docker. The Laravel integration
runs PHP and Composer inside the repository's pinned Docker image, so host PHP/Composer are not
required. Docker Engine is required for PostgreSQL/MySQL integration containers. Docker Compose v2 is
also required for Laravel's containerized PHP runner; SQLite-only database checks do not start a
database container.

```bash
git clone https://github.com/doofx0071/omnicraft
cd omnicraft
npm install              # installs the workspace
```

> **PHP security note (October 2026):** the "PHP2Shell" vulnerabilities (CVE-2026-109618/109619, CVSS
> 9.2) are patched in PHP 8.2.35 / 8.3.36 / 8.4.27 / 8.5.12. When working on the Laravel path, verify
> `php -v` meets or exceeds the patched release for your minor line.

## Everyday commands

All from `packages/cli/` unless noted:

| Command                              | What                                                          |
| ------------------------------------ | ------------------------------------------------------------- |
| `npm run dev`                        | Run the CLI from source (interactive — needs a real terminal) |
| `npx tsc --noEmit`                   | Typecheck                                                     |
| `npx vitest run`                     | Tests (or `npm test` from the root)                           |
| `npx tsup`                           | Build → `dist/index.js`                                       |
| `npx tsx scripts/smoke-e2e.ts <dir>` | Scaffold the combinations currently listed in the smoke script |
| `npm run check:support-matrix` | Check every Supported row against its registered scenario and CI release gate |
| `npm run test:integration:db -- --database sqlite` | Generated Express + Drizzle + SQLite (no Docker) |
| `npm run test:integration:node -- --scenario express-prisma-postgres` | Generated Express + Prisma + PostgreSQL |
| `npm run test:integration:node` | Generated Express, Fastify, and Hono Prisma/Drizzle/raw-SQL scenarios (Docker for PostgreSQL/MySQL) |
| `npm run test:integration:python` | Generated FastAPI + SQLAlchemy + SQLite/PostgreSQL (Python 3.12 + uv; PostgreSQL requires Docker) |
| `npm run test:integration:php -- --database sqlite` | Generated Laravel + SQLite (Docker PHP/Composer image) |
| `npm run test:integration:db` | All supported Node databases (requires Docker for PostgreSQL/MySQL) |
| `npm run test:integration:php` | Laravel SQLite, PostgreSQL, and MySQL (requires Docker for PHP image and networked DBs) |
| `npm run demo` (root)                | Regenerate `docs/demo.gif` + `docs/demo.html`                 |

Try your changes like a user would: `npx tsup && node dist/index.js` (or `--yes --skip-install my-app`
for a promptless run).

## Before you open a PR

Follow the [feature development workflow](docs/development/feature-development-workflow.md) — it defines
what to read per change type, what tests are required, and which docs must be updated in the same PR.

Checklist:

- [ ] `npx tsc --noEmit`, `npx vitest run`, and `npm run check:support-matrix` are green
- [ ] New behavior has tests; selectable choices come from `src/capabilities.ts` and prompt/flag/docs checks pass
- [ ] Template changes verified per the [testing strategy](docs/development/testing-strategy.md) Level 3
      (scaffold → install → typecheck → boot → DB operation for every claimed combo)
- [ ] Docs updated ([stack support matrix](docs/templates/stack-support-matrix.md), README, `HELP_TEXT`)
- [ ] No unresolved `{{tokens}}`, no secrets, prettier-clean
- [ ] The `supported-stack-release-gate` check is green for the exact commit being released; it aggregates
      the Windows/Ubuntu/macOS matrix, package artifact, evidence consistency, and full supported runtime jobs

## PR expectations

- One logical change per PR; conventional commit summary (`feat:`, `fix:`, `docs:`, `chore:`).
- Describe **what was verified and how** in the PR body — "tests pass" without the commands isn't
  reviewable evidence.
- Template/stack PRs: include the support-matrix diff; a combination becomes "Supported" only with
  evidence (see the matrix's promotion rules).

## Adding a stack or integration

Follow the dedicated procedures — they exist so new code looks like the existing code:

- [Adding a stack](docs/templates/adding-a-stack.md) (runtime/framework)
- [Adding an integration](docs/templates/adding-an-integration.md) (database/ORM/extra)
- [Template contract](docs/templates/template-contract.md) (rules every template layer follows)

## Security

- Never commit secrets; generated projects get `.env` from `.env.example` locally, gitignored.
- Any subprocess change must follow the `src/exec.ts` rules in
  [coding standards](docs/development/coding-standards.md) (Windows shell semantics, no user input in
  command strings).

## Releases (maintainers)

1. Confirm the ROADMAP phase is complete and its support claims have the required evidence.
2. In the release PR, bump `packages/cli/package.json` (semver; templates ship with the CLI), update
   `package-lock.json`, add the dated `CHANGELOG.md` section, and mark that version as a release candidate
   in `ROADMAP.md`.
3. Merge only after the `supported-stack-release-gate` is green for the exact release commit. The tag run
   repeats this complete gate before it can publish.
4. Create and push the matching `v<version>` tag from that commit. The `CI` workflow then publishes the
   package to npm with OIDC trusted publishing, creates the GitHub Release from the matching changelog
   section with the title `v<version> — <ROADMAP theme>`, and commits the published version and source
   commit to `ROADMAP.md` and the system overview.
5. Verify `npm view create-omnicraft version dist-tags --json` and `gh release view v<version>`.

Before the first automated npm publish, configure the `create-omnicraft` package's npm **Trusted
Publisher** for GitHub Actions with owner `doofx0071`, repository `omnicraft`, workflow filename `ci.yml`,
and permission to run `npm publish`. The package manifest's `repository.url` must match the GitHub repo.
Trusted publishing requires a GitHub-hosted runner, Node 22.14 or newer, npm 11.5.1 or newer, and
`id-token: write`; do not add a long-lived npm publish token to GitHub secrets. Configure it shortly
before the first automated release: npm requires the new trusted publisher to complete its first
successful publish within two days. With npm 11.15 or newer, the CLI command is

```bash
npx --yes npm@11.21.1 trust github create-omnicraft --file ci.yml \
  --repository doofx0071/omnicraft --allow-publish
```

The first request requires npm account 2FA.
