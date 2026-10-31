import { describe, expect, it } from 'vitest'
import { buildManifest } from './manifest.js'
import type { Answers } from './types.js'

function answers(authentication: Answers['authentication']): Answers {
  if (authentication === 'laravel-native') {
    return {
      projectName: 'demo-app',
      targetDir: '/tmp/demo-app',
      projectType: 'web',
      frontend: 'livewire',
      language: null,
      fullStack: true,
      backendRuntime: 'php',
      backendFramework: 'laravel',
      orm: null,
      database: 'sqlite',
      authentication,
      extras: { tailwind: false, eslintPrettier: false, shadcn: false },
      architecture: { kind: 'integrated-laravel', framework: 'laravel', mode: 'livewire' },
    }
  }
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
  it.each(['none', 'better-auth', 'laravel-native'] as const)(
    'stores %s separately from add-module history',
    (authentication) => {
      const manifest = buildManifest(answers(authentication), '1.0.2', 'npm')

      expect(manifest.authentication).toBe(authentication)
      expect(manifest.modules).toEqual([])
      if (authentication === 'laravel-native') {
        expect(manifest.stack.frontend).toBe('livewire')
        expect(manifest.stack.architecture).toEqual({
          kind: 'integrated-laravel',
          framework: 'laravel',
          mode: 'livewire',
        })
      }
    },
  )
})
