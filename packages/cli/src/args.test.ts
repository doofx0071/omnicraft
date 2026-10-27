import { describe, expect, it } from 'vitest'
import { HELP_TEXT, parseArgs } from './args.js'
import { readFileSync } from 'node:fs'

describe('parseArgs', () => {
  it('documents the current selectable values and release-tag behavior', () => {
    expect(HELP_TEXT).toContain('--frontend <name>    Skip the frontend prompt (react, nextjs, vue, svelte; Next.js is integrated)')
    expect(HELP_TEXT).toContain('shadcn is web React/Vite-only')
    expect(HELP_TEXT).toContain("this CLI version's release tag")

    const helpOptions = HELP_TEXT.match(/Options:\n([\s\S]*?)\n\nExamples:/)?.[1]
    const readme = readFileSync(
      new URL('../../../README.md', import.meta.url),
      'utf8',
    ).replace(/\r\n/g, '\n')
    const readmeOptions = readme.match(/## Options\n\n```\n[^\n]*\n\n([\s\S]*?)\n```/)?.[1]
    expect(readmeOptions).toBe(helpOptions)
  })

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
