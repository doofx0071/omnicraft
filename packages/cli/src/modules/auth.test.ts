import { describe, expect, it } from 'vitest'
import { authModule } from './auth.js'
import type { ProjectManifest } from '../manifest.js'

function manifest(
  overrides: Partial<ProjectManifest['stack']> = {},
): ProjectManifest {
  return {
    schema: 1,
    cliVersion: '1.0.0',
    createdAt: '2026-10-28T00:00:00.000Z',
    projectName: 'demo-app',
    stack: {
      platform: 'web',
      frontend: 'react',
      architecture: { kind: 'separate-frontend-api' },
      backendRuntime: 'node',
      backendFramework: 'express',
      orm: 'drizzle',
      database: 'postgres',
      extras: [],
      ...overrides,
    },
    modules: [],
    packageManager: 'npm',
  }
}

describe('auth module compatibility', () => {
  it('allows the Express + Drizzle stack', () => {
    expect(authModule.incompatible?.(manifest())).toBeNull()
  })

  it.each(['fastify', 'hono'])(
    'rejects %s because auth patches are Express-specific',
    (framework) => {
      expect(authModule.incompatible?.(manifest({ backendFramework: framework }))).toEqual(
        expect.stringContaining('Express'),
      )
    },
  )

  it.each([
    { frontend: 'vue', reason: 'React frontend' },
    { backendRuntime: 'python', reason: 'Node.js + Express' },
    { orm: 'none', reason: 'Node.js + Express + Drizzle' },
    { database: 'mongodb', reason: 'SQLite, PostgreSQL, and MySQL' },
    { database: null, reason: 'no database' },
    { architecture: { kind: 'frontend-only' as const }, reason: 'architecture' },
  ])('rejects unsupported module manifest %# before writing', ({ reason, ...overrides }) => {
    expect(authModule.incompatible?.(manifest(overrides))).toContain(reason)
  })

  it('tells users to configure the secret without shipping a secret value', () => {
    expect(authModule.nextSteps?.join('\n')).toContain('BETTER_AUTH_SECRET=<a long random string>')
    expect(Object.values(authModule.files({ projectName: 'demo-app', databaseName: 'demo_app', targetDir: '.' }, manifest())).join('\n')).not.toMatch(/BETTER_AUTH_SECRET=[^<\n]/)
  })
})
