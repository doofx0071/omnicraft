import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:net'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { MySqlContainer, type StartedMySqlContainer } from '@testcontainers/mysql'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { runCommand, startCommand, type StartedCommand } from '../src/exec.js'
import { saveManifest } from '../src/add.js'
import { CLI_VERSION, TEMPLATES_ROOT } from '../src/config.js'
import { buildManifest } from '../src/manifest.js'
import { createEnvFiles } from '../src/scaffold/env.js'
import { applyLayers } from '../src/scaffold/engine.js'
import { composeLayers, templateVariables } from '../src/scaffold/compose.js'
import { NODE_RUNTIME_SCENARIOS, type NodeRuntimeScenario } from '../src/support-evidence.js'
import type { Answers } from '../src/types.js'

const POSTGRES_IMAGE = 'postgres:17.11-alpine3.24'
const MYSQL_IMAGE = 'mysql:8.4.13'
const CHILD_TIMEOUT_MS = 10 * 60 * 1000
const HTTP_TIMEOUT_MS = 15_000
type StartedDatabaseContainer = StartedPostgreSqlContainer | StartedMySqlContainer

function requestedScenarios(argv: string[]): NodeRuntimeScenario[] {
  const options = argv.filter((arg) => arg === '--scenario' || arg.startsWith('--scenario='))
  if (options.length === 0) return [...NODE_RUNTIME_SCENARIOS]
  if (options.length > 1) throw new Error('Pass --scenario only once.')
  const index = argv.indexOf('--scenario')
  const value = index >= 0 ? argv[index + 1] : options[0]?.split('=', 2)[1]
  const scenario = NODE_RUNTIME_SCENARIOS.find((candidate) => candidate.id === value)
  if (!scenario) {
    throw new Error(
      `Unknown scenario "${value ?? ''}". Choose: ${NODE_RUNTIME_SCENARIOS.map(({ id }) => id).join(', ')}.`,
    )
  }
  return [scenario]
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

function makeAnswers(projectRoot: string, scenario: NodeRuntimeScenario): Answers {
  return {
    projectName: `omnicraft-${scenario.id}-test`,
    targetDir: projectRoot,
    projectType: 'web',
    frontend: 'react',
    language: 'typescript',
    fullStack: true,
    backendRuntime: 'node',
    backendFramework: scenario.framework,
    orm: scenario.orm,
    database: scenario.database,
    extras: { tailwind: false, eslintPrettier: false, shadcn: false },
    architecture: { kind: 'separate-frontend-api' },
  }
}

function scaffold(projectRoot: string, scenario: NodeRuntimeScenario): void {
  const answers = makeAnswers(projectRoot, scenario)
  applyLayers(TEMPLATES_ROOT, composeLayers(answers), templateVariables(answers), projectRoot)
  createEnvFiles(projectRoot)
  saveManifest(projectRoot, buildManifest(answers, CLI_VERSION, 'npm'))
}

function makeCredentials(): { database: string; username: string; password: string } {
  const suffix = randomBytes(6).toString('hex')
  return {
    database: `omnicraft_${suffix}`,
    username: `oc_${suffix}`,
    password: `test_${randomBytes(18).toString('hex')}`,
  }
}

async function startDatabase(
  database: Exclude<NodeRuntimeScenario['database'], 'sqlite'>,
  secrets: string[],
): Promise<StartedDatabaseContainer> {
  const credentials = makeCredentials()
  secrets.push(credentials.database, credentials.username, credentials.password)
  if (database === 'postgres') {
    return new PostgreSqlContainer(POSTGRES_IMAGE)
      .withDatabase(credentials.database)
      .withUsername(credentials.username)
      .withPassword(credentials.password)
      .withStartupTimeout(120_000)
      .start()
  }
  return new MySqlContainer(MYSQL_IMAGE)
    .withDatabase(credentials.database)
    .withUsername(credentials.username)
    .withUserPassword(credentials.password)
    .withStartupTimeout(120_000)
    .start()
}

async function ensureDockerAvailable(): Promise<void> {
  const version = process.versions.node.split('.').map(Number)
  if ((version[0] ?? 0) < 22 || ((version[0] ?? 0) === 22 && (version[1] ?? 0) < 22)) {
    throw new Error('PostgreSQL/MySQL integration requires Node.js 22.22 or newer (Testcontainers v12).')
  }
  const result = runCommand('docker', ['info'], process.cwd(), {
    timeoutMs: 15_000,
    maxBuffer: 1_000_000,
  })
  if (!result.ok) throw new Error('Docker Engine/Desktop is required for Node database integration tests.')
}

async function reservePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  assert(address && typeof address === 'object', 'The operating system did not assign an app port.')
  const { port } = address
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
  return port
}

async function jsonResponse(response: Response): Promise<unknown> {
  const body = await response.text()
  try {
    return JSON.parse(body) as unknown
  } catch {
    throw new Error(`Expected JSON from HTTP ${response.status}.`)
  }
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
  return { response, body: await jsonResponse(response) }
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
      // Poll until the app starts or the bounded startup deadline expires.
    }
    await delay(250)
  }
  throw new Error(`Generated API did not become healthy:\n${tail(redact(child.output, secrets))}`)
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} was not an object.`)
  return value as Record<string, unknown>
}

async function verifyCrud(origin: string, scenario: NodeRuntimeScenario): Promise<void> {
  const email = `${scenario.id}-${randomBytes(6).toString('hex')}@example.test`
  const initial = await request(origin, '/api/users')
  assert.equal(initial.response.status, 200)
  assert.deepEqual(initial.body, [])

  const created = await request(origin, '/api/users', {
    method: 'POST',
    body: { name: 'Node Runtime Integration', email },
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

function initializeDatabase(
  scenario: NodeRuntimeScenario,
  projectRoot: string,
  env: NodeJS.ProcessEnv,
  secrets: string[],
  diagnostics: string[],
): void {
  if (scenario.orm === 'prisma') {
    runRequired('Initialize Prisma schema', 'npm', ['run', 'db:push', '--workspace=server'], projectRoot, env, secrets, diagnostics)
  } else if (scenario.orm === 'drizzle') {
    runRequired('Generate Drizzle migrations', 'npm', ['run', 'db:generate', '--workspace=server'], projectRoot, env, secrets, diagnostics, 120_000)
    runRequired('Apply Drizzle migrations', 'npm', ['run', 'db:migrate', '--workspace=server'], projectRoot, env, secrets, diagnostics, 120_000)
  } else {
    runRequired('Apply generated database migrations', 'npm', ['run', 'db:migrate', '--workspace=server'], projectRoot, env, secrets, diagnostics)
  }
}

async function runScenario(scenario: NodeRuntimeScenario): Promise<void> {
  const projectRoot = mkdtempSync(join(tmpdir(), `omnicraft-${scenario.id}-`))
  const diagnostics: string[] = []
  const secrets: string[] = []
  let container: StartedDatabaseContainer | undefined
  let child: StartedCommand | undefined
  let failure: unknown

  try {
    console.log(`[node:${scenario.id}] preparing generated project from production layers`)
    scaffold(projectRoot, scenario)
    const env: NodeJS.ProcessEnv = { NODE_ENV: 'test' }
    if (scenario.database !== 'sqlite') {
      container = await startDatabase(scenario.database, secrets)
      const databaseUrl = container.getConnectionUri()
      secrets.push(databaseUrl)
      env.DATABASE_URL = databaseUrl
    }

    runRequired('Install generated dependencies', 'npm', ['install', '--no-audit', '--no-fund'], projectRoot, env, secrets, diagnostics)
    runRequired('Typecheck generated client', 'npx', ['tsc', '--noEmit', '-p', 'client'], projectRoot, env, secrets, diagnostics, 120_000)
    runRequired('Build generated client', 'npm', ['run', 'build', '--workspace=client'], projectRoot, env, secrets, diagnostics)
    runRequired('Typecheck generated API', 'npx', ['tsc', '--noEmit', '-p', 'server'], projectRoot, env, secrets, diagnostics, 120_000)
    console.log(`[node:${scenario.id}] generated client and API checks completed`)
    console.log(`[node:${scenario.id}] applying ${scenario.orm} database setup`)
    initializeDatabase(scenario, projectRoot, env, secrets, diagnostics)

    const port = await reservePort()
    const origin = `http://127.0.0.1:${port}`
    child = await startCommand('npm', ['run', 'dev', '--workspace=server'], projectRoot, {
      env: isolatedEnvironment({ ...env, PORT: `${port}`, CORS_ORIGIN: origin }),
    })
    await waitForHealth(origin, child, secrets)
    await verifyCrud(origin, scenario)
    assert(
      secrets.every((secret) => !child?.output.includes(secret)),
      'Generated API logs exposed a synthetic database credential.',
    )
    console.log(`[node:${scenario.id}] install, typecheck, migration/setup, boot, CRUD, and failure checks passed`)
  } catch (error) {
    const detail = redact(error instanceof Error ? error.message : String(error), secrets)
    const childOutput = child ? redact(child.output, secrets) : ''
    failure = new Error(
      `[node:${scenario.id}] failed\n${detail}${diagnostics.length ? `\n\n${diagnostics.slice(-4).join('\n\n')}` : ''}${childOutput ? `\n\nGenerated API output:\n${tail(childOutput)}` : ''}`,
      { cause: error },
    )
  } finally {
    try {
      if (child) await child.stop()
    } finally {
      try {
        if (container) await container.stop()
      } finally {
        rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 })
        console.log(`[node:${scenario.id}] isolated project and database resources cleaned`)
      }
    }
  }

  if (failure) throw failure
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const scenarios = requestedScenarios(argv)
  if (scenarios.some((scenario) => scenario.database !== 'sqlite')) await ensureDockerAvailable()
  for (const scenario of scenarios) await runScenario(scenario)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
})
