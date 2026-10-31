import assert from 'node:assert/strict'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { integrationScenarios } from '../src/support-evidence.js'
import type { AuthenticationSetup } from '../src/types.js'
import { runCommand } from '../src/exec.js'

const COMMAND_TIMEOUT_MS = 15 * 60 * 1000
const AUTHENTICATION_SETUPS = integrationScenarios(
  'php-laravel-livewire-auth',
) as readonly AuthenticationSetup[]

function runRequired(
  label: string,
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const result = runCommand(command, args, cwd, {
    env,
    timeoutMs: COMMAND_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
  })
  if (!result.ok) {
    throw new Error(`${label} failed (exit ${result.exitCode ?? 'unknown'}):\n${result.output.slice(-16_000)}`)
  }
  return result.output
}

function assertSupportedNodeForLivewire(): void {
  const [majorText, minorText] = process.versions.node.split('.')
  const major = Number(majorText)
  const minor = Number(minorText)
  const supported =
    major > 26 ||
    major === 26 ||
    (major === 24 && minor >= 11) ||
    (major === 22 && minor >= 18)
  assert(
    supported,
    `The official Livewire starter's Vite Plus tooling requires Node 22.18+, 24.11+, or 26+; got ${process.version}.`,
  )
}

function isolatedTestEnv(databasePath: string): NodeJS.ProcessEnv {
  const env = { ...process.env }
  for (const key of [
    'DB_URL',
    'DB_CONNECTION',
    'DB_DATABASE',
    'DB_HOST',
    'DB_PORT',
    'DB_USERNAME',
    'DB_PASSWORD',
  ]) {
    delete env[key]
  }
  return {
    ...env,
    APP_ENV: 'testing',
    DB_CONNECTION: 'sqlite',
    DB_DATABASE: databasePath,
    CACHE_STORE: 'array',
    MAIL_MAILER: 'array',
    SESSION_DRIVER: 'array',
  }
}

function routeNames(serverDir: string): Set<string> {
  const output = runRequired('List generated Laravel routes', 'php', ['artisan', 'route:list', '--json'], serverDir)
  const routes = JSON.parse(output) as Array<{ name: string | null }>
  return new Set(routes.flatMap((route) => (route.name ? [route.name] : [])))
}

function generateProject(
  cliPath: string,
  tempRoot: string,
  setup: AuthenticationSetup,
  env: NodeJS.ProcessEnv,
): string {
  const projectName = `livewire-${setup}`
  const skipFrontendInstall = setup === 'none'
  const output = runRequired(
    `Generate Laravel Livewire project with ${setup} auth`,
    'node',
    [
      cliPath,
      '--yes',
      ...(skipFrontendInstall ? ['--skip-install'] : []),
      '--frontend',
      'livewire',
      '--auth',
      setup,
      projectName,
    ],
    tempRoot,
    env,
  )
  if (skipFrontendInstall) {
    assert(!output.includes('Installing Livewire frontend dependencies'), '--skip-install must skip npm setup.')
  } else {
    assert(output.includes('Installing Livewire frontend dependencies'), 'Default setup must install Livewire assets.')
  }

  const projectRoot = join(tempRoot, projectName)
  const serverDir = join(projectRoot, 'server')
  const manifest = JSON.parse(readFileSync(join(projectRoot, '.omnicraft', 'project.json'), 'utf8')) as {
    authentication: string
    modules: string[]
    stack: { architecture: { kind: string; mode?: string }; frontend: string; database: string }
  }
  assert.equal(manifest.authentication, setup)
  assert.deepEqual(manifest.modules, [], 'Authentication must remain separate from manifest.modules.')
  assert.deepEqual(manifest.stack, expectLivewireStack())
  assert(existsSync(join(serverDir, '.env')))
  assert(existsSync(join(serverDir, 'database', 'database.sqlite')))
  assert.equal(
    existsSync(join(serverDir, 'node_modules')),
    !skipFrontendInstall,
    'The generated Livewire dependency state should match the selected install mode.',
  )

  const composer = JSON.parse(readFileSync(join(serverDir, 'composer.json'), 'utf8')) as {
    require: Record<string, string>
    scripts?: Record<string, unknown>
  }
  assert.equal(
    'laravel/fortify' in composer.require,
    setup === 'laravel-native',
    'Only the Laravel native starter should include Fortify.',
  )
  if (setup === 'laravel-native') {
    assert(!existsSync(join(serverDir, 'chisel.php')), 'The official Laravel feature setup did not finish.')
    const postUpdateScripts = composer.scripts?.['post-update-cmd']
    assert(
      !Array.isArray(postUpdateScripts) ||
        !postUpdateScripts.some((script) => String(script).includes('artisan install:features')),
      'The official one-time Laravel feature hook was not removed from Composer scripts.',
    )
    assert(
      !existsSync(join(serverDir, 'app', 'Console', 'Commands', 'InstallFeaturesCommand.php')),
      'The official one-time Laravel feature installer command was not removed.',
    )
  }
  const routes = routeNames(serverDir)
  assert.equal(routes.has('login'), setup === 'laravel-native')
  assert.equal(routes.has('register'), setup === 'laravel-native')

  return projectRoot
}

function assertIncompatibleChoiceRejectsBeforeWrites(cliPath: string, tempRoot: string): void {
  const targetDir = join(tempRoot, 'incompatible-livewire')
  const result = runCommand(
    'node',
    [cliPath, '--yes', '--frontend', 'livewire', '--db', 'postgres', 'incompatible-livewire'],
    tempRoot,
    { timeoutMs: COMMAND_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
  )
  assert(!result.ok, 'The unsupported Laravel Livewire/PostgreSQL combination unexpectedly passed preflight.')
  assert(!existsSync(targetDir), 'The incompatible Laravel Livewire choice wrote project files before rejection.')
}

function expectLivewireStack() {
  return {
    platform: 'web',
    frontend: 'livewire',
    architecture: { kind: 'integrated-laravel', framework: 'laravel', mode: 'livewire' },
    backendRuntime: 'php',
    backendFramework: 'laravel',
    orm: null,
    database: 'sqlite',
    extras: [],
  }
}

function runProjectChecks(projectRoot: string, setup: AuthenticationSetup): void {
  const serverDir = join(projectRoot, 'server')
  const databasePath = join(serverDir, 'database', 'database.sqlite').replaceAll('\\', '/')
  const env = isolatedTestEnv(databasePath)
  const fixtureName =
    setup === 'none' ? 'OmniCraftLivewireNoneAuthTest.php' : 'OmniCraftLivewireNativeAuthTest.php'
  const fixture = fileURLToPath(new URL(`../tests/php/${fixtureName}`, import.meta.url))
  const featureTests = join(serverDir, 'tests', 'Feature')
  mkdirSync(featureTests, { recursive: true })
  copyFileSync(fixture, join(featureTests, fixtureName))

  assert(statSync(join(serverDir, 'database', 'database.sqlite')).size > 0, 'SQLite migrations did not write the database file.')
  runRequired('Verify generated Laravel migrations', 'php', ['artisan', 'migrate:status', '--no-ansi'], serverDir, env)
  if (!existsSync(join(serverDir, 'node_modules'))) {
    runRequired('Install generated Livewire frontend dependencies', 'npm', ['install', '--no-audit', '--no-fund'], serverDir)
  }
  runRequired('Build generated Livewire assets', 'npm', ['run', 'build'], serverDir)
  runRequired('Run generated Livewire auth and SQLite feature tests', 'php', ['artisan', 'test', '--no-ansi'], serverDir, env)
}

function assertOwnedTempDirectory(tempRoot: string): void {
  const tempBase = resolve(tmpdir())
  const absoluteRoot = resolve(tempRoot)
  const relativeRoot = relative(tempBase, absoluteRoot)
  assert(!isAbsolute(relativeRoot) && relativeRoot !== '..' && !relativeRoot.startsWith(`..${sep}`))
  assert(basename(absoluteRoot).startsWith('omnicraft-laravel-livewire-auth-'))
}

function main(): void {
  assertSupportedNodeForLivewire()
  const cliPath = resolve(fileURLToPath(new URL('../dist/index.js', import.meta.url)))
  assert(existsSync(cliPath), 'Build the CLI with `npx tsup` before running Livewire integration checks.')

  const tempRoot = resolve(mkdtempSync(join(tmpdir(), 'omnicraft-laravel-livewire-auth-')))
  assertOwnedTempDirectory(tempRoot)
  let failure: unknown
  try {
    assertIncompatibleChoiceRejectsBeforeWrites(cliPath, tempRoot)
    for (const setup of AUTHENTICATION_SETUPS) {
      console.log(`[laravel-livewire:${setup}] generating through the production CLI`)
      const callerDatabase = join(tempRoot, `caller-${setup}.sqlite`)
      writeFileSync(callerDatabase, '')
      const callerEnv = {
        ...process.env,
        DB_CONNECTION: 'sqlite',
        DB_DATABASE: callerDatabase,
      }
      const projectRoot = generateProject(cliPath, tempRoot, setup, callerEnv)
      assert.equal(
        statSync(callerDatabase).size,
        0,
        'Initial Laravel migrations must not modify the caller-selected database.',
      )
      runProjectChecks(projectRoot, setup)
      console.log(`[laravel-livewire:${setup}] generation, SQLite, assets, and auth checks passed`)
    }
  } catch (error) {
    failure = error
  } finally {
    try {
      assertOwnedTempDirectory(tempRoot)
      rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 })
    } catch (cleanupError) {
      failure = failure
        ? new AggregateError([failure, cleanupError], 'Livewire integration failed and temp cleanup failed.')
        : cleanupError
    }
  }

  if (failure) throw failure
}

main()
