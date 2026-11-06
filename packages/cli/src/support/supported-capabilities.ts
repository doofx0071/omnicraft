import {
  creationAuthStack,
  frontendOnlyStack,
  inertiaReactAuthStack,
  livewireAuthStack,
  nextjsStack,
  nodeStack,
  phpStack,
  pythonStack,
  REACT_VITE_TESTING_NONREJECTED_COMBINATIONS,
  reactViteTestingGroupId,
  sanctumSpaAuthStack,
  supabaseAuthStack,
  webStack,
  type SupportedCombination,
} from './combinations.js'
import type { IntegrationTargetId } from './scenarios.js'

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
