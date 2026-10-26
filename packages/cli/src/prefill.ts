import type { Answers, BackendFramework, Frontend, Orm } from './types.js'
import type { ParsedArgs } from './args.js'

/**
 * Stack choices that exist in the current release — the prompts show more
 * options as "(soon)". Availability is runtime-scoped: only Node.js uses a
 * user-selected ORM; Python ships SQLAlchemy + Alembic; PHP ships Eloquent.
 */
export const AVAILABLE = {
  runtime: ['node', 'python', 'php'] as const,
  frontend: ['react', 'nextjs', 'vue', 'svelte'] as const,
  lang: ['typescript', 'javascript'] as const,
  backend: {
    node: ['express', 'fastify', 'hono'] as const,
    python: ['fastapi'] as const,
    php: ['laravel'] as const,
  },
  db: {
    node: ['postgres', 'sqlite', 'mysql'] as const,
    python: ['postgres', 'sqlite'] as const,
    php: ['postgres', 'sqlite', 'mysql'] as const,
  },
  orm: { node: ['drizzle', 'prisma', 'none'] as const },
  extras: ['tailwind', 'eslint', 'shadcn'] as const,
}

export type Runtime = (typeof AVAILABLE.runtime)[number]

/** Throws a friendly error when a flag value isn't an available choice. */
export function parseEnumChoice<T extends string>(
  flag: string,
  value: string,
  allowed: readonly T[],
): T {
  const v = value.trim().toLowerCase()
  if (!(allowed as readonly string[]).includes(v)) {
    throw new Error(`Invalid ${flag} value "${value}". Available: ${allowed.join(', ')}`)
  }
  return v as T
}

function resolveRuntime(args: ParsedArgs): Runtime {
  return args.runtime
    ? parseEnumChoice('--runtime', args.runtime, AVAILABLE.runtime)
    : 'node'
}

/** Validates every stack flag present on the parsed args; throws on bad values. */
export function validateStackFlags(args: ParsedArgs): void {
  const runtime = resolveRuntime(args)
  if (args.lang) parseEnumChoice('--lang', args.lang, AVAILABLE.lang)
  if (args.frontend) parseEnumChoice('--frontend', args.frontend, AVAILABLE.frontend)
  if (args.backend) parseEnumChoice('--backend', args.backend, AVAILABLE.backend[runtime])
  if (args.db) parseEnumChoice('--db', args.db, AVAILABLE.db[runtime])
  if (args.orm && runtime !== 'node') {
    throw new Error('--orm applies to Node.js backends only (Python uses SQLAlchemy + Alembic, PHP uses Eloquent)')
  }
  if (args.orm) parseEnumChoice('--orm', args.orm, AVAILABLE.orm.node)
  if (args.extras) {
    for (const extra of args.extras) parseEnumChoice('--extras', extra, AVAILABLE.extras)
    // shadcn/ui is built on Tailwind — selecting it implies the tailwind extra.
    if (args.extras.includes('shadcn') && !args.extras.includes('tailwind')) {
      args.extras.push('tailwind')
    }
  }
  // Prisma 7 driver adapters are wired for PostgreSQL only right now —
  // SQLite/MySQL ship with Drizzle or raw SQL.
  if (runtime === 'node') {
    const db = args.db?.trim().toLowerCase() ?? 'postgres'
    const orm = args.orm?.trim().toLowerCase()
    if (db !== 'postgres' && orm === 'prisma') {
      throw new Error(
        `Invalid combination: --orm prisma currently supports --db postgres only (got ${db})`,
      )
    }
  }
}

/** True when at least one prompt would be answered by a flag. */
export function hasStackFlags(args: ParsedArgs): boolean {
  return (
    args.fullStack !== undefined ||
    args.runtime !== undefined ||
    args.frontend !== undefined ||
    args.backend !== undefined ||
    args.db !== undefined ||
    args.orm !== undefined ||
    args.extras !== undefined
  )
}

/**
 * Builds complete answers from flags + defaults — used for `--yes` runs where
 * no prompt may appear. Defaults match the interactive flow's initial values.
 */
export function resolveAnswers(args: ParsedArgs, projectName: string, targetDir: string): Answers {
  const runtime = resolveRuntime(args)
  const frontend: Frontend = args.frontend
    ? parseEnumChoice('--frontend', args.frontend, AVAILABLE.frontend)
    : 'react'
  // Next.js is the integrated-full-stack architecture: it IS the server, so
  // the separate backend prompts collapse into the framework choice.
  const integrated = frontend === 'nextjs'
  const fullStack = integrated ? true : (args.fullStack ?? true)
  const db = args.db ? parseEnumChoice('--db', args.db, AVAILABLE.db[runtime]) : 'postgres'
  const backendFramework: BackendFramework = fullStack && !integrated
    ? args.backend
      ? parseEnumChoice('--backend', args.backend, AVAILABLE.backend[runtime])
      : runtime === 'node'
        ? 'express'
        : runtime === 'python'
          ? 'fastapi'
          : 'laravel'
    : 'express'
  const orm: Orm | null = fullStack && runtime === 'node'
    ? args.orm
      ? parseEnumChoice('--orm', args.orm, AVAILABLE.orm.node)
      : 'drizzle'
    : null
  // Defaults mirror the interactive prompt's initialValues (tailwind + eslint,
  // shadcn opt-in) — NOT the full AVAILABLE list.
  const extrasList = args.extras ?? AVAILABLE.extras.filter((e) => e !== 'shadcn')

  return {
    projectName,
    targetDir,
    projectType: 'web',
    frontend,
    language: args.lang ? parseEnumChoice('--lang', args.lang, AVAILABLE.lang) : 'typescript',
    fullStack,
    backendRuntime: fullStack && !integrated ? runtime : null,
    backendFramework: fullStack && !integrated ? backendFramework : null,
    orm,
    database: fullStack ? db : null,
    extras: {
      tailwind: extrasList.includes('tailwind') || extrasList.includes('shadcn'),
      eslintPrettier: extrasList.includes('eslint'),
      shadcn: extrasList.includes('shadcn'),
    },
    architecture: integrated
      ? { kind: 'integrated-fullstack', framework: 'nextjs' }
      : fullStack
        ? { kind: 'separate-frontend-api' }
        : { kind: 'frontend-only' },
  }
}
