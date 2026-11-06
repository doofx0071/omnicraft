import { REACT_VITE_TESTING_FOLLOWUP_SCENARIOS } from './combinations.js'
import type { AuthenticationSetup, Database } from '../types.js'

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

export function integrationScenarios(target: IntegrationTargetId): readonly string[] {
  return INTEGRATION_TARGETS[target].scenarios
}
