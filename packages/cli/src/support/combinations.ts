import { AVAILABLE, CAPABILITY_REGISTRY, type ModuleId } from '../capabilities.js'
import type {
  AuthenticationSetup,
  BackendFramework,
  BackendRuntime,
  Database,
  Frontend,
  Language,
  Orm,
} from '../types.js'

export interface SupportedCombination {
  flags: {
    platform: 'web'
    lang?: Language
    frontend: Frontend
    fullStack: boolean
    runtime?: BackendRuntime
    backend?: BackendFramework
    orm?: Orm
    db?: Database
    auth?: AuthenticationSetup
    extras: readonly (typeof AVAILABLE.extras)[number][]
  }
  module?: ModuleId
}

export function webStack(
  frontend: Frontend,
  language: Language,
  runtime: BackendRuntime,
  backend: BackendFramework,
  orm: Orm | undefined,
  database: Database,
  module?: ModuleId,
  extras: SupportedExtras = [],
): SupportedCombination {
  return {
    flags: {
      platform: 'web',
      lang: language,
      frontend,
      fullStack: true,
      runtime,
      backend,
      ...(orm ? { orm } : {}),
      db: database,
      extras: [...extras],
    },
    ...(module ? { module } : {}),
  }
}

export function nodeStack(
  backend: 'express' | 'fastify' | 'hono',
  orm: Orm,
  database: Database,
  frontend: Frontend = 'react',
  language: Language = 'typescript',
  module?: ModuleId,
): SupportedCombination {
  return webStack(frontend, language, 'node', backend, orm, database, module)
}

export function creationAuthStack(database: Database): SupportedCombination {
  const stack = nodeStack('express', 'drizzle', database)
  return { ...stack, flags: { ...stack.flags, auth: 'better-auth' } }
}

export function pythonStack(database: Database): SupportedCombination {
  return webStack('react', 'typescript', 'python', 'fastapi', undefined, database)
}

export function phpStack(database: Database): SupportedCombination {
  return webStack('react', 'typescript', 'php', 'laravel', undefined, database)
}

export function sanctumSpaAuthStack(
  database: Extract<Database, 'sqlite' | 'postgres' | 'mysql'>,
): SupportedCombination {
  const stack = phpStack(database)
  return { ...stack, flags: { ...stack.flags, auth: 'laravel-native' } }
}

export function livewireAuthStack(
  authentication: Extract<AuthenticationSetup, 'none' | 'laravel-native'>,
): SupportedCombination {
  return {
    flags: {
      platform: 'web',
      frontend: 'livewire',
      fullStack: true,
      runtime: 'php',
      backend: 'laravel',
      db: 'sqlite',
      auth: authentication,
      extras: [],
    },
  }
}

export function inertiaReactAuthStack(
  authentication: Extract<AuthenticationSetup, 'none' | 'laravel-native'>,
): SupportedCombination {
  return {
    flags: {
      platform: 'web',
      lang: 'typescript',
      frontend: 'inertia-react',
      fullStack: true,
      runtime: 'php',
      backend: 'laravel',
      db: 'sqlite',
      auth: authentication,
      extras: [],
    },
  }
}

export function nextjsStack(database: Database): SupportedCombination {
  return {
    flags: {
      platform: 'web',
      lang: 'typescript',
      frontend: 'nextjs',
      fullStack: true,
      db: database,
      extras: ['tailwind', 'eslint'],
    },
  }
}

export function frontendOnlyStack(
  language: Language,
  extras: SupportedExtras = [],
  module?: ModuleId,
): SupportedCombination {
  return {
    flags: {
      platform: 'web',
      lang: language,
      frontend: 'react',
      fullStack: false,
      extras: [...extras],
    },
    ...(module ? { module } : {}),
  }
}

export function supabaseAuthStack(): SupportedCombination {
  const stack = frontendOnlyStack('typescript')
  return { ...stack, flags: { ...stack.flags, auth: 'supabase-auth' } }
}

type SupportedExtras = SupportedCombination['flags']['extras']

function availableExtraSets(): SupportedExtras[] {
  const extras = AVAILABLE.extras
  const sets: SupportedExtras[] = []
  for (let mask = 0; mask < 1 << extras.length; mask += 1) {
    const selected = extras.filter((_, index) => (mask & (1 << index)) !== 0)
    if (selected.includes('shadcn') && !selected.includes('tailwind')) continue
    sets.push(selected)
  }
  return sets
}

function testingExtraGroup(extras: readonly string[]): string {
  if (extras.includes('shadcn')) return extras.includes('eslint') ? 'shadcn-eslint' : 'shadcn'
  if (extras.length === 0) return 'none'
  return [...extras].sort().join('-')
}

export function reactViteTestingGroupId(flags: SupportedCombination['flags']): string {
  const family = flags.fullStack ? (flags.runtime ?? 'node') : 'frontend-only'
  return `react-vite-testing-${family}-${testingExtraGroup(flags.extras)}`
}

function exactTestingCombinationAlreadySupported(flags: SupportedCombination['flags']): boolean {
  if (flags.extras.length !== 0) return false
  if (!flags.fullStack) return true
  if (flags.runtime === 'node') {
    return (
      flags.backend === 'express' &&
      flags.orm === 'drizzle' &&
      flags.db === 'sqlite' &&
      (flags.lang === 'typescript' || flags.lang === 'javascript')
    )
  }
  return (
    flags.lang === 'typescript' &&
    flags.db === 'sqlite' &&
    ((flags.runtime === 'python' && flags.backend === 'fastapi') ||
      (flags.runtime === 'php' && flags.backend === 'laravel'))
  )
}

function allReactViteTestingCombinations(): SupportedCombination[] {
  const combinations: SupportedCombination[] = []
  const extrasSets = availableExtraSets()

  for (const language of AVAILABLE.lang) {
    for (const extras of extrasSets) {
      combinations.push(frontendOnlyStack(language, extras, 'testing'))

      for (const backend of AVAILABLE.backend.node) {
        for (const orm of CAPABILITY_REGISTRY.ormsByNodeBackend[backend]) {
          for (const database of AVAILABLE.db.node) {
            if (orm === 'prisma' && database !== 'postgres') continue
            const combination = webStack(
              'react',
              language,
              'node',
              backend,
              orm,
              database,
              'testing',
            )
            combination.flags.extras = [...extras]
            combinations.push(combination)
          }
        }
      }

      // shadcn/ui templates are wired only into the Node install branch, so
      // Python and Laravel API pairings with the shadcn extra stay outside the
      // registered testing-module family until their own rejection is recorded.
      if (extras.includes('shadcn')) continue

      for (const database of AVAILABLE.db.python) {
        const combination = webStack(
          'react',
          language,
          'python',
          'fastapi',
          undefined,
          database,
          'testing',
        )
        combination.flags.extras = [...extras]
        combinations.push(combination)
      }

      for (const database of AVAILABLE.db.php) {
        const combination = webStack(
          'react',
          language,
          'php',
          'laravel',
          undefined,
          database,
          'testing',
        )
        combination.flags.extras = [...extras]
        combinations.push(combination)
      }
    }
  }

  return combinations
}

export const REACT_VITE_TESTING_FOLLOWUP_COMBINATIONS = allReactViteTestingCombinations().filter(
  (combination) => !exactTestingCombinationAlreadySupported(combination.flags),
)
export const REACT_VITE_TESTING_REJECTED_COMBINATIONS =
  REACT_VITE_TESTING_FOLLOWUP_COMBINATIONS.filter(
    ({ flags }) => flags.lang === 'javascript' && flags.extras.includes('shadcn'),
  )
export const REACT_VITE_TESTING_NONREJECTED_COMBINATIONS =
  REACT_VITE_TESTING_FOLLOWUP_COMBINATIONS.filter(
    (combination) => !REACT_VITE_TESTING_REJECTED_COMBINATIONS.includes(combination),
  )
export const REACT_VITE_TESTING_FOLLOWUP_SCENARIOS = [
  ...new Set(
    REACT_VITE_TESTING_FOLLOWUP_COMBINATIONS.map(({ flags }) => reactViteTestingGroupId(flags)),
  ),
]
