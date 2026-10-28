import { AVAILABLE, type ModuleId } from './capabilities.js'
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

export const NEXTJS_DATABASE_SCENARIOS = ['sqlite', 'postgres', 'mysql'] as const satisfies readonly Extract<Database, 'sqlite' | 'postgres' | 'mysql'>[]
export const FRONTEND_RUNTIME_SCENARIOS = ['react-js-frontend-only'] as const
export const DOCKER_MODULE_SCENARIOS = ['postgres', 'mysql'] as const satisfies readonly Extract<Database, 'postgres' | 'mysql'>[]
export const MODULE_RUNTIME_SCENARIOS = [
  'add-testing-react-vite-ts',
  'shadcn-react-vite-ts-frontend-only',
] as const
export const NATIVE_PLATFORM_SCENARIOS = ['expo-ios-simulator', 'tauri-linux-desktop'] as const

export const INTEGRATION_TARGETS = {
  'node-runtime': {
    script: 'scripts/node-stack-integration.ts',
    workflowJob: 'node-runtime-integration',
    workflowCommand:
      'npm run test:integration:node --workspace=create-omnicraft -- --scenario',
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
    workflowCommand: 'npm run test:integration:docker-module --workspace=create-omnicraft -- --database',
    scenarios: DOCKER_MODULE_SCENARIOS,
  },
  'module-runtime': {
    script: 'scripts/module-runtime-integration.ts',
    workflowJob: 'module-runtime-integration',
    workflowCommand: 'npm run test:integration:modules --workspace=create-omnicraft -- --scenario',
    scenarios: MODULE_RUNTIME_SCENARIOS,
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
    lang: Language
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
  | 'auth-module'
  | 'creation-auth'
  | 'docker-module'
  | 'testing-module'
  | 'shadcn-extra'

export interface SupportedCapability {
  id: string
  matrixFormat: SupportMatrixFormat
  target: IntegrationTargetId
  scenarios: readonly string[]
  combinations: readonly SupportedCombination[]
}

type SupportedExtras = SupportedCombination['flags']['extras']

function webStack(
  frontend: Frontend,
  language: Language,
  runtime: BackendRuntime,
  backend: BackendFramework,
  orm: Orm | undefined,
  database: Database,
  module?: ModuleId,
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
      extras: [],
    },
    ...(module ? { module } : {}),
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
  if (combinations.length === 0) throw new Error('A Supported matrix row must register a combination.')
  const first = combinations[0] as SupportedCombination
  const frontend = first.flags.frontend as Frontend
  const language = first.flags.lang as Language
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
  if (databases.length > 0 && new Set(databases).size !== databases.length) {
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
    case 'auth-module':
      label = `\`omnicraft add auth\` — Express + Drizzle + ${databaseList('/')}`
      break
    case 'creation-auth':
      label = `Creation-time Better Auth — ${frontendLabel} + Express + Drizzle + ${databaseList('/')}`
      break
    case 'docker-module':
      label = `\`omnicraft add docker\` — Express + Drizzle + ${oneDatabase()} separate API`
      break
    case 'testing-module':
      label = '`omnicraft add testing` — React/Vite TypeScript frontend-only'
      break
    case 'shadcn-extra':
      label = 'shadcn/ui — React/Vite TypeScript frontend-only'
      break
  }
  return `| ${label} | **Supported** |`
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
    id: 'shadcn-react-vite-ts-frontend-only',
    matrixFormat: 'shadcn-extra',
    target: 'module-runtime',
    scenarios: ['shadcn-react-vite-ts-frontend-only'],
    combinations: [frontendOnlyStack('typescript', ['tailwind', 'eslint', 'shadcn'])],
  },
] as const satisfies readonly SupportedCapability[]

export function integrationScenarios(target: IntegrationTargetId): readonly string[] {
  return INTEGRATION_TARGETS[target].scenarios
}
