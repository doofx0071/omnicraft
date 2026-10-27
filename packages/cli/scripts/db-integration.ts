import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:net'
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { text } from 'node:stream/consumers'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import type { StartedMySqlContainer } from '@testcontainers/mysql'
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { runCommand, startCommand, type StartedCommand } from '../src/exec.js'
import { saveManifest } from '../src/add.js'
import { runAdd } from '../src/add-run.js'
import { CLI_VERSION, TEMPLATES_ROOT } from '../src/config.js'
import { buildManifest } from '../src/manifest.js'
import { createEnvFiles } from '../src/scaffold/env.js'
import { applyLayers } from '../src/scaffold/engine.js'
import { composeLayers, templateVariables } from '../src/scaffold/compose.js'
import { integrationScenarios } from '../src/support-evidence.js'
import type { Answers, Database } from '../src/types.js'

const POSTGRES_IMAGE = 'postgres:17.11-alpine3.24'
const MYSQL_IMAGE = 'mysql:8.4.13'
type TestDatabase = Extract<Database, 'sqlite' | 'postgres' | 'mysql'>

const DATABASES = integrationScenarios('node-express-drizzle') as readonly TestDatabase[]
const AUTH_PASSWORD = 'OmniCraft-test-password-2026'
const AUTH_SECRET_BYTES = 32
const CHILD_TIMEOUT_MS = 10 * 60 * 1000
const HTTP_TIMEOUT_MS = 15_000

type StartedDatabaseContainer = StartedPostgreSqlContainer | StartedMySqlContainer

function requestedDatabases(argv: string[]): TestDatabase[] {
  const databaseArgs = argv.filter((arg) => arg === '--database' || arg.startsWith('--database='))
  if (databaseArgs.length === 0) return [...DATABASES]
  if (databaseArgs.length > 1) throw new Error('Pass --database only once.')

  const index = argv.indexOf('--database')
  const value = index >= 0 ? argv[index + 1] : databaseArgs[0]?.split('=', 2)[1]
  if (!value || !DATABASES.includes(value as TestDatabase)) {
    throw new Error(`Unknown database "${value ?? ''}". Choose: ${DATABASES.join(', ')}.`)
  }
  return [value as TestDatabase]
}

function isolatedEnvironment(overrides: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = { ...process.env }
  for (const key of [
    'DATABASE_URL',
    'BETTER_AUTH_SECRET',
    'BETTER_AUTH_URL',
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
    'DB_CONNECTION',
    'DB_HOST',
    'DB_PORT',
    'DB_DATABASE',
    'DB_USERNAME',
    'DB_PASSWORD',
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
  const result = runCommand(command, args, cwd, { env, timeoutMs, maxBuffer: 32 * 1024 * 1024 })
  assertNoSecrets(result.output, secrets, label)
  const output = redact(result.output, secrets)
  diagnostics.push(`${label}:\n${tail(output)}`)
  if (!result.ok) {
    throw new Error(`${label} failed (exit ${result.exitCode ?? 'unknown'}):\n${tail(output)}`)
  }
  return result.output
}

function makeAnswers(projectRoot: string, database: TestDatabase): Answers {
  return {
    projectName: `omnicraft-test-${database}`,
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

function scaffoldWithAuth(projectRoot: string, database: TestDatabase): void {
  const answers = makeAnswers(projectRoot, database)
  applyLayers(TEMPLATES_ROOT, composeLayers(answers), templateVariables(answers), projectRoot)
  createEnvFiles(projectRoot)
  saveManifest(projectRoot, buildManifest(answers, CLI_VERSION, 'npm'))
}

async function startDatabase(
  database: Exclude<TestDatabase, 'sqlite'>,
  secrets: string[],
): Promise<StartedDatabaseContainer> {
  const [{ MySqlContainer }, { PostgreSqlContainer }, { Wait }] = await Promise.all([
    import('@testcontainers/mysql'),
    import('@testcontainers/postgresql'),
    import('testcontainers'),
  ])
  const suffix = randomBytes(6).toString('hex')
  const databaseName = `omnicraft_${suffix}`
  const username = `oc_${suffix}`
  const password = `test_${randomBytes(12).toString('hex')}`
  secrets.push(databaseName, username, password)

  if (database === 'postgres') {
    const container = await new PostgreSqlContainer(POSTGRES_IMAGE)
      .withDatabase(databaseName)
      .withUsername(username)
      .withPassword(password)
      .withStartupTimeout(180_000)
      .start()
    await container.exec(['pg_isready', '-U', username, '-d', databaseName])
    return container
  }

  const rootPassword = `root_${randomBytes(12).toString('hex')}`
  secrets.push(rootPassword)
  const container = await new MySqlContainer(MYSQL_IMAGE)
    .withDatabase(databaseName)
    .withUsername(username)
    .withUserPassword(password)
    .withRootPassword(rootPassword)
    .withWaitStrategy(Wait.forLogMessage(/ready for connections/i))
    .withStartupTimeout(180_000)
    .start()
  return container
}

async function ensureDockerAvailable(): Promise<void> {
  const result = runCommand('docker', ['info'], process.cwd(), {
    timeoutMs: 15_000,
    maxBuffer: 1_000_000,
  })
  if (!result.ok) {
    throw new Error(
      'Docker Engine/Desktop is required for PostgreSQL and MySQL tests. Start Docker and retry.',
    )
  }
}

function ensureTestcontainersNodeVersion(): void {
  const [major = 0, minor = 0] = process.versions.node.split('.').map(Number)
  if (major < 22 || (major === 22 && minor < 22)) {
    throw new Error(
      'PostgreSQL/MySQL Testcontainers cases require Node.js 22.22 or newer. The SQLite-only and fast suites do not.',
    )
  }
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

function assertNoSecrets(value: string, secrets: string[], label: string): void {
  for (const secret of secrets) {
    if (secret.length >= 5) assert(!value.includes(secret), `${label} exposed a test secret.`)
  }
}

function assertAuthSecretNotPersisted(projectRoot: string, authSecret: string): void {
  for (const relativePath of [
    'server/.env',
    'server/.env.example',
    'server/src/auth.ts',
    'client/src/lib/auth-client.ts',
    '.omnicraft/project.json',
  ]) {
    const path = join(projectRoot, relativePath)
    if (existsSync(path)) {
      assert(
        !readFileSync(path, 'utf8').includes(authSecret),
        `Generated file ${relativePath} persisted BETTER_AUTH_SECRET.`,
      )
    }
  }
}

function cookieHeader(response: Response): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  const setCookies = headers.getSetCookie?.() ?? [response.headers.get('set-cookie') ?? '']
  const pairs = setCookies
    .map((setCookie) => setCookie.split(';', 1)[0]?.trim() ?? '')
    .filter(Boolean)
  const result = pairs.join('; ')
  assert.match(result, /session_token=/i, 'Better Auth did not set a session cookie.')
  return result
}

async function jsonResponse(response: Response): Promise<unknown> {
  const body = await response.text()
  try {
    return JSON.parse(body) as unknown
  } catch {
    throw new Error(`Expected JSON from HTTP ${response.status}.`)
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  assert(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    `${label} was not an object.`,
  )
  return value as Record<string, unknown>
}

function userEmailFromSession(value: unknown): string | null {
  if (value === null) return null
  const session = record(value, 'Session response')
  if (session.user === null || session.user === undefined) return null
  return String(record(session.user, 'Session user').email ?? '')
}

async function request(
  origin: string,
  path: string,
  options: { method?: string; body?: unknown; cookie?: string } = {},
): Promise<{ response: Response; body: unknown }> {
  const headers = new Headers()
  if (options.body !== undefined) headers.set('content-type', 'application/json')
  if (options.cookie) headers.set('cookie', options.cookie)
  const response = await fetch(`${origin}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: 'manual',
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  })
  return { response, body: await jsonResponse(response) }
}

async function waitForHealth(origin: string, child: StartedCommand): Promise<void> {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    const exited = await Promise.race([child.exited, delay(0).then(() => null)])
    if (exited) throw new Error(`Generated API exited before health check:\n${tail(exited.output)}`)
    try {
      const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1_000) })
      if (response.ok) return
    } catch {
      // Keep polling until the startup deadline.
    }
    await delay(250)
  }
  throw new Error(`Generated API did not become healthy within 30 seconds:\n${tail(child.output)}`)
}

async function verifyUserCrud(origin: string): Promise<void> {
  const email = `crud-${randomBytes(6).toString('hex')}@example.test`
  const created = await request(origin, '/api/users', {
    method: 'POST',
    body: { name: 'Integration User', email },
  })
  assert.equal(created.response.status, 201, 'A valid user should be created.')
  const createdUser = record(created.body, 'Created user')
  assert.equal(createdUser.email, email)
  assert.equal(typeof createdUser.id, 'number')
  const id = Number(createdUser.id)

  const listed = await request(origin, '/api/users')
  assert.equal(listed.response.status, 200)
  assert(
    Array.isArray(listed.body) &&
      listed.body.some((user) => record(user, 'Listed user').email === email),
    'The created user should be returned by the list endpoint.',
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
  assert.equal(invalid.response.status, 400, 'Invalid user data should return HTTP 400.')

  const deleted = await request(origin, `/api/users/${id}`, { method: 'DELETE' })
  assert.equal(deleted.response.status, 200, 'The created user should be deletable.')
  const missing = await request(origin, `/api/users/${id}`, { method: 'DELETE' })
  assert.equal(missing.response.status, 404, 'Deleting an absent user should return HTTP 404.')
}

async function verifyAuth(
  origin: string,
  secrets: string[],
): Promise<{ email: string; cookie: string }> {
  const email = `auth-${randomBytes(6).toString('hex')}@example.test`
  const registration = await request(origin, '/api/auth/sign-up/email', {
    method: 'POST',
    body: { name: 'Auth Integration', email, password: AUTH_PASSWORD },
  })
  assert(registration.response.ok, 'A valid email/password registration should succeed.')
  const signupCookie = cookieHeader(registration.response)
  secrets.push(signupCookie)

  const duplicate = await request(origin, '/api/auth/sign-up/email', {
    method: 'POST',
    body: { name: 'Auth Integration', email, password: AUTH_PASSWORD },
  })
  assert(!duplicate.response.ok, 'Registering the same email twice should fail.')

  const invalid = await request(origin, '/api/auth/sign-up/email', {
    method: 'POST',
    body: { name: 'Missing Password', email: `invalid-${email}` },
  })
  assert(!invalid.response.ok, 'Registration without a password should fail.')

  const wrongPassword = await request(origin, '/api/auth/sign-in/email', {
    method: 'POST',
    body: { email, password: 'wrong-password' },
  })
  assert(!wrongPassword.response.ok, 'A wrong password should not create a session.')

  const unknownAccount = await request(origin, '/api/auth/sign-in/email', {
    method: 'POST',
    body: { email: `unknown-${email}`, password: AUTH_PASSWORD },
  })
  assert(!unknownAccount.response.ok, 'An unknown account should not create a session.')

  const login = await request(origin, '/api/auth/sign-in/email', {
    method: 'POST',
    body: { email, password: AUTH_PASSWORD },
  })
  assert(login.response.ok, 'Valid credentials should sign in.')
  const cookie = cookieHeader(login.response)
  secrets.push(cookie)

  const authenticatedSession = await request(origin, '/api/auth/get-session', { cookie })
  assert.equal(userEmailFromSession(authenticatedSession.body), email)

  const noSession = await request(origin, '/api/auth/get-session')
  assert.equal(
    userEmailFromSession(noSession.body),
    null,
    'Session lookup without a cookie should be empty.',
  )
  const invalidSession = await request(origin, '/api/auth/get-session', {
    cookie: 'session_token=invalid',
  })
  assert.equal(
    userEmailFromSession(invalidSession.body),
    null,
    'An invalid cookie should not authenticate.',
  )

  const protectedWithoutCookie = await request(origin, '/api/me')
  assert.equal(protectedWithoutCookie.response.status, 401)
  const protectedWithCookie = await request(origin, '/api/me', { cookie })
  assert.equal(protectedWithCookie.response.status, 200)
  assert.equal(userEmailFromSession(protectedWithCookie.body), email)

  return { email, cookie }
}

async function verifyLogout(origin: string, cookie: string): Promise<void> {
  const logout = await request(origin, '/api/auth/sign-out', { method: 'POST', cookie })
  assert(logout.response.ok, 'Logout should succeed.')
  const protectedAfterLogout = await request(origin, '/api/me', { cookie })
  assert.equal(
    protectedAfterLogout.response.status,
    401,
    'Logout should invalidate the existing session.',
  )
  const sessionAfterLogout = await request(origin, '/api/auth/get-session', { cookie })
  assert.equal(userEmailFromSession(sessionAfterLogout.body), null)
}

function verifyStoredPassword(
  database: TestDatabase,
  serverDir: string,
  databaseUrl: string,
  authPassword: string,
  secrets: string[],
  diagnostics: string[],
): void {
  const fixture = fileURLToPath(new URL('./fixtures/auth-password-check.mjs', import.meta.url))
  copyFileSync(fixture, join(serverDir, '.omnicraft-auth-password-check.mjs'))
  const env = isolatedEnvironment({
    DATABASE_URL: databaseUrl,
    OMNICRAFT_TEST_DATABASE: database,
    OMNICRAFT_TEST_PASSWORD: authPassword,
  })
  runRequired(
    'Verify stored password hash',
    'node',
    ['.omnicraft-auth-password-check.mjs'],
    serverDir,
    env,
    secrets,
    diagnostics,
    30_000,
  )
}

async function startServer(
  projectRoot: string,
  port: number,
  databaseUrl: string,
  authSecret: string,
): Promise<StartedCommand> {
  const origin = `http://127.0.0.1:${port}`
  const env = isolatedEnvironment({
    DATABASE_URL: databaseUrl,
    BETTER_AUTH_SECRET: authSecret,
    BETTER_AUTH_URL: origin,
    PORT: `${port}`,
    CORS_ORIGIN: origin,
    NODE_ENV: 'test',
  })
  return startCommand('npm', ['run', 'dev', '--workspace=server'], projectRoot, { env })
}

async function runDatabaseCase(database: TestDatabase): Promise<void> {
  const projectRoot = mkdtempSync(join(tmpdir(), `omnicraft-${database}-integration-`))
  const serverDir = join(projectRoot, 'server')
  const secrets: string[] = []
  const diagnostics: string[] = []
  let container: StartedDatabaseContainer | undefined
  let child: StartedCommand | undefined
  let serverOutput = ''

  try {
    console.log(`[database:${database}] preparing generated project`)
    scaffoldWithAuth(projectRoot, database)
    await runAdd('auth', projectRoot, false)

    const manifest = JSON.parse(
      readFileSync(join(projectRoot, '.omnicraft', 'project.json'), 'utf8'),
    ) as {
      modules?: string[]
    }
    assert(
      manifest.modules?.includes('auth'),
      'The existing add-auth integration should be applied.',
    )

    let databaseUrl: string
    if (database === 'sqlite') {
      databaseUrl = 'file:./data/auth.sqlite'
    } else {
      container = await startDatabase(database, secrets)
      databaseUrl = container.getConnectionUri()
      secrets.push(databaseUrl)
    }

    const authSecret = randomBytes(AUTH_SECRET_BYTES).toString('base64url')
    secrets.push(authSecret, AUTH_PASSWORD)
    assertAuthSecretNotPersisted(projectRoot, authSecret)
    const installEnv = isolatedEnvironment({})
    const migrationEnv = isolatedEnvironment({ DATABASE_URL: databaseUrl })

    runRequired(
      'npm install',
      'npm',
      ['install', '--no-audit', '--no-fund'],
      projectRoot,
      installEnv,
      secrets,
      diagnostics,
    )
    runRequired(
      'Typecheck generated client',
      'npx',
      ['tsc', '--noEmit', '-p', 'client'],
      projectRoot,
      installEnv,
      secrets,
      diagnostics,
      120_000,
    )
    runRequired(
      'Typecheck generated API',
      'npx',
      ['tsc', '--noEmit', '-p', 'server'],
      projectRoot,
      installEnv,
      secrets,
      diagnostics,
      120_000,
    )
    console.log(`[database:${database}] generated client and API typechecks passed`)
    runRequired(
      'Generate Drizzle migrations',
      'npm',
      ['run', 'db:generate', '--workspace=server'],
      projectRoot,
      migrationEnv,
      secrets,
      diagnostics,
      120_000,
    )
    runRequired(
      'Apply Drizzle migrations',
      'npm',
      ['run', 'db:migrate', '--workspace=server'],
      projectRoot,
      migrationEnv,
      secrets,
      diagnostics,
      120_000,
    )
    console.log(`[database:${database}] migrations applied`)

    const port = await reservePort()
    let origin = `http://127.0.0.1:${port}`
    child = await startServer(projectRoot, port, databaseUrl, authSecret)
    await waitForHealth(origin, child)
    console.log(`[database:${database}] API healthy; checking CRUD and authentication`)
    await verifyUserCrud(origin)
    const auth = await verifyAuth(origin, secrets)
    verifyStoredPassword(database, serverDir, databaseUrl, AUTH_PASSWORD, secrets, diagnostics)
    assertNoSecrets(child.output, secrets, 'Generated server logs')
    serverOutput += child.output
    await child.stop()
    child = undefined

    const restartedPort = await reservePort()
    origin = `http://127.0.0.1:${restartedPort}`
    child = await startServer(projectRoot, restartedPort, databaseUrl, authSecret)
    await waitForHealth(origin, child)
    const persistedSession = await request(origin, '/api/me', { cookie: auth.cookie })
    assert.equal(
      persistedSession.response.status,
      200,
      'A valid database session should survive a process restart.',
    )
    assert.equal(userEmailFromSession(persistedSession.body), auth.email)
    await verifyLogout(origin, auth.cookie)
    assertNoSecrets(child.output, secrets, 'Generated server logs after restart')
    serverOutput += child.output
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    if (child) serverOutput += child.output
    let containerOutput = ''
    if (container) {
      try {
        containerOutput = await text(await container.logs({ tail: 200 }))
      } catch {
        containerOutput = 'Container logs were unavailable.'
      }
    }
    const report = [
      `[database:${database}] failed`,
      redact(detail, secrets),
      diagnostics.filter(Boolean).slice(-3).join('\n\n'),
      serverOutput ? `Generated API output:\n${tail(redact(serverOutput, secrets))}` : '',
      containerOutput
        ? `Database container output:\n${tail(redact(containerOutput, secrets))}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n')
    throw new Error(report, { cause: error })
  } finally {
    try {
      if (child) await child.stop()
    } finally {
      try {
        if (container) await container.stop()
      } finally {
        rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 })
        console.log(`[database:${database}] isolated project and database resources cleaned`)
      }
    }
  }
  console.log(`[database:${database}] migrations, CRUD, and Better Auth passed`)
}

async function main(): Promise<void> {
  const databases = requestedDatabases(process.argv.slice(2))
  if (databases.some((database) => database !== 'sqlite')) {
    ensureTestcontainersNodeVersion()
    await ensureDockerAvailable()
  }
  for (const database of databases) await runDatabaseCase(database)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
