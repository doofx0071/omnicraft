import { AVAILABLE, CAPABILITY_REGISTRY, type ModuleId } from './capabilities.js'
import {
  BACKEND_FRAMEWORK_LABELS,
  DATABASE_LABELS,
  FRONTEND_LABELS,
  ORM_LABELS,
  type AuthenticationSetup,
  type BackendFramework,
  type BackendRuntime,
  type Database,
  type Frontend,
  type Language,
  type Orm,
} from './types.js'

export interface NodeRuntimeScenario {
  id: string
  framework: 'express' | 'fastify' | 'hono'
  orm: 'drizzle' | 'prisma' | 'none'
  database: Extract<Database, 'sqlite' | 'postgres' | 'mysql'>
  frontend?: 'react' | 'vue' | 'svelte'
  language?: 'typescript' | 'javascript'
}

export const NODE_RUNTIME_SCENARIOS = [
  { id: 'express-prisma-postgres', framework: 'express', orm: 'prisma', database: 'postgres' },
  { id: 'express-raw-sqlite', framework: 'express', orm: 'none', database: 'sqlite' },
  { id: 'express-raw-postgres', framework: 'express', orm: 'none', database: 'postgres' },
  { id: 'express-raw-mysql', framework: 'express', orm: 'none', database: 'mysql' },
  {
    id: 'express-drizzle-sqlite-vue',
    framework: 'express',
    orm: 'drizzle',
    database: 'sqlite',
    frontend: 'vue',
  },
  {
    id: 'express-drizzle-sqlite-svelte',
    framework: 'express',
    orm: 'drizzle',
    database: 'sqlite',
    frontend: 'svelte',
  },
  {
    id: 'express-drizzle-sqlite-react-js',
    framework: 'express',
    orm: 'drizzle',
    database: 'sqlite',
    language: 'javascript',
  },
  { id: 'fastify-drizzle-postgres', framework: 'fastify', orm: 'drizzle', database: 'postgres' },
  { id: 'fastify-drizzle-sqlite', framework: 'fastify', orm: 'drizzle', database: 'sqlite' },
  { id: 'fastify-drizzle-mysql', framework: 'fastify', orm: 'drizzle', database: 'mysql' },
  { id: 'fastify-prisma-postgres', framework: 'fastify', orm: 'prisma', database: 'postgres' },
  { id: 'fastify-raw-postgres', framework: 'fastify', orm: 'none', database: 'postgres' },
  { id: 'fastify-raw-sqlite', framework: 'fastify', orm: 'none', database: 'sqlite' },
  { id: 'fastify-raw-mysql', framework: 'fastify', orm: 'none', database: 'mysql' },
  { id: 'hono-drizzle-postgres', framework: 'hono', orm: 'drizzle', database: 'postgres' },
  { id: 'hono-drizzle-sqlite', framework: 'hono', orm: 'drizzle', database: 'sqlite' },
  { id: 'hono-drizzle-mysql', framework: 'hono', orm: 'drizzle', database: 'mysql' },
  { id: 'hono-raw-postgres', framework: 'hono', orm: 'none', database: 'postgres' },
  { id: 'hono-raw-sqlite', framework: 'hono', orm: 'none', database: 'sqlite' },
  { id: 'hono-raw-mysql', framework: 'hono', orm: 'none', database: 'mysql' },
] as const satisfies readonly NodeRuntimeScenario[]

export const NEXTJS_DATABASE_SCENARIOS = [
  'sqlite',
  'postgres',
  'mysql',
] as const satisfies readonly Extract<Database, 'sqlite' | 'postgres' | 'mysql'>[]
export const FRONTEND_RUNTIME_SCENARIOS = ['react-js-frontend-only'] as const
export const DOCKER_MODULE_SCENARIOS = ['postgres', 'mysql'] as const satisfies readonly Extract<
  Database,
  'postgres' | 'mysql'
>[]
export const MODULE_RUNTIME_SCENARIOS = [
  'add-testing-react-vite-ts',
  'add-testing-react-vite-js-frontend-only',
  'add-testing-react-vite-ts-separate-api',
  'add-testing-react-vite-js-separate-api',
  'add-testing-vue-express-drizzle-sqlite',
  'add-testing-svelte-express-drizzle-sqlite',
  'add-testing-fastapi-sqlite',
  'add-testing-laravel-sqlite',
  'add-testing-nextjs-sqlite',
  'shadcn-react-vite-ts-frontend-only',
] as const
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
export const NATIVE_PLATFORM_SCENARIOS = [
  'expo-ios-simulator',
  'expo-android-emulator',
  'tauri-linux-desktop',
  'tauri-macos-desktop',
  'tauri-windows-desktop',
] as const
export const LARAVEL_LIVEWIRE_AUTH_SCENARIOS = [
  'none',
  'laravel-native',
] as const satisfies readonly AuthenticationSetup[]
export const LARAVEL_INERTIA_REACT_AUTH_SCENARIOS = [
  'none',
  'laravel-native',
] as const satisfies readonly AuthenticationSetup[]
export const LARAVEL_SANCTUM_SPA_AUTH_SCENARIOS = [
  'none-sqlite',
  'laravel-native-sqlite',
  'laravel-native-postgres',
  'laravel-native-mysql',
] as const

export const INTEGRATION_TARGETS = {
  'node-runtime': {
    script: 'scripts/node-stack-integration.ts',
    workflowJob: 'node-runtime-integration',
    workflowCommand: 'npm run test:integration:node --workspace=create-omnicraft -- --scenario',
    scenarios: NODE_RUNTIME_SCENARIOS.map((scenario) => scenario.id),
  },
  'nextjs-runtime': {
    script: 'scripts/nextjs-runtime-integration.ts',
    workflowJob: 'nextjs-runtime-integration',
    workflowCommand: 'npm run test:integration:nextjs --workspace=create-omnicraft -- --database',
    scenarios: NEXTJS_DATABASE_SCENARIOS,
  },
  'frontend-runtime': {
    script: 'scripts/frontend-runtime-integration.ts',
    workflowJob: 'frontend-runtime-integration',
    workflowCommand: 'npm run test:integration:frontend --workspace=create-omnicraft',
    scenarios: FRONTEND_RUNTIME_SCENARIOS,
  },
  'docker-module': {
    script: 'scripts/docker-module-integration.ts',
    workflowJob: 'docker-module-integration',
    workflowCommand:
      'npm run test:integration:docker-module --workspace=create-omnicraft -- --database',
    scenarios: DOCKER_MODULE_SCENARIOS,
  },
  'module-runtime': {
    script: 'scripts/module-runtime-integration.ts',
    workflowJob: 'module-runtime-integration',
    workflowCommand: 'npm run test:integration:modules --workspace=create-omnicraft -- --scenario',
    scenarios: MODULE_RUNTIME_SCENARIOS,
  },
  'module-runtime-react-vite': {
    script: 'scripts/module-runtime-integration.ts',
    workflowJob: 'react-vite-add-testing-integration',
    workflowCommand:
      'npm run test:integration:modules --workspace=create-omnicraft -- --scenario-group',
    scenarios: REACT_VITE_TESTING_FOLLOWUP_SCENARIOS,
  },
  'native-platform': {
    script: 'scripts/native-platform-integration.ts',
    workflowJob: 'native-platform-integration',
    workflowCommand: 'npm run test:integration:native --workspace=create-omnicraft -- --scenario',
    scenarios: NATIVE_PLATFORM_SCENARIOS,
  },
  'node-express-drizzle': {
    script: 'scripts/db-integration.ts',
    workflowJob: 'database-integration',
    workflowCommand: 'npm run test:integration:db --workspace=create-omnicraft',
    scenarios: ['sqlite', 'postgres', 'mysql'],
  },
  'python-fastapi': {
    script: 'scripts/fastapi-integration.ts',
    workflowJob: 'python-fastapi-integration',
    workflowCommand: 'npm run test:integration:python --workspace=create-omnicraft',
    scenarios: ['sqlite', 'postgres'],
  },
  'php-laravel': {
    script: 'scripts/php-laravel-e2e.ts',
    workflowJob: 'php-laravel-integration',
    workflowCommand: 'npm run test:integration:php --workspace=create-omnicraft',
    scenarios: ['sqlite', 'postgres', 'mysql'],
  },
  'php-laravel-livewire-auth': {
    script: 'scripts/php-livewire-auth-e2e.ts',
    workflowJob: 'php-laravel-livewire-auth-integration',
    workflowCommand: 'npm run test:integration:php-livewire --workspace=create-omnicraft',
    scenarios: LARAVEL_LIVEWIRE_AUTH_SCENARIOS,
  },
  'php-laravel-inertia-react-auth': {
    script: 'scripts/php-inertia-react-auth-e2e.ts',
    workflowJob: 'php-laravel-inertia-react-auth-integration',
    workflowCommand: 'npm run test:integration:php-inertia --workspace=create-omnicraft',
    scenarios: LARAVEL_INERTIA_REACT_AUTH_SCENARIOS,
  },
  'php-laravel-sanctum-spa-auth': {
    script: 'scripts/php-laravel-sanctum-auth-e2e.ts',
    workflowJob: 'php-laravel-sanctum-spa-auth-integration',
    workflowCommand: 'npm run test:integration:php-sanctum-auth --workspace=create-omnicraft',
    scenarios: LARAVEL_SANCTUM_SPA_AUTH_SCENARIOS,
  },
  'supabase-auth': {
    script: 'scripts/supabase-auth-integration.ts',
    workflowJob: 'supabase-auth-integration',
    workflowCommand: 'npm run test:integration:supabase-auth --workspace=create-omnicraft',
    scenarios: ['react-ts-supabase-auth-frontend-only'],
  },
} as const satisfies Record<
  string,
  {
    script: string
    workflowJob: string
    workflowCommand: string
    scenarios: readonly string[]
  }
>

export type IntegrationTargetId = keyof typeof INTEGRATION_TARGETS

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

export type SupportMatrixFormat =
  | 'frontend-app'
  | 'frontend-client-api'
  | 'frontend-only'
  | 'nextjs-integrated'
  | 'node-backend'
  | 'python-backend'
  | 'php-backend'
  | 'supabase-auth'
  | 'laravel-livewire-auth'
  | 'laravel-inertia-react-auth'
  | 'laravel-sanctum-spa-auth'
  | 'auth-module'
  | 'creation-auth'
  | 'docker-module'
  | 'testing-module'
  | 'testing-module-react-vite-family'
  | 'shadcn-extra'

export interface SupportedCapability {
  id: string
  matrixFormat: SupportMatrixFormat
  target: IntegrationTargetId
  scenarios: readonly string[]
  combinations: readonly SupportedCombination[]
}

export type RejectionGuard = 'flag-preflight' | 'module-preflight'

/** Flag-level shape a rejection registers; platform widens to native targets. */
export interface RejectedCombinationFlags {
  platform?: 'web' | 'mobile' | 'desktop'
  lang?: Language
  frontend?: Frontend
  fullStack?: boolean
  runtime?: BackendRuntime
  backend?: BackendFramework
  orm?: Orm
  db?: Database
  auth?: AuthenticationSetup
  extras: readonly (typeof AVAILABLE.extras)[number][]
}

export interface RejectedCombination {
  flags: RejectedCombinationFlags
  module?: ModuleId
  /** Exact message the live production guard must produce for this combination. */
  guardMessage: string
  /** Hosted scenario that exercises this rejection, when the entry declares a target. */
  scenario?: string
}

export interface RejectedModuleCapability {
  id: string
  /** Exact matrix row label; the checker requires the row to start with it. */
  rowLabel: string
  /** Hosted integration target that exercises the rejections, when one exists. */
  target?: IntegrationTargetId
  /** Which production guard rejects every registered combination. */
  guard: RejectionGuard
  combinations: readonly RejectedCombination[]
}

function webStack(
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

function rejectedCombination(
  flags: RejectedCombinationFlags,
  guardMessage: string,
  module?: ModuleId,
  scenario?: string,
): RejectedCombination {
  return {
    flags,
    ...(module ? { module } : {}),
    guardMessage,
    ...(scenario ? { scenario } : {}),
  }
}

function nodeStack(
  backend: 'express' | 'fastify' | 'hono',
  orm: Orm,
  database: Database,
  frontend: Frontend = 'react',
  language: Language = 'typescript',
  module?: ModuleId,
): SupportedCombination {
  return webStack(frontend, language, 'node', backend, orm, database, module)
}

function creationAuthStack(database: Database): SupportedCombination {
  const stack = nodeStack('express', 'drizzle', database)
  return { ...stack, flags: { ...stack.flags, auth: 'better-auth' } }
}

function pythonStack(database: Database): SupportedCombination {
  return webStack('react', 'typescript', 'python', 'fastapi', undefined, database)
}

function phpStack(database: Database): SupportedCombination {
  return webStack('react', 'typescript', 'php', 'laravel', undefined, database)
}

function sanctumSpaAuthStack(
  database: Extract<Database, 'sqlite' | 'postgres' | 'mysql'>,
): SupportedCombination {
  const stack = phpStack(database)
  return { ...stack, flags: { ...stack.flags, auth: 'laravel-native' } }
}

function livewireAuthStack(
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

function inertiaReactAuthStack(
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

function nextjsStack(database: Database): SupportedCombination {
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

function frontendOnlyStack(
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

function supabaseAuthStack(): SupportedCombination {
  const stack = frontendOnlyStack('typescript')
  return { ...stack, flags: { ...stack.flags, auth: 'supabase-auth' } }
}

function requiredDatabase(combination: SupportedCombination): Database {
  const database = combination.flags.db
  if (!database) throw new Error('A Supported matrix combination must specify its database.')
  return database as Database
}

function displayOrm(orm: string | undefined): string {
  if (!orm) throw new Error('A Supported Node combination must specify its ORM/data access.')
  return orm === 'none' ? 'Raw SQL (`none`)' : ORM_LABELS[orm as Orm]
}

function requireOneCombination(capability: SupportedCapability): SupportedCombination {
  if (capability.combinations.length !== 1) {
    throw new Error(`Matrix format "${capability.matrixFormat}" requires one exact combination.`)
  }
  return capability.combinations[0] as SupportedCombination
}

/** Renders the exact matrix label from the typed combination registered with its evidence. */
export function registeredMatrixRowPrefix(capability: SupportedCapability): string {
  const combinations = capability.combinations
  if (combinations.length === 0)
    throw new Error('A Supported matrix row must register a combination.')
  const first = combinations[0] as SupportedCombination
  const frontend = first.flags.frontend as Frontend
  const language = first.flags.lang
  const frontendLabel =
    language === 'javascript'
      ? `${FRONTEND_LABELS[frontend]} + Vite JavaScript`
      : `${FRONTEND_LABELS[frontend]} + Vite + TypeScript`
  const database = (item: SupportedCombination) => DATABASE_LABELS[requiredDatabase(item)]
  const oneDatabase = () => database(requireOneCombination(capability))
  const databaseList = (separator = ', ') => combinations.map(database).join(separator)
  const databases = combinations.flatMap((combination) =>
    combination.flags.db ? [combination.flags.db] : [],
  )
  if (
    capability.matrixFormat !== 'testing-module-react-vite-family' &&
    databases.length > 0 &&
    new Set(databases).size !== databases.length
  ) {
    throw new Error(`Supported row "${capability.id}" repeats a database combination.`)
  }

  let label: string
  switch (capability.matrixFormat) {
    case 'frontend-app': {
      const flags = requireOneCombination(capability).flags
      label = `${frontendLabel} + ${BACKEND_FRAMEWORK_LABELS[flags.backend as BackendFramework]} + ${displayOrm(flags.orm)} + ${oneDatabase()}`
      break
    }
    case 'frontend-client-api': {
      const flags = requireOneCombination(capability).flags
      label = `${frontendLabel} + ${BACKEND_FRAMEWORK_LABELS[flags.backend as BackendFramework]} + ${displayOrm(flags.orm)} + ${oneDatabase()}${language === 'javascript' ? ' separate API' : ''}`
      break
    }
    case 'frontend-only':
      label = `${frontendLabel}, frontend-only`
      break
    case 'supabase-auth': {
      const authentication = requireOneCombination(capability).flags.auth
      if (authentication !== 'supabase-auth') {
        throw new Error(`Supabase Auth row "${capability.id}" must select Supabase Auth.`)
      }
      label = 'React + Vite + TypeScript + Supabase Auth + Data API/RLS, frontend-only'
      break
    }
    case 'nextjs-integrated':
      label =
        oneDatabase() === 'MySQL'
          ? 'Next.js integrated full-stack + MySQL'
          : `Next.js integrated full-stack + raw SQL + ${oneDatabase()}`
      break
    case 'node-backend': {
      const flags = first.flags
      if (
        combinations.some(
          (combination) =>
            combination.flags.backend !== flags.backend || combination.flags.orm !== flags.orm,
        )
      ) {
        throw new Error(`Node backend row "${capability.id}" mixes frameworks or ORMs.`)
      }
      label = `${BACKEND_FRAMEWORK_LABELS[flags.backend as BackendFramework]} | ${displayOrm(flags.orm)} | ${databaseList()}`
      break
    }
    case 'python-backend':
      label = `FastAPI | SQLAlchemy 2 async + Alembic | ${oneDatabase()}`
      break
    case 'php-backend':
      label = `Laravel 12 | Eloquent | ${oneDatabase()}`
      break
    case 'laravel-livewire-auth': {
      const authentication = requireOneCombination(capability).flags.auth
      if (authentication !== 'none' && authentication !== 'laravel-native') {
        throw new Error(
          `Livewire auth row "${capability.id}" must select None or Laravel native auth.`,
        )
      }
      const mode = authentication === 'none' ? 'None' : 'Laravel native/Fortify'
      label = `Laravel 13 + Livewire 4 (${mode}) | Eloquent | ${oneDatabase()}`
      break
    }
    case 'laravel-inertia-react-auth': {
      const authentication = requireOneCombination(capability).flags.auth
      if (authentication !== 'none' && authentication !== 'laravel-native') {
        throw new Error(
          `Inertia React auth row "${capability.id}" must select None or Laravel native auth.`,
        )
      }
      const mode = authentication === 'none' ? 'None' : 'Laravel native/Fortify'
      label = `Laravel 13 + Inertia React (${mode}) | Eloquent | ${oneDatabase()}`
      break
    }
    case 'laravel-sanctum-spa-auth': {
      const combination = requireOneCombination(capability)
      const flags = combination.flags
      if (
        flags.frontend !== 'react' ||
        flags.lang !== 'typescript' ||
        !flags.fullStack ||
        flags.runtime !== 'php' ||
        flags.backend !== 'laravel' ||
        flags.orm !== undefined ||
        flags.db === undefined ||
        flags.auth !== 'laravel-native' ||
        flags.extras.length !== 0 ||
        combination.module !== undefined
      ) {
        throw new Error(
          `Sanctum SPA auth row "${capability.id}" must use React/Vite TypeScript + Laravel 12 API + a registered SQL database with Laravel native auth.`,
        )
      }
      label = `React + Vite + TypeScript + Laravel 12 API + Sanctum SPA sessions | Eloquent | ${DATABASE_LABELS[flags.db as Database]}`
      break
    }
    case 'auth-module':
      label = `\`omnicraft add auth\` — Express + Drizzle + ${databaseList('/')}`
      break
    case 'creation-auth':
      label = `Creation-time Better Auth — ${frontendLabel} + Express + Drizzle + ${databaseList('/')}`
      break
    case 'docker-module':
      label = `\`omnicraft add docker\` — Express + Drizzle + ${oneDatabase()} separate API`
      break
    case 'testing-module': {
      const flags = requireOneCombination(capability).flags
      const testingTarget = '`omnicraft add testing` — '
      if (!flags.fullStack) {
        label = `${testingTarget}React/Vite ${language === 'javascript' ? 'JavaScript' : 'TypeScript'} frontend-only`
      } else {
        const backend = flags.backend as BackendFramework
        const dataAccess =
          flags.runtime === 'node'
            ? displayOrm(flags.orm)
            : flags.runtime === 'python'
              ? 'SQLAlchemy 2 async + Alembic'
              : 'Eloquent'
        label = `${testingTarget}${frontendLabel} + ${BACKEND_FRAMEWORK_LABELS[backend]} + ${dataAccess} + ${oneDatabase()} separate API`
      }
      break
    }
    case 'testing-module-react-vite-family':
      label = `\`omnicraft add testing\` — ${combinations.length} other exact React/Vite paths`
      break
    case 'shadcn-extra':
      label = 'shadcn/ui — React/Vite TypeScript frontend-only'
      break
  }
  return `| ${label} | **Supported** |`
}

export function registeredRejectedMatrixRowPrefix(capability: RejectedModuleCapability): string {
  return `| ${capability.rowLabel} | **Rejected — unsupported combination** |`
}

/**
 * Each Supported row records the exact flag-level stack/module combination,
 * the generated-project scenario, and how to render its matrix label. The
 * consistency checker resolves these flags through the current CLI rules.
 */
export const SUPPORTED_CAPABILITIES = [
  {
    id: 'frontend-react-express-drizzle-postgres',
    matrixFormat: 'frontend-app',
    target: 'node-express-drizzle',
    scenarios: ['postgres'],
    combinations: [nodeStack('express', 'drizzle', 'postgres')],
  },
  {
    id: 'express-drizzle-postgres',
    matrixFormat: 'node-backend',
    target: 'node-express-drizzle',
    scenarios: ['postgres'],
    combinations: [nodeStack('express', 'drizzle', 'postgres')],
  },
  {
    id: 'express-drizzle-sqlite',
    matrixFormat: 'node-backend',
    target: 'node-express-drizzle',
    scenarios: ['sqlite'],
    combinations: [nodeStack('express', 'drizzle', 'sqlite')],
  },
  {
    id: 'express-drizzle-mysql',
    matrixFormat: 'node-backend',
    target: 'node-express-drizzle',
    scenarios: ['mysql'],
    combinations: [nodeStack('express', 'drizzle', 'mysql')],
  },
  {
    id: 'express-prisma-postgres',
    matrixFormat: 'node-backend',
    target: 'node-runtime',
    scenarios: ['express-prisma-postgres'],
    combinations: [nodeStack('express', 'prisma', 'postgres')],
  },
  {
    id: 'express-raw-sqlite',
    matrixFormat: 'node-backend',
    target: 'node-runtime',
    scenarios: ['express-raw-sqlite'],
    combinations: [nodeStack('express', 'none', 'sqlite')],
  },
  {
    id: 'express-raw-postgres',
    matrixFormat: 'node-backend',
    target: 'node-runtime',
    scenarios: ['express-raw-postgres'],
    combinations: [nodeStack('express', 'none', 'postgres')],
  },
  {
    id: 'express-raw-mysql',
    matrixFormat: 'node-backend',
    target: 'node-runtime',
    scenarios: ['express-raw-mysql'],
    combinations: [nodeStack('express', 'none', 'mysql')],
  },
  {
    id: 'fastapi-sqlalchemy-postgres',
    matrixFormat: 'python-backend',
    target: 'python-fastapi',
    scenarios: ['postgres'],
    combinations: [pythonStack('postgres')],
  },
  {
    id: 'fastify-drizzle-postgres',
    matrixFormat: 'node-backend',
    target: 'node-runtime',
    scenarios: ['fastify-drizzle-postgres'],
    combinations: [nodeStack('fastify', 'drizzle', 'postgres')],
  },
  {
    id: 'fastify-drizzle-sqlite',
    matrixFormat: 'node-backend',
    target: 'node-runtime',
    scenarios: ['fastify-drizzle-sqlite'],
    combinations: [nodeStack('fastify', 'drizzle', 'sqlite')],
  },
  {
    id: 'fastify-drizzle-mysql',
    matrixFormat: 'node-backend',
    target: 'node-runtime',
    scenarios: ['fastify-drizzle-mysql'],
    combinations: [nodeStack('fastify', 'drizzle', 'mysql')],
  },
  {
    id: 'fastify-prisma-postgres',
    matrixFormat: 'node-backend',
    target: 'node-runtime',
    scenarios: ['fastify-prisma-postgres'],
    combinations: [nodeStack('fastify', 'prisma', 'postgres')],
  },
  {
    id: 'fastify-raw-sql',
    matrixFormat: 'node-backend',
    target: 'node-runtime',
    scenarios: ['fastify-raw-postgres', 'fastify-raw-sqlite', 'fastify-raw-mysql'],
    combinations: [
      nodeStack('fastify', 'none', 'postgres'),
      nodeStack('fastify', 'none', 'sqlite'),
      nodeStack('fastify', 'none', 'mysql'),
    ],
  },
  {
    id: 'hono-drizzle-postgres-sqlite',
    matrixFormat: 'node-backend',
    target: 'node-runtime',
    scenarios: ['hono-drizzle-postgres', 'hono-drizzle-sqlite'],
    combinations: [
      nodeStack('hono', 'drizzle', 'postgres'),
      nodeStack('hono', 'drizzle', 'sqlite'),
    ],
  },
  {
    id: 'hono-drizzle-mysql',
    matrixFormat: 'node-backend',
    target: 'node-runtime',
    scenarios: ['hono-drizzle-mysql'],
    combinations: [nodeStack('hono', 'drizzle', 'mysql')],
  },
  {
    id: 'hono-raw-sql',
    matrixFormat: 'node-backend',
    target: 'node-runtime',
    scenarios: ['hono-raw-postgres', 'hono-raw-sqlite', 'hono-raw-mysql'],
    combinations: [
      nodeStack('hono', 'none', 'postgres'),
      nodeStack('hono', 'none', 'sqlite'),
      nodeStack('hono', 'none', 'mysql'),
    ],
  },
  {
    id: 'laravel-eloquent-postgres',
    matrixFormat: 'php-backend',
    target: 'php-laravel',
    scenarios: ['postgres'],
    combinations: [phpStack('postgres')],
  },
  {
    id: 'laravel-eloquent-mysql',
    matrixFormat: 'php-backend',
    target: 'php-laravel',
    scenarios: ['mysql'],
    combinations: [phpStack('mysql')],
  },
  {
    id: 'fastapi-sqlalchemy-sqlite',
    matrixFormat: 'python-backend',
    target: 'python-fastapi',
    scenarios: ['sqlite'],
    combinations: [pythonStack('sqlite')],
  },
  {
    id: 'laravel-eloquent-sqlite',
    matrixFormat: 'php-backend',
    target: 'php-laravel',
    scenarios: ['sqlite'],
    combinations: [phpStack('sqlite')],
  },
  {
    id: 'laravel-livewire-none-sqlite',
    matrixFormat: 'laravel-livewire-auth',
    target: 'php-laravel-livewire-auth',
    scenarios: ['none'],
    combinations: [livewireAuthStack('none')],
  },
  {
    id: 'laravel-livewire-native-auth-sqlite',
    matrixFormat: 'laravel-livewire-auth',
    target: 'php-laravel-livewire-auth',
    scenarios: ['laravel-native'],
    combinations: [livewireAuthStack('laravel-native')],
  },
  {
    id: 'laravel-inertia-react-none-sqlite',
    matrixFormat: 'laravel-inertia-react-auth',
    target: 'php-laravel-inertia-react-auth',
    scenarios: ['none'],
    combinations: [inertiaReactAuthStack('none')],
  },
  {
    id: 'laravel-inertia-react-native-auth-sqlite',
    matrixFormat: 'laravel-inertia-react-auth',
    target: 'php-laravel-inertia-react-auth',
    scenarios: ['laravel-native'],
    combinations: [inertiaReactAuthStack('laravel-native')],
  },
  {
    id: 'laravel-api-sanctum-spa-auth-sqlite',
    matrixFormat: 'laravel-sanctum-spa-auth',
    target: 'php-laravel-sanctum-spa-auth',
    scenarios: ['laravel-native-sqlite'],
    combinations: [sanctumSpaAuthStack('sqlite')],
  },
  {
    id: 'laravel-api-sanctum-spa-auth-postgres',
    matrixFormat: 'laravel-sanctum-spa-auth',
    target: 'php-laravel-sanctum-spa-auth',
    scenarios: ['laravel-native-postgres'],
    combinations: [sanctumSpaAuthStack('postgres')],
  },
  {
    id: 'laravel-api-sanctum-spa-auth-mysql',
    matrixFormat: 'laravel-sanctum-spa-auth',
    target: 'php-laravel-sanctum-spa-auth',
    scenarios: ['laravel-native-mysql'],
    combinations: [sanctumSpaAuthStack('mysql')],
  },
  {
    id: 'auth-express-drizzle-sqlite',
    matrixFormat: 'auth-module',
    target: 'node-express-drizzle',
    scenarios: ['sqlite'],
    combinations: [nodeStack('express', 'drizzle', 'sqlite', 'react', 'typescript', 'auth')],
  },
  {
    id: 'auth-express-drizzle-postgres-mysql',
    matrixFormat: 'auth-module',
    target: 'node-express-drizzle',
    scenarios: ['postgres', 'mysql'],
    combinations: [
      nodeStack('express', 'drizzle', 'postgres', 'react', 'typescript', 'auth'),
      nodeStack('express', 'drizzle', 'mysql', 'react', 'typescript', 'auth'),
    ],
  },
  {
    id: 'creation-auth-better-auth-express-drizzle',
    matrixFormat: 'creation-auth',
    target: 'node-express-drizzle',
    scenarios: ['sqlite', 'postgres', 'mysql'],
    combinations: [
      creationAuthStack('sqlite'),
      creationAuthStack('postgres'),
      creationAuthStack('mysql'),
    ],
  },
  {
    id: 'frontend-vue-express-drizzle-sqlite',
    matrixFormat: 'frontend-client-api',
    target: 'node-runtime',
    scenarios: ['express-drizzle-sqlite-vue'],
    combinations: [nodeStack('express', 'drizzle', 'sqlite', 'vue')],
  },
  {
    id: 'frontend-svelte-express-drizzle-sqlite',
    matrixFormat: 'frontend-client-api',
    target: 'node-runtime',
    scenarios: ['express-drizzle-sqlite-svelte'],
    combinations: [nodeStack('express', 'drizzle', 'sqlite', 'svelte')],
  },
  {
    id: 'frontend-react-js-express-drizzle-sqlite',
    matrixFormat: 'frontend-client-api',
    target: 'node-runtime',
    scenarios: ['express-drizzle-sqlite-react-js'],
    combinations: [nodeStack('express', 'drizzle', 'sqlite', 'react', 'javascript')],
  },
  {
    id: 'frontend-react-js-frontend-only',
    matrixFormat: 'frontend-only',
    target: 'frontend-runtime',
    scenarios: ['react-js-frontend-only'],
    combinations: [frontendOnlyStack('javascript')],
  },
  {
    id: 'supabase-auth-react-vite-typescript',
    matrixFormat: 'supabase-auth',
    target: 'supabase-auth',
    scenarios: ['react-ts-supabase-auth-frontend-only'],
    combinations: [supabaseAuthStack()],
  },
  {
    id: 'nextjs-raw-sqlite',
    matrixFormat: 'nextjs-integrated',
    target: 'nextjs-runtime',
    scenarios: ['sqlite'],
    combinations: [nextjsStack('sqlite')],
  },
  {
    id: 'nextjs-raw-postgres',
    matrixFormat: 'nextjs-integrated',
    target: 'nextjs-runtime',
    scenarios: ['postgres'],
    combinations: [nextjsStack('postgres')],
  },
  {
    id: 'nextjs-raw-mysql',
    matrixFormat: 'nextjs-integrated',
    target: 'nextjs-runtime',
    scenarios: ['mysql'],
    combinations: [nextjsStack('mysql')],
  },
  {
    id: 'docker-module-postgres',
    matrixFormat: 'docker-module',
    target: 'docker-module',
    scenarios: ['postgres'],
    combinations: [nodeStack('express', 'drizzle', 'postgres', 'react', 'typescript', 'docker')],
  },
  {
    id: 'docker-module-mysql',
    matrixFormat: 'docker-module',
    target: 'docker-module',
    scenarios: ['mysql'],
    combinations: [nodeStack('express', 'drizzle', 'mysql', 'react', 'typescript', 'docker')],
  },
  {
    id: 'testing-module-react-vite-ts-frontend-only',
    matrixFormat: 'testing-module',
    target: 'module-runtime',
    scenarios: ['add-testing-react-vite-ts'],
    combinations: [frontendOnlyStack('typescript', [], 'testing')],
  },
  {
    id: 'testing-module-react-vite-js-frontend-only',
    matrixFormat: 'testing-module',
    target: 'module-runtime',
    scenarios: ['add-testing-react-vite-js-frontend-only'],
    combinations: [frontendOnlyStack('javascript', [], 'testing')],
  },
  {
    id: 'testing-module-react-vite-ts-express-drizzle-sqlite',
    matrixFormat: 'testing-module',
    target: 'module-runtime',
    scenarios: ['add-testing-react-vite-ts-separate-api'],
    combinations: [nodeStack('express', 'drizzle', 'sqlite', 'react', 'typescript', 'testing')],
  },
  {
    id: 'testing-module-react-vite-js-express-drizzle-sqlite',
    matrixFormat: 'testing-module',
    target: 'module-runtime',
    scenarios: ['add-testing-react-vite-js-separate-api'],
    combinations: [nodeStack('express', 'drizzle', 'sqlite', 'react', 'javascript', 'testing')],
  },
  {
    id: 'testing-module-react-vite-ts-fastapi-sqlite',
    matrixFormat: 'testing-module',
    target: 'module-runtime',
    scenarios: ['add-testing-fastapi-sqlite'],
    combinations: [
      webStack('react', 'typescript', 'python', 'fastapi', undefined, 'sqlite', 'testing'),
    ],
  },
  {
    id: 'testing-module-react-vite-ts-laravel-sqlite',
    matrixFormat: 'testing-module',
    target: 'module-runtime',
    scenarios: ['add-testing-laravel-sqlite'],
    combinations: [
      webStack('react', 'typescript', 'php', 'laravel', undefined, 'sqlite', 'testing'),
    ],
  },
  {
    id: 'testing-module-react-vite-other-exact-paths',
    matrixFormat: 'testing-module-react-vite-family',
    target: 'module-runtime-react-vite',
    scenarios: REACT_VITE_TESTING_NONREJECTED_COMBINATIONS.map(({ flags }) =>
      reactViteTestingGroupId(flags),
    ),
    combinations: REACT_VITE_TESTING_NONREJECTED_COMBINATIONS,
  },
  {
    id: 'shadcn-react-vite-ts-frontend-only',
    matrixFormat: 'shadcn-extra',
    target: 'module-runtime',
    scenarios: ['shadcn-react-vite-ts-frontend-only'],
    combinations: [frontendOnlyStack('typescript', ['tailwind', 'eslint', 'shadcn'])],
  },
] as const satisfies readonly SupportedCapability[]

/** Live guard messages the rejection registry validates every checker run. */
export const TESTING_MODULE_JS_SHADCN_GUARD_MESSAGE =
  'the current shadcn templates require the TypeScript React/Vite app template'
export const TESTING_MODULE_FRONTEND_GUARD_MESSAGE = 'the sample test requires a React/Vite frontend'
export const JAVASCRIPT_FRONTEND_GUARD_MESSAGE =
  'JavaScript is only available for the React/Vite web frontend; choose --lang typescript for this frontend.'
export const NATIVE_LANGUAGE_GUARD_MESSAGE =
  'Native Expo and Tauri scaffolds use TypeScript; omit --lang javascript.'
export const NATIVE_WEB_FLAGS_GUARD_MESSAGE =
  'Mobile and desktop scaffolds use their official TypeScript generators; omit web stack flags.'
export const NEXTJS_SEPARATE_BACKEND_GUARD_MESSAGE =
  'Next.js is integrated full-stack and uses raw SQL; --runtime, --backend, --orm, and --no-full-stack do not apply.'
export const NEXTJS_EXTRAS_GUARD_MESSAGE =
  'Next.js always includes Tailwind and ESLint from create-next-app; use --extras tailwind,eslint or omit --extras.'
export const SHADCN_FRONTEND_GUARD_MESSAGE =
  'shadcn/ui is only available for React/Vite web projects; choose --frontend react or omit shadcn.'
export const LARAVEL_LIVEWIRE_DATABASE_GUARD_MESSAGE =
  'Laravel Livewire currently requires PHP + Laravel + SQLite and does not use a separate frontend, language, ORM, or extras; omit those flags.'
export const LARAVEL_INERTIA_REACT_DATABASE_GUARD_MESSAGE =
  'Laravel Inertia React currently requires PHP + Laravel + SQLite + TypeScript and does not accept a separate API, ORM, or extras; omit incompatible flags.'

function prismaDatabaseGuardMessage(database: Extract<Database, 'sqlite' | 'mysql'>): string {
  return `Invalid combination: --orm prisma currently supports --db postgres only (got ${database})`
}

function nodePrismaStack(
  backend: 'express' | 'fastify',
  database: Extract<Database, 'sqlite' | 'mysql'>,
): RejectedCombination {
  return rejectedCombination(
    {
      platform: 'web',
      lang: 'typescript',
      frontend: 'react',
      fullStack: true,
      runtime: 'node',
      backend,
      orm: 'prisma',
      db: database,
      extras: [],
    },
    prismaDatabaseGuardMessage(database),
  )
}

export const REJECTED_MODULE_CAPABILITIES = [
  {
    id: 'testing-module-react-vite-js-shadcn',
    rowLabel: `\`omnicraft add testing\` — React/Vite JavaScript + shadcn (${REACT_VITE_TESTING_REJECTED_COMBINATIONS.length} exact module paths)`,
    target: 'module-runtime-react-vite',
    guard: 'module-preflight',
    combinations: REACT_VITE_TESTING_REJECTED_COMBINATIONS.map((combination) => ({
      ...combination,
      guardMessage: TESTING_MODULE_JS_SHADCN_GUARD_MESSAGE,
      scenario: reactViteTestingGroupId(combination.flags),
    })),
  },
  {
    id: 'javascript-vue-svelte-nextjs',
    target: undefined,
    rowLabel: 'JavaScript Vue, Svelte, or Next.js templates',
    guard: 'flag-preflight',
    combinations: [
      rejectedCombination(
        {
          platform: 'web',
          lang: 'javascript',
          frontend: 'vue',
          fullStack: true,
          runtime: 'node',
          backend: 'express',
          orm: 'drizzle',
          db: 'postgres',
          extras: [],
        },
        JAVASCRIPT_FRONTEND_GUARD_MESSAGE,
      ),
      rejectedCombination(
        {
          platform: 'web',
          lang: 'javascript',
          frontend: 'svelte',
          fullStack: true,
          runtime: 'node',
          backend: 'express',
          orm: 'drizzle',
          db: 'postgres',
          extras: [],
        },
        JAVASCRIPT_FRONTEND_GUARD_MESSAGE,
      ),
      rejectedCombination(
        {
          platform: 'web',
          lang: 'javascript',
          frontend: 'nextjs',
          extras: ['tailwind', 'eslint'],
        },
        JAVASCRIPT_FRONTEND_GUARD_MESSAGE,
      ),
    ],
  },
  {
    id: 'javascript-expo-tauri',
    target: undefined,
    rowLabel: 'JavaScript Expo or Tauri',
    guard: 'flag-preflight',
    combinations: [
      rejectedCombination(
        {
          platform: 'mobile',
          lang: 'javascript',
          frontend: 'react',
          fullStack: false,
          extras: [],
        },
        NATIVE_LANGUAGE_GUARD_MESSAGE,
      ),
      rejectedCombination(
        {
          platform: 'desktop',
          lang: 'javascript',
          frontend: 'react',
          fullStack: false,
          extras: [],
        },
        NATIVE_LANGUAGE_GUARD_MESSAGE,
      ),
    ],
  },
  {
    id: 'nextjs-separate-backend-flags',
    target: undefined,
    rowLabel: 'Next.js with `--orm`, `--runtime`, `--backend`, `--no-full-stack`, or contradictory `--extras`',
    guard: 'flag-preflight',
    combinations: [
      rejectedCombination(
        { platform: 'web', frontend: 'nextjs', runtime: 'node', extras: ['tailwind', 'eslint'] },
        NEXTJS_SEPARATE_BACKEND_GUARD_MESSAGE,
      ),
      rejectedCombination(
        { platform: 'web', frontend: 'nextjs', backend: 'express', extras: ['tailwind', 'eslint'] },
        NEXTJS_SEPARATE_BACKEND_GUARD_MESSAGE,
      ),
      rejectedCombination(
        { platform: 'web', frontend: 'nextjs', orm: 'drizzle', extras: ['tailwind', 'eslint'] },
        NEXTJS_SEPARATE_BACKEND_GUARD_MESSAGE,
      ),
      rejectedCombination(
        { platform: 'web', frontend: 'nextjs', fullStack: false, extras: ['tailwind', 'eslint'] },
        NEXTJS_SEPARATE_BACKEND_GUARD_MESSAGE,
      ),
      rejectedCombination(
        { platform: 'web', frontend: 'nextjs', extras: ['tailwind', 'shadcn'] },
        NEXTJS_EXTRAS_GUARD_MESSAGE,
      ),
    ],
  },
  {
    id: 'node-prisma-sqlite-mysql',
    target: undefined,
    rowLabel: 'Node.js + Prisma + SQLite or MySQL',
    guard: 'flag-preflight',
    combinations: [
      nodePrismaStack('express', 'sqlite'),
      nodePrismaStack('express', 'mysql'),
      nodePrismaStack('fastify', 'sqlite'),
      nodePrismaStack('fastify', 'mysql'),
    ],
  },
  {
    id: 'integrated-laravel-postgres-mysql',
    target: undefined,
    rowLabel: 'Integrated Laravel (Livewire or Inertia React) + PostgreSQL or MySQL',
    guard: 'flag-preflight',
    combinations: [
      rejectedCombination(
        {
          platform: 'web',
          frontend: 'livewire',
          fullStack: true,
          runtime: 'php',
          backend: 'laravel',
          db: 'postgres',
          extras: [],
        },
        LARAVEL_LIVEWIRE_DATABASE_GUARD_MESSAGE,
      ),
      rejectedCombination(
        {
          platform: 'web',
          frontend: 'livewire',
          fullStack: true,
          runtime: 'php',
          backend: 'laravel',
          db: 'mysql',
          extras: [],
        },
        LARAVEL_LIVEWIRE_DATABASE_GUARD_MESSAGE,
      ),
      rejectedCombination(
        {
          platform: 'web',
          lang: 'typescript',
          frontend: 'inertia-react',
          fullStack: true,
          runtime: 'php',
          backend: 'laravel',
          db: 'postgres',
          extras: [],
        },
        LARAVEL_INERTIA_REACT_DATABASE_GUARD_MESSAGE,
      ),
      rejectedCombination(
        {
          platform: 'web',
          lang: 'typescript',
          frontend: 'inertia-react',
          fullStack: true,
          runtime: 'php',
          backend: 'laravel',
          db: 'mysql',
          extras: [],
        },
        LARAVEL_INERTIA_REACT_DATABASE_GUARD_MESSAGE,
      ),
    ],
  },
  {
    id: 'shadcn-frontend-limits',
    target: undefined,
    rowLabel: 'shadcn/ui — Vue, Svelte, integrated Laravel, or native mobile/desktop apps',
    guard: 'flag-preflight',
    combinations: [
      rejectedCombination(
        {
          platform: 'web',
          lang: 'typescript',
          frontend: 'vue',
          fullStack: true,
          runtime: 'node',
          backend: 'express',
          orm: 'drizzle',
          db: 'postgres',
          extras: ['tailwind', 'shadcn'],
        },
        SHADCN_FRONTEND_GUARD_MESSAGE,
      ),
      rejectedCombination(
        {
          platform: 'web',
          lang: 'typescript',
          frontend: 'svelte',
          fullStack: true,
          runtime: 'node',
          backend: 'express',
          orm: 'drizzle',
          db: 'postgres',
          extras: ['tailwind', 'shadcn'],
        },
        SHADCN_FRONTEND_GUARD_MESSAGE,
      ),
      rejectedCombination(
        {
          platform: 'web',
          frontend: 'livewire',
          fullStack: true,
          runtime: 'php',
          backend: 'laravel',
          db: 'sqlite',
          extras: ['tailwind', 'shadcn'],
        },
        SHADCN_FRONTEND_GUARD_MESSAGE,
      ),
      rejectedCombination(
        {
          platform: 'web',
          lang: 'typescript',
          frontend: 'inertia-react',
          fullStack: true,
          runtime: 'php',
          backend: 'laravel',
          db: 'sqlite',
          extras: ['tailwind', 'shadcn'],
        },
        SHADCN_FRONTEND_GUARD_MESSAGE,
      ),
      rejectedCombination(
        {
          platform: 'mobile',
          lang: 'typescript',
          frontend: 'react',
          fullStack: false,
          extras: ['tailwind', 'shadcn'],
        },
        NATIVE_WEB_FLAGS_GUARD_MESSAGE,
      ),
      rejectedCombination(
        {
          platform: 'desktop',
          lang: 'typescript',
          frontend: 'react',
          fullStack: false,
          extras: ['tailwind', 'shadcn'],
        },
        NATIVE_WEB_FLAGS_GUARD_MESSAGE,
      ),
    ],
  },
  {
    id: 'auth-module-fastify-hono',
    target: undefined,
    rowLabel: '`omnicraft add auth` — Fastify/Hono + Drizzle',
    guard: 'module-preflight',
    combinations: [
      rejectedCombination(
        nodeStack('fastify', 'drizzle', 'postgres').flags,
        'Better Auth currently requires Node.js + Express + Drizzle; its route patches target Express.',
        'auth',
      ),
      rejectedCombination(
        nodeStack('hono', 'drizzle', 'postgres').flags,
        'Better Auth currently requires Node.js + Express + Drizzle; its route patches target Express.',
        'auth',
      ),
    ],
  },
  {
    id: 'testing-module-vue-express-drizzle-sqlite',
    rowLabel: '`omnicraft add testing` — Vue/Vite + Express + Drizzle + SQLite',
    target: 'module-runtime',
    guard: 'module-preflight',
    combinations: [
      rejectedCombination(
        nodeStack('express', 'drizzle', 'sqlite', 'vue').flags,
        TESTING_MODULE_FRONTEND_GUARD_MESSAGE,
        'testing',
        'add-testing-vue-express-drizzle-sqlite',
      ),
    ],
  },
  {
    id: 'testing-module-svelte-express-drizzle-sqlite',
    rowLabel: '`omnicraft add testing` — Svelte/Vite + Express + Drizzle + SQLite',
    target: 'module-runtime',
    guard: 'module-preflight',
    combinations: [
      rejectedCombination(
        nodeStack('express', 'drizzle', 'sqlite', 'svelte').flags,
        TESTING_MODULE_FRONTEND_GUARD_MESSAGE,
        'testing',
        'add-testing-svelte-express-drizzle-sqlite',
      ),
    ],
  },
  {
    id: 'testing-module-nextjs-sqlite',
    rowLabel: '`omnicraft add testing` — Next.js + SQLite integrated full-stack',
    target: 'module-runtime',
    guard: 'module-preflight',
    combinations: [
      rejectedCombination(
        nextjsStack('sqlite').flags,
        TESTING_MODULE_FRONTEND_GUARD_MESSAGE,
        'testing',
        'add-testing-nextjs-sqlite',
      ),
    ],
  },
] as const satisfies readonly RejectedModuleCapability[]

export function integrationScenarios(target: IntegrationTargetId): readonly string[] {
  return INTEGRATION_TARGETS[target].scenarios
}
