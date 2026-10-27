import { describe, expect, it } from 'vitest'
import { authModule } from './auth.js'
import type { ProjectManifest } from '../manifest.js'

function manifest(backendFramework: string): ProjectManifest {
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
      backendFramework,
      orm: 'drizzle',
      database: 'postgres',
      extras: [],
    },
    modules: [],
    packageManager: 'npm',
  }
}

describe('auth module compatibility', () => {
  it('allows the Express + Drizzle stack', () => {
    expect(authModule.incompatible?.(manifest('express'))).toBeNull()
  })

  it.each(['fastify', 'hono'])(
    'rejects %s because auth patches are Express-specific',
    (framework) => {
      expect(authModule.incompatible?.(manifest(framework))).toEqual(
        expect.stringContaining('Express'),
      )
    },
  )
})
