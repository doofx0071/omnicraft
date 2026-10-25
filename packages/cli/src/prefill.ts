import type { Answers, BackendFramework, Frontend, Orm } from './types.js'
import type { ParsedArgs } from './args.js'

/** Stack choices that exist in the current release — the prompts show more options as "(soon)". */
export const AVAILABLE = {
  frontend: ['react'] as const,
  backend: ['express', 'fastify', 'hono'] as const,
  db: ['postgres', 'sqlite', 'mysql'] as const,
  orm: ['drizzle', 'prisma'] as const,
  extras: ['tailwind', 'eslint'] as const,
}

export type Extra = (typeof AVAILABLE.extras)[number]

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

/** Validates every stack flag present on the parsed args; throws on bad values. */
export function validateStackFlags(args: ParsedArgs): void {
  if (args.frontend) parseEnumChoice('--frontend', args.frontend, AVAILABLE.frontend)
  if (args.backend) parseEnumChoice('--backend', args.backend, AVAILABLE.backend)
  if (args.db) parseEnumChoice('--db', args.db, AVAILABLE.db)
  if (args.orm) parseEnumChoice('--orm', args.orm, AVAILABLE.orm)
  if (args.extras) {
    for (const extra of args.extras) parseEnumChoice('--extras', extra, AVAILABLE.extras)
  }
  // Prisma 7 driver adapters are wired for PostgreSQL only right now —
  // SQLite/MySQL ship with Drizzle.
  const db = args.db?.trim().toLowerCase() ?? 'postgres'
  const orm = args.orm?.trim().toLowerCase()
  if (db !== 'postgres' && orm === 'prisma') {
    throw new Error(`Invalid combination: --orm prisma currently supports --db postgres only (got ${db})`)
  }
}

/** True when at least one prompt would be answered by a flag. */
export function hasStackFlags(args: ParsedArgs): boolean {
  return (
    args.fullStack !== undefined ||
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
  const fullStack = args.fullStack ?? true
  const frontend: Frontend = args.frontend
    ? parseEnumChoice('--frontend', args.frontend, AVAILABLE.frontend)
    : 'react'
  const database = args.db
    ? parseEnumChoice('--db', args.db, AVAILABLE.db)
    : 'postgres'
  const backendFramework: BackendFramework = fullStack
    ? args.backend
      ? parseEnumChoice('--backend', args.backend, AVAILABLE.backend)
      : 'express'
    : 'express'
  const orm: Orm = fullStack
    ? args.orm
      ? parseEnumChoice('--orm', args.orm, AVAILABLE.orm)
      : 'drizzle'
    : 'drizzle'
  const extrasList = args.extras ?? [...AVAILABLE.extras]

  return {
    projectName,
    targetDir,
    projectType: 'web',
    frontend,
    language: 'typescript',
    fullStack,
    backendRuntime: fullStack ? 'node' : null,
    backendFramework: fullStack ? backendFramework : null,
    orm: fullStack ? orm : null,
    database: fullStack ? database : null,
    extras: {
      tailwind: extrasList.includes('tailwind'),
      eslintPrettier: extrasList.includes('eslint'),
    },
  }
}
