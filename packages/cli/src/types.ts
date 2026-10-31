export type ProjectType = 'web' | 'mobile' | 'desktop'
export type Frontend = 'react' | 'vue' | 'svelte' | 'nextjs' | 'livewire' | 'inertia-react'
export type Language = 'typescript' | 'javascript'
export type BackendRuntime = 'node' | 'python' | 'php'
export type BackendFramework =
  | 'express'
  | 'fastify'
  | 'hono'
  | 'nestjs'
  | 'fastapi'
  | 'laravel'
  | 'django'
  | 'symfony'
export type Orm = 'drizzle' | 'prisma' | 'none' | 'mongoose'
export type Database = 'postgres' | 'sqlite' | 'mysql' | 'mongodb'
export type AuthenticationSetup = 'none' | 'better-auth' | 'laravel-native' | 'supabase-auth'

/**
 * How the project is architected (master plan §3-B).
 * - `frontend-only`: browser app, no server.
 * - `integrated-fullstack`: the frontend framework IS the server (Next.js
 *   app router + route handlers); a separate API is optional and not
 *   scaffolded.
 * - `integrated-laravel`: Laravel + Livewire or Laravel + Inertia React is one
 *   PHP application, without a separate API workspace.
 * - `separate-frontend-api`: client/ + server/ workspaces (the original shape).
 * - `native-app`: Expo (mobile) or Tauri (desktop) — a device app that talks
 *   to a separately-running backend; no db prompts.
 */
export type ProjectArchitecture =
  | { kind: 'frontend-only' }
  | { kind: 'integrated-fullstack'; framework: 'nextjs' }
  | { kind: 'integrated-laravel'; framework: 'laravel'; mode: 'livewire' | 'inertia-react' }
  | { kind: 'separate-frontend-api' }
  | { kind: 'native-app'; platform: 'mobile' | 'desktop' }

export interface Extras {
  tailwind: boolean
  eslintPrettier: boolean
  /** shadcn/ui — implies tailwind; components are added by the pinned shadcn CLI post-scaffold. */
  shadcn: boolean
}

export interface Answers {
  projectName: string
  targetDir: string
  projectType: ProjectType
  frontend: Frontend
  language: Language | null
  fullStack: boolean
  backendRuntime: BackendRuntime | null
  backendFramework: BackendFramework | null
  orm: Orm | null
  database: Database | null
  authentication: AuthenticationSetup
  extras: Extras
  /** Derived from frontend + fullStack; nextjs fullStack = integrated full-stack. */
  architecture: ProjectArchitecture
}

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  web: 'Web App',
  mobile: 'Mobile App',
  desktop: 'Desktop App',
}

export const FRONTEND_LABELS: Record<Frontend, string> = {
  react: 'React',
  nextjs: 'Next.js',
  vue: 'Vue',
  svelte: 'Svelte',
  livewire: 'Laravel + Livewire',
  'inertia-react': 'Laravel + Inertia React',
}

export const BACKEND_RUNTIME_LABELS: Record<BackendRuntime, string> = {
  node: 'Node.js',
  python: 'Python',
  php: 'PHP (Laravel)',
}

export const BACKEND_FRAMEWORK_LABELS: Record<BackendFramework, string> = {
  express: 'Express',
  fastify: 'Fastify',
  hono: 'Hono',
  nestjs: 'NestJS',
  fastapi: 'FastAPI',
  laravel: 'Laravel',
  django: 'Django',
  symfony: 'Symfony',
}

export const ORM_LABELS: Record<Orm, string> = {
  drizzle: 'Drizzle',
  prisma: 'Prisma',
  none: 'None (raw SQL)',
  mongoose: 'Mongoose',
}

export const DATABASE_LABELS: Record<Database, string> = {
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  sqlite: 'SQLite',
  mongodb: 'MongoDB',
}

export function describeStack(answers: Answers): string[] {
  const lines: string[] = []
  lines.push(`Type:       ${PROJECT_TYPE_LABELS[answers.projectType]}`)
  lines.push(
    `Frontend:   ${FRONTEND_LABELS[answers.frontend]}${answers.language ? ` (${answers.language})` : ''}`,
  )
  if (answers.architecture.kind === 'integrated-laravel') {
    lines.push('Backend:    PHP — Laravel')
    lines.push(`Database:   ${DATABASE_LABELS[answers.database!]} (Eloquent)`)
    lines.push(
      `UI:         ${answers.architecture.mode === 'livewire' ? 'Livewire' : 'Inertia React'}`,
    )
  } else if (answers.fullStack) {
    lines.push(
      `Backend:    ${BACKEND_RUNTIME_LABELS[answers.backendRuntime!]} + ${BACKEND_FRAMEWORK_LABELS[answers.backendFramework!]}`,
    )
    lines.push(
      `Database:   ${DATABASE_LABELS[answers.database!]} (${ORM_LABELS[answers.orm!]})`,
    )
  } else {
    lines.push('Backend:    none (frontend only)')
  }
  const extras: string[] = []
  if (answers.extras.tailwind) extras.push('Tailwind CSS')
  if (answers.extras.eslintPrettier) extras.push('ESLint + Prettier')
  lines.push(`Extras:     ${extras.length > 0 ? extras.join(', ') : 'none'}`)
  return lines
}
