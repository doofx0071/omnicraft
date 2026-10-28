import type { Database } from './types.js'

export interface NodeRuntimeScenario {
  id: string
  framework: 'express' | 'fastify' | 'hono'
  orm: 'drizzle' | 'prisma' | 'none'
  database: Extract<Database, 'sqlite' | 'postgres' | 'mysql'>
}

export const NODE_RUNTIME_SCENARIOS = [
  { id: 'express-prisma-postgres', framework: 'express', orm: 'prisma', database: 'postgres' },
  { id: 'express-raw-sqlite', framework: 'express', orm: 'none', database: 'sqlite' },
  { id: 'express-raw-postgres', framework: 'express', orm: 'none', database: 'postgres' },
  { id: 'express-raw-mysql', framework: 'express', orm: 'none', database: 'mysql' },
] as const satisfies readonly NodeRuntimeScenario[]

export const INTEGRATION_TARGETS = {
  'node-runtime': {
    script: 'scripts/node-stack-integration.ts',
    workflowJob: 'node-runtime-integration',
    workflowCommand:
      'npm run test:integration:node --workspace=create-omnicraft -- --scenario',
    scenarios: NODE_RUNTIME_SCENARIOS.map((scenario) => scenario.id),
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

interface SupportedCapability {
  id: string
  matrixRowPrefix: string
  target: IntegrationTargetId
  scenarios: readonly string[]
}

/**
 * Each Supported matrix row names the exact runtime test target and scenario
 * that must pass before a release can ship.
 */
export const SUPPORTED_CAPABILITIES = [
  {
    id: 'frontend-react-express-drizzle-postgres',
    matrixRowPrefix:
      '| React + Vite + TypeScript + Express + Drizzle + PostgreSQL | **Supported** |',
    target: 'node-express-drizzle',
    scenarios: ['postgres'],
  },
  {
    id: 'express-drizzle-postgres',
    matrixRowPrefix: '| Express | Drizzle | PostgreSQL | **Supported** |',
    target: 'node-express-drizzle',
    scenarios: ['postgres'],
  },
  {
    id: 'express-drizzle-sqlite',
    matrixRowPrefix: '| Express | Drizzle | SQLite | **Supported** |',
    target: 'node-express-drizzle',
    scenarios: ['sqlite'],
  },
  {
    id: 'express-drizzle-mysql',
    matrixRowPrefix: '| Express | Drizzle | MySQL | **Supported** |',
    target: 'node-express-drizzle',
    scenarios: ['mysql'],
  },
  {
    id: 'laravel-eloquent-postgres',
    matrixRowPrefix: '| Laravel 12 | Eloquent | PostgreSQL | **Supported** |',
    target: 'php-laravel',
    scenarios: ['postgres'],
  },
  {
    id: 'laravel-eloquent-mysql',
    matrixRowPrefix: '| Laravel 12 | Eloquent | MySQL | **Supported** |',
    target: 'php-laravel',
    scenarios: ['mysql'],
  },
  {
    id: 'fastapi-sqlalchemy-sqlite',
    matrixRowPrefix: '| FastAPI | SQLAlchemy 2 async + Alembic | SQLite | **Supported** |',
    target: 'python-fastapi',
    scenarios: ['sqlite'],
  },
  {
    id: 'laravel-eloquent-sqlite',
    matrixRowPrefix: '| Laravel 12 | Eloquent | SQLite | **Supported** |',
    target: 'php-laravel',
    scenarios: ['sqlite'],
  },
  {
    id: 'auth-express-drizzle-sqlite',
    matrixRowPrefix: '| `omnicraft add auth` — Express + Drizzle + SQLite | **Supported** |',
    target: 'node-express-drizzle',
    scenarios: ['sqlite'],
  },
  {
    id: 'auth-express-drizzle-postgres-mysql',
    matrixRowPrefix:
      '| `omnicraft add auth` — Express + Drizzle + PostgreSQL/MySQL | **Supported** |',
    target: 'node-express-drizzle',
    scenarios: ['postgres', 'mysql'],
  },
] as const satisfies readonly SupportedCapability[]

export function integrationScenarios(target: IntegrationTargetId): readonly string[] {
  return INTEGRATION_TARGETS[target].scenarios
}
