import type { ParsedArgs } from './args.js'
import type {
  Answers,
  AuthenticationSetup,
  BackendFramework,
  Frontend,
  Language,
  Orm,
  ProjectType,
} from './types.js'
import { AUTHENTICATION_CATALOG, AVAILABLE, CAPABILITY_REGISTRY } from './capabilities.js'

export const RUNTIME_BACKENDS = AVAILABLE.backend
export const RUNTIME_DATABASES = AVAILABLE.db
export const NODE_FRAMEWORK_ORMS = CAPABILITY_REGISTRY.ormsByNodeBackend

export const MODULE_COMPATIBILITY = {
  auth: AUTHENTICATION_CATALOG['better-auth'].requirements,
} as const

export interface AuthenticationContext {
  frontend: string
  language?: string
  architecture: { kind: string }
  backendRuntime: string | null
  backendFramework: string | null
  orm: string | null
  database: string | null
}

export function authenticationCompatibilityReason(
  setup: AuthenticationSetup,
  context: AuthenticationContext,
): string | null {
  const definition = AUTHENTICATION_CATALOG[setup]
  if (definition.category === 'none') return null

  const supported = definition.requirements
  if (!supported) {
    throw new Error(`Authentication setup "${setup}" is missing its stack requirements.`)
  }
  if (context.frontend !== supported.frontend) {
    return `Better Auth currently requires the React frontend; ${context.frontend} is not covered yet.`
  }
  if (context.language !== undefined && context.language !== supported.language) {
    return `Better Auth creation currently requires TypeScript; ${context.language} is not covered yet.`
  }
  if (
    context.backendRuntime !== supported.backendRuntime ||
    context.backendFramework !== supported.backendFramework ||
    context.orm !== supported.orm
  ) {
    return 'Better Auth currently requires Node.js + Express + Drizzle; its route patches target Express.'
  }
  if (context.architecture.kind !== supported.architecture) {
    return `architecture "${context.architecture.kind}" is not covered yet`
  }
  if (!(supported.databases as readonly string[]).includes(context.database ?? '')) {
    return `Better Auth currently supports SQLite, PostgreSQL, and MySQL; ${context.database ?? 'no database'} is not covered yet.`
  }
  return null
}

export function compatibleAuthenticationSetups(
  context: AuthenticationContext,
): AuthenticationSetup[] {
  return AVAILABLE.authentication.filter(
    (setup) => authenticationCompatibilityReason(setup, context) === null,
  )
}

const NEXTJS_GENERATOR_EXTRAS = ['tailwind', 'eslint'] as const

function matchesNextjsGeneratorExtras(extras: readonly string[] | undefined): boolean {
  if (extras === undefined) return true
  const selected = new Set(extras)
  return (
    selected.size === NEXTJS_GENERATOR_EXTRAS.length &&
    NEXTJS_GENERATOR_EXTRAS.every((extra) => selected.has(extra))
  )
}

export function nodeOrmsForFramework(framework: BackendFramework | null): readonly Orm[] {
  if (framework === 'express' || framework === 'fastify' || framework === 'hono') {
    return NODE_FRAMEWORK_ORMS[framework]
  }
  return []
}

export function supportsLanguage(
  projectType: ProjectType,
  frontend: Frontend,
  language: Language,
): boolean {
  return language === 'typescript' || (projectType === 'web' && frontend === 'react')
}

export function supportsShadcn(
  projectType: ProjectType,
  frontend: Frontend,
  architecture: Answers['architecture'],
): boolean {
  return (
    projectType === 'web' &&
    frontend === 'react' &&
    architecture.kind !== 'integrated-fullstack' &&
    architecture.kind !== 'native-app'
  )
}

/** Rejects cross-option flag combinations before prompts or scaffold writes. */
export function validateFlagCompatibility(args: ParsedArgs): void {
  const platform = args.platform?.trim().toLowerCase()
  const frontend = args.frontend?.trim().toLowerCase()
  const runtime = args.runtime?.trim().toLowerCase() ?? 'node'
  const backend = args.backend?.trim().toLowerCase()
  const orm = args.orm?.trim().toLowerCase()
  const extras = args.extras ?? []
  const isNative = platform === 'mobile' || platform === 'desktop'
  if (args.lang?.trim().toLowerCase() === 'javascript' && isNative) {
    throw new Error('Native Expo and Tauri scaffolds use TypeScript; omit --lang javascript.')
  }
  const hasWebStackFlags =
    args.lang?.trim().toLowerCase() === 'javascript' ||
    args.frontend !== undefined ||
    args.fullStack !== undefined ||
    args.runtime !== undefined ||
    args.backend !== undefined ||
    args.db !== undefined ||
    args.orm !== undefined ||
    extras.length > 0

  if (isNative && hasWebStackFlags) {
    throw new Error(
      'Mobile and desktop scaffolds use their official TypeScript generators; omit web stack flags.',
    )
  }

  if (args.fullStack === false && (args.runtime || args.backend || args.db || args.orm)) {
    throw new Error(
      '--runtime, --backend, --db, and --orm require a full-stack project; remove --no-full-stack.',
    )
  }

  if (
    frontend === 'nextjs' &&
    (args.runtime || args.backend || args.orm || args.fullStack === false)
  ) {
    throw new Error(
      'Next.js is integrated full-stack and uses raw SQL; --runtime, --backend, --orm, and --no-full-stack do not apply.',
    )
  }

  if (frontend === 'nextjs' && !matchesNextjsGeneratorExtras(args.extras)) {
    throw new Error(
      'Next.js always includes Tailwind and ESLint from create-next-app; use --extras tailwind,eslint or omit --extras.',
    )
  }

  if (args.lang?.trim().toLowerCase() === 'javascript' && frontend && frontend !== 'react') {
    throw new Error(
      'JavaScript is only available for the React/Vite web frontend; choose --lang typescript for this frontend.',
    )
  }

  if (extras.includes('shadcn') && frontend && frontend !== 'react') {
    throw new Error(
      'shadcn/ui is only available for React/Vite web projects; choose --frontend react or omit shadcn.',
    )
  }

  if (runtime === 'node' && backend === 'hono' && orm === 'prisma') {
    throw new Error('Prisma is not available for Hono; choose Drizzle or raw SQL with --orm none.')
  }

  if (args.auth?.trim().toLowerCase() === 'better-auth') {
    const supported = MODULE_COMPATIBILITY.auth
    const conflicts =
      (platform !== undefined && platform !== 'web') ||
      args.fullStack === false ||
      (args.lang !== undefined && args.lang.trim().toLowerCase() !== supported.language) ||
      (frontend !== undefined && frontend !== supported.frontend) ||
      (args.runtime !== undefined && runtime !== supported.backendRuntime) ||
      (backend !== undefined && backend !== supported.backendFramework) ||
      (orm !== undefined && orm !== supported.orm) ||
      (args.db !== undefined && !(supported.databases as readonly string[]).includes(args.db.trim().toLowerCase()))
    if (conflicts) {
      throw new Error(
        '--auth better-auth requires TypeScript with a full-stack React/Vite Express API using Drizzle and SQLite, PostgreSQL, or MySQL.',
      )
    }
  }
}

/**
 * Prompt filtering mirrors the same combinations accepted by flags and
 * composition, keeping a preselected flag from making the wizard offer a
 * choice that cannot be used.
 */
export function isProjectTypeAllowedByFlags(projectType: ProjectType, args: ParsedArgs): boolean {
  if (projectType === 'web') return true
  const webOnlyFlags =
    args.lang?.trim().toLowerCase() === 'javascript' ||
    args.frontend !== undefined ||
    args.fullStack !== undefined ||
    args.runtime !== undefined ||
    args.backend !== undefined ||
    args.db !== undefined ||
    args.orm !== undefined ||
    (args.extras?.length ?? 0) > 0 ||
    args.auth?.trim().toLowerCase() === 'better-auth'
  return !webOnlyFlags
}

export function isFrontendAllowedByFlags(frontend: Frontend, args: ParsedArgs): boolean {
  if (args.auth?.trim().toLowerCase() === 'better-auth' && frontend !== MODULE_COMPATIBILITY.auth.frontend) return false
  if (args.lang?.trim().toLowerCase() === 'javascript' && frontend !== 'react') return false
  if (args.extras?.includes('shadcn') && frontend !== 'react') return false
  if (frontend === 'nextjs' && !matchesNextjsGeneratorExtras(args.extras)) return false
  if (
    (args.runtime || args.backend || args.orm || args.fullStack === false) &&
    frontend === 'nextjs'
  )
    return false
  return true
}

export function isRuntimeAllowedByFlags(
  runtime: 'node' | 'python' | 'php',
  args: ParsedArgs,
): boolean {
  if (
    args.auth?.trim().toLowerCase() === 'better-auth' &&
    runtime !== MODULE_COMPATIBILITY.auth.backendRuntime
  )
    return false
  if (args.runtime && args.runtime.trim().toLowerCase() !== runtime) return false
  if (!args.runtime && (args.orm || args.backend)) return runtime === 'node'
  if (
    args.db &&
    !(RUNTIME_DATABASES[runtime] as readonly string[]).includes(args.db.trim().toLowerCase())
  )
    return false
  return true
}

export function hasFullStackFlags(args: ParsedArgs): boolean {
  return Boolean(args.runtime || args.backend || args.db || args.orm || args.auth?.trim().toLowerCase() === 'better-auth')
}

/** Throws when an Answers object could silently compose the wrong template. */
export function validateAnswerCompatibility(answers: Answers): void {
  const authenticationError = authenticationCompatibilityReason(
    answers.authentication,
    answers,
  )
  if (authenticationError) throw new Error(authenticationError)

  const integrated = answers.architecture.kind === 'integrated-fullstack'
  const native = answers.architecture.kind === 'native-app'

  if (native) {
    if (
      answers.architecture.kind !== 'native-app' ||
      answers.projectType !== answers.architecture.platform ||
      answers.language !== 'typescript'
    ) {
      throw new Error(
        'Native Expo and Tauri scaffolds require their matching platform and TypeScript.',
      )
    }
    if (
      answers.fullStack ||
      answers.backendRuntime ||
      answers.backendFramework ||
      answers.orm ||
      answers.database ||
      answers.extras.tailwind ||
      answers.extras.eslintPrettier ||
      answers.extras.shadcn
    ) {
      throw new Error(
        'Native Expo and Tauri scaffolds do not accept web backend, database, or extra layers.',
      )
    }
    return
  }

  if (answers.projectType !== 'web') {
    throw new Error('Mobile and desktop projects must use the native-app architecture.')
  }
  if (!supportsLanguage(answers.projectType, answers.frontend, answers.language)) {
    throw new Error('JavaScript is only available for the React/Vite web frontend.')
  }
  if (
    answers.extras.shadcn &&
    !supportsShadcn(answers.projectType, answers.frontend, answers.architecture)
  ) {
    throw new Error('shadcn/ui is only available for React/Vite web projects.')
  }

  if (answers.frontend === 'nextjs') {
    if (
      !integrated ||
      !answers.fullStack ||
      answers.backendRuntime !== null ||
      answers.backendFramework !== null ||
      answers.orm !== 'none' ||
      answers.database === null ||
      !(RUNTIME_DATABASES.node as readonly string[]).includes(answers.database) ||
      !answers.extras.tailwind ||
      !answers.extras.eslintPrettier
    ) {
      throw new Error(
        'Next.js must use the integrated full-stack architecture with raw SQL, a supported database, and no separate backend.',
      )
    }
    return
  }

  if (integrated) {
    throw new Error('Only Next.js can use the integrated full-stack architecture.')
  }

  if (answers.fullStack) {
    if (
      answers.architecture.kind !== 'separate-frontend-api' ||
      answers.backendRuntime === null ||
      answers.backendFramework === null ||
      answers.database === null
    ) {
      throw new Error('A separate full-stack project requires a compatible backend and database.')
    }
    const frameworks = RUNTIME_BACKENDS[answers.backendRuntime]
    if (!(frameworks as readonly string[]).includes(answers.backendFramework)) {
      throw new Error(
        `${answers.backendFramework} is not available for the ${answers.backendRuntime} runtime.`,
      )
    }
    if (answers.backendRuntime === 'node') {
      const allowedOrms = nodeOrmsForFramework(answers.backendFramework)
      if (answers.orm === null || !allowedOrms.includes(answers.orm)) {
        throw new Error(
          `${answers.orm ?? 'No ORM'} is not available for ${answers.backendFramework}.`,
        )
      }
    } else if (answers.orm !== null) {
      throw new Error(
        `${answers.backendRuntime} backends use their built-in data access layer, not a Node ORM.`,
      )
    }
    if (
      !(RUNTIME_DATABASES[answers.backendRuntime] as readonly string[]).includes(answers.database)
    ) {
      throw new Error(
        `${answers.database} is not available for the ${answers.backendRuntime} runtime.`,
      )
    }
  } else if (
    answers.architecture.kind !== 'frontend-only' ||
    answers.backendRuntime !== null ||
    answers.backendFramework !== null ||
    answers.orm !== null ||
    answers.database !== null
  ) {
    throw new Error('Frontend-only projects cannot include backend or database selections.')
  }
}
