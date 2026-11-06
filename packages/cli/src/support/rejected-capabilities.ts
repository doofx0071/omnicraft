import { AVAILABLE, type ModuleId } from '../capabilities.js'
import type {
  AuthenticationSetup,
  BackendFramework,
  BackendRuntime,
  Database,
  Frontend,
  Language,
  Orm,
} from '../types.js'
import {
  nextjsStack,
  nodeStack,
  REACT_VITE_TESTING_REJECTED_COMBINATIONS,
  reactViteTestingGroupId,
} from './combinations.js'
import type { IntegrationTargetId } from './scenarios.js'

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
export const SHADCN_PYTHON_RUNTIME_GUARD_MESSAGE =
  'shadcn/ui requires a Node.js backend; the shadcn CLI step runs only in the Node install flow and FastAPI is not covered yet. Omit shadcn or use --runtime node.'
export const SHADCN_PHP_RUNTIME_GUARD_MESSAGE =
  'shadcn/ui requires a Node.js backend; the shadcn CLI step runs only in the Node install flow and Laravel is not covered yet. Omit shadcn or use --runtime node.'
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
    id: 'shadcn-runtime-limits',
    target: undefined,
    rowLabel: 'shadcn/ui — FastAPI or Laravel API backends',
    guard: 'flag-preflight',
    combinations: [
      rejectedCombination(
        {
          platform: 'web',
          lang: 'typescript',
          frontend: 'react',
          fullStack: true,
          runtime: 'python',
          backend: 'fastapi',
          db: 'postgres',
          extras: ['tailwind', 'shadcn'],
        },
        SHADCN_PYTHON_RUNTIME_GUARD_MESSAGE,
      ),
      rejectedCombination(
        {
          platform: 'web',
          lang: 'typescript',
          frontend: 'react',
          fullStack: true,
          runtime: 'php',
          backend: 'laravel',
          db: 'sqlite',
          extras: ['tailwind', 'shadcn'],
        },
        SHADCN_PHP_RUNTIME_GUARD_MESSAGE,
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
