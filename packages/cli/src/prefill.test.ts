import { describe, expect, it } from 'vitest'
import { hasStackFlags, resolveAnswers, validateStackFlags } from './prefill.js'
import { parseArgs } from './args.js'

describe('validateStackFlags', () => {
  it('accepts available choices', () => {
    expect(() => validateStackFlags(parseArgs(['--backend', 'fastify', '--orm=prisma']))).not.toThrow()
    expect(() => validateStackFlags(parseArgs(['--frontend', 'react']))).not.toThrow()
    expect(() => validateStackFlags(parseArgs(['--db', 'sqlite']))).not.toThrow()
  })

  it('rejects unavailable choices with the available list', () => {
    expect(() => validateStackFlags(parseArgs(['--backend', 'nestjs']))).toThrow(
      /Available: express, fastify, hono/,
    )
    expect(() => validateStackFlags(parseArgs(['--db', 'mongodb']))).toThrow(
      /Available: postgres, sqlite, mysql/,
    )
    expect(() => validateStackFlags(parseArgs(['--extras', 'tailwind,prettier']))).toThrow(/Available: tailwind, eslint/)
  })

  it('rejects prisma with a non-postgres database', () => {
    expect(() => validateStackFlags(parseArgs(['--db', 'sqlite', '--orm', 'prisma']))).toThrow(
      /--orm prisma currently supports --db postgres only/,
    )
    expect(() => validateStackFlags(parseArgs(['--db', 'mysql', '--orm', 'prisma']))).toThrow(
      /--orm prisma currently supports --db postgres only/,
    )
    expect(() => validateStackFlags(parseArgs(['--db', 'sqlite', '--orm', 'drizzle']))).not.toThrow()
  })

  it('validates runtime-specific backends and databases', () => {
    expect(() => validateStackFlags(parseArgs(['--runtime', 'python', '--db', 'sqlite']))).not.toThrow()
    expect(() => validateStackFlags(parseArgs(['--runtime', 'php', '--backend', 'laravel']))).not.toThrow()
    expect(() => validateStackFlags(parseArgs(['--runtime', 'python', '--backend', 'express']))).toThrow(
      /Available: fastapi/,
    )
    expect(() => validateStackFlags(parseArgs(['--runtime', 'python', '--db', 'mysql']))).toThrow(
      /Available: postgres, sqlite/,
    )
    expect(() => validateStackFlags(parseArgs(['--runtime', 'php', '--db', 'mysql']))).not.toThrow()
  })

  it('rejects --orm for non-node runtimes', () => {
    expect(() => validateStackFlags(parseArgs(['--runtime', 'python', '--orm', 'drizzle']))).toThrow(
      /--orm applies to Node\.js backends only/,
    )
    expect(() => validateStackFlags(parseArgs(['--runtime', 'php', '--orm', 'drizzle']))).toThrow(
      /--orm applies to Node\.js backends only/,
    )
  })

  it('validates and resolves the language flag', () => {
    expect(() => validateStackFlags(parseArgs(['--lang', 'javascript']))).not.toThrow()
    expect(() => validateStackFlags(parseArgs(['--lang', 'py']))).toThrow(/Available: typescript, javascript/)
    const js = resolveAnswers(parseArgs(['--yes', '--lang', 'javascript', '--no-full-stack']), 'demo', '/tmp/demo')
    expect(js.language).toBe('javascript')
  })

  it.each([
    [['--frontend', 'vue', '--lang', 'javascript'], /JavaScript is only available/],
    [['--frontend', 'nextjs', '--lang', 'javascript'], /JavaScript is only available/],
    [['--platform', 'mobile', '--lang', 'javascript'], /Native Expo and Tauri scaffolds use TypeScript/],
    [['--frontend', 'nextjs', '--orm', 'drizzle'], /Next\.js is integrated full-stack/],
    [['--frontend', 'nextjs', '--runtime', 'node'], /Next\.js is integrated full-stack/],
    [['--frontend', 'nextjs', '--backend', 'express'], /Next\.js is integrated full-stack/],
    [['--frontend', 'nextjs', '--no-full-stack'], /Next\.js is integrated full-stack/],
    [['--frontend', 'nextjs', '--extras', 'none'], /Next\.js always includes Tailwind and ESLint/],
    [['--frontend', 'nextjs', '--extras', 'tailwind'], /Next\.js always includes Tailwind and ESLint/],
    [['--backend', 'hono', '--orm', 'prisma'], /Prisma is not available for Hono/],
    [['--frontend', 'vue', '--extras', 'shadcn'], /shadcn\/ui is only available/],
  ])('rejects incompatible flags: %j', (argv, message) => {
    expect(() => validateStackFlags(parseArgs(argv))).toThrow(message)
  })

  it('accepts the native TypeScript selection', () => {
    expect(() => validateStackFlags(parseArgs(['--platform', 'mobile', '--lang', 'typescript']))).not.toThrow()
    expect(() => validateStackFlags(parseArgs(['--platform', 'mobile', '--extras', 'none']))).not.toThrow()
  })

  it('validates the runtime itself', () => {
    expect(() => validateStackFlags(parseArgs(['--runtime', 'ruby']))).toThrow(
      /Available: node, python, php/,
    )
  })

  it('accepts --orm none with any database', () => {
    expect(() => validateStackFlags(parseArgs(['--orm', 'none', '--db', 'sqlite']))).not.toThrow()
    expect(() => validateStackFlags(parseArgs(['--orm=none', '--db=mysql']))).not.toThrow()
    const answers = resolveAnswers(
      parseArgs(['--yes', '--orm', 'none', '--db', 'sqlite']),
      'demo',
      '/tmp/demo',
    )
    expect(answers.orm).toBe('none')
    expect(answers.database).toBe('sqlite')
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
    expect(answers.extras).toEqual({ tailwind: true, eslintPrettier: true, shadcn: false })
  })

  it('applies flag overrides', () => {
    const answers = resolveAnswers(
      parseArgs(['--yes', '--backend=fastify', '--orm=prisma', '--extras', 'tailwind']),
      base.projectName,
      base.targetDir,
    )
    expect(answers.backendFramework).toBe('fastify')
    expect(answers.orm).toBe('prisma')
    expect(answers.extras).toEqual({ tailwind: true, eslintPrettier: false, shadcn: false })
  })

  it('resolves the database flag', () => {
    const sqlite = resolveAnswers(parseArgs(['--yes', '--db', 'sqlite']), base.projectName, base.targetDir)
    expect(sqlite.database).toBe('sqlite')
    expect(sqlite.orm).toBe('drizzle')
    const mysql = resolveAnswers(parseArgs(['--yes', '--db=mysql']), base.projectName, base.targetDir)
    expect(mysql.database).toBe('mysql')
  })

  it('resolves python and php runtimes', () => {
    const py = resolveAnswers(
      parseArgs(['--yes', '--runtime', 'python', '--db', 'sqlite']),
      base.projectName,
      base.targetDir,
    )
    expect(py.backendRuntime).toBe('python')
    expect(py.backendFramework).toBe('fastapi')
    expect(py.orm).toBeNull()
    expect(py.database).toBe('sqlite')

    const php = resolveAnswers(parseArgs(['--yes', '--runtime', 'php']), base.projectName, base.targetDir)
    expect(php.backendRuntime).toBe('php')
    expect(php.backendFramework).toBe('laravel')
    expect(php.orm).toBeNull()
    expect(php.database).toBe('postgres')
  })

  it('resolves Next.js as integrated raw SQL without a separate backend', () => {
    expect(() => validateStackFlags(parseArgs(['--frontend', 'nextjs', '--extras', 'tailwind,eslint']))).not.toThrow()
    const next = resolveAnswers(
      parseArgs(['--yes', '--frontend', 'nextjs', '--db', 'sqlite']),
      base.projectName,
      base.targetDir,
    )
    expect(next.architecture).toEqual({ kind: 'integrated-fullstack', framework: 'nextjs' })
    expect(next.backendRuntime).toBeNull()
    expect(next.backendFramework).toBeNull()
    expect(next.orm).toBe('none')
    expect(next.database).toBe('sqlite')
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
