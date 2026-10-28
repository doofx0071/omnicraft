import { describe, expect, it } from 'vitest'
import { buildManifest } from './manifest.js'
import type { Answers } from './types.js'

function answers(authentication: Answers['authentication']): Answers {
  return {
    projectName: 'demo-app',
    targetDir: '/tmp/demo-app',
    projectType: 'web',
    frontend: 'react',
    language: 'typescript',
    fullStack: true,
    backendRuntime: 'node',
    backendFramework: 'express',
    orm: 'drizzle',
    database: 'postgres',
    authentication,
    extras: { tailwind: false, eslintPrettier: false, shadcn: false },
    architecture: { kind: 'separate-frontend-api' },
  }
}

describe('project authentication manifest data', () => {
  it.each(['none', 'better-auth'] as const)(
    'stores %s separately from add-module history',
    (authentication) => {
      const manifest = buildManifest(answers(authentication), '1.0.2', 'npm')

      expect(manifest.authentication).toBe(authentication)
      expect(manifest.modules).toEqual([])
    },
  )
})
