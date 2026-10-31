import { describe, expect, it } from 'vitest'
import { buildNextSteps } from './next-steps.js'
import type { Answers } from './types.js'
import type { PackageManager } from './scaffold/pkg-manager.js'

function makeAnswers(overrides: Partial<Answers> = {}): Answers {
  return {
    projectName: 'demo-app',
    targetDir: '.',
    projectType: 'web',
    frontend: 'react',
    language: 'typescript',
    fullStack: true,
    backendRuntime: 'node',
    backendFramework: 'express',
    orm: 'drizzle',
    database: 'postgres',
    authentication: 'none',
    extras: { tailwind: true, eslintPrettier: true, shadcn: false },
    architecture: { kind: 'separate-frontend-api' },
    ...overrides,
  }
}

describe('buildNextSteps', () => {
  it('shows the manual Supabase Auth setup for the frontend-only app', () => {
    const result = buildNextSteps(
      makeAnswers({
        fullStack: false,
        backendRuntime: null,
        backendFramework: null,
        orm: null,
        database: null,
        authentication: 'supabase-auth',
        architecture: { kind: 'frontend-only' },
      }),
      'npm',
    )
    expect(result.steps).toEqual(['cd demo-app', 'npm run dev'])
    expect(result.details).toContain('Supabase Data API with user-scoped row-level security')
    expect(result.details).toContain('publishable key to .env')
  })

  it('prints integrated Next.js steps without a separate-server claim', () => {
    const answers = makeAnswers({
      frontend: 'nextjs',
      backendRuntime: null,
      backendFramework: null,
      orm: 'none',
      database: 'sqlite',
      architecture: { kind: 'integrated-fullstack', framework: 'nextjs' },
    })

    const result = buildNextSteps(answers, 'npm' satisfies PackageManager)

    expect(result.steps).toEqual(['cd demo-app', 'npm run db:migrate         # apply SQL migrations', 'npm run dev'])
    expect(result.details).toContain('http://localhost:5173/api/users')
    expect(result.details).toContain('SQLite file configured by DATABASE_URL in .env')
    expect(result.details).not.toContain('localhost:3000')
    expect(result.details).not.toContain('server/data/app.db')
  })

  it('starts a containerized database for integrated PostgreSQL', () => {
    const answers = makeAnswers({
      frontend: 'nextjs',
      backendRuntime: null,
      backendFramework: null,
      orm: 'none',
      database: 'postgres',
      architecture: { kind: 'integrated-fullstack', framework: 'nextjs' },
    })

    const result = buildNextSteps(answers, 'npm')

    expect(result.steps).toEqual([
      'cd demo-app',
      'docker compose up -d        # start PostgreSQL',
      'npm run db:migrate         # apply SQL migrations',
      'npm run dev',
    ])
    expect(result.details).toContain('PostgreSQL configured by DATABASE_URL in .env')
  })

  it.each(['none', 'laravel-native'] as const)(
    'prints integrated Laravel + Livewire next steps for %s authentication',
    (authentication) => {
      const answers = makeAnswers({
        frontend: 'livewire',
        language: null,
        backendRuntime: 'php',
        backendFramework: 'laravel',
        orm: null,
        database: 'sqlite',
        authentication,
        architecture: { kind: 'integrated-laravel', framework: 'laravel', mode: 'livewire' },
      })

      const result = buildNextSteps(answers, 'npm')

      expect(result.steps).toEqual([
        'cd demo-app',
        'cd server',
        'npm install                # if you skipped frontend dependency setup',
        'php artisan migrate',
        'composer run dev',
      ])
      expect(result.details).toContain('Laravel + Livewire (integrated PHP-driven app)')
      expect(result.details).toContain('SQLite at server/database/database.sqlite')
      expect(result.details).not.toContain('localhost:5173')
    },
  )

  it.each(['none', 'laravel-native'] as const)(
    'prints integrated Laravel + Inertia React next steps for %s authentication',
    (authentication) => {
      const answers = makeAnswers({
        frontend: 'inertia-react',
        language: 'typescript',
        backendRuntime: 'php',
        backendFramework: 'laravel',
        orm: null,
        database: 'sqlite',
        authentication,
        architecture: { kind: 'integrated-laravel', framework: 'laravel', mode: 'inertia-react' },
      })

      const result = buildNextSteps(answers, 'npm')

      expect(result.steps).toEqual([
        'cd demo-app',
        'cd server',
        'npm install                # if you skipped frontend dependency setup',
        'php artisan migrate',
        'composer run dev',
      ])
      expect(result.details).toContain('Laravel + Inertia React (integrated Laravel app)')
      expect(result.details).toContain('SQLite at server/database/database.sqlite')
      expect(result.details).toContain(authentication === 'none' ? 'auth     → None' : 'Laravel native session auth (Fortify)')
      expect(result.details).not.toContain('localhost:5173')
    },
  )
})
