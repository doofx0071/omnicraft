import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ProjectManifest } from './manifest.js'

vi.mock('@clack/prompts', () => ({
  log: { error: vi.fn(), message: vi.fn(), warn: vi.fn() },
  note: vi.fn(),
  select: vi.fn(),
  spinner: () => ({ start: vi.fn(), stop: vi.fn() }),
}))

import { applyModuleToProject, runAdd } from './add-run.js'
import { loadManifest, saveManifest } from './add.js'

let tempRoot = ''

function manifest(frontend = 'react', architecture: ProjectManifest['stack']['architecture'] = { kind: 'separate-frontend-api' }): ProjectManifest {
  return {
    schema: 1,
    cliVersion: '1.0.1',
    createdAt: '2026-10-28T00:00:00.000Z',
    projectName: 'demo-app',
    stack: {
      platform: 'web',
      frontend,
      architecture,
      backendRuntime: architecture.kind === 'separate-frontend-api' ? 'node' : null,
      backendFramework: architecture.kind === 'separate-frontend-api' ? 'express' : null,
      orm: architecture.kind === 'separate-frontend-api' ? 'drizzle' : null,
      database: architecture.kind === 'separate-frontend-api' ? 'sqlite' : null,
      extras: [],
    },
    modules: [],
    packageManager: 'npm',
  }
}

function write(path: string, content: string): void {
  const absolute = join(tempRoot, path)
  mkdirSync(join(absolute, '..'), { recursive: true })
  writeFileSync(absolute, content)
}

function createAuthProject(): void {
  write('package.json', JSON.stringify({ name: 'demo-app', dependencies: { express: '^5.0.0' } }, null, 2))
  write('server/src/index.ts', 'import { apiRouter } from "./routes/index.js";\napp.use(express.json());\n')
  write(
    'server/src/routes/index.ts',
    'import { usersRouter } from "./users.js";\napiRouter.use("/users", usersRouter);\n',
  )
  write('server/drizzle.config.ts', 'schema: "./src/db/schema.ts",\n')
  saveManifest(tempRoot, manifest())
}

function filesUnder(path: string): string[] {
  const absolute = join(tempRoot, path)
  if (!existsSync(absolute)) return []
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = join(path, entry.name).replaceAll('\\', '/')
    return entry.isDirectory() ? filesUnder(relative) : [relative]
  })
}

function directoriesUnder(path: string): string[] {
  const absolute = join(tempRoot, path)
  if (!existsSync(absolute)) return []
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return []
    const relative = join(path, entry.name).replaceAll('\\', '/')
    return [relative, ...directoriesUnder(relative)]
  })
}

function resetExitCode(): void {
  process.exitCode = 0
}

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), 'omnicraft-add-test-'))
  resetExitCode()
})

afterEach(() => {
  resetExitCode()
  rmSync(tempRoot, { recursive: true, force: true, maxRetries: 5 })
})

describe('omnicraft add', () => {
  it('dry-run reports the auth changes without writing them', async () => {
    createAuthProject()
    const before = filesUnder('.')
    const manifestBefore = readFileSync(join(tempRoot, '.omnicraft/project.json'), 'utf8')

    await runAdd('auth', tempRoot, true)

    expect(filesUnder('.')).toEqual(before)
    expect(readFileSync(join(tempRoot, '.omnicraft/project.json'), 'utf8')).toBe(manifestBefore)
    expect(existsSync(join(tempRoot, 'server/src/auth.ts'))).toBe(false)
  })

  it('applies auth files and patches, merges dependencies, and records the module', async () => {
    createAuthProject()

    await runAdd('auth', tempRoot, false)

    expect(loadManifest(tempRoot).modules).toEqual(['auth'])
    expect(loadManifest(tempRoot).authentication).toBe('better-auth')
    expect(readFileSync(join(tempRoot, 'server/src/index.ts'), 'utf8')).toContain('toNodeHandler(auth)')
    expect(readFileSync(join(tempRoot, 'server/src/routes/index.ts'), 'utf8')).toContain('meRouter')
    expect(readFileSync(join(tempRoot, 'server/drizzle.config.ts'), 'utf8')).toContain('auth-schema.ts')
    expect(existsSync(join(tempRoot, 'server/src/auth.ts'))).toBe(true)
    const packageJson = JSON.parse(readFileSync(join(tempRoot, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>
    }
    expect(packageJson.dependencies.express).toBe('^5.0.0')
    expect(packageJson.dependencies['better-auth']).toBe('^1.7.14')
    expect(filesUnder('.').every((path) => !readFileSync(join(tempRoot, path), 'utf8').includes('test-only-secret'))).toBe(true)
  })

  it('applies creation-time auth without recording it as an added module', async () => {
    createAuthProject()

    const result = applyModuleToProject('auth', tempRoot, { recordModule: false })

    expect(result.status).toBe('applied')
    expect(loadManifest(tempRoot).authentication).toBe('better-auth')
    expect(loadManifest(tempRoot).modules).toEqual([])
    expect(existsSync(join(tempRoot, 'server/src/auth.ts'))).toBe(true)

    const before = filesUnder('.').map((path) => [path, readFileSync(join(tempRoot, path), 'utf8')])
    await runAdd('auth', tempRoot, false)
    expect(filesUnder('.').map((path) => [path, readFileSync(join(tempRoot, path), 'utf8')])).toEqual(before)
    expect(loadManifest(tempRoot).modules).toEqual([])
  })

  it('is idempotent and leaves the second invocation unchanged', async () => {
    createAuthProject()
    await runAdd('auth', tempRoot, false)
    const before = filesUnder('.').map((path) => [path, readFileSync(join(tempRoot, path), 'utf8')])

    await runAdd('auth', tempRoot, false)

    expect(filesUnder('.').map((path) => [path, readFileSync(join(tempRoot, path), 'utf8')])).toEqual(before)
    expect(loadManifest(tempRoot).modules).toEqual(['auth'])
  })

  it('rejects a generated-file collision before changing patches or the manifest', async () => {
    createAuthProject()
    write('server/src/auth.ts', 'user-owned\n')
    const indexBefore = readFileSync(join(tempRoot, 'server/src/index.ts'), 'utf8')
    const manifestBefore = readFileSync(join(tempRoot, '.omnicraft/project.json'), 'utf8')

    await runAdd('auth', tempRoot, false)

    expect(readFileSync(join(tempRoot, 'server/src/auth.ts'), 'utf8')).toBe('user-owned\n')
    expect(readFileSync(join(tempRoot, 'server/src/index.ts'), 'utf8')).toBe(indexBefore)
    expect(readFileSync(join(tempRoot, '.omnicraft/project.json'), 'utf8')).toBe(manifestBefore)
    expect(process.exitCode).toBe(1)
  })

  it('rejects missing patch anchors before any file or manifest writes', async () => {
    createAuthProject()
    write('server/src/index.ts', 'export const unrelated = true;\n')
    const manifestBefore = readFileSync(join(tempRoot, '.omnicraft/project.json'), 'utf8')
    const packageBefore = readFileSync(join(tempRoot, 'package.json'), 'utf8')

    await runAdd('auth', tempRoot, false)

    expect(filesUnder('server/src')).toEqual(['server/src/index.ts', 'server/src/routes/index.ts'])
    expect(readFileSync(join(tempRoot, 'package.json'), 'utf8')).toBe(packageBefore)
    expect(readFileSync(join(tempRoot, '.omnicraft/project.json'), 'utf8')).toBe(manifestBefore)
    expect(process.exitCode).toBe(1)
  })

  it('rejects an unsupported auth stack before any file or manifest writes', async () => {
    createAuthProject()
    const projectManifest = loadManifest(tempRoot)
    projectManifest.stack.frontend = 'vue'
    saveManifest(tempRoot, projectManifest)
    const manifestBefore = readFileSync(join(tempRoot, '.omnicraft/project.json'), 'utf8')
    const indexBefore = readFileSync(join(tempRoot, 'server/src/index.ts'), 'utf8')

    await runAdd('auth', tempRoot, false)

    expect(existsSync(join(tempRoot, 'server/src/auth.ts'))).toBe(false)
    expect(readFileSync(join(tempRoot, 'server/src/index.ts'), 'utf8')).toBe(indexBefore)
    expect(readFileSync(join(tempRoot, '.omnicraft/project.json'), 'utf8')).toBe(manifestBefore)
    expect(process.exitCode).toBe(1)
  })

  it('keeps omnicraft add auth unavailable on the Laravel-native Livewire stack', async () => {
    const projectManifest = manifest('livewire', {
      kind: 'integrated-laravel',
      framework: 'laravel',
      mode: 'livewire',
    })
    projectManifest.stack.backendRuntime = 'php'
    projectManifest.stack.backendFramework = 'laravel'
    projectManifest.stack.orm = null
    projectManifest.stack.database = 'sqlite'
    projectManifest.authentication = 'laravel-native'
    saveManifest(tempRoot, projectManifest)
    write('package.json', JSON.stringify({ name: 'demo-app', private: true }, null, 2))
    write('server/routes/web.php', "<?php\n// User Laravel routes.\n")
    const pathsBefore = filesUnder('.')
    const manifestBefore = readFileSync(join(tempRoot, '.omnicraft/project.json'), 'utf8')
    const routesBefore = readFileSync(join(tempRoot, 'server/routes/web.php'), 'utf8')

    await runAdd('auth', tempRoot, false)

    expect(filesUnder('.')).toEqual(pathsBefore)
    expect(readFileSync(join(tempRoot, '.omnicraft/project.json'), 'utf8')).toBe(manifestBefore)
    expect(readFileSync(join(tempRoot, 'server/routes/web.php'), 'utf8')).toBe(routesBefore)
    expect(existsSync(join(tempRoot, 'server/src/auth.ts'))).toBe(false)
    expect(process.exitCode).toBe(1)
  })

  it('rolls back files and manifest when a filesystem write fails mid-apply', async () => {
    createAuthProject()
    write('client', 'blocks the auth client directory\n')
    const paths = filesUnder('.')
    const directories = directoriesUnder('.')
    const before = new Map(paths.map((path) => [path, readFileSync(join(tempRoot, path), 'utf8')]))

    await expect(runAdd('auth', tempRoot, false)).rejects.toThrow()

    expect(filesUnder('.')).toEqual(paths)
    expect(directoriesUnder('.')).toEqual(directories)
    for (const [path, content] of before) expect(readFileSync(join(tempRoot, path), 'utf8')).toBe(content)
    expect(loadManifest(tempRoot).modules).toEqual([])
  })

  it('adds the testing module to the selected frontend-only target', async () => {
    saveManifest(tempRoot, manifest('react', { kind: 'frontend-only' }))
    write('package.json', JSON.stringify({ name: 'demo-app' }, null, 2))

    await runAdd('testing', tempRoot, false)

    expect(existsSync(join(tempRoot, 'src/App.test.tsx'))).toBe(true)
    expect(existsSync(join(tempRoot, 'src/setupTests.ts'))).toBe(true)
    expect(loadManifest(tempRoot).modules).toEqual(['testing'])
    expect(readFileSync(join(tempRoot, 'vitest.config.ts'), 'utf8')).toContain(
      'setupFiles: ["./src/setupTests.ts"]',
    )
    expect(readFileSync(join(tempRoot, 'src/App.test.tsx'), 'utf8')).toContain(
      'screen.getByRole("heading", { name: "⚡ demo-app" })',
    )
    const packageJson = JSON.parse(readFileSync(join(tempRoot, 'package.json'), 'utf8')) as {
      devDependencies: Record<string, string>
      scripts: Record<string, string>
    }
    expect(packageJson.devDependencies.vitest).toBe('^3.0.0')
    expect(packageJson.scripts.test).toBe('vitest run')
  })

  it('rejects the Docker module on SQLite before writing files', async () => {
    saveManifest(tempRoot, manifest())
    write('package.json', JSON.stringify({ name: 'demo-app' }, null, 2))
    const manifestBefore = readFileSync(join(tempRoot, '.omnicraft/project.json'), 'utf8')

    await runAdd('docker', tempRoot, false)

    expect(process.exitCode).toBe(1)
    expect(existsSync(join(tempRoot, 'docker-compose.yml'))).toBe(false)
    expect(readFileSync(join(tempRoot, '.omnicraft/project.json'), 'utf8')).toBe(manifestBefore)
  })

  it('rejects the Docker module on integrated Next.js before writing files', async () => {
    const projectManifest = manifest('nextjs', { kind: 'integrated-fullstack', framework: 'nextjs' })
    projectManifest.stack.database = 'postgres'
    projectManifest.stack.orm = 'none'
    saveManifest(tempRoot, projectManifest)
    write('package.json', JSON.stringify({ name: 'demo-app' }, null, 2))
    const manifestBefore = readFileSync(join(tempRoot, '.omnicraft/project.json'), 'utf8')

    await runAdd('docker', tempRoot, false)

    expect(process.exitCode).toBe(1)
    expect(existsSync(join(tempRoot, 'docker-compose.yml'))).toBe(false)
    expect(readFileSync(join(tempRoot, '.omnicraft/project.json'), 'utf8')).toBe(manifestBefore)
  })
})
