import { describe, expect, it } from 'vitest'
import { AVAILABLE } from './capabilities.js'
import {
  authenticationCompatibilityReason,
  compatibleAuthenticationSetups,
} from './compatibility.js'

const supportedExpressDrizzle = {
  frontend: 'react',
  language: 'typescript',
  architecture: { kind: 'separate-frontend-api' },
  backendRuntime: 'node',
  backendFramework: 'express',
  orm: 'drizzle',
  database: 'postgres',
}

describe('creation-time authentication compatibility', () => {
  it('exposes only None and the existing Better Auth setup', () => {
    expect(AVAILABLE.authentication).toEqual(['none', 'better-auth'])
  })

  it.each(['sqlite', 'postgres', 'mysql'])('offers Better Auth for the supported %s database', (database) => {
    const context = { ...supportedExpressDrizzle, database }
    expect(compatibleAuthenticationSetups(context)).toEqual(['none', 'better-auth'])
    expect(authenticationCompatibilityReason('better-auth', context)).toBeNull()
  })

  it.each([
    ['frontend', { frontend: 'vue' }],
    ['language', { language: 'javascript' }],
    ['runtime', { backendRuntime: 'python' }],
    ['framework', { backendFramework: 'fastify' }],
    ['orm', { orm: 'none' }],
    ['database', { database: 'mongodb' }],
    ['architecture', { architecture: { kind: 'frontend-only' } }],
  ])('omits Better Auth when the selected %s is unsupported', (_dimension, overrides) => {
    const context = { ...supportedExpressDrizzle, ...overrides }
    expect(compatibleAuthenticationSetups(context)).toEqual(['none'])
    expect(authenticationCompatibilityReason('better-auth', context)).toBeTruthy()
  })

  it('keeps None compatible with a frontend-only project', () => {
    const context = {
      ...supportedExpressDrizzle,
      architecture: { kind: 'frontend-only' },
      backendRuntime: null,
      backendFramework: null,
      orm: null,
      database: null,
    }
    expect(compatibleAuthenticationSetups(context)).toEqual(['none'])
    expect(authenticationCompatibilityReason('none', context)).toBeNull()
  })
})
