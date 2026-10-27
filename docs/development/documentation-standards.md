# Documentation standards

What must be updated when behavior changes, where each kind of content lives, and the rules that keep
the docs trustworthy. Meta-doc: this page governs the docs tree itself.

## Document responsibilities (what lives where)

| Document                                 | Owns                                                                                            | Must never do                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [AGENTS.md](../../AGENTS.md)             | Concise agent entry point: commands, non-negotiable rules, repo map, links                      | Replace deep guides — it indexes, it doesn't duplicate   |
| [README.md](../../README.md)             | User-facing overview, install, **current** support, options (identical to `HELP_TEXT`), demo    | Claim support ahead of verification; drift from CLI help |
| [CONTRIBUTING.md](../../CONTRIBUTING.md) | Contribution and release process                                                                |                                                          |
| [ROADMAP.md](../../ROADMAP.md)           | Milestones, phase progress, issue links                                                         | Describe proposals as shipped                            |
| [docs/index.md](../index.md)             | Directory + reading paths + status vocabulary                                                   |                                                          |
| `docs/architecture/*`                    | How the CLI actually works (flow, layout, engine)                                               | Describe intended-but-unbuilt behavior                   |
| `docs/development/*`                     | Standards and workflows for changing the CLI                                                    |                                                          |
| `docs/templates/*`                       | Template contract, extension procedures, [support matrix](../templates/stack-support-matrix.md) | List combos that haven't met the verification bar        |
| `docs/plans/active/`                     | Current working plans                                                                           | Pretend to be current-state docs                         |
| `docs/demo.*`                            | Generated demo assets (via `npm run demo`)                                                      | Be hand-edited                                           |

## Change-coupling rules

Docs update **in the same PR** as the code they describe:

1. **Capability change** (new/changed runtime, framework, database, ORM, extra) →
   [support matrix](../templates/stack-support-matrix.md) + README choice scope/flow diagram + the
   relevant flag registry, prompt choices, `src/compatibility.ts`, module guard, and composition rules.
   `AVAILABLE` remains the dimension-level choice list. Status moves forward only with evidence (see
   the matrix's rules).
2. **CLI surface change** (flag, prompt, default) → README "Options" **and** `HELP_TEXT` in `src/args.ts`
   together — they must be identical.
3. **Engine/composition change** → [template engine](../architecture/template-engine.md) +
   [template contract](../templates/template-contract.md).
4. **New module/directory** → [repository structure](../architecture/repository-structure.md) placement table.
5. **Milestone progress** → ROADMAP checkbox + progress table (and the issue closes with an evidence comment).
6. **Released user-visible change** → changelog entry when `CHANGELOG.md` exists.

## Accuracy rules

- **Actual, not aspirational.** Present-tense statements describe shipped, verified behavior. Everything
  else is "planned"/"experimental" — the [status vocabulary](../index.md#status-vocabulary) is canonical.
- **Scaffolded ≠ verified ≠ supported.** The [testing strategy](testing-strategy.md) defines the bar;
  the matrix records who met it.
- **One authoritative home per fact.** Verification status → support matrix; capability choices and
  compatibility → current flag/prompt/module registry plus composition code; layer/merge rules →
  template-engine doc; token list → template-engine doc. Other pages link, never copy.
- **Commands must be runnable as written.** Every command in docs is something a contributor can paste
  into a shell from the stated directory.
- **Examples match help.** README option examples are copy-consistent with `node dist/index.js --help`.

## Style

- GitHub-flavored Markdown; relative links between docs (checked before merging).
- Tables for enumerable facts (matrices, file maps); prose for explanation.
- Keep pages short and single-purpose; when a page grows past ~150 lines of reference content, split by
  concern and link.
- No duplicated explanations across pages — link to the authoritative one.

## When documentation itself is the change

- Check internal links (they're relative; move = update every referent).
- The completed master plan is historical. For current process rules, follow `AGENTS.md` and the active
  development guides; record conflicts there instead of treating an archived plan as current policy.
- Update [docs/index.md](../index.md) when adding, moving, or renaming any page in `docs/`.
