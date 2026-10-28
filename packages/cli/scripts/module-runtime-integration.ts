import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:net'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { runCommand, startCommand, type StartedCommand } from '../src/exec.js'
import { CLI_VERSION, SHADCN_BASE, SHADCN_COMPONENTS, SHADCN_PRESET, TEMPLATES_ROOT } from '../src/config.js'
import { buildManifest } from '../src/manifest.js'
import { createEnvFiles } from '../src/scaffold/env.js'
import { applyLayers } from '../src/scaffold/engine.js'
import { composeLayers, templateVariables } from '../src/scaffold/compose.js'
import { saveManifest } from '../src/add.js'
import type { Answers } from '../src/types.js'

const SCENARIOS = ['add-testing-react-vite-ts', 'shadcn-react-vite-ts-frontend-only'] as const
const CHILD_TIMEOUT_MS = 10 * 60 * 1000
const HTTP_TIMEOUT_MS = 15_000
const CLI_ROOT = process.cwd()
const SECRETS = Object.entries(process.env)
  .filter(([key, value]) => /(TOKEN|PASSWORD|SECRET|API_KEY|AUTH)/i.test(key) && Boolean(value))
  .map(([, value]) => value as string)

type Scenario = (typeof SCENARIOS)[number]

function requestedScenario(argv: string[]): Scenario {
  const options = argv.filter((arg) => arg === '--scenario' || arg.startsWith('--scenario='))
  if (options.length > 1) throw new Error('Pass --scenario only once.')
  const index = argv.indexOf('--scenario')
  const value = index >= 0 ? argv[index + 1] : options[0]?.split('=', 2)[1]
  if (!value) throw new Error(`Pass --scenario ${SCENARIOS.join('|')}.`)
  if (!SCENARIOS.includes(value as Scenario)) {
    throw new Error(`Unknown scenario "${value}". Choose: ${SCENARIOS.join(', ')}.`)
  }
  return value as Scenario
}

function redact(value: string): string {
  return SECRETS.reduce(
    (result, secret) => (secret.length < 5 ? result : result.replaceAll(secret, '[REDACTED]')),
    value,
  )
}

function tail(value: string, length = 12_000): string {
  return value.length > length ? value.slice(-length) : value
}

function isolatedEnvironment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env = { ...process.env }
  for (const key of ['DATABASE_URL', 'PORT', 'NODE_ENV', 'HOSTNAME']) delete env[key]
  return { ...env, CI: '1', NO_UPDATE_NOTIFIER: '1', ...overrides }
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
  console.log(`[integration] command completed: ${label} (exit ${result.exitCode ?? 'unknown'})`)
  const output = redact(result.output)
  diagnostics.push(`${label}:\n${tail(output)}`)
  if (!result.ok) {
    throw new Error(`${label} failed (exit ${result.exitCode ?? 'unknown'}):\n${tail(output)}`)
  }
  return output
}

function makeAnswers(projectRoot: string, scenario: Scenario): Answers {
  const projectName = `omnicraft-${scenario}-${randomBytes(4).toString('hex')}`
  const shadcn = scenario === 'shadcn-react-vite-ts-frontend-only'
  return {
    projectName,
    targetDir: projectRoot,
    projectType: 'web',
    frontend: 'react',
    language: 'typescript',
    fullStack: false,
    backendRuntime: null,
    backendFramework: null,
    orm: null,
    database: null,
    extras: { tailwind: shadcn, eslintPrettier: shadcn, shadcn },
    architecture: { kind: 'frontend-only' },
  }
}

function scaffold(projectRoot: string, scenario: Scenario): Answers {
  const answers = makeAnswers(projectRoot, scenario)
  applyLayers(TEMPLATES_ROOT, composeLayers(answers), templateVariables(answers), projectRoot)
  createEnvFiles(projectRoot)
  saveManifest(projectRoot, buildManifest(answers, CLI_VERSION, 'npm'))
  return answers
}

function invokeAddTesting(projectRoot: string): ReturnType<typeof runCommand> {
  const result = runCommand('npx', ['tsx', 'src/index.ts', 'add', 'testing', projectRoot], CLI_ROOT, {
    env: isolatedEnvironment(),
    timeoutMs: 120_000,
    maxBuffer: 4 * 1024 * 1024,
  })
  return { ...result, output: redact(result.output) }
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

async function waitForApp(origin: string, child: StartedCommand): Promise<string> {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    const exited = await Promise.race([child.exited, delay(0).then(() => null)])
    if (exited) throw new Error(`Generated Vite app exited before responding:\n${tail(redact(exited.output))}`)
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(1_000) })
      if (response.ok) return await response.text()
    } catch {
      // Poll until Vite starts or the bounded startup deadline expires.
    }
    await delay(250)
  }
  throw new Error(`Generated Vite app did not become ready:\n${tail(redact(child.output))}`)
}

async function verifyPreview(origin: string, scenario: Scenario): Promise<void> {
  const response = await fetch(origin, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) })
  assert.equal(response.status, 200, 'The generated React page did not load.')
  const page = await response.text()
  assert(page.includes('<div id="root"></div>'), 'The generated React page did not render its mount point.')
  const assetPath = /<script[^>]+src="([^"]+\.js)"/.exec(page)?.[1]
  assert(assetPath, 'The generated React page did not reference a built JavaScript entry.')

  const entry = await fetch(new URL(assetPath, origin), { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) })
  assert.equal(entry.status, 200, 'The generated JavaScript bundle did not load from Vite preview.')
  const bundle = await entry.text()
  assert(bundle.includes('createRoot'), 'The generated JavaScript bundle did not include React mounting code.')
  if (scenario === 'shadcn-react-vite-ts-frontend-only') {
    assert(bundle.includes('shadcn/ui'), 'The generated shadcn app was not present in the served bundle.')
    assert(bundle.includes('Add user'), 'The generated user form was not present in the served bundle.')
  }

  const missingAsset = await fetch(`${origin}/assets/__omnicraft_missing_asset__.js`, {
    headers: { accept: 'application/javascript' },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  })
  assert.equal(missingAsset.status, 404, 'A missing built JavaScript asset should return HTTP 404.')
}

async function runTestingScenario(projectRoot: string, answers: Answers, diagnostics: string[]): Promise<void> {
  const configPath = join(projectRoot, 'vitest.config.ts')
  const packagePath = join(projectRoot, 'package.json')
  const manifestPath = join(projectRoot, '.omnicraft', 'project.json')
  const originalPackage = readFileSync(packagePath, 'utf8')
  const originalManifest = readFileSync(manifestPath, 'utf8')

  writeFileSync(configPath, '// collision sentinel\n')
  const conflict = invokeAddTesting(projectRoot)
  assert.equal(conflict.ok, false, 'The testing module must reject an existing Vitest config.')
  assert(conflict.output.includes('a vitest config already exists'))
  assert.equal(readFileSync(packagePath, 'utf8'), originalPackage, 'A rejected add changed package.json.')
  assert.equal(readFileSync(manifestPath, 'utf8'), originalManifest, 'A rejected add changed the manifest.')
  assert(!existsSync(join(projectRoot, 'src', 'App.test.tsx')))
  unlinkSync(configPath)

  const added = invokeAddTesting(projectRoot)
  assert(added.ok, `The generated-project add command failed:\n${tail(added.output)}`)
  assert.equal(readFileSync(manifestPath, 'utf8').includes('"testing"'), true)
  assert(existsSync(join(projectRoot, 'src', 'App.test.tsx')))
  assert(existsSync(join(projectRoot, 'src', 'setupTests.ts')))
  const installedConfig = readFileSync(configPath, 'utf8')
  const installedTest = readFileSync(join(projectRoot, 'src', 'App.test.tsx'), 'utf8')
  assert(installedConfig.includes('setupFiles: ["./src/setupTests.ts"]'))
  assert(installedTest.includes(`name: "⚡ ${answers.projectName}"`))

  const packageAfterAdd = readFileSync(packagePath, 'utf8')
  const manifestAfterAdd = readFileSync(manifestPath, 'utf8')
  const repeated = invokeAddTesting(projectRoot)
  assert(repeated.ok, `The repeated testing add failed:\n${tail(repeated.output)}`)
  assert(repeated.output.includes('already installed'))
  assert.equal(readFileSync(packagePath, 'utf8'), packageAfterAdd)
  assert.equal(readFileSync(configPath, 'utf8'), installedConfig)
  assert.equal(readFileSync(manifestPath, 'utf8'), manifestAfterAdd)

  runRequired('Install generated testing dependencies', 'npm', ['install', '--no-audit', '--no-fund'], projectRoot, diagnostics)
  runRequired('Typecheck generated React/Vite project with sample test', 'npx', ['tsc', '--noEmit'], projectRoot, diagnostics)
  runRequired('Run generated sample test', 'npm', ['test'], projectRoot, diagnostics)
  runRequired('Build generated React/Vite app', 'npm', ['run', 'build'], projectRoot, diagnostics)
}

async function runShadcnScenario(projectRoot: string, diagnostics: string[]): Promise<void> {
  const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8')) as {
    devDependencies?: Record<string, string>
  }
  assert(packageJson.devDependencies?.['@tailwindcss/vite'], 'Tailwind Vite dependencies must be in the app manifest.')
  assert(packageJson.devDependencies?.tailwindcss, 'Tailwind CSS dependencies must be in the app manifest.')
  assert(!existsSync(join(projectRoot, 'src', 'package.json')), 'The src directory must not become a package workspace.')

  runRequired('Install generated React/Vite dependencies', 'npm', ['install', '--no-audit', '--no-fund'], projectRoot, diagnostics)
  runRequired(
    'Run production shadcn init path',
    'npx',
    [
      '--yes', 'shadcn@latest', 'init', '--base', SHADCN_BASE,
      '--preset', SHADCN_PRESET, '--no-monorepo', '--force',
    ],
    projectRoot,
    diagnostics,
  )
  runRequired(
    'Run production shadcn component install path',
    'npx',
    ['--yes', 'shadcn@latest', 'add', ...SHADCN_COMPONENTS, '--yes', '--overwrite'],
    projectRoot,
    diagnostics,
  )
  runRequired(
    'Run production shadcn formatting step',
    'npx',
    ['--yes', 'prettier@latest', '--write', '.'],
    projectRoot,
    diagnostics,
  )

  for (const component of SHADCN_COMPONENTS) {
    assert(
      existsSync(join(projectRoot, 'src', 'components', 'ui', `${component}.tsx`)),
      `The shadcn CLI did not generate the ${component} component.`,
    )
  }
  runRequired('Install shadcn component dependencies', 'npm', ['install', '--no-audit', '--no-fund'], projectRoot, diagnostics)
  runRequired('Build generated shadcn React/Vite app', 'npm', ['run', 'build'], projectRoot, diagnostics)
}

async function runScenario(scenario: Scenario): Promise<void> {
  const projectRoot = mkdtempSync(join(tmpdir(), `omnicraft-${scenario}-`))
  const diagnostics: string[] = []
  let child: StartedCommand | undefined
  let failure: unknown

  try {
    console.log(`[module:${scenario}] composing exact React/Vite TypeScript frontend-only layers`)
    const answers = scaffold(projectRoot, scenario)
    if (scenario === 'add-testing-react-vite-ts') {
      await runTestingScenario(projectRoot, answers, diagnostics)
    } else {
      await runShadcnScenario(projectRoot, diagnostics)
    }

    const port = await reservePort()
    const origin = `http://127.0.0.1:${port}`
    child = await startCommand(
      'npm',
      ['run', 'preview', '--', '--host', '127.0.0.1', '--port', `${port}`, '--strictPort'],
      projectRoot,
      { env: isolatedEnvironment() },
    )
    await waitForApp(origin, child)
    await verifyPreview(origin, scenario)
    console.log(`[module:${scenario}] install, build, boot, bundle, and failure checks passed`)
    console.log(`[module:${scenario}] database operation is not applicable to frontend-only architecture`)
  } catch (error) {
    const detail = redact(error instanceof Error ? error.message : String(error))
    const childOutput = child ? tail(redact(child.output)) : ''
    failure = new Error(
      `[module:${scenario}] failed\n${detail}${diagnostics.length ? `\n\n${diagnostics.slice(-5).join('\n\n')}` : ''}${childOutput ? `\n\nGenerated Vite output:\n${childOutput}` : ''}`,
      { cause: error },
    )
  } finally {
    try {
      if (child) await child.stop()
    } finally {
      rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 })
      console.log(`[module:${scenario}] isolated project resources cleaned`)
    }
  }

  if (failure) throw failure
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  await runScenario(requestedScenario(argv))
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
})
