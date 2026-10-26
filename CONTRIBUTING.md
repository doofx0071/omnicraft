# Contributing to OmniCraft

Thanks for helping craft stacks! This repo is a small monorepo: all product code lives in
`packages/cli` (the npm package `create-omnicraft`).

## Setup

Prerequisites: **Node.js ≥ 20.12** (24 recommended), npm 11. For template runtime verification also:
Python + [uv](https://docs.astral.sh/uv/), PHP 8.4 (**always the latest patched release** — see the
security note) + Composer, Docker (for postgres/mysql testing).

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
| `npx tsx scripts/smoke-e2e.ts <dir>` | Scaffold all supported combos without prompts                 |
| `npm run demo` (root)                | Regenerate `docs/demo.gif` + `docs/demo.html`                 |

Try your changes like a user would: `npx tsup && node dist/index.js` (or `--yes --skip-install my-app`
for a promptless run).

## Before you open a PR

Follow the [feature development workflow](docs/development/feature-development-workflow.md) — it defines
what to read per change type, what tests are required, and which docs must be updated in the same PR.

Checklist:

- [ ] `npx tsc --noEmit` and `npx vitest run` are green (62 tests currently)
- [ ] New behavior has tests; changed capabilities updated `src/prefill.ts`-driven surfaces
- [ ] Template changes verified per the [testing strategy](docs/development/testing-strategy.md) Level 3
      (scaffold → install → typecheck → boot → DB operation for every claimed combo)
- [ ] Docs updated ([stack support matrix](docs/templates/stack-support-matrix.md), README, `HELP_TEXT`)
- [ ] No unresolved `{{tokens}}`, no secrets, prettier-clean
- [ ] CI green (windows + ubuntu + macos: typecheck, tests, build, scaffold matrix, e2e, lint)

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

1. Confirm ROADMAP phase complete; all issues closed with evidence.
2. Bump `packages/cli/package.json` version (semver; templates ship with the CLI).
3. `npm test && npm run build` green; `npm pack --dry-run` shows `dist/` + `templates/`.
4. `cd packages/cli && npm publish` (browser auth / EOTP), then verify `npm view create-omnicraft version`.
5. Tag `v<version>`, push the tag, tick the ROADMAP.
