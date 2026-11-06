/**
 * Node 20 generated-project floor check (audit remediation E5).
 *
 * The declared engines floor is >=20.12, but every other generated-project
 * runtime job runs Node 24, and node-stack-integration cannot even load on
 * Node 20: its Testcontainers import chain pulls an undici version that
 * requires zlib ZSTD constants from Node 22+. The SQLite layers are also
 * unavailable on Node 20 because their better-sqlite3@^13 dependency declares
 * engines node >=22. This check therefore scaffolds express + raw SQL +
 * PostgreSQL — `pg` is dependency-free JavaScript — through the BUILT CLI,
 * installs, typechecks, migrates, boots, and exercises HTTP CRUD against a
 * PostgreSQL service provided by the caller (DATABASE_URL from the
 * environment, as in the sanctum CI job).
 *
 * It is an extra CI hygiene check — it registers no Supported matrix row and
 * does not run on any other stack.
 *
 * Run: npx tsx scripts/lib/node20-postgres-runtime.ts (after `npx tsup`).
 */
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { runCommand, startCommand, type StartedCommand } from '../../src/exec.js'

const CLI_DIST = resolve(dirname(fileURLToPath(import.meta.url)), '../../dist/index.js')
const CHILD_TIMEOUT_MS = 10 * 60 * 1000
const HTTP_TIMEOUT_MS = 15_000
const HEALTH_DEADLINE_MS = 60_000

function runRequired(label: string, command: string, args: string[], cwd: string): string {
  const result = runCommand(command, args, cwd, {
    timeoutMs: CHILD_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
  })
  if (!result.ok) {
    throw new Error(
      `${label} failed (exit ${result.exitCode ?? 'unknown'}):\n${result.output.slice(-16_000)}`,
    )
  }
  return result.output
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

async function waitForHealth(origin: string, child: StartedCommand): Promise<void> {
  const deadline = Date.now() + HEALTH_DEADLINE_MS
  while (Date.now() < deadline) {
    const exited = await Promise.race([child.exited, delay(0).then(() => null)])
    if (exited) {
      throw new Error(`Generated API exited before the health check:\n${child.output.slice(-12_000)}`)
    }
    try {
      const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1_000) })
      if (response.ok) return
    } catch {
      // Poll until the API starts or the bounded startup deadline expires.
    }
    await delay(500)
  }
  throw new Error(`Generated API did not become healthy:\n${child.output.slice(-12_000)}`)
}

async function verifyCrud(origin: string): Promise<void> {
  const email = `node20-floor-${Date.now()}@example.test`
  const base = `${origin}/api/users`
  const post = (body: Record<string, string>) =>
    fetch(base, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    })

  const initial = await fetch(base, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) })
  assert.equal(initial.status, 200)
  assert.deepEqual(await initial.json(), [])

  const created = await post({ name: 'Node 20 Floor Check', email })
  assert.equal(created.status, 201, 'Valid user creation failed.')
  const user = (await created.json()) as { id: number; email: string }
  assert.equal(user.email, email)
  const id = Number(user.id)
  assert(Number.isInteger(id) && id > 0, 'The API did not return a persisted user id.')

  const listed = await fetch(base, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) })
  assert(
    (await listed.json() as unknown[]).some(
      (item) => (item as { email: string }).email === email,
    ),
    'The created database row was not returned by the list endpoint.',
  )

  const duplicate = await post({ name: 'Duplicate User', email })
  assert.equal(duplicate.status, 409, 'Duplicate email should return HTTP 409.')

  const invalid = await post({ name: '', email: 'not-an-email' })
  assert.equal(invalid.status, 400, 'Invalid input should return HTTP 400.')

  const deleted = await fetch(`${base}/${id}`, {
    method: 'DELETE',
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  })
  assert.equal(deleted.status, 200)
  const missing = await fetch(`${base}/${id}`, {
    method: 'DELETE',
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  })
  assert.equal(missing.status, 404, 'Deleting a missing row should return HTTP 404.')
}

async function main(): Promise<void> {
  assert(
    process.env.DATABASE_URL,
    'DATABASE_URL must point at a reachable PostgreSQL service for this check.',
  )
  assert(
    existsSync(CLI_DIST),
    `The built CLI is missing at ${CLI_DIST}. Run "npx tsup" in packages/cli first.`,
  )
  const scratch = mkdtempSync(join(tmpdir(), 'omnicraft-node20-pg-runtime-'))
  let child: StartedCommand | undefined
  let failure: unknown
  try {
    console.log('[node20] scaffolding express + raw SQL + PostgreSQL through the built CLI')
    runRequired(
      'Scaffold the generated project',
      'node',
      [
        CLI_DIST,
        '--yes',
        '--skip-install',
        '--runtime',
        'node',
        '--backend',
        'express',
        '--orm',
        'none',
        '--db',
        'postgres',
        'omnicraft-node20-check',
      ],
      scratch,
    )
    const projectRoot = join(scratch, 'omnicraft-node20-check')
    assert(existsSync(join(projectRoot, 'server', '.env')), 'The CLI must create server/.env from .env.example.')
    assert(existsSync(join(projectRoot, 'server', 'src', 'db')), 'The generated server must contain the raw-SQL db layer.')

    console.log('[node20] installing, typechecking, and migrating the generated project')
    runRequired('Install generated dependencies', 'npm', ['install', '--no-audit', '--no-fund'], projectRoot)
    runRequired('Typecheck generated client', 'npx', ['tsc', '--noEmit', '-p', 'client'], projectRoot)
    runRequired('Typecheck generated API', 'npx', ['tsc', '--noEmit', '-p', 'server'], projectRoot)
    runRequired('Apply generated migrations', 'npm', ['run', 'db:migrate', '--workspace=server'], projectRoot)

    const port = await reservePort()
    const origin = `http://127.0.0.1:${port}`
    console.log(`[node20] booting the generated API on ${origin}`)
    child = startCommand('npm', ['run', 'dev', '--workspace=server'], projectRoot, {
      env: { ...process.env, NODE_ENV: 'test', PORT: `${port}`, CORS_ORIGIN: origin },
    })
    await waitForHealth(origin, child)
    await verifyCrud(origin)
    console.log('[node20] install, typecheck, migration, boot, and PostgreSQL CRUD passed on', process.version)
  } catch (error) {
    failure = error
  } finally {
    try {
      if (child) await child.stop()
    } finally {
      rmSync(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 })
    }
  }
  if (failure) throw failure
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
})
