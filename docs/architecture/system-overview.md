# System overview

OmniCraft is a single npm package (`create-omnicraft`) inside a private-root monorepo. This page
describes the components as they exist today (v0.3.0).

## One-run flow

```
user runs `npm create omnicraft@latest [name] [flags]`
        │
        ▼
src/index.ts ── parseArgs (src/args.ts)          validate flags, help/version exits
        │
        ├─ non-TTY guard (requires --yes)        plus update-check notice (src/update-check.ts)
        ▼
runPrompts (src/prompts/run-prompts.ts)          interactive flow; flags answer prompts; --yes skips all
        │  returns Answers
        ▼
composeLayers + templateVariables                maps Answers → ordered Layer[] + tokens
        │  (src/scaffold/compose.ts)
        ▼
applyLayers (src/scaffold/engine.ts)             copy → render tokens → restore dotfiles → merge package.json
        │                                        (per layer, in order)
        ├─ Laravel only: composer create-project FIRST, then overlay layers
        ▼
post-scaffold (src/index.ts + src/scaffold/*)
        ├─ createEnvFiles   — copy every .env.example → .env
        ├─ gitInit          — git init -b main (best-effort)
        ├─ dependency setup — npm/pnpm/yarn/bun install (node) or uv sync (python);
        │                    php is already installed by composer
        └─ printNextSteps   — tailored commands + URLs
```

## Components and responsibilities

| Component                   | Files                                             | Responsibility                                                                                                                                                                                                                                                         |
| --------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Entry / orchestration**   | `src/index.ts`                                    | Arg parsing, TTY guard, update check, the scaffold → git → install → next-steps sequence, single error catch site (`CancelledError` → clean cancel).                                                                                                                   |
| **CLI surface**             | `src/args.ts`                                     | Parses positional project name and all flags (`--yes`, `--runtime`, `--frontend`, `--backend`, `--db`, `--orm`, `--extras`, `--full-stack`/`--no-full-stack`, `--latest`, `--skip-install`, `--debug`, `--help`, `--version`). Throws on unknown flags/missing values. |
| **Prompt flow**             | `src/prompts/run-prompts.ts`                      | The interactive wizard. Runtime-scoped framework/database choices, "(soon)" roadmap options that bounce with a notice, summary + confirm. Flags and `--yes` bypass prompts. Returns the full `Answers` object.                                                         |
| **Capability tables**       | `src/prefill.ts` (`AVAILABLE`)                    | The single place listing available runtimes, per-runtime backends and databases, Node ORMs, extras. Powers flag validation (`validateStackFlags`) and `--yes` defaults (`resolveAnswers`).                                                                             |
| **Composition**             | `src/scaffold/compose.ts`                         | Pure mapping `Answers → Layer[]` and `Answers → token variables`. Encodes layer order and the Laravel post-Composer split (`isPostComposerLayer`).                                                                                                                     |
| **Engine**                  | `src/scaffold/engine.ts`                          | Applies layers: recursive copy, token rendering, `_`-prefix dotfile restore, `package.json` deep-merge when the destination file already exists. Throws `MissingLayerError` for absent layers.                                                                         |
| **Renderer**                | `src/scaffold/renderer.ts`                        | `{{token}}` substitution (unknown tokens left intact), `_file` → `.file` rename, binary-file detection by extension.                                                                                                                                                   |
| **Manifest merge**          | `src/scaffold/merge.ts`                           | Recursive `package.json` merge; later scalars/arrays replace, objects merge. Lets db/framework/extras/root layers each contribute deps and scripts.                                                                                                                    |
| **Remote templates**        | `src/scaffold/remote.ts`                          | `--latest`: giget download of the same `packages/cli/templates` tree from GitHub `main`.                                                                                                                                                                               |
| **Exec helpers**            | `src/exec.ts`                                     | `runCommand` (captured, sync) and `runCommandVisible` (inherited stdio, async). Windows: single command string + `shell: true` — see [coding standards](../development/coding-standards.md).                                                                           |
| **Post-scaffold utilities** | `src/scaffold/env.ts`, `git.ts`, `pkg-manager.ts` | `.env` bootstrap, git init, package-manager detection/install.                                                                                                                                                                                                         |
| **Exit UX**                 | `src/next-steps.ts`                               | Tailored next-step panel per stack (docker only for containerized DBs, runtime-specific database line).                                                                                                                                                                |
| **Templates**               | `src/templates/`                                  | The generated-project tree, published in the npm package. See the [template contract](../templates/template-contract.md).                                                                                                                                              |
| **Tests**                   | `src/**/*.test.ts`                                | 62 tests across 8 files. See the [testing strategy](../development/testing-strategy.md).                                                                                                                                                                               |
| **Smoke scaffold**          | `scripts/smoke-e2e.ts`                            | Scaffolds all 11 supported combos + frontend-only into a target dir without prompts. Used by CI and local verification.                                                                                                                                                |

## Cross-cutting invariants

1. **One catch site.** `main()` catches `CancelledError` (from `unwrap`/`unwrapMany`) and shows a clean
   cancel; everything else prints the error (`--debug` adds the stack trace) and sets exit code 1.
2. **Windows-safe subprocesses.** All child processes go through `src/exec.ts`; on win32 the command is a
   single string with `shell: true` (never an args array — Node 24 DEP0190, and npm/git/composer are shell
   shims). Callers pass hardcoded literals only.
3. **Terminal restoration.** `restoreTerminal()` (raw mode off, cursor visible) is registered on
   `exit`/`SIGINT`/`uncaughtException` — clack leaves the console in raw mode and a hard exit otherwise
   garbles cmd.exe.
4. **Capability accuracy.** What prompts offer, flags accept, compose can build, tests verify, and docs
   claim must agree. The `AVAILABLE` table in `src/prefill.ts` is the source for prompts/flags; the
   [support matrix](../templates/stack-support-matrix.md) records verification status.
5. **No TTY → no prompts.** Without `--yes` the CLI refuses to run piped; `--yes` produces the same
   validated configuration as the interactive defaults.
