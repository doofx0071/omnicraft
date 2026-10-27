import type {
  BackendFramework,
  BackendRuntime,
  Database,
  Frontend,
  Language,
  Orm,
  ProjectType,
} from './types.js'

type CapabilityOption<T extends string> = {
  value: T
  label: string
  available: boolean
  hint?: string
}

/**
 * Selectable options and their prompt metadata. Cross-option constraints live
 * in compatibility.ts; this registry is the source for prompt/flag choices.
 */
export const CAPABILITY_REGISTRY = {
  projectType: [
    { value: 'web', label: 'Web App', available: true, hint: 'Browser app' },
    {
      value: 'mobile',
      label: 'Mobile App',
      available: true,
      hint: 'Expo + TypeScript (iOS/Android)',
    },
    { value: 'desktop', label: 'Desktop App', available: true, hint: 'Tauri 2 + React UI' },
  ] as const satisfies readonly CapabilityOption<ProjectType>[],
  frontend: [
    { value: 'react', label: 'React', available: true, hint: 'Vite + TypeScript' },
    {
      value: 'nextjs',
      label: 'Next.js',
      available: true,
      hint: 'Integrated full-stack — Next.js IS the server',
    },
    { value: 'vue', label: 'Vue', available: true, hint: 'Vite + TypeScript' },
    { value: 'svelte', label: 'Svelte', available: true, hint: 'Vite + TypeScript' },
  ] as const satisfies readonly CapabilityOption<Frontend>[],
  language: [
    { value: 'typescript', label: 'TypeScript', available: true, hint: 'Recommended' },
    {
      value: 'javascript',
      label: 'JavaScript',
      available: true,
      hint: 'React/Vite client ships as JS; a selected server remains TypeScript',
    },
  ] as const satisfies readonly CapabilityOption<Language>[],
  runtime: [
    { value: 'node', label: 'Node.js', available: true, hint: 'Express, Fastify, Hono' },
    { value: 'python', label: 'Python', available: true, hint: 'FastAPI + SQLAlchemy' },
    { value: 'php', label: 'PHP (Laravel)', available: true, hint: 'Laravel + Eloquent' },
  ] as const satisfies readonly CapabilityOption<BackendRuntime>[],
  backend: {
    node: [
      { value: 'express', label: 'Express', available: true, hint: 'The classic, huge ecosystem' },
      { value: 'fastify', label: 'Fastify', available: true, hint: 'Fast, schema-first' },
      { value: 'hono', label: 'Hono', available: true, hint: 'Ultra-light' },
      { value: 'nestjs', label: 'NestJS', available: false },
    ] as const satisfies readonly CapabilityOption<BackendFramework>[],
    python: [
      { value: 'fastapi', label: 'FastAPI', available: true, hint: 'SQLAlchemy + Alembic' },
      { value: 'django', label: 'Django', available: false },
    ] as const satisfies readonly CapabilityOption<BackendFramework>[],
    php: [
      { value: 'laravel', label: 'Laravel', available: true, hint: 'Laravel 12 + Eloquent' },
      { value: 'symfony', label: 'Symfony', available: false },
    ] as const satisfies readonly CapabilityOption<BackendFramework>[],
  } satisfies Record<BackendRuntime, readonly CapabilityOption<BackendFramework>[]>,
  database: {
    node: [
      { value: 'postgres', label: 'PostgreSQL', available: true, hint: 'Drizzle or Prisma' },
      { value: 'sqlite', label: 'SQLite', available: true, hint: 'Zero setup — file-based (Drizzle)' },
      { value: 'mysql', label: 'MySQL', available: true, hint: 'Drizzle' },
      { value: 'mongodb', label: 'MongoDB', available: false },
    ] as const satisfies readonly CapabilityOption<Database>[],
    python: [
      { value: 'postgres', label: 'PostgreSQL', available: true, hint: 'asyncpg + Alembic' },
      { value: 'sqlite', label: 'SQLite', available: true, hint: 'Zero setup — file-based (aiosqlite)' },
      { value: 'mysql', label: 'MySQL', available: false },
      { value: 'mongodb', label: 'MongoDB', available: false },
    ] as const satisfies readonly CapabilityOption<Database>[],
    php: [
      { value: 'postgres', label: 'PostgreSQL', available: true, hint: 'Eloquent' },
      { value: 'sqlite', label: 'SQLite', available: true, hint: 'Zero setup — file-based (Eloquent)' },
      { value: 'mysql', label: 'MySQL', available: true, hint: 'Eloquent' },
      { value: 'mongodb', label: 'MongoDB', available: false },
    ] as const satisfies readonly CapabilityOption<Database>[],
  } satisfies Record<BackendRuntime, readonly CapabilityOption<Database>[]>,
  orm: [
    { value: 'drizzle', label: 'Drizzle', available: true, hint: 'SQL-like, lightweight' },
    {
      value: 'prisma',
      label: 'Prisma',
      available: true,
      hint: 'Schema-first; PostgreSQL only for now',
    },
    {
      value: 'none',
      label: 'None — raw SQL',
      available: true,
      hint: 'Driver + parameterized queries + SQL-file migrations',
    },
    { value: 'mongoose', label: 'Mongoose', available: false },
  ] as const satisfies readonly CapabilityOption<Orm>[],
  extras: [
    { value: 'tailwind', label: 'Tailwind CSS', available: true, hint: 'Utility-first styling' },
    { value: 'eslint', label: 'ESLint + Prettier', available: true, hint: 'Linting + formatting' },
    {
      value: 'shadcn',
      label: 'shadcn/ui',
      available: true,
      hint: 'Component library (includes Tailwind) — runs shadcn CLI',
    },
  ] as const satisfies readonly CapabilityOption<'tailwind' | 'eslint' | 'shadcn'>[],
  modules: [
    { value: 'auth', label: 'auth', available: true, hint: 'Better Auth email/password' },
    { value: 'docker', label: 'docker', available: true, hint: 'Database Compose service' },
    { value: 'testing', label: 'testing', available: true, hint: 'Vitest client test setup' },
  ] as const,
  ormsByNodeBackend: {
    express: ['drizzle', 'prisma', 'none'],
    fastify: ['drizzle', 'prisma', 'none'],
    hono: ['drizzle', 'none'],
  } as const satisfies Record<'express' | 'fastify' | 'hono', readonly Orm[]>,
} as const

type AvailableValue<Options extends readonly { value: string; available: boolean }[]> = Extract<
  Options[number],
  { available: true }
>['value']

function availableValues<
  const Options extends readonly { value: string; available: boolean }[],
>(options: Options): AvailableValue<Options>[] {
  return options.filter((option) => option.available).map((option) => option.value) as AvailableValue<Options>[]
}

/** Values accepted by flags and used by non-interactive defaults. */
export const AVAILABLE = {
  projectType: availableValues(CAPABILITY_REGISTRY.projectType),
  frontend: availableValues(CAPABILITY_REGISTRY.frontend),
  lang: availableValues(CAPABILITY_REGISTRY.language),
  runtime: availableValues(CAPABILITY_REGISTRY.runtime),
  backend: {
    node: availableValues(CAPABILITY_REGISTRY.backend.node),
    python: availableValues(CAPABILITY_REGISTRY.backend.python),
    php: availableValues(CAPABILITY_REGISTRY.backend.php),
  },
  db: {
    node: availableValues(CAPABILITY_REGISTRY.database.node),
    python: availableValues(CAPABILITY_REGISTRY.database.python),
    php: availableValues(CAPABILITY_REGISTRY.database.php),
  },
  orm: { node: availableValues(CAPABILITY_REGISTRY.orm) },
  extras: availableValues(CAPABILITY_REGISTRY.extras),
  modules: availableValues(CAPABILITY_REGISTRY.modules),
} as const

export type ModuleId = (typeof AVAILABLE.modules)[number]
