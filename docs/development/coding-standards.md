# Coding standards

Rules for code in `packages/cli/src/`. These reflect how the codebase already works — follow them so the
next change looks like the last one.

## TypeScript

- **Strict mode always.** `tsc --noEmit` must be clean; CI enforces it. No `any`; use `unknown` + narrowing.
- **ESM.** The package is `"type": "module"`. Relative imports in source use `.js` extensions
  (`from './args.js'`) because the output is bundled ESM run by Node directly.
- **Co-locate tests.** Every module with behavior gets `<name>.test.ts` next to it (vitest).
- **Types as documentation.** `Answers` in `src/types.ts` is the shared vocabulary; label maps live there
  too so prompt text and summaries can't drift.
- **No dead code.** If a helper isn't called, delete it — don't keep "utility" exports for later.

## Subprocess rules (non-negotiable on Windows)

All child processes go through `src/exec.ts`:

- `runCommand(command, args, cwd)` — captured output, sync, for git/uv/composer/prisma-style steps.
- `runCommandVisible(...)` — inherited stdio, async, for the dependency install (npm's live progress must
  stream; never wrap it back in a spinner).

On win32 both spawn a **single joined command string** with `shell: true`. Never pass an args array with
`shell: true` (Node 24 DEP0190), and never assume `.cmd` shims (npm, git, composer) spawn without a shell.
This is safe **only** because every caller passes hardcoded literals — never interpolate user input
(project names, paths) into a command string. A project name reaches a subprocess only as a working
directory (`cwd`) or by the smoke script's file operations, never as part of a shell command.

## Error handling and cancellation

- Prompt results go through `unwrap<T>()` / `unwrapMany<T>()` (`src/cancel.ts`), which throw
  `CancelledError` on clack's cancel symbol. Always pass explicit generics — clack types results as
  `T | symbol`.
- `main()` in `src/index.ts` is the **single catch site**: `CancelledError` → clean cancel message;
  anything else → error + exit code 1 (`--debug` prints the stack trace). Don't add ad-hoc
  `process.exit` paths in flow code.
- User-facing failures say what to do next (e.g. install failure → the exact manual command).

## clack 1.x gotchas

- `Option<Value>` can't be satisfied by an unresolved generic — constrain to `string` and cast at the
  edge (see `selectWithSoon` in `run-prompts.ts`).
- `p.select` needs `Option<T>[]`; build option objects imperatively when the hint is conditional.
- Availability is never hardcoded in prompt choice arrays — derive from `AVAILABLE` (`src/prefill.ts`).

## Capability changes

When adding/changing what the CLI can scaffold, update **all** of these together (see the
[feature workflow](feature-development-workflow.md)):

1. `AVAILABLE` in `src/prefill.ts` (+ `validateStackFlags` rules),
2. prompt choices in `run-prompts.ts` (choices + hints, incl. "(soon)" entries),
3. `composeLayers` if a new layer kind is involved,
4. tests (`prefill.test.ts`, `engine.test.ts`, `prompts/run-prompts.test.ts` as applicable),
5. smoke combos (`scripts/smoke-e2e.ts`) for new verified combinations,
6. README ("Supported stacks", Options, flow diagram) and the
   [stack support matrix](../templates/stack-support-matrix.md).

## Formatting and linting

- **Prettier** is the formatter (root `.prettierrc.json`: `printWidth 100`, defaults otherwise, CRLF
  tolerance on Windows checkouts). Run it on touched files; CI lints **generated** output, and the
  repo is expected to be prettier-clean too.
- There is **no ESLint config for the CLI repo itself yet** — don't add one casually; if introduced, it
  must run in CI and stay clean (the _generated projects'_ eslint config is a template asset with its own
  rules, e.g. `^_`-prefixed unused args allowed).

## Templates (authoring rules)

Template files follow the same quality bar as source (prettier-clean, strict-compatible TS) plus the
[template contract](../templates/template-contract.md): tokens only from the documented set, `_`-prefix
dotfiles, partial `package.json` fragments, and files that expect later-layer overrides.

## Comments

State constraints the code can't show (Windows spawn rules, why a layer overrides another, why a version
is pinned) — not narration. The `AGENTS.md` rules about comments apply: no "this does X" restatements.

## Version compatibility pins

Template dependency versions are chosen for peer compatibility, not recency. Before bumping:

- `typescript` is pinned to `^5.9.3` — typescript-eslint peers require `<6.1` (TS 7 breaks it).
- `prisma`/`@prisma/client` pinned to `^7.10.1` — npm's `latest` tag currently points at an 8.0 RC.
  Check peer ranges of the dependent packages before changing either.
