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
    id: 'express-prisma-postgres',
    matrixRowPrefix: '| Express | Prisma | PostgreSQL | **Supported** |',
    target: 'node-runtime',
    scenarios: ['express-prisma-postgres'],
  },
  {
    id: 'express-raw-sqlite',
    matrixRowPrefix: '| Express | Raw SQL (`none`) | SQLite | **Supported** |',
    target: 'node-runtime',
    scenarios: ['express-raw-sqlite'],
  },
  {
    id: 'express-raw-postgres',
    matrixRowPrefix: '| Express | Raw SQL (`none`) | PostgreSQL | **Supported** |',
    target: 'node-runtime',
    scenarios: ['express-raw-postgres'],
  },
  {
    id: 'express-raw-mysql',
    matrixRowPrefix: '| Express | Raw SQL (`none`) | MySQL | **Supported** |',
    target: 'node-runtime',
    scenarios: ['express-raw-mysql'],
  },
  {
    id: 'fastapi-sqlalchemy-postgres',
    matrixRowPrefix: '| FastAPI | SQLAlchemy 2 async + Alembic | PostgreSQL | **Supported** |',
    target: 'python-fastapi',
    scenarios: ['postgres'],
  },
  {
    id: 'fastify-drizzle-postgres',
    matrixRowPrefix: '| Fastify | Drizzle | PostgreSQL | **Supported** |',
    target: 'node-runtime',
    scenarios: ['fastify-drizzle-postgres'],
  },
  {
    id: 'fastify-drizzle-sqlite',
    matrixRowPrefix: '| Fastify | Drizzle | SQLite | **Supported** |',
    target: 'node-runtime',
    scenarios: ['fastify-drizzle-sqlite'],
  },
  {
    id: 'fastify-drizzle-mysql',
    matrixRowPrefix: '| Fastify | Drizzle | MySQL | **Supported** |',
    target: 'node-runtime',
    scenarios: ['fastify-drizzle-mysql'],
  },
  {
    id: 'fastify-prisma-postgres',
    matrixRowPrefix: '| Fastify | Prisma | PostgreSQL | **Supported** |',
    target: 'node-runtime',
    scenarios: ['fastify-prisma-postgres'],
  },
  {
    id: 'fastify-raw-sql',
    matrixRowPrefix: '| Fastify | Raw SQL (`none`) | PostgreSQL, SQLite, MySQL | **Supported** |',
    target: 'node-runtime',
    scenarios: ['fastify-raw-postgres', 'fastify-raw-sqlite', 'fastify-raw-mysql'],
  },
  {
    id: 'hono-drizzle-postgres-sqlite',
    matrixRowPrefix: '| Hono | Drizzle | PostgreSQL, SQLite | **Supported** |',
    target: 'node-runtime',
    scenarios: ['hono-drizzle-postgres', 'hono-drizzle-sqlite'],
  },
  {
    id: 'hono-drizzle-mysql',
    matrixRowPrefix: '| Hono | Drizzle | MySQL | **Supported** |',
    target: 'node-runtime',
    scenarios: ['hono-drizzle-mysql'],
  },
  {
    id: 'hono-raw-sql',
    matrixRowPrefix: '| Hono | Raw SQL (`none`) | PostgreSQL, SQLite, MySQL | **Supported** |',
    target: 'node-runtime',
    scenarios: ['hono-raw-postgres', 'hono-raw-sqlite', 'hono-raw-mysql'],
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
