import { describe, expect, it } from 'vitest'
import { deepMergePackageJson, mergeExtensionsJson } from './scaffold/merge.js'

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

  it('drops __proto__/constructor/prototype keys without polluting the prototype', () => {
    // JSON.parse stores "__proto__" as a real own property — ordinary
    // assignment during the merge would reassign the result's prototype.
    const base = JSON.parse('{"name":"server","scripts":{"dev":"tsx watch"}}') as Record<
      string,
      unknown
    >
    const override = JSON.parse(
      '{"name":"evil","__proto__":{"polluted":true},"scripts":{"__proto__":{"nested":true},"build":"tsc"},"constructor":{"c":1},"prototype":{"p":1}}',
    ) as Record<string, unknown>

    const merged = deepMergePackageJson(base, override)

    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype)
    expect(Object.getPrototypeOf(merged.scripts as object)).toBe(Object.prototype)
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined()
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(({} as Record<string, unknown>).nested).toBeUndefined()
    expect(Object.hasOwn(merged, '__proto__')).toBe(false)
    expect(Object.hasOwn(merged, 'constructor')).toBe(false)
    expect(Object.hasOwn(merged, 'prototype')).toBe(false)
    expect(Object.hasOwn(merged.scripts as object, '__proto__')).toBe(false)
    expect(merged.name).toBe('evil')
    expect(merged.scripts).toEqual({ dev: 'tsx watch', build: 'tsc' })
  })

  it('drops a primitive __proto__ value instead of assigning it', () => {
    const override = JSON.parse('{"__proto__": 5, "name": "x"}') as Record<string, unknown>
    const merged = deepMergePackageJson({ name: 'base' }, override)
    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype)
    expect(merged).toEqual({ name: 'x' })
  })
})

describe('mergeExtensionsJson', () => {
  it('unions, dedupes, and sorts recommendations across fragments', () => {
    const merged = mergeExtensionsJson(
      { recommendations: ['prisma.prisma', 'bradlc.vscode-tailwindcss'] },
      { recommendations: ['bradlc.vscode-tailwindcss', 'Vue.volar'] },
    )
    expect(merged.recommendations).toEqual([
      'Vue.volar',
      'bradlc.vscode-tailwindcss',
      'prisma.prisma',
    ])
  })

  it('starts fresh when a fragment has no recommendations array', () => {
    expect(mergeExtensionsJson({}, { recommendations: ['dbaeumer.vscode-eslint'] })).toEqual({
      recommendations: ['dbaeumer.vscode-eslint'],
    })
    expect(mergeExtensionsJson({ recommendations: ['a'] }, {}).recommendations).toEqual(['a'])
  })

  it('ignores non-array recommendations values', () => {
    expect(
      mergeExtensionsJson({ recommendations: 'bogus' }, { recommendations: 42 }).recommendations,
    ).toEqual([])
  })

  it('keeps other keys with override-wins semantics', () => {
    expect(mergeExtensionsJson({ other: 1, keep: 'x' }, { other: 2 })).toEqual({
      other: 2,
      keep: 'x',
      recommendations: [],
    })
  })

  it('does not mutate its inputs', () => {
    const base = { recommendations: ['b'] }
    const override = { recommendations: ['a'] }
    mergeExtensionsJson(base, override)
    expect(base).toEqual({ recommendations: ['b'] })
    expect(override).toEqual({ recommendations: ['a'] })
  })
})
