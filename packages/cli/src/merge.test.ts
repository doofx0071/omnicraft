import { describe, expect, it } from 'vitest'
import { deepMergePackageJson } from './scaffold/merge.js'

describe('deepMergePackageJson', () => {
  it('unions dependencies and scripts across layers', () => {
    const base = {
      name: 'server',
      scripts: { dev: 'tsx watch', build: 'tsc' },
      dependencies: { express: '^5.3.0' },
    }
    const override = {
      scripts: { 'db:push': 'drizzle-kit push' },
      dependencies: { 'drizzle-orm': '^0.45.4' },
    }
    const merged = deepMergePackageJson(base, override)
    expect(merged.scripts).toEqual({ dev: 'tsx watch', build: 'tsc', 'db:push': 'drizzle-kit push' })
    expect(merged.dependencies).toEqual({ express: '^5.3.0', 'drizzle-orm': '^0.45.4' })
    expect(merged.name).toBe('server')
  })

  it('lets later layers override scalars and nested objects', () => {
    const base = { a: 1, nested: { x: 1, y: 2 } }
    const override = { a: 2, nested: { y: 3 } }
    expect(deepMergePackageJson(base, override)).toEqual({ a: 2, nested: { x: 1, y: 3 } })
  })

  it('replaces arrays instead of merging them', () => {
    const base = { workspaces: ['client'] }
    const override = { workspaces: ['client', 'server'] }
    expect(deepMergePackageJson(base, override).workspaces).toEqual(['client', 'server'])
  })

  it('does not mutate its inputs', () => {
    const base = { scripts: { dev: 'x' } }
    deepMergePackageJson(base, { scripts: { build: 'y' } })
    expect(base.scripts).toEqual({ dev: 'x' })
  })
})
