# Feature development workflow

The repeatable path from issue to merged change. Depth scales with risk: a typo fix needs steps 1, 4, 5,
8; a new stack needs all of them (and [adding-a-stack](../templates/adding-a-stack.md) on top).

## 1. Understand

- Read the GitHub issue and the relevant docs for the change type (matrix below).
- Inspect the **actual** code and tests — don't assume from docs or prior sessions.
- Note what the behavior is today, what it should be, and what's out of scope.

**Task → required reading:**

| Change type                 | Read first                                                                                                                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any change                  | root [AGENTS.md](../../AGENTS.md), this page, [coding standards](coding-standards.md)                                                                                                                    |
| New runtime/framework/stack | [adding-a-stack](../templates/adding-a-stack.md), [template contract](../templates/template-contract.md), [template engine](../architecture/template-engine.md), [testing strategy](testing-strategy.md) |
| New database/ORM/extra      | [adding-an-integration](../templates/adding-an-integration.md), [template contract](../templates/template-contract.md), [testing strategy](testing-strategy.md)                                          |
| Prompt/flag behavior        | [coding standards](coding-standards.md) (capability rules), `src/prefill.ts`, `src/prompts/run-prompts.ts`                                                                                               |
| Template-engine change      | [template engine](../architecture/template-engine.md), [template contract](../templates/template-contract.md)                                                                                            |
| Release/publish             | [CONTRIBUTING.md](../../CONTRIBUTING.md) (release section), master plan §5.4                                                                                                                             |

## 2. Plan

Identify every touch point before writing code:

- Which source modules change (`prompts/`, `scaffold/`, `prefill.ts`, `args.ts`, `types.ts`, `next-steps.ts`)?
- Which template layers are added/changed/overridden?
- What do flags, `--yes` defaults, and validation accept or reject?
- Which tests must exist, and which existing tests break?
- Which docs change (README, support matrix, docs/*, ROADMAP checkboxes)?

For multi-file features, write a short plan into the issue (or `docs/plans/active/` for larger arcs).

## 3. Implement

- Smallest complete change; match existing patterns (see [coding standards](coding-standards.md)).
- Capability changes start in `AVAILABLE` (`src/prefill.ts`) — prompts and flags consume it.
- Template changes follow the [template contract](../templates/template-contract.md); remember layers
  overwrite (and `package.json` merges) — design for it, don't fight it.
- Don't refactor unrelated code in the same change.

## 4. Test

Run locally, from `packages/cli/`:

```bash
npx tsc --noEmit        # types
npx vitest run          # unit + engine tests
npx tsup                # build
```

Then whatever the change type requires (see [testing strategy](testing-strategy.md)):

- New/changed template combo → add it to `scripts/smoke-e2e.ts`, scaffold, `npm install`, typecheck both
  workspaces, boot the server, hit the endpoints.
- New flag/prompt → exercise via the built CLI (`node dist/index.js`), including `--yes` and error paths.
- Everything else → at minimum, run the relevant slice of CI locally: scaffold all smoke combos and
  lint a generated project with extras.

Report what you actually ran — never imply a check passed that didn't.

## 5. Update documentation (same PR)

| If you changed…                    | Update                                                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Available stacks/combos            | [stack support matrix](../templates/stack-support-matrix.md), README "Supported stacks" + flow diagram         |
| Flags/help                         | README "Options", `HELP_TEXT` in `src/args.ts` (they must stay identical)                                      |
| Template structure/engine behavior | [template contract](../templates/template-contract.md) / [template engine](../architecture/template-engine.md) |
| Dev commands or layout             | [repository structure](../architecture/repository-structure.md), [docs/index.md](../index.md) as needed        |
| Milestone progress                 | ROADMAP.md checkboxes + progress table                                                                         |
| Released user-visible behavior     | CHANGELOG entry when one exists                                                                                |

## 6. Review your diff

Check for: accidental file changes, unresolved `{{tokens}}` in templates, secrets, broken relative links
between docs, drift between what prompts offer and what docs claim.

## 7. Commit, push, let CI finish

- Conventional summary line (e.g. `feat: …`, `fix: …`, `docs: …`), body explaining behavior.
- CI (windows self-hosted + ubuntu + macos) must be green; it runs typecheck, tests, build, the full
  scaffold matrix, an install+typecheck e2e, and lint of generated output.

## 8. Report and close

State: what changed, what was verified (with the actual commands/results), known limitations, follow-ups.
Then close the issue with a one-paragraph evidence comment, tick the ROADMAP checkbox if the phase item
is complete, and bump the version + publish if the phase is releasing (see [CONTRIBUTING.md](../../CONTRIBUTING.md)).
