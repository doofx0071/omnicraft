import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:net'
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { runCommand, startCommand, type StartedCommand } from '../src/exec.js'
import { CLI_VERSION, TEMPLATES_ROOT } from '../src/config.js'
import { buildManifest } from '../src/manifest.js'
import { createEnvFiles } from '../src/scaffold/env.js'
import { applyLayers } from '../src/scaffold/engine.js'
import { composeLayers, templateVariables } from '../src/scaffold/compose.js'
import { loadManifest, saveManifest } from '../src/add.js'
import type { Answers, Database } from '../src/types.js'

const DATABASES = ['postgres', 'mysql'] as const satisfies readonly Extract<Database, 'postgres' | 'mysql'>[]
const CHILD_TIMEOUT_MS = 10 * 60 * 1000
const HTTP_TIMEOUT_MS = 15_000
const CLI_ROOT = process.cwd()
type DockerDatabase = (typeof DATABASES)[number]

function requestedDatabase(argv: string[]): DockerDatabase {
  const options = argv.filter((arg) => arg === '--database' || arg.startsWith('--database='))
  if (options.length > 1) throw new Error('Pass --database only once.')
  const index = argv.indexOf('--database')
  const value = index >= 0 ? argv[index + 1] : options[0]?.split('=', 2)[1]
  if (!value) throw new Error(`Pass --database ${DATABASES.join('|')}.`)
  if (!DATABASES.includes(value as DockerDatabase)) {
    throw new Error(`Unknown database "${value}". Choose: ${DATABASES.join(', ')}.`)
  }
  return value as DockerDatabase
}

function secretsFor(databaseName: string, databaseUrl: string): string[] {
  return [databaseName, 'omnicraft-root', databaseUrl]
}

function isolatedEnvironment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env = { ...process.env }
  for (const key of [
    'DATABASE_URL',
    'PORT',
    'CORS_ORIGIN',
    'PGHOST',
    'PGPORT',
    'PGUSER',
    'PGPASSWORD',
    'PGDATABASE',
    'MYSQL_HOST',
    'MYSQL_TCP_PORT',
    'MYSQL_USER',
    'MYSQL_PASSWORD',
    'MYSQL_DATABASE',
  ]) {
    delete env[key]
  }
  return { ...env, ...overrides }
}

function redact(value: string, secrets: string[]): string {
  return secrets.reduce(
    (result, secret) => (secret.length < 5 ? result : result.replaceAll(secret, '[REDACTED]')),
    value,
  )
}

function tail(value: string, length = 12_000): string {
  return value.length > length ? value.slice(-length) : value
}

function runRequired(
  label: string,
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  secrets: string[],
  diagnostics: string[],
  timeoutMs = CHILD_TIMEOUT_MS,
): string {
  console.log(`[integration] ${label}`)
  const result = runCommand(command, args, cwd, {
    env: isolatedEnvironment(env),
    timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
  })
  console.log(`[integration] command completed: ${label} (exit ${result.exitCode ?? 'unknown'})`)
  const output = redact(result.output, secrets)
  diagnostics.push(`${label}:\n${tail(output)}`)
  if (!result.ok) {
    throw new Error(`${label} failed (exit ${result.exitCode ?? 'unknown'}):\n${tail(output)}`)
  }
  return output
}

function makeAnswers(projectRoot: string, database: DockerDatabase): Answers {
  const suffix = randomBytes(4).toString('hex')
  const projectName = `omnicraft-docker-${database}-${suffix}`
  return {
    projectName,
    targetDir: projectRoot,
    projectType: 'web',
    frontend: 'react',
    language: 'typescript',
    fullStack: true,
    backendRuntime: 'node',
    backendFramework: 'express',
    orm: 'drizzle',
    database,
    extras: { tailwind: false, eslintPrettier: false, shadcn: false },
    architecture: { kind: 'separate-frontend-api' },
  }
}

function scaffold(projectRoot: string, database: DockerDatabase): Answers {
  const answers = makeAnswers(projectRoot, database)
  applyLayers(TEMPLATES_ROOT, composeLayers(answers), templateVariables(answers), projectRoot)
  createEnvFiles(projectRoot)
  saveManifest(projectRoot, buildManifest(answers, CLI_VERSION, 'npm'))
  return answers
}

async function ensureDockerAvailable(): Promise<void> {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const result = runCommand('docker', ['info'], CLI_ROOT, {
      timeoutMs: 10_000,
      maxBuffer: 1_000_000,
    })
    if (result.ok) return
    if (attempt < 5) await delay(2_000)
  }
  throw new Error('Docker Engine did not become ready after five bounded checks.')
}

function invokeAddDocker(projectRoot: string, secrets: string[]): ReturnType<typeof runCommand> {
  const result = runCommand('npx', ['tsx', 'src/index.ts', 'add', 'docker', projectRoot], CLI_ROOT, {
    env: isolatedEnvironment({ CI: '1' }),
    timeoutMs: 120_000,
    maxBuffer: 4 * 1024 * 1024,
  })
  return { ...result, output: redact(result.output, secrets) }
}

async function reservePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  assert(address && typeof address === 'object', 'The operating system did not assign an API port.')
  const { port } = address
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
  return port
}

async function canBindPort(port: number): Promise<boolean> {
  const server = createServer()
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, '127.0.0.1', resolve)
    })
    return true
  } catch (error) {
    if (['EADDRINUSE', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')) return false
    throw error
  } finally {
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    }
  }
}

async function waitForHealth(origin: string, child: StartedCommand, secrets: string[]): Promise<void> {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    const exited = await Promise.race([child.exited, delay(0).then(() => null)])
    if (exited) {
      throw new Error(`Generated API exited before health check:\n${tail(redact(exited.output, secrets))}`)
    }
    try {
      const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1_000) })
      if (response.ok) return
    } catch {
      // Poll until the API starts or the bounded startup deadline expires.
    }
    await delay(250)
  }
  throw new Error(`Generated API did not become healthy:\n${tail(redact(child.output, secrets))}`)
}

async function request(
  origin: string,
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<{ response: Response; body: unknown }> {
  const response = await fetch(`${origin}${path}`, {
    method: options.method ?? 'GET',
    headers: options.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  })
  const text = await response.text()
  let body: unknown
  try {
    body = JSON.parse(text) as unknown
  } catch {
    throw new Error(`Expected JSON from HTTP ${response.status}.`)
  }
  return { response, body }
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} was not an object.`)
  return value as Record<string, unknown>
}

async function verifyCrud(origin: string, scenario: DockerDatabase): Promise<void> {
  const email = `docker-${scenario}-${randomBytes(6).toString('hex')}@example.test`
  const initial = await request(origin, '/api/users')
  assert.equal(initial.response.status, 200)
  assert.deepEqual(initial.body, [])

  const created = await request(origin, '/api/users', {
    method: 'POST',
    body: { name: 'Docker Module Integration', email },
  })
  assert.equal(created.response.status, 201, `Valid user creation failed: ${JSON.stringify(created.body)}`)
  const user = assertRecord(created.body, 'Created user')
  assert.equal(user.email, email)
  const id = Number(user.id)
  assert(Number.isInteger(id) && id > 0, 'The API did not return a persisted user id.')

  const listed = await request(origin, '/api/users')
  assert(
    Array.isArray(listed.body) && listed.body.some((item) => assertRecord(item, 'Listed user').email === email),
    'The created database row was not returned by the list endpoint.',
  )

  const duplicate = await request(origin, '/api/users', {
    method: 'POST',
    body: { name: 'Duplicate User', email },
  })
  assert.equal(duplicate.response.status, 409, 'Duplicate email should return HTTP 409.')

  const invalid = await request(origin, '/api/users', {
    method: 'POST',
    body: { name: '', email: 'not-an-email' },
  })
  assert.equal(invalid.response.status, 400, 'Invalid input should return HTTP 400.')

  const deleted = await request(origin, `/api/users/${id}`, { method: 'DELETE' })
  assert.equal(deleted.response.status, 200)
  const missing = await request(origin, `/api/users/${id}`, { method: 'DELETE' })
  assert.equal(missing.response.status, 404, 'Deleting a missing row should return HTTP 404.')
}

async function runScenario(database: DockerDatabase): Promise<void> {
  const projectRoot = mkdtempSync(join(tmpdir(), `omnicraft-add-docker-${database}-`))
  const diagnostics: string[] = []
  let answers: Answers | undefined
  let child: StartedCommand | undefined
  let composeConfigured = false
  let failure: unknown
  const secrets: string[] = []

  try {
    console.log(`[docker:${database}] composing exact Express + Drizzle project from production layers`)
    answers = scaffold(projectRoot, database)
    const projectDatabaseName = answers.projectName.replace(/-/g, '_')
    const composeFile = join(projectRoot, 'docker-compose.yml')
    assert(existsSync(composeFile), 'The production PostgreSQL/MySQL layers should provide Compose output.')
    const defaultCompose = readFileSync(composeFile, 'utf8')
    const manifestBeforeConflict = readFileSync(join(projectRoot, '.omnicraft', 'project.json'), 'utf8')

    const conflict = invokeAddDocker(projectRoot, secrets)
    assert.equal(conflict.ok, false, 'Adding docker to the generated database project should reject its existing Compose file.')
    assert(conflict.output.includes('Refusing to overwrite existing file(s): docker-compose.yml'))
    assert.equal(readFileSync(composeFile, 'utf8'), defaultCompose, 'The conflicting Compose file must remain unchanged.')
    assert.equal(
      readFileSync(join(projectRoot, '.omnicraft', 'project.json'), 'utf8'),
      manifestBeforeConflict,
      'A rejected module add must not change the project manifest.',
    )

    unlinkSync(composeFile)
    const added = invokeAddDocker(projectRoot, secrets)
    assert(added.ok, `The generated-project add command failed:\n${tail(added.output)}`)
    assert(added.output.includes('docker compose up -d'), `Expected Docker module next steps:\n${tail(added.output)}`)
    assert.deepEqual(loadManifest(projectRoot).modules, ['docker'])
    composeConfigured = existsSync(composeFile)
    assert(composeConfigured, 'The docker module did not create docker-compose.yml.')

    const moduleCompose = readFileSync(composeFile, 'utf8')
    const expectedImage = database === 'postgres' ? 'postgres:16-alpine' : 'mysql:8'
    const internalPort = database === 'postgres' ? 5432 : 3306
    const defaultPortMapping = `- "${internalPort}:${internalPort}"`
    assert(moduleCompose.includes(`image: ${expectedImage}`), 'The module Compose image did not match the selected database.')
    assert(moduleCompose.includes(defaultPortMapping), 'The Compose output did not include the expected database port.')
    assert(!moduleCompose.includes('{{databaseName}}'), 'The module Compose output retained a template token.')
    assert(moduleCompose.includes(projectDatabaseName), 'The Compose output did not render the project database name.')

    const manifestAfterAdd = readFileSync(join(projectRoot, '.omnicraft', 'project.json'), 'utf8')
    const idempotent = invokeAddDocker(projectRoot, secrets)
    assert(idempotent.ok, `The repeated docker add failed:\n${tail(idempotent.output)}`)
    assert(idempotent.output.includes('already installed'), `Expected idempotent add warning:\n${tail(idempotent.output)}`)
    assert.equal(readFileSync(composeFile, 'utf8'), moduleCompose, 'The repeated add changed the Compose file.')
    assert.equal(readFileSync(join(projectRoot, '.omnicraft', 'project.json'), 'utf8'), manifestAfterAdd)

    const hostPort = await canBindPort(internalPort) ? internalPort : await reservePort()
    if (hostPort !== internalPort) {
      writeFileSync(composeFile, moduleCompose.replace(defaultPortMapping, `- "${hostPort}:${internalPort}"`))
      console.log(`[docker:${database}] using available host port ${hostPort}; the module default port ${internalPort} is occupied`)
    }
    const databaseUrl = database === 'postgres'
      ? `postgresql://omnicraft:omnicraft@127.0.0.1:${hostPort}/${projectDatabaseName}`
      : `mysql://omnicraft:omnicraft@127.0.0.1:${hostPort}/${projectDatabaseName}`
    secrets.push(...secretsFor(projectDatabaseName, databaseUrl))
    const env: NodeJS.ProcessEnv = { CI: '1', NODE_ENV: 'test', DATABASE_URL: databaseUrl }

    const composeProject = answers.projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    runRequired('Validate added Compose output', 'docker', ['compose', 'config', '--quiet'], projectRoot, env, secrets, diagnostics)
    runRequired(
      'Start the added Compose database and wait for its healthcheck',
      'docker',
      ['compose', '--project-name', composeProject, 'up', '--detach', '--wait'],
      projectRoot,
      env,
      secrets,
      diagnostics,
      180_000,
    )

    runRequired('Install generated dependencies', 'npm', ['install', '--no-audit', '--no-fund'], projectRoot, env, secrets, diagnostics)
    runRequired('Typecheck generated client', 'npx', ['tsc', '--noEmit', '-p', 'client'], projectRoot, env, secrets, diagnostics, 120_000)
    runRequired('Build generated client', 'npm', ['run', 'build', '--workspace=client'], projectRoot, env, secrets, diagnostics)
    runRequired('Typecheck generated API', 'npx', ['tsc', '--noEmit', '-p', 'server'], projectRoot, env, secrets, diagnostics, 120_000)
    runRequired('Generate Drizzle migrations', 'npm', ['run', 'db:generate', '--workspace=server'], projectRoot, env, secrets, diagnostics, 120_000)
    runRequired('Apply Drizzle migrations to added Compose database', 'npm', ['run', 'db:migrate', '--workspace=server'], projectRoot, env, secrets, diagnostics, 120_000)

    const port = await reservePort()
    const origin = `http://127.0.0.1:${port}`
    child = await startCommand('npm', ['run', 'dev', '--workspace=server'], projectRoot, {
      env: isolatedEnvironment({ ...env, PORT: `${port}`, CORS_ORIGIN: origin }),
    })
    await waitForHealth(origin, child, secrets)
    await verifyCrud(origin, database)
    assert(secrets.every((secret) => !child?.output.includes(secret)), 'Generated API logs exposed a database name or URL.')
    assert(
      !/(?:postgres(?:ql)?|mysql):\/\/omnicraft:omnicraft@/i.test(child.output) &&
        !/password\s*[=:]\s*omnicraft(?:-root)?\b/i.test(child.output),
      'Generated API logs exposed a synthetic Compose database credential.',
    )
    console.log(`[docker:${database}] compatibility conflict, successful add, idempotency, Compose startup, migration, CRUD, and failure checks passed`)
  } catch (error) {
    const detail = redact(error instanceof Error ? error.message : String(error), secrets)
    const childOutput = child ? redact(child.output, secrets) : ''
    failure = new Error(
      `[docker:${database}] failed\n${detail}${diagnostics.length ? `\n\n${diagnostics.slice(-5).join('\n\n')}` : ''}${childOutput ? `\n\nGenerated API output:\n${tail(childOutput)}` : ''}`,
      { cause: error },
    )
  } finally {
    try {
      if (child) await child.stop()
    } finally {
      try {
        if (composeConfigured) {
          const projectName = answers?.projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')
          if (projectName) {
            const cleanup = runCommand('docker', ['compose', '--project-name', projectName, 'down', '--volumes', '--remove-orphans'], projectRoot, {
              env: isolatedEnvironment({ CI: '1' }),
              timeoutMs: 120_000,
              maxBuffer: 4 * 1024 * 1024,
            })
            if (!cleanup.ok) {
              const detail = redact(cleanup.output, secrets)
              failure = failure
                ? new AggregateError([failure, new Error(`Compose cleanup failed:\n${tail(detail)}`)])
                : new Error(`Compose cleanup failed:\n${tail(detail)}`)
            }
          }
        }
      } finally {
        rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 })
        console.log(`[docker:${database}] isolated project and Compose resources cleaned`)
      }
    }
  }

  if (failure) throw failure
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const database = requestedDatabase(argv)
  await ensureDockerAvailable()
  await runScenario(database)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
})
