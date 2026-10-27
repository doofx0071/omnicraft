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
    extras: { tailwind: true, eslintPrettier: true, shadcn: false },
    architecture: { kind: 'separate-frontend-api' },
    ...overrides,
  }
}

describe('buildNextSteps', () => {
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
})
