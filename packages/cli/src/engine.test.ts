import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { TEMPLATES_ROOT } from './config.js'
import { createEnvFiles } from './scaffold/env.js'
import { applyLayers } from './scaffold/engine.js'
import { composeLayers, templateVariables } from './scaffold/compose.js'
import type { Answers } from './types.js'

function makeAnswers(overrides: Partial<Answers> = {}): Answers {
  return {
    projectName: 'demo-app',
    targetDir: '.',
    projectType: 'web',
    frontend: 'react',
    language: 'typescript',
    fullStack: true,
    backendRuntime: 'node',
    backendFramework: 'express',
    orm: 'drizzle',
    database: 'postgres',
    extras: { tailwind: true, eslintPrettier: true },
    ...overrides,
  }
}

function scaffoldInto(dir: string, answers: Answers): void {
  applyLayers(TEMPLATES_ROOT, composeLayers(answers), templateVariables(answers), dir)
  createEnvFiles(dir)
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8'))
}

const tempDirs: string[] = []
function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), `omnicraft-${prefix}-`))
  tempDirs.push(dir)
  return dir
}

afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
})

describe('full-stack combos', () => {
  const matrix = [
    { framework: 'express', orm: 'drizzle', db: 'postgres' },
    { framework: 'express', orm: 'drizzle', db: 'sqlite' },
    { framework: 'express', orm: 'drizzle', db: 'mysql' },
    { framework: 'express', orm: 'prisma', db: 'postgres' },
    { framework: 'fastify', orm: 'drizzle', db: 'postgres' },
    { framework: 'fastify', orm: 'drizzle', db: 'sqlite' },
    { framework: 'fastify', orm: 'drizzle', db: 'mysql' },
    { framework: 'fastify', orm: 'prisma', db: 'postgres' },
  ] as const

  for (const { framework, orm, db } of matrix) {
    it(`scaffolds ${framework} + ${orm} + ${db}`, () => {
      const dir = makeTempDir(`${framework}-${orm}`)
      scaffoldInto(dir, makeAnswers({ backendFramework: framework, orm, database: db }))

      // Root layer: workspaces manifest, tokens rendered
      const rootPkg = readJson(join(dir, 'package.json'))
      expect(rootPkg.name).toBe('demo-app')
      expect(rootPkg.workspaces).toEqual(['client', 'server'])
      expect(rootPkg.scripts).toHaveProperty('dev')
      expect(existsSync(join(dir, 'docker-compose.yml'))).toBe(db !== 'sqlite')
      expect(existsSync(join(dir, '.gitignore'))).toBe(true)
      if (db !== 'sqlite') {
        expect(readFileSync(join(dir, 'docker-compose.yml'), 'utf8')).toContain('demo_app')
      }

      // Generated projects ship their own CI workflow
      expect(existsSync(join(dir, '.github', 'workflows', 'ci.yml'))).toBe(true)
      const generatedCi = readFileSync(join(dir, '.github', 'workflows', 'ci.yml'), 'utf8')
      expect(generatedCi).toContain('tsc --noEmit -p client')
      expect(readFileSync(join(dir, 'README.md'), 'utf8')).toContain('## Troubleshooting')

      // Client layer
      const clientPkg = readJson(join(dir, 'client', 'package.json'))
      expect(clientPkg.name).toBe('demo-app-client')
      expect(clientPkg.dependencies).toHaveProperty('react')
      expect(readFileSync(join(dir, 'client', 'index.html'), 'utf8')).toContain(
        '<title>demo-app</title>',
      )
      expect(existsSync(join(dir, 'client', 'src', 'lib', 'api.ts'))).toBe(true)

      // Server layer: framework entry + ORM wiring
      const serverPkg = readJson(join(dir, 'server', 'package.json'))
      expect(serverPkg.name).toBe('demo-app-server')
      expect(serverPkg.dependencies).toHaveProperty(framework)
      expect(serverPkg.scripts).toHaveProperty('db:push')
      expect(existsSync(join(dir, 'server', 'src', 'routes', 'users.ts'))).toBe(true)

      if (orm === 'drizzle') {
        expect(existsSync(join(dir, 'server', 'drizzle.config.ts'))).toBe(true)
        expect(existsSync(join(dir, 'server', 'src', 'db', 'schema.ts'))).toBe(true)
        expect(existsSync(join(dir, 'server', 'prisma'))).toBe(false)
        const schema = readFileSync(join(dir, 'server', 'src', 'db', 'schema.ts'), 'utf8')
        if (db === 'sqlite') expect(schema).toContain('sqliteTable')
        else if (db === 'mysql') expect(schema).toContain('mysqlTable')
        else expect(schema).toContain('pgTable')
      } else {
        expect(db).toBe('postgres')
        expect(existsSync(join(dir, 'server', 'prisma', 'schema.prisma'))).toBe(true)
        expect(existsSync(join(dir, 'server', 'prisma.config.ts'))).toBe(true)
        expect(existsSync(join(dir, 'server', 'drizzle.config.ts'))).toBe(false)
      }

      // Env bootstrap: .env created from the (overwritten) .env.example
      const envContent = readFileSync(join(dir, 'server', '.env'), 'utf8')
      if (db === 'sqlite') {
        expect(envContent).toContain('DATABASE_URL=file:./data/app.db')
      } else if (db === 'mysql') {
        expect(envContent).toContain('DATABASE_URL=mysql://omnicraft:omnicraft@localhost:3306/demo_app')
      } else {
        expect(envContent).toContain(
          'DATABASE_URL=postgres://omnicraft:omnicraft@localhost:5432/demo_app',
        )
      }

      // Extras merged into the root manifest
      if (framework === 'express') {
        expect(rootPkg.devDependencies).toHaveProperty('concurrently')
        expect(rootPkg.devDependencies).toHaveProperty('eslint')
        expect(existsSync(join(dir, 'eslint.config.js'))).toBe(true)
        expect(readFileSync(join(dir, 'client', 'src', 'index.css'), 'utf8')).toContain(
          '@import "tailwindcss"',
        )
        expect(readFileSync(join(dir, 'client', 'vite.config.ts'), 'utf8')).toContain('tailwindcss()')
      }

      // README is tokenized
      const readme = readFileSync(join(dir, 'README.md'), 'utf8')
      expect(readme).toContain('# demo-app')
      expect(readme).not.toContain('{{')
    })
  }
})

describe('frontend-only', () => {
  it('scaffolds the client at the project root without server artifacts', () => {
    const dir = makeTempDir('frontend-only')
    scaffoldInto(dir, makeAnswers({ fullStack: false }))

    const pkg = readJson(join(dir, 'package.json'))
    expect(pkg.name).toBe('demo-app')
    expect(pkg.dependencies).toHaveProperty('react')
    expect(existsSync(join(dir, 'src', 'App.tsx'))).toBe(true)
    expect(existsSync(join(dir, 'docker-compose.yml'))).toBe(false)
    expect(existsSync(join(dir, 'client'))).toBe(false)
    expect(existsSync(join(dir, 'server'))).toBe(false)
    expect(existsSync(join(dir, '.gitignore'))).toBe(true)
    expect(existsSync(join(dir, '.github', 'workflows', 'ci.yml'))).toBe(true)
  })
})

describe('layer composition edge cases', () => {
  it('throws MissingLayerError for unknown layers', async () => {
    const dir = makeTempDir('missing-layer')
    const { MissingLayerError } = await import('./scaffold/engine.js')
    expect(() =>
      applyLayers(TEMPLATES_ROOT, [{ src: 'nope/does-not-exist', dest: '.' }], {}, dir),
    ).toThrow(MissingLayerError)
  })

  it('does not leak tokens into any generated file', () => {
    const dir = makeTempDir('tokens')
    scaffoldInto(dir, makeAnswers())
    for (const file of readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
      const path = join(dir, String(file))
      try {
        const content = readFileSync(path, 'utf8')
        expect(content).not.toContain('{{projectName}}')
        expect(content).not.toContain('{{clientPackageName}}')
        expect(content).not.toContain('{{serverPackageName}}')
        expect(content).not.toContain('{{databaseName}}')
      } catch {
        // non-utf8 file — skip
      }
    }
  })
})
