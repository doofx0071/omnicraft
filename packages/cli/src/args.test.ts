import { describe, expect, it } from 'vitest'
import { parseArgs } from './args.js'

describe('parseArgs', () => {
  it('parses boolean flags', () => {
    const args = parseArgs(['--latest', '--skip-install', '--yes'])
    expect(args.latest).toBe(true)
    expect(args.skipInstall).toBe(true)
    expect(args.yes).toBe(true)
  })

  it('parses value flags with a space and with =', () => {
    expect(parseArgs(['--frontend', 'react']).frontend).toBe('react')
    expect(parseArgs(['--backend=fastify']).backend).toBe('fastify')
    expect(parseArgs(['--orm', 'prisma']).orm).toBe('prisma')
  })

  it('parses --full-stack / --no-full-stack', () => {
    expect(parseArgs(['--full-stack']).fullStack).toBe(true)
    expect(parseArgs(['--no-full-stack']).fullStack).toBe(false)
  })

  it('splits --extras lists and supports "none"', () => {
    expect(parseArgs(['--extras', 'tailwind,eslint']).extras).toEqual(['tailwind', 'eslint'])
    expect(parseArgs(['--extras=tailwind']).extras).toEqual(['tailwind'])
    expect(parseArgs(['--extras', 'none']).extras).toEqual([])
  })

  it('throws on a value flag without a value', () => {
    expect(() => parseArgs(['--frontend'])).toThrow(/Missing value for --frontend/)
    expect(() => parseArgs(['--frontend', '--yes'])).toThrow(/Missing value for --frontend/)
  })

  it('throws on unknown options', () => {
    expect(() => parseArgs(['--nope'])).toThrow(/Unknown option/)
  })

  it('keeps the positional project name', () => {
    expect(parseArgs(['my-app', '--yes']).projectName).toBe('my-app')
    expect(() => parseArgs(['a', 'b'])).toThrow(/at most one project name/)
  })
})
