import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:net'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { runCommand, startCommand, type StartedCommand } from '../src/exec.js'
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
const DATABASES = integrationScenarios('python-fastapi-sqlite')
assert.deepEqual(DATABASES, ['sqlite'], 'FastAPI integration currently implements SQLite only.')

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

function runRequired(
  label: string,
  command: string,
  args: string[],
  cwd: string,
  diagnostics: string[],
  timeoutMs = CHILD_TIMEOUT_MS,
): string {
  console.log(`[integration] ${label}`)
  const result = runCommand(command, args, cwd, {
    env: isolatedEnvironment(),
    timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
  })
  diagnostics.push(`${label}:\n${tail(result.output)}`)
  if (!result.ok) {
    throw new Error(`${label} failed (exit ${result.exitCode ?? 'unknown'}):\n${tail(result.output)}`)
  }
  return result.output
}

function makeAnswers(projectRoot: string): Answers {
  return {
    projectName: 'omnicraft-fastapi-sqlite-test',
    targetDir: projectRoot,
    projectType: 'web',
    frontend: 'react',
    language: 'typescript',
    fullStack: true,
    backendRuntime: 'python',
    backendFramework: 'fastapi',
    orm: null,
    database: 'sqlite',
    extras: { tailwind: false, eslintPrettier: false, shadcn: false },
    architecture: { kind: 'separate-frontend-api' },
  }
}

function scaffold(projectRoot: string): void {
  const answers = makeAnswers(projectRoot)
  applyLayers(TEMPLATES_ROOT, composeLayers(answers), templateVariables(answers), projectRoot)
  createEnvFiles(projectRoot)
  saveManifest(projectRoot, buildManifest(answers, CLI_VERSION, 'npm'))
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

async function waitForHealth(origin: string, child: StartedCommand): Promise<void> {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    const exited = await Promise.race([child.exited, delay(0).then(() => null)])
    if (exited) throw new Error(`Generated FastAPI app exited before health check:\n${tail(exited.output)}`)
    try {
      const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1_000) })
      if (response.ok) return
    } catch {
      // Poll until the app starts or the bounded startup deadline expires.
    }
    await delay(250)
  }
  throw new Error(`Generated FastAPI app did not become healthy:\n${tail(child.output)}`)
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} was not an object.`)
  return value as Record<string, unknown>
}

async function verifyCrud(origin: string): Promise<void> {
  const email = `sqlite-${randomBytes(6).toString('hex')}@example.com`
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
    'The created SQLite user was not returned by the list endpoint.',
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
}

async function main(): Promise<void> {
  const projectRoot = mkdtempSync(join(tmpdir(), 'omnicraft-fastapi-sqlite-'))
  const serverDir = join(projectRoot, 'server')
  const diagnostics: string[] = []
  let child: StartedCommand | undefined
  try {
    console.log('[fastapi:sqlite] preparing generated project')
    scaffold(projectRoot)
    runRequired('Install generated Python dependencies', 'uv', ['sync', '--no-progress', '--python', '3.12'], serverDir, diagnostics)
    runRequired('Apply generated Alembic migrations', 'uv', ['run', 'alembic', 'upgrade', 'head'], serverDir, diagnostics)

    const port = await reservePort()
    const origin = `http://127.0.0.1:${port}`
    child = await startCommand(
      'uv',
      ['run', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', `${port}`],
      serverDir,
      { env: isolatedEnvironment({ PORT: `${port}`, CORS_ORIGIN: origin }) },
    )
    await waitForHealth(origin, child)
    console.log('[fastapi:sqlite] health passed; checking generated SQLite CRUD and failure paths')
    await verifyCrud(origin)
    console.log('[fastapi:sqlite] migrations, boot, CRUD, validation, conflict, and delete checks passed')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(
      `[fastapi:sqlite] failed\n${detail}${diagnostics.length ? `\n\n${diagnostics.slice(-4).join('\n\n')}` : ''}`,
      { cause: error },
    )
  } finally {
    try {
      if (child) await child.stop()
    } finally {
      rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 })
      console.log('[fastapi:sqlite] isolated project cleaned')
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
})
