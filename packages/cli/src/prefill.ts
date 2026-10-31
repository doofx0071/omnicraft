import type { Answers, AuthenticationSetup, BackendFramework, Frontend, Orm } from './types.js'
import type { ParsedArgs } from './args.js'
import { AVAILABLE } from './capabilities.js'
import {
  validateAnswerCompatibility,
  validateFlagCompatibility,
} from './compatibility.js'

/** Available prompt and flag values, derived from the typed capability registry. */
export { AVAILABLE } from './capabilities.js'

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
  if (args.runtime) return parseEnumChoice('--runtime', args.runtime, AVAILABLE.runtime)
  if (
    args.frontend?.trim().toLowerCase() === 'livewire' ||
    args.frontend?.trim().toLowerCase() === 'inertia-react' ||
    args.auth?.trim().toLowerCase() === 'laravel-native'
  ) return 'php'
  return 'node'
}

/** Validates every stack flag present on the parsed args; throws on bad values. */
export function validateStackFlags(args: ParsedArgs): void {
  const runtime = resolveRuntime(args)
  if (args.platform) parseEnumChoice('--platform', args.platform, ['web', 'mobile', 'desktop'])
  if (args.lang) parseEnumChoice('--lang', args.lang, AVAILABLE.lang)
  if (args.frontend) parseEnumChoice('--frontend', args.frontend, AVAILABLE.frontend)
  if (args.backend) parseEnumChoice('--backend', args.backend, AVAILABLE.backend[runtime])
  if (args.db) parseEnumChoice('--db', args.db, AVAILABLE.db[runtime])
  if (args.auth) parseEnumChoice('--auth', args.auth, AVAILABLE.authentication)
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
  validateFlagCompatibility(args)
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
    args.auth !== undefined ||
    args.extras !== undefined
  )
}

/**
 * Builds complete answers from flags + defaults — used for `--yes` runs where
 * no prompt may appear. Defaults match the interactive flow's initial values.
 */
export function resolveAnswers(args: ParsedArgs, projectName: string, targetDir: string): Answers {
  validateStackFlags(args)
  const runtime = resolveRuntime(args)
  const supabaseAuth = args.auth?.trim().toLowerCase() === 'supabase-auth'
  const laravelNative = args.auth?.trim().toLowerCase() === 'laravel-native'
  const inferredFrontend = laravelNative && args.frontend === undefined ? 'livewire' : undefined
  const frontend: Frontend = inferredFrontend
    ? inferredFrontend
    : args.frontend
      ? parseEnumChoice('--frontend', args.frontend, AVAILABLE.frontend)
      : 'react'
  // Next.js is the integrated-full-stack architecture: it IS the server, so
  // the separate backend prompts collapse into the framework choice.
  const integrated = frontend === 'nextjs'
  const integratedLaravel = frontend === 'livewire' || frontend === 'inertia-react'
  const integratedLaravelLivewire = frontend === 'livewire'
  const fullStack = supabaseAuth ? false : integratedLaravel || integrated ? true : (args.fullStack ?? true)
  const db = args.db
    ? parseEnumChoice('--db', args.db, AVAILABLE.db[runtime])
    : integratedLaravel
      ? 'sqlite'
      : 'postgres'
  const backendFramework: BackendFramework | null = integratedLaravel
    ? 'laravel'
    : fullStack && !integrated
    ? args.backend
      ? parseEnumChoice('--backend', args.backend, AVAILABLE.backend[runtime])
      : runtime === 'node'
        ? 'express'
        : runtime === 'python'
          ? 'fastapi'
          : 'laravel'
    : null
  const orm: Orm | null = integratedLaravel
    ? null
    : integrated
    ? 'none'
    : fullStack && runtime === 'node'
    ? args.orm
      ? parseEnumChoice('--orm', args.orm, AVAILABLE.orm.node)
      : 'drizzle'
    : null
  // Defaults mirror the interactive prompt's initialValues (tailwind + eslint,
  // shadcn opt-in) — NOT the full AVAILABLE list.
  const extrasList = args.extras ?? AVAILABLE.extras.filter((e) => e !== 'shadcn')

  const answers: Answers = {
    projectName,
    targetDir,
    projectType: 'web',
    frontend,
    language: integratedLaravelLivewire
      ? null
      : args.lang
        ? parseEnumChoice('--lang', args.lang, AVAILABLE.lang)
        : 'typescript',
    fullStack,
    backendRuntime: fullStack && (!integrated || integratedLaravel) ? runtime : null,
    backendFramework,
    orm,
    database: fullStack ? db : null,
    authentication: args.auth
      ? parseEnumChoice<AuthenticationSetup>('--auth', args.auth, AVAILABLE.authentication)
      : 'none',
    extras: integratedLaravel
      ? { tailwind: false, eslintPrettier: false, shadcn: false }
      : {
          tailwind: extrasList.includes('tailwind') || extrasList.includes('shadcn'),
          eslintPrettier: extrasList.includes('eslint'),
          shadcn: extrasList.includes('shadcn'),
        },
    architecture: integratedLaravel
      ? {
          kind: 'integrated-laravel',
          framework: 'laravel',
          mode: integratedLaravelLivewire ? 'livewire' : 'inertia-react',
        }
      : integrated
      ? { kind: 'integrated-fullstack', framework: 'nextjs' }
      : fullStack
        ? { kind: 'separate-frontend-api' }
        : { kind: 'frontend-only' },
  }
  validateAnswerCompatibility(answers)
  return answers
}
