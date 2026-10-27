import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { copyFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCommand } from '../src/exec.js'
import { saveManifest } from '../src/add.js'
import { CLI_VERSION, TEMPLATES_ROOT } from '../src/config.js'
import { buildManifest } from '../src/manifest.js'
import { createEnvFiles } from '../src/scaffold/env.js'
import { applyLayers } from '../src/scaffold/engine.js'
import { composeLayers, isPostComposerLayer, templateVariables } from '../src/scaffold/compose.js'
import type { Answers, Database } from '../src/types.js'

const COMPOSE_TIMEOUT_MS = 15 * 60 * 1000
const DATABASES = ['postgres', 'mysql'] as const
type TestDatabase = (typeof DATABASES)[number]

function isolatedEnvironment(overrides: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = { ...process.env }
  for (const key of [
    'DATABASE_URL',
    'DB_CONNECTION',
    'DB_HOST',
    'DB_PORT',
    'DB_DATABASE',
    'DB_USERNAME',
    'DB_PASSWORD',
    'MYSQL_HOST',
    'MYSQL_TCP_PORT',
    'MYSQL_USER',
    'MYSQL_PASSWORD',
    'MYSQL_DATABASE',
    'PGHOST',
    'PGPORT',
    'PGUSER',
    'PGPASSWORD',
    'PGDATABASE',
  ]) {
    delete env[key]
  }
  return { ...env, ...overrides }
}

function redact(value: string, secrets: string[]): string {
  return secrets.reduce((result, secret) => {
    if (secret.length < 5) return result
    return result.replaceAll(secret, '[REDACTED]')
  }, value)
}

function runRequired(
  label: string,
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  secrets: string[],
  diagnostics: string[],
  timeoutMs = COMPOSE_TIMEOUT_MS,
): string {
  const result = runCommand(command, args, cwd, { env, timeoutMs, maxBuffer: 32 * 1024 * 1024 })
  for (const secret of secrets) {
    if (secret.length >= 5)
      assert(!result.output.includes(secret), `${label} exposed a test credential.`)
  }
  const output = redact(result.output, secrets)
  diagnostics.push(`${label}:\n${output.slice(-12_000)}`)
  if (!result.ok) {
    throw new Error(
      `${label} failed (exit ${result.exitCode ?? 'unknown'}):\n${output.slice(-12_000)}`,
    )
  }
  return result.output
}

function makeAnswers(projectRoot: string, database: TestDatabase): Answers {
  return {
    projectName: `omnicraft-laravel-${database}`,
    targetDir: projectRoot,
    projectType: 'web',
    frontend: 'react',
    language: 'typescript',
    fullStack: true,
    backendRuntime: 'php',
    backendFramework: 'laravel',
    orm: null,
    database: database as Database,
    extras: { tailwind: false, eslintPrettier: false, shadcn: false },
    architecture: { kind: 'separate-frontend-api' },
  }
}

function scaffoldBeforeComposer(
  projectRoot: string,
  database: TestDatabase,
): {
  answers: Answers
  postComposerLayers: ReturnType<typeof composeLayers>
} {
  const answers = makeAnswers(projectRoot, database)
  const layers = composeLayers(answers)
  applyLayers(
    TEMPLATES_ROOT,
    layers.filter((layer) => !isPostComposerLayer(layer)),
    templateVariables(answers),
    projectRoot,
  )
  createEnvFiles(projectRoot)
  saveManifest(projectRoot, buildManifest(answers, CLI_VERSION, 'npm'))
  return { answers, postComposerLayers: layers.filter(isPostComposerLayer) }
}

function phpServiceEnv(
  projectRoot: string,
  database: TestDatabase,
  databaseName: string,
  username: string,
  password: string,
  rootPassword: string,
): NodeJS.ProcessEnv {
  const uid = process.getuid?.() ?? 1000
  const gid = process.getgid?.() ?? 1000
  return isolatedEnvironment({
    OMNICRAFT_TEST_PROJECT_DIR: projectRoot.replaceAll('\\', '/'),
    OMNICRAFT_TEST_UID: `${uid}`,
    OMNICRAFT_TEST_GID: `${gid}`,
    OMNICRAFT_EXPECTED_DB_DRIVER: database === 'postgres' ? 'pgsql' : 'mysql',
    OMNICRAFT_DB_CONNECTION: database === 'postgres' ? 'pgsql' : 'mysql',
    OMNICRAFT_DB_HOST: database,
    OMNICRAFT_DB_PORT: database === 'postgres' ? '5432' : '3306',
    OMNICRAFT_DB_DATABASE: databaseName,
    OMNICRAFT_DB_USERNAME: username,
    OMNICRAFT_DB_PASSWORD: password,
    OMNICRAFT_DB_ROOT_PASSWORD: rootPassword,
  })
}

function composeArgs(projectName: string, database: TestDatabase, args: string[]): string[] {
  return [
    'compose',
    '--project-name',
    projectName,
    '--file',
    'compose.yaml',
    '--profile',
    database,
    ...args,
  ]
}

function makeProjectName(database: TestDatabase): string {
  return `omnicraft-php-${database}-${randomBytes(6).toString('hex')}`
}

function makeDatabaseCredentials(): {
  databaseName: string
  username: string
  password: string
  rootPassword: string
} {
  const suffix = randomBytes(6).toString('hex')
  return {
    databaseName: `omnicraft_${suffix}`,
    username: `oc_${suffix}`,
    password: `test_${randomBytes(18).toString('hex')}`,
    rootPassword: `root_${randomBytes(18).toString('hex')}`,
  }
}

function composeWorkingDirectory(): string {
  return fileURLToPath(new URL('../tests/infra/php/', import.meta.url))
}

async function ensureDockerAvailable(cwd: string): Promise<void> {
  const result = runCommand('docker', ['info'], cwd, { timeoutMs: 15_000, maxBuffer: 1_000_000 })
  if (!result.ok)
    throw new Error(
      'Docker Engine/Desktop with the Compose plugin is required for Laravel integration tests.',
    )
  const compose = runCommand('docker', ['compose', 'version'], cwd, {
    timeoutMs: 15_000,
    maxBuffer: 1_000_000,
  })
  if (!compose.ok) throw new Error('Docker Compose v2 is required for Laravel integration tests.')
}

async function runDatabaseCase(database: TestDatabase, composeDir: string): Promise<void> {
  const projectRoot = mkdtempSync(join(tmpdir(), `omnicraft-laravel-${database}-`))
  const projectName = makeProjectName(database)
  const credentials = makeDatabaseCredentials()
  const secrets = [
    credentials.databaseName,
    credentials.username,
    credentials.password,
    credentials.rootPassword,
  ]
  const env = phpServiceEnv(
    projectRoot,
    database,
    credentials.databaseName,
    credentials.username,
    credentials.password,
    credentials.rootPassword,
  )
  const diagnostics: string[] = []
  let failure: unknown

  const run = (label: string, args: string[], timeoutMs = COMPOSE_TIMEOUT_MS) =>
    runRequired(
      label,
      'docker',
      composeArgs(projectName, database, args),
      composeDir,
      env,
      secrets,
      diagnostics,
      timeoutMs,
    )
  const runPhp = (label: string, command: string[], timeoutMs = COMPOSE_TIMEOUT_MS) =>
    run(
      label,
      ['run', '--rm', '--no-deps', '--workdir', '/workspace/server', 'php-test', ...command],
      timeoutMs,
    )

  try {
    console.log(`[laravel:${database}] preparing generated project and isolated Compose project`)
    const { answers, postComposerLayers } = scaffoldBeforeComposer(projectRoot, database)
    assert(postComposerLayers.length > 0, 'The Laravel post-Composer overlay was not selected.')

    run('Build PHP and Composer test image', ['build', 'php-test'], 10 * 60 * 1000)
    run(
      'Start isolated database',
      ['up', '-d', '--wait', '--wait-timeout', '180', database],
      4 * 60 * 1000,
    )
    run('Create Laravel 12 application', [
      'run',
      '--rm',
      '--no-deps',
      'php-test',
      'composer',
      'create-project',
      process.platform === 'win32' ? '"laravel/laravel:^12.0"' : 'laravel/laravel:^12.0',
      'server',
      '--no-interaction',
      '--prefer-dist',
      '--no-progress',
    ])

    applyLayers(TEMPLATES_ROOT, postComposerLayers, templateVariables(answers), projectRoot)
    copyFileSync(join(projectRoot, 'server', '.env.example'), join(projectRoot, 'server', '.env'))
    const fixture = fileURLToPath(
      new URL('../tests/php/OmniCraftDatabaseApiTest.php', import.meta.url),
    )
    const featureTestDir = join(projectRoot, 'server', 'tests', 'Feature')
    mkdirSync(featureTestDir, { recursive: true })
    copyFileSync(fixture, join(featureTestDir, 'OmniCraftDatabaseApiTest.php'))

    runPhp('Generate Laravel application key', ['php', 'artisan', 'key:generate', '--force'])
    runPhp('Install Composer dependencies', [
      'composer',
      'install',
      '--no-interaction',
      '--prefer-dist',
      '--no-progress',
    ])
    runPhp('Check PHP platform extensions', ['composer', 'check-platform-reqs'])
    runPhp('Apply Laravel migrations', ['php', 'artisan', 'migrate', '--force'])
    runPhp('Run Laravel database and API feature tests', ['php', 'artisan', 'test', '--no-ansi'])
    console.log(
      `[laravel:${database}] Composer platform checks, migrations, and API operations passed`,
    )
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    failure = new Error(
      `[laravel:${database}] failed\n${redact(detail, secrets)}${diagnostics.length ? `\n\n${diagnostics.slice(-4).join('\n\n')}` : ''}`,
      {
        cause: error,
      },
    )
  } finally {
    try {
      run(
        'Remove Compose project and database volumes',
        ['down', '--volumes', '--remove-orphans', '--timeout', '10'],
        60_000,
      )
    } catch (error) {
      const cleanup = new Error(
        `Compose cleanup failed for ${projectName}: ${error instanceof Error ? error.message : String(error)}`,
      )
      failure = failure
        ? new AggregateError(
            [failure, cleanup],
            'Laravel test failed and Compose cleanup also failed.',
          )
        : cleanup
    } finally {
      try {
        rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 })
      } catch (error) {
        const cleanup = new Error(
          `Generated Laravel project cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        )
        failure = failure
          ? new AggregateError(
              [failure, cleanup],
              'Laravel test failed and generated-project cleanup also failed.',
            )
          : cleanup
      }
    }
  }

  if (failure) throw failure
  console.log(`[laravel:${database}] cleanup passed`)
}

async function main(): Promise<void> {
  const composeDir = composeWorkingDirectory()
  await ensureDockerAvailable(composeDir)
  for (const database of DATABASES) await runDatabaseCase(database, composeDir)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
  console.error(message)
  process.exitCode = 1
})
