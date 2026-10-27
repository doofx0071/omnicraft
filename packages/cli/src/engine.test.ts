import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { TEMPLATES_ROOT } from './config.js'
import { createEnvFiles } from './scaffold/env.js'
import { applyLayers } from './scaffold/engine.js'
import { composeLayers, planLayerApplication, templateVariables } from './scaffold/compose.js'
import type { Answers } from './types.js'

function makeAnswers(overrides: Partial<Answers> = {}): Answers {
  const fullStack = overrides.fullStack ?? true
  return {
    projectName: 'demo-app',
    targetDir: '.',
    projectType: 'web',
    frontend: 'react',
    language: 'typescript',
    fullStack,
    backendRuntime: fullStack ? 'node' : null,
    backendFramework: fullStack ? 'express' : null,
    orm: fullStack ? 'drizzle' : null,
    database: fullStack ? 'postgres' : null,
    extras: { tailwind: true, eslintPrettier: true, shadcn: false },
    architecture: fullStack ? { kind: 'separate-frontend-api' } : { kind: 'frontend-only' },
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

describe('official-generator layer order', () => {
  it('applies every Next.js layer after create-next-app and skips Composer', () => {
    const answers = makeAnswers({
      frontend: 'nextjs',
      backendRuntime: null,
      backendFramework: null,
      orm: 'none',
      database: 'sqlite',
      architecture: { kind: 'integrated-fullstack', framework: 'nextjs' },
    })
    const layers = composeLayers(answers)
    const plan = planLayerApplication(layers, answers.architecture)

    expect(plan.afterOfficialGenerator).toEqual(layers)
    expect(plan.afterOfficialGenerator.map(({ src }) => src)).toContain('web/nextjs/db-sqlite')
    expect(plan.afterOfficialGenerator.map(({ src }) => src)).toContain('root/fullstack-next/sqlite')
    expect(plan.beforeComposer).toEqual([])
    expect(plan.afterComposer).toEqual([])
  })

  it('applies the Laravel overlay after Composer and the other layers before it', () => {
    const answers = makeAnswers({
      backendRuntime: 'php',
      backendFramework: 'laravel',
      orm: null,
      database: 'sqlite',
    })
    const layers = composeLayers(answers)
    const plan = planLayerApplication(layers, answers.architecture)

    expect(plan.afterOfficialGenerator).toEqual([])
    expect(plan.beforeComposer.map(({ src }) => src)).toContain('web/react/client')
    expect(plan.beforeComposer.map(({ src }) => src)).toContain('root/fullstack-php/sqlite')
    expect(plan.afterComposer.map(({ src }) => src)).toEqual(['server/php/laravel'])
  })
})

describe('composition compatibility', () => {
  it.each([
    [{ frontend: 'vue', language: 'javascript' }, /JavaScript is only available/],
    [{ backendFramework: 'hono', orm: 'prisma' }, /prisma is not available for hono/i],
    [{ frontend: 'vue', extras: { tailwind: true, eslintPrettier: true, shadcn: true } }, /shadcn\/ui is only available/],
    [{ frontend: 'nextjs', backendRuntime: null, backendFramework: null, orm: 'drizzle', architecture: { kind: 'integrated-fullstack', framework: 'nextjs' } }, /Next\.js must use the integrated full-stack architecture/],
    [{ frontend: 'nextjs', backendRuntime: null, backendFramework: null, orm: 'none', database: 'mongodb', architecture: { kind: 'integrated-fullstack', framework: 'nextjs' } }, /Next\.js must use the integrated full-stack architecture/],
    [{ frontend: 'nextjs', backendRuntime: null, backendFramework: null, orm: 'none', extras: { tailwind: false, eslintPrettier: true, shadcn: false }, architecture: { kind: 'integrated-fullstack', framework: 'nextjs' } }, /Next\.js must use the integrated full-stack architecture/],
  ] as const)('rejects incompatible answers before returning layers', (overrides, message) => {
    expect(() => composeLayers(makeAnswers(overrides))).toThrow(message)
  })
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
      const dir = makeTempDir(`${framework}-${orm}-${db}`)
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
        expect(existsSync(join(dir, 'server', 'data'))).toBe(true)
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


describe('python + php runtimes', () => {
  it('scaffolds fastapi + sqlite', () => {
    const dir = makeTempDir('fastapi-sqlite')
    scaffoldInto(
      dir,
      makeAnswers({ backendRuntime: 'python', backendFramework: 'fastapi', orm: null, database: 'sqlite' }),
    )

    // python root variant
    expect((readJson(join(dir, 'package.json')).scripts as Record<string, string>)['dev:server']).toContain('uvicorn')
    expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toContain('server/.venv/')
    expect(existsSync(join(dir, 'docker-compose.yml'))).toBe(false)

    // server layer: fastapi base + sqlalchemy adapter, no npm manifest
    expect(existsSync(join(dir, 'server', 'pyproject.toml'))).toBe(true)
    expect(existsSync(join(dir, 'server', 'app', 'main.py'))).toBe(true)
    expect(existsSync(join(dir, 'server', 'app', 'database.py'))).toBe(true)
    expect(existsSync(join(dir, 'server', 'alembic.ini'))).toBe(true)
    expect(existsSync(join(dir, 'server', 'package.json'))).toBe(false)
    expect(readFileSync(join(dir, 'server', '.env'), 'utf8')).toContain('DATABASE_URL=sqlite+aiosqlite:///data/app.db')
    expect(readFileSync(join(dir, 'server', 'pyproject.toml'), 'utf8')).toContain('aiosqlite')
  })

  it('scaffolds fastapi + postgres', () => {
    const dir = makeTempDir('fastapi-postgres')
    scaffoldInto(
      dir,
      makeAnswers({ backendRuntime: 'python', backendFramework: 'fastapi', orm: null, database: 'postgres' }),
    )
    expect(existsSync(join(dir, 'docker-compose.yml'))).toBe(true)
    expect(readFileSync(join(dir, 'server', '.env'), 'utf8')).toContain(
      'DATABASE_URL=postgresql+asyncpg://omnicraft:omnicraft@localhost:5432/demo_app',
    )
    expect(readFileSync(join(dir, 'server', 'pyproject.toml'), 'utf8')).toContain('asyncpg')
  })

  it('scaffolds the laravel overlay (composer base is created at scaffold time)', () => {
    const dir = makeTempDir('laravel-sqlite')
    scaffoldInto(
      dir,
      makeAnswers({ backendRuntime: 'php', backendFramework: 'laravel', orm: null, database: 'sqlite' }),
    )

    // overlay files, destined for the composer-created skeleton
    expect(existsSync(join(dir, 'server', 'routes', 'api.php'))).toBe(true)
    expect(existsSync(join(dir, 'server', 'bootstrap', 'app.php'))).toBe(true)
    expect(existsSync(join(dir, 'server', 'app', 'Http', 'Controllers', 'UserController.php'))).toBe(true)
    expect(readFileSync(join(dir, 'server', '.env.example'), 'utf8')).toContain('DB_CONNECTION=sqlite')

    // php root variant
    expect((readJson(join(dir, 'package.json')).scripts as Record<string, string>)['dev:server']).toContain('artisan serve')
    expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toContain('server/vendor/')
  })
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

describe('safety: protected paths and collisions', () => {
  it('never overwrites an existing user .env', () => {
    const dir = makeTempDir('protected-env')
    mkdirSync(join(dir, 'server'), { recursive: true })
    writeFileSync(join(dir, 'server', '.env'), 'DATABASE_URL=postgres://user-secret@localhost/keepme')
    scaffoldInto(dir, makeAnswers())
    const env = readFileSync(join(dir, 'server', '.env'), 'utf8')
    expect(env).toBe('DATABASE_URL=postgres://user-secret@localhost/keepme')
    // while .env.example still ships
    expect(existsSync(join(dir, 'server', '.env.example'))).toBe(true)
  })

  it('never overwrites an existing .git directory', () => {
    const dir = makeTempDir('protected-git')
    mkdirSync(join(dir, '.git'), { recursive: true })
    writeFileSync(join(dir, '.git', 'HEAD'), 'ref: refs/heads/main')
    scaffoldInto(dir, makeAnswers({ fullStack: false }))
    expect(readFileSync(join(dir, '.git', 'HEAD'), 'utf8')).toBe('ref: refs/heads/main')
    expect(existsSync(join(dir, 'src', 'App.tsx'))).toBe(true)
  })

  it('renders no unresolved tokens in env files', () => {
    const dir = makeTempDir('env-tokens')
    scaffoldInto(dir, makeAnswers({ orm: 'prisma' }))
    const env = readFileSync(join(dir, 'server', '.env'), 'utf8')
    expect(env).toContain('5432/demo_app')
    expect(env).not.toContain('{{')
  })
})
describe('shadcn extra layer', () => {
  it('pre-provisions alias config and the shadcn App', () => {
    const dir = makeTempDir('shadcn-layer')
    scaffoldInto(dir, makeAnswers({ extras: { tailwind: true, eslintPrettier: true, shadcn: true } }))

    // alias config (no baseUrl — deprecated in TS 5.9)
    const tsconfig = readJson(join(dir, 'client', 'tsconfig.json')) as { compilerOptions: { paths: unknown; baseUrl?: unknown } }
    expect(tsconfig.compilerOptions.paths).toEqual({ '@/*': ['./src/*'] })
    expect(tsconfig.compilerOptions.baseUrl).toBeUndefined()

    // vite alias + types/node dep for path resolution (quote style may be
    // normalized by prettier — assert the alias path, not the quotes)
    expect(readFileSync(join(dir, 'client', 'vite.config.ts'), 'utf8')).toMatch(/alias/i)
    expect(readFileSync(join(dir, 'client', 'vite.config.ts'), 'utf8')).toContain('./src')
    expect(readJson(join(dir, 'client', 'package.json')).devDependencies).toHaveProperty('@types/node')

    // shadcn-based App imports via the alias; token lives in a JS string (TSX-safe)
    const app = readFileSync(join(dir, 'client', 'src', 'App.tsx'), 'utf8')
    expect(app).toContain('@/components/ui/button')
    expect(app).toContain('const APP_TITLE = "demo-app"')
    expect(app).not.toContain('{{projectName}}')
  })
})
describe('frontend expansion (v0.4)', () => {
  it('scaffolds a vue client with the vue tailwind variant', () => {
    const dir = makeTempDir('vue-client')
    scaffoldInto(dir, makeAnswers({ frontend: 'vue', fullStack: false }))
    expect(readJson(join(dir, 'package.json')).dependencies).toHaveProperty('vue')
    expect(existsSync(join(dir, 'src', 'App.vue'))).toBe(true)
    expect(readFileSync(join(dir, 'vite.config.ts'), 'utf8')).toContain('@vitejs/plugin-vue')
  })

  it('scaffolds a svelte client with the svelte tailwind variant', () => {
    const dir = makeTempDir('svelte-client')
    scaffoldInto(dir, makeAnswers({ frontend: 'svelte', fullStack: false }))
    expect(readJson(join(dir, 'package.json')).dependencies).toHaveProperty('svelte')
    expect(existsSync(join(dir, 'src', 'App.svelte'))).toBe(true)
    expect(readFileSync(join(dir, 'vite.config.ts'), 'utf8')).toContain('@sveltejs/vite-plugin-svelte')
  })

  it('scaffolds the next overlay + sqlite db layer for integrated fullstack', () => {
    const dir = makeTempDir('next-overlay')

    // Simulate the create-next-app skeleton: the real flow generates the app
    // BEFORE the overlay applies — the root manifest must exist so the db
    // layer's fragment merges into it (applyLayers inline: scaffoldInto would
    // wipe the simulated skeleton).
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'demo-app', dependencies: { next: '16.4.3' } }))

    const nextAnswers = makeAnswers({
      frontend: 'nextjs',
      backendRuntime: null,
      backendFramework: null,
      orm: 'none',
      database: 'sqlite',
      extras: { tailwind: true, eslintPrettier: true, shadcn: false },
      architecture: { kind: 'integrated-fullstack', framework: 'nextjs' },
    })
    nextAnswers.targetDir = dir
    const layerPlan = planLayerApplication(composeLayers(nextAnswers), nextAnswers.architecture)
    expect(layerPlan.afterOfficialGenerator.length).toBeGreaterThan(0)
    expect(layerPlan.beforeComposer).toEqual([])
    expect(layerPlan.afterComposer).toEqual([])
    applyLayers(TEMPLATES_ROOT, layerPlan.afterOfficialGenerator, templateVariables(nextAnswers), dir)
    createEnvFiles(dir)

    // overlay: route handlers + users page (create-next-app generates the rest)
    expect(existsSync(join(dir, 'app', 'api', 'users', 'route.ts'))).toBe(true)
    expect(existsSync(join(dir, 'app', 'api', 'users', '[id]', 'route.ts'))).toBe(true)
    expect(existsSync(join(dir, 'app', 'users', 'page.tsx'))).toBe(true)

    // db layer at app/db with the driver dep merged into the ROOT manifest
    expect(existsSync(join(dir, 'app', 'db', 'index.ts'))).toBe(true)
    expect(existsSync(join(dir, 'app', 'db', 'migrations', '001_create_users.sql'))).toBe(true)
    expect(readJson(join(dir, 'package.json')).dependencies).toHaveProperty('better-sqlite3')

    // no vite artifacts (cna wires tailwind via turbopack)
    expect(existsSync(join(dir, 'vite.config.ts'))).toBe(false)
    expect(existsSync(join(dir, 'docker-compose.yml'))).toBe(false) // sqlite
  })

  it('scaffolds the next postgres variant with compose file', () => {
    const dir = makeTempDir('next-pg')
    scaffoldInto(
      dir,
      makeAnswers({
        frontend: 'nextjs',
        backendRuntime: null,
        backendFramework: null,
        orm: 'none',
        database: 'postgres',
        extras: { tailwind: true, eslintPrettier: true, shadcn: false },
        architecture: { kind: 'integrated-fullstack', framework: 'nextjs' },
      }),
    )
    expect(existsSync(join(dir, 'docker-compose.yml'))).toBe(true)
    expect(readFileSync(join(dir, '.env'), 'utf8')).toContain(
      'DATABASE_URL=postgres://omnicraft:omnicraft@localhost:5432/demo_app',
    )
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
