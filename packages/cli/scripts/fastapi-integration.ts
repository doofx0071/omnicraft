import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:net'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { runCommand, startCommand, type StartedCommand } from '../src/exec.js'
import { ensureDockerAvailable as ensureDockerEngineAvailable } from './lib/dwait.js'
import { saveManifest } from '../src/add.js'
import { CLI_VERSION, TEMPLATES_ROOT } from '../src/config.js'
import { buildManifest } from '../src/manifest.js'
import { createEnvFiles } from '../src/scaffold/env.js'
import { applyLayers } from '../src/scaffold/engine.js'
import { composeLayers, templateVariables } from '../src/scaffold/compose.js'
import { integrationScenarios } from '../src/support-evidence.js'
import type { Answers } from '../src/types.js'

const CHILD_TIMEOUT_MS = 10 * 60 * 1000
const HTTP_TIMEOUT_MS = 15_000
const POSTGRES_IMAGE = 'postgres:17.11-alpine3.24'
type TestDatabase = 'sqlite' | 'postgres'
const DATABASES = integrationScenarios('python-fastapi') as readonly TestDatabase[]

function requestedDatabases(argv: string[]): TestDatabase[] {
  const options = argv.filter((arg) => arg === '--database' || arg.startsWith('--database='))
  if (options.length === 0) return [...DATABASES]
  if (options.length > 1) throw new Error('Pass --database only once.')
  const index = argv.indexOf('--database')
  const value = index >= 0 ? argv[index + 1] : options[0]?.split('=', 2)[1]
  if (!value || !DATABASES.includes(value as TestDatabase)) {
    throw new Error(`Unknown database "${value ?? ''}". Choose: ${DATABASES.join(', ')}.`)
  }
  return [value as TestDatabase]
}

function isolatedEnvironment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env = { ...process.env }
  for (const key of ['DATABASE_URL', 'CORS_ORIGIN', 'PORT', 'PYTHONPATH', 'VIRTUAL_ENV']) {
    delete env[key]
  }
  return { ...env, ...overrides }
}

function tail(value: string, length = 12_000): string {
  return value.length > length ? value.slice(-length) : value
}

function redact(value: string, secrets: string[]): string {
  return secrets.reduce(
    (result, secret) => (secret.length < 5 ? result : result.replaceAll(secret, '[REDACTED]')),
    value,
  )
}

function runRequired(
  label: string,
  command: string,
  args: string[],
  cwd: string,
  diagnostics: string[],
  timeoutMs = CHILD_TIMEOUT_MS,
  envOverrides: NodeJS.ProcessEnv = {},
  secrets: string[] = [],
): string {
  console.log(`[integration] ${label}`)
  const result = runCommand(command, args, cwd, {
    env: isolatedEnvironment(envOverrides),
    timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
  })
  const output = redact(result.output, secrets)
  diagnostics.push(`${label}:\n${tail(output)}`)
  if (!result.ok) {
    throw new Error(`${label} failed (exit ${result.exitCode ?? 'unknown'}):\n${tail(output)}`)
  }
  return output
}

function makeAnswers(projectRoot: string, database: TestDatabase): Answers {
  return {
    projectName: `omnicraft-fastapi-${database}-test`,
    targetDir: projectRoot,
    projectType: 'web',
    frontend: 'react',
    language: 'typescript',
    fullStack: true,
    backendRuntime: 'python',
    backendFramework: 'fastapi',
    orm: null,
    database,
    authentication: 'none',
    extras: { tailwind: false, eslintPrettier: false, shadcn: false },
    architecture: { kind: 'separate-frontend-api' },
  }
}

function scaffold(projectRoot: string, database: TestDatabase): void {
  const answers = makeAnswers(projectRoot, database)
  applyLayers(TEMPLATES_ROOT, composeLayers(answers), templateVariables(answers), projectRoot)
  createEnvFiles(projectRoot)
  saveManifest(projectRoot, buildManifest(answers, CLI_VERSION, 'npm'))
}

async function startPostgres(secrets: string[]): Promise<StartedPostgreSqlContainer> {
  const suffix = randomBytes(6).toString('hex')
  const database = `omnicraft_${suffix}`
  const username = `oc_${suffix}`
  const password = `test_${randomBytes(18).toString('hex')}`
  secrets.push(database, username, password)
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withDatabase(database)
    .withUsername(username)
    .withPassword(password)
    .withStartupTimeout(120_000)
    .start()
  return container
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
      throw new Error(
        `Generated FastAPI app exited before health check:\n${tail(redact(exited.output, secrets))}`,
      )
    }
    try {
      const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1_000) })
      if (response.ok) return
    } catch {
      // Poll until the app starts or the bounded startup deadline expires.
    }
    await delay(250)
  }
  throw new Error(
    `Generated FastAPI app did not become healthy:\n${tail(redact(child.output, secrets))}`,
  )
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} was not an object.`)
  return value as Record<string, unknown>
}

async function verifySecurityHeaders(origin: string): Promise<void> {
  const health = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) })
  assert.equal(health.status, 200, 'The health endpoint should answer before the rate limit engages.')
  for (const header of ['x-content-type-options', 'x-frame-options']) {
    assert(
      (health.headers.get(header) ?? '').length > 0,
      `The generated API must send the ${header} security header on /api/health.`,
    )
  }
}

// The boot environment sets RATE_LIMIT_* low, so a bounded burst must hit
// the shared 429 contract. Runs last in verifyCrud — the limiter keeps
// rejecting afterwards.
async function verifyRateLimit(origin: string): Promise<void> {
  let limited = false
  for (let attempt = 0; attempt < 30 && !limited; attempt += 1) {
    const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) })
    if (response.status === 429) {
      limited = true
      assert.equal(
        response.headers.get('content-type')?.split(';')[0],
        'application/json',
        'The 429 response should be JSON.',
      )
      assert.deepEqual(await response.json(), { error: 'Too many requests' })
      const retryAfter = Number(response.headers.get('retry-after'))
      assert(
        Number.isFinite(retryAfter) && retryAfter >= 0,
        'The 429 response must include a numeric Retry-After header.',
      )
      break
    }
    assert.equal(response.status, 200, 'Unexpected response while exercising the rate limit.')
  }
  assert(
    limited,
    'The generated API never returned 429 within 30 /api/health requests — check the RATE_LIMIT_* wiring.',
  )
}

async function verifyCrud(origin: string, database: TestDatabase): Promise<void> {
  await verifySecurityHeaders(origin)

  for (const path of ['/api', '/api/__unknown']) {
    const missingRoute = await request(origin, path)
    assert.equal(missingRoute.response.status, 404, `Unknown API route ${path} should return HTTP 404.`)
    assert.equal(
      missingRoute.response.headers.get('content-type')?.split(';')[0],
      'application/json',
      `Unknown API route ${path} should return JSON.`,
    )
    assert.deepEqual(missingRoute.body, { error: 'Not found' })
  }

  const outsideApiResponse = await fetch(`${origin}/apix`, {
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  })
  assert.equal(outsideApiResponse.status, 404, 'Unknown non-API route /apix should return HTTP 404.')
  assert.notEqual(
    await outsideApiResponse.text(),
    JSON.stringify({ error: 'Not found' }),
    '/apix must not match the API fallback.',
  )

  const email = `${database}-${randomBytes(6).toString('hex')}@example.com`
  const initial = await request(origin, '/api/users')
  assert.equal(initial.response.status, 200)
  assert.deepEqual(initial.body, [])

  const created = await request(origin, '/api/users', {
    method: 'POST',
    body: { name: 'FastAPI Integration', email },
  })
  assert.equal(created.response.status, 201, `Valid user creation failed: ${JSON.stringify(created.body)}`)
  const user = assertRecord(created.body, 'Created user')
  assert.equal(user.email, email)
  const id = Number(user.id)
  assert(Number.isInteger(id) && id > 0, 'The API did not return a persisted user id.')

  const listed = await request(origin, '/api/users')
  assert(
    Array.isArray(listed.body) &&
      listed.body.some((item) => assertRecord(item, 'Listed user').email === email),
    `The created ${database} user was not returned by the list endpoint.`,
  )

  const duplicate = await request(origin, '/api/users', {
    method: 'POST',
    body: { name: 'Duplicate User', email },
  })
  assert.equal(duplicate.response.status, 409)

  const invalid = await request(origin, '/api/users', {
    method: 'POST',
    body: { name: '', email: 'not-an-email' },
  })
  assert.equal(invalid.response.status, 422)

  const deleted = await request(origin, `/api/users/${id}`, { method: 'DELETE' })
  assert.equal(deleted.response.status, 200)
  const missing = await request(origin, `/api/users/${id}`, { method: 'DELETE' })
  assert.equal(missing.response.status, 404)

  await verifyRateLimit(origin)
}

async function ensureDockerAvailable(): Promise<void> {
  await ensureDockerEngineAvailable('the FastAPI PostgreSQL integration tests')
}

async function runDatabaseCase(database: TestDatabase): Promise<void> {
  const projectRoot = mkdtempSync(join(tmpdir(), `omnicraft-fastapi-${database}-`))
  const serverDir = join(projectRoot, 'server')
  const diagnostics: string[] = []
  const secrets: string[] = []
  let container: StartedPostgreSqlContainer | undefined
  let child: StartedCommand | undefined
  let failure: unknown

  try {
    console.log(`[fastapi:${database}] preparing generated project`)
    scaffold(projectRoot, database)
    const envOverrides: NodeJS.ProcessEnv = {}
    if (database === 'postgres') {
      container = await startPostgres(secrets)
      const rawUrl = container.getConnectionUri()
      const databaseUrl = rawUrl.replace(/^postgres(?:ql)?:\/\//, 'postgresql+asyncpg://')
      secrets.push(rawUrl, databaseUrl)
      envOverrides.DATABASE_URL = databaseUrl
    }

    runRequired(
      'Install generated Python dependencies',
      'uv',
      ['sync', '--no-progress', '--python', '3.12'],
      serverDir,
      diagnostics,
      CHILD_TIMEOUT_MS,
      envOverrides,
      secrets,
    )
    runRequired(
      'Apply generated Alembic migrations',
      'uv',
      ['run', 'alembic', 'upgrade', 'head'],
      serverDir,
      diagnostics,
      CHILD_TIMEOUT_MS,
      envOverrides,
      secrets,
    )

    const port = await reservePort()
    const origin = `http://127.0.0.1:${port}`
    child = await startCommand(
      'uv',
      ['run', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', `${port}`],
      serverDir,
      {
        env: isolatedEnvironment({
          ...envOverrides,
          PORT: `${port}`,
          CORS_ORIGIN: origin,
          // Keeps the 429 probe fast while leaving headroom above the ~12
          // /api requests health polling + CRUD + 404 probes consume first.
          RATE_LIMIT_MAX: '20',
          RATE_LIMIT_WINDOW_MINUTES: '15',
        }),
      },
    )
    await waitForHealth(origin, child, secrets)
    console.log(`[fastapi:${database}] API healthy; checking generated CRUD and failure paths`)
    await verifyCrud(origin, database)
    assert(
      secrets.every((secret) => !child?.output.includes(secret)),
      'Generated FastAPI logs exposed a synthetic database credential.',
    )
    console.log(`[fastapi:${database}] migrations, boot, CRUD, and failure checks passed`)
  } catch (error) {
    const detail = redact(error instanceof Error ? error.message : String(error), secrets)
    const childOutput = child ? redact(child.output, secrets) : ''
    failure = new Error(
      `[fastapi:${database}] failed\n${detail}${diagnostics.length ? `\n\n${diagnostics.slice(-4).join('\n\n')}` : ''}${childOutput ? `\n\nGenerated API output:\n${tail(childOutput)}` : ''}`,
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
        console.log(`[fastapi:${database}] isolated project and database resources cleaned`)
      }
    }
  }

  if (failure) throw failure
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const databases = requestedDatabases(argv)
  if (databases.includes('postgres')) await ensureDockerAvailable()
  for (const database of databases) await runDatabaseCase(database)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
})
