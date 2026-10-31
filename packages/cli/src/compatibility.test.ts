import { describe, expect, it } from 'vitest'
import { AVAILABLE } from './capabilities.js'
import {
  authenticationCompatibilityReason,
  compatibleAuthenticationSetups,
  isFrontendAllowedByFlags,
  isRuntimeAllowedByFlags,
} from './compatibility.js'
import { parseArgs } from './args.js'

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
  it('exposes the existing setup choices without treating native auth as an add module', () => {
    expect(AVAILABLE.authentication).toEqual(['none', 'better-auth', 'laravel-native'])
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

  it('offers only None and Laravel native auth for integrated Livewire on SQLite', () => {
    const context = {
      frontend: 'livewire',
      language: null,
      architecture: { kind: 'integrated-laravel' },
      backendRuntime: 'php',
      backendFramework: 'laravel',
      orm: null,
      database: 'sqlite',
    }
    expect(compatibleAuthenticationSetups(context)).toEqual(['none', 'laravel-native'])
    expect(authenticationCompatibilityReason('laravel-native', context)).toBeNull()
  })

  it('offers only None and Laravel native auth for integrated Inertia React on SQLite', () => {
    const context = {
      frontend: 'inertia-react',
      language: 'typescript',
      architecture: { kind: 'integrated-laravel' },
      backendRuntime: 'php',
      backendFramework: 'laravel',
      orm: null,
      database: 'sqlite',
    }
    expect(compatibleAuthenticationSetups(context)).toEqual(['none', 'laravel-native'])
    expect(authenticationCompatibilityReason('laravel-native', context)).toBeNull()
  })

  it.each([
    [{ database: 'postgres' }, /SQLite only/],
    [{ backendRuntime: 'node' }, /PHP \+ Laravel/],
    [{ frontend: 'react' }, /integrated Livewire or Inertia React/],
    [{ architecture: { kind: 'separate-frontend-api' } }, /integrated Livewire or Inertia React/],
  ])('omits Laravel native auth for incompatible context %j', (overrides, reason) => {
    const context = {
      frontend: 'livewire',
      language: null,
      architecture: { kind: 'integrated-laravel' },
      backendRuntime: 'php',
      backendFramework: 'laravel',
      orm: null,
      database: 'sqlite',
      ...overrides,
    }
    expect(compatibleAuthenticationSetups(context)).toEqual(['none'])
    expect(authenticationCompatibilityReason('laravel-native', context)).toMatch(reason)
  })

  it('filters prompt choices and runtime from Laravel-native flags', () => {
    const args = parseArgs(['--auth', 'laravel-native'])
    expect(isFrontendAllowedByFlags('livewire', args)).toBe(true)
    expect(isFrontendAllowedByFlags('inertia-react', args)).toBe(false)
    expect(isFrontendAllowedByFlags('react', args)).toBe(false)
    expect(isRuntimeAllowedByFlags('php', args)).toBe(true)
    expect(isRuntimeAllowedByFlags('node', args)).toBe(false)
  })

  it('allows explicit Inertia React with Laravel-native auth while preserving auth-only Livewire inference', () => {
    const args = parseArgs(['--frontend', 'inertia-react', '--auth', 'laravel-native'])
    expect(isFrontendAllowedByFlags('inertia-react', args)).toBe(true)
    expect(isRuntimeAllowedByFlags('php', args)).toBe(true)
    expect(isRuntimeAllowedByFlags('node', args)).toBe(false)
  })
})
