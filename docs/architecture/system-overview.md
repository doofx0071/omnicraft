# System overview

OmniCraft is the `create-omnicraft` npm package. `packages/cli/package.json` is the authoritative
source version; npm publication status is tracked separately in the [roadmap](../../ROADMAP.md).
The CLI is interactive by default and can compose web, backend, database, extra, and native-platform
layers. Exact support and verification vary by combination; see the
[support matrix](../templates/stack-support-matrix.md).

## One-run flow

```text
user runs `npm create omnicraft@latest [name] [flags]`
        │
        ▼
src/index.ts ── parseArgs (src/args.ts)          validate flags/help/version
        │
        ├─ non-TTY guard (requires --yes)        plus update-check notice
        ▼
runPrompts (src/prompts/run-prompts.ts)          interactive flow or flags/defaults
        │                                         returns Answers
        ▼
composeLayers + templateVariables               maps Answers → ordered Layer[] + token variables
        │
        ├─ Native app: run create-expo-app or create-tauri-app, then apply platform layer
        ├─ Next.js: run create-next-app, then apply the integrated app/database overlay
        ├─ Laravel 13 Livewire: retrieve a pinned official kit, then install/configure Composer and SQLite
        ├─ Laravel 13 Inertia React: create-project from a pinned official kit, then install/configure Composer and SQLite
        ├─ Laravel 12 API: create a Laravel skeleton with Composer, then apply the API/data overlay
        └─ Other web projects: apply composed client/server/database/extra/root layers
        │
        ▼
post-scaffold                                    create env files + project manifest + git init
        │
        ├─ npm/pnpm/yarn/bun install (Node) or uv sync (Python), if selected
        └─ tailored next steps
```

JavaScript changes the React/Vite client layer only; the server remains TypeScript. Next.js is an
integrated full-stack app. Laravel Livewire and Laravel Inertia React are integrated PHP applications;
Inertia's React UI and Laravel routes/sessions live in one `server/` app. They remain distinct from the
Laravel 12 API/data scaffold and the separate React/Vite client plus API paths. Expo and Tauri create a
native client that talks to a separately run backend; OmniCraft does not scaffold that backend in the
same native project.

Authentication is an optional stack-filtered setup, separate from `omnicraft add` module history.
`None` adds no authentication layer; selected authentication is recorded in the generated manifest's
`authentication` field. Creation-time Better Auth and `omnicraft add auth` share the same catalog and
compatibility rules. The support matrix is the source of truth for exact authentication combinations
and their evidence.

## Components and responsibilities

| Component | Files | Responsibility |
| --- | --- | --- |
| Entry/orchestration | `src/index.ts` | Argument validation, TTY guard, generator execution, scaffold/install ordering, and the single cancellation/error path. |
| CLI surface | `src/args.ts` | Positional project name, flags, and `HELP_TEXT`. The README options block mirrors this text. |
| Capability choices | `src/capabilities.ts`, `src/compatibility.ts`, `src/prefill.ts`, and `src/prompts/run-prompts.ts` | Typed dimension and module choices, cross-option constraints, flag validation, `--yes` defaults, interactive choices, and composition/auth guards. |
| Project types | `src/types.ts` | Type unions and `Answers` shape. Some union values are future values and do not make a choice selectable. |
| Composition | `src/scaffold/compose.ts` | Pure mapping from `Answers` to ordered layers and template variables; routes Next.js and native adapters separately. |
| Engine | `src/scaffold/engine.ts` | Recursive template copy, token render, underscore dotfile restoration, protected-name checks, and `package.json` merge. Later template layers overwrite earlier files except manifests, which merge. |
| Renderer | `src/scaffold/renderer.ts` | `{{token}}` replacement, unresolved-token detection, dotfile rename, binary-file detection. Vue `.vue` files are exempt from the unresolved-token scan. |
| Manifest merge | `src/scaffold/merge.ts` | Recursive `package.json` merge; later scalars and arrays replace earlier values. |
| Remote templates | `src/config.ts`, `src/scaffold/remote.ts` | `--latest` downloads the release tag matching the CLI version, not the mutable `main` branch. |
| Module injector | `src/add.ts`, `src/modules/` | `omnicraft add` loads project metadata, checks module compatibility/conflicts, applies patches, and records modules separately from active authentication. Current module coverage is summarized in the support matrix. |
| Process helpers | `src/exec.ts` | Captured and visible subprocess execution; Windows command-shell rules are in [coding standards](../development/coding-standards.md). |
| Templates | `packages/cli/templates/` | Embedded generated-project files published with the CLI. See the [template contract](../templates/template-contract.md). |
| Tests | `src/**/*.test.ts` | Unit and contract coverage for CLI behavior; generated-project coverage is recorded separately in the [testing strategy](../development/testing-strategy.md) and support matrix. |
| Smoke generation | `scripts/smoke-e2e.ts` | Lists 19 layer-composition paths, including two Inertia React root overlays and a network-backed `create-next-app` step; it does not cover native projects or install/boot every generated app. |

## Cross-cutting behavior and limits

1. **Capability accuracy.** `capabilities.ts` lists selectable dimension values and module IDs;
   `compatibility.ts` shares cross-option rules across prompts, flag validation, composition, and
   authentication guards. The support matrix records exact combinations and their verification evidence.
2. **Layer overrides.** Repeated files such as framework routes, env files, Vite config, CSS, and
   `.env.example` are intentional. A later layer replaces earlier template output; `package.json`
   objects deep-merge.
3. **Token behavior.** Tokens with no value cause `UnresolvedTokenError` in non-`.vue` text files.
   Vue interpolation uses the same braces and is intentionally excluded.
4. **Destination behavior.** Interactive runs show a conservative collision preview before continuing;
   it may include files that the final composition does not write. `--yes` refuses any non-empty target.
   `.env` names are protected, but writes are direct, non-transactional, and do not reject destination
   symlinks. See the [template engine guide](template-engine.md) for exact limits.
5. **Windows subprocesses.** All child processes go through `src/exec.ts`; on Windows the helper passes
   one command string through `shell: true` for npm/git shim compatibility. Callers use hardcoded
   commands.
6. **Terminal restoration.** `restoreTerminal()` is registered on exit, SIGINT, and uncaught exceptions
   because Clack uses raw terminal mode.
7. **CI evidence.** CI scaffolds the smoke list and runs dedicated generated-project integrations for
   exact supported rows, including the Supabase Auth, Laravel Sanctum, Livewire, and Inertia auth
   scenarios. See the [testing strategy](../development/testing-strategy.md) and
   [support matrix](../templates/stack-support-matrix.md) for exact evidence and boundaries.
