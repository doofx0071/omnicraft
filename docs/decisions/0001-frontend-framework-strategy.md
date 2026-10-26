# ADR 0001 — Frontend framework expansion strategy (Next.js, TanStack/React Router, Vue, Svelte)

**Status:** Accepted (2026-10-26)
**Context:** Issue #20 (evaluate TanStack Start / React Router v7) and issue #17 (Next.js).
**Supersedes:** none. Related: master plan §3-A/§3-B, §8.

## Context

OmniCraft v0.3.x scaffolds a single architecture: **separate frontend + API** (Vite client +
independent backend). The roadmap adds frontends with fundamentally different shapes:

- **Next.js** — integrated full-stack: the framework is the server (route handlers, SSR/RSC).
- **TanStack Start / React Router Framework Mode** — also integrated full-stack, younger ecosystems.
- **Vue / Svelte (Vite)** — same architecture as the existing React client; only the view layer differs.

## Decision

1. **Next.js ships via the official generator adapter** — `create-next-app@16` pinned, invoked
   non-interactively (`--ts --app --tailwind --no-src-dir --import-alias @/* --use-npm
--skip-install --yes`), then an OmniCraft overlay (users API route handlers, demo page, db
   adapter, root scripts/CI). Rationale: Next.js conventions evolve faster than we can mirror them
   in owned templates; the adapter keeps the foundation current while OmniCraft's value (db
   boilerplate, working CRUD, DX) is layered on top. Same pattern as Laravel/Composer.
2. **The architecture becomes explicit** — `Answers.architecture: frontend-only |
integrated-fullstack | separate-frontend-api`. For `integrated-fullstack`, the "Full-stack?",
   runtime, and backend-framework prompts collapse (the framework is the server); the db/ORM
   prompts remain. This is a prerequisite the master plan called out before any integrated
   framework work.
3. **TanStack Start / React Router Framework Mode: deferred, not scheduled.** They are both viable,
   but two integrated adapters double the verification surface while the adapter contract has been
   proven for exactly one integrated framework. Revisit after v0.4.0 usage feedback; the decision
   record then evaluates the official initializers' non-interactive support, server-action model,
   and stability against the Next adapter's real-world maintenance cost.
4. **Vue and Svelte ship as owned Vite client templates** — small surface, no official-generator
   adapter warranted (same rationale as keeping the Vite+React template). Same architecture
   (`separate-frontend-api`), same db/ORM/extras matrix.

## Consequences

- `compose` gains an integrated path: no client layer pre-CNA; overlay + db layer applied after
  the generator runs; `mergeManifestAtRoot` layers merge deps into the single root manifest.
- The tailwind extra ships per-frontend vite configs (`vite-react|vue|svelte`); Next is excluded
  (CNA wires Tailwind via turbopack).
- shadcn is React+Vite only (components and the vite alias assume that stack).
- Verification bar unchanged (support matrix): a new frontend advertises "Supported" only after
  install + typecheck/build + boot + one real DB operation.
