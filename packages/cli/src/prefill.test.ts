import { describe, expect, it } from 'vitest'
import { hasStackFlags, resolveAnswers, validateStackFlags } from './prefill.js'
import { parseArgs } from './args.js'

describe('validateStackFlags', () => {
  it('accepts available choices', () => {
    expect(() => validateStackFlags(parseArgs(['--backend', 'fastify', '--orm=prisma']))).not.toThrow()
    expect(() => validateStackFlags(parseArgs(['--frontend', 'react']))).not.toThrow()
  })

  it('rejects unavailable choices with the available list', () => {
    expect(() => validateStackFlags(parseArgs(['--backend', 'hono']))).toThrow(/Available: express, fastify/)
    expect(() => validateStackFlags(parseArgs(['--orm=mongoose']))).toThrow(/Available: drizzle, prisma/)
    expect(() => validateStackFlags(parseArgs(['--extras', 'tailwind,prettier']))).toThrow(/Available: tailwind, eslint/)
  })
})

describe('resolveAnswers', () => {
  const base = { projectName: 'demo', targetDir: '/tmp/demo' }

  it('uses interactive-flow defaults under --yes', () => {
    const answers = resolveAnswers(parseArgs(['--yes']), base.projectName, base.targetDir)
    expect(answers.fullStack).toBe(true)
    expect(answers.frontend).toBe('react')
    expect(answers.backendFramework).toBe('express')
    expect(answers.orm).toBe('drizzle')
    expect(answers.database).toBe('postgres')
    expect(answers.extras).toEqual({ tailwind: true, eslintPrettier: true })
  })

  it('applies flag overrides', () => {
    const answers = resolveAnswers(
      parseArgs(['--yes', '--backend=fastify', '--orm=prisma', '--extras', 'tailwind']),
      base.projectName,
      base.targetDir,
    )
    expect(answers.backendFramework).toBe('fastify')
    expect(answers.orm).toBe('prisma')
    expect(answers.extras).toEqual({ tailwind: true, eslintPrettier: false })
  })

  it('frontend-only clears backend fields', () => {
    const answers = resolveAnswers(parseArgs(['--yes', '--no-full-stack']), base.projectName, base.targetDir)
    expect(answers.fullStack).toBe(false)
    expect(answers.backendFramework).toBeNull()
    expect(answers.orm).toBeNull()
    expect(answers.database).toBeNull()
    expect(answers.backendRuntime).toBeNull()
  })
})

describe('hasStackFlags', () => {
  it('detects any stack flag', () => {
    expect(hasStackFlags(parseArgs(['--yes']))).toBe(false)
    expect(hasStackFlags(parseArgs(['--no-full-stack']))).toBe(true)
    expect(hasStackFlags(parseArgs(['--orm', 'drizzle']))).toBe(true)
    expect(hasStackFlags(parseArgs(['--extras', 'none']))).toBe(true)
  })
})
