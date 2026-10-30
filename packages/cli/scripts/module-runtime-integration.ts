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
import {
  CNA_PACKAGE,
  CLI_VERSION,
  SHADCN_BASE,
  SHADCN_COMPONENTS,
  SHADCN_PRESET,
  TEMPLATES_ROOT,
} from '../src/config.js'
import { buildManifest } from '../src/manifest.js'
import { resolveAnswers } from '../src/prefill.js'
import { createEnvFiles } from '../src/scaffold/env.js'
import { applyLayers } from '../src/scaffold/engine.js'
import { composeLayers, templateVariables } from '../src/scaffold/compose.js'
import { saveManifest } from '../src/add.js'
import type { Answers } from '../src/types.js'
import {
  reactViteTestingGroupId,
  REACT_VITE_TESTING_FOLLOWUP_COMBINATIONS,
  REACT_VITE_TESTING_FOLLOWUP_SCENARIOS,
  type SupportedCombination,
} from '../src/support-evidence.js'

const SCENARIOS = [
  'add-testing-react-vite-ts',
  'add-testing-react-vite-js-frontend-only',
  'add-testing-react-vite-ts-separate-api',
  'add-testing-react-vite-js-separate-api',
  'add-testing-vue-express-drizzle-sqlite',
  'add-testing-svelte-express-drizzle-sqlite',
  'add-testing-fastapi-sqlite',
  'add-testing-laravel-sqlite',
  'add-testing-nextjs-sqlite',
  'shadcn-react-vite-ts-frontend-only',
] as const
const EXPECTED_TESTING_REJECTIONS: Partial<Record<(typeof SCENARIOS)[number], string>> = {
  'add-testing-vue-express-drizzle-sqlite': 'the sample test requires a React/Vite frontend',
  'add-testing-svelte-express-drizzle-sqlite': 'the sample test requires a React/Vite frontend',
  'add-testing-nextjs-sqlite': 'the sample test requires a React/Vite frontend',
}
const CHILD_TIMEOUT_MS = 10 * 60 * 1000
const HTTP_TIMEOUT_MS = 15_000
const CLI_ROOT = process.cwd()
const SECRETS = Object.entries(process.env)
  .filter(([key, value]) => /(TOKEN|PASSWORD|SECRET|API_KEY|AUTH)/i.test(key) && Boolean(value))
  .map(([, value]) => value as string)

type Scenario = (typeof SCENARIOS)[number]
type ScenarioGroup = (typeof REACT_VITE_TESTING_FOLLOWUP_SCENARIOS)[number]

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

function requestedScenarioGroup(argv: string[]): ScenarioGroup {
  const options = argv.filter(
    (arg) => arg === '--scenario-group' || arg.startsWith('--scenario-group='),
  )
  if (options.length > 1) throw new Error('Pass --scenario-group only once.')
  const index = argv.indexOf('--scenario-group')
  const value = index >= 0 ? argv[index + 1] : options[0]?.split('=', 2)[1]
  if (!value) throw new Error(`Pass --scenario-group ${REACT_VITE_TESTING_FOLLOWUP_SCENARIOS.join('|')}.`)
  if (!REACT_VITE_TESTING_FOLLOWUP_SCENARIOS.includes(value)) {
    throw new Error(`Unknown scenario group "${value}". Choose: ${REACT_VITE_TESTING_FOLLOWUP_SCENARIOS.join(', ')}.`)
  }
  return value
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

function runGeneratedTestingCommand(
  projectRoot: string,
  scenario: string,
  diagnostics: string[],
): void {
  const result = runCommand('npm', ['test'], projectRoot, {
    env: isolatedEnvironment(),
    timeoutMs: CHILD_TIMEOUT_MS,
    maxBuffer: 32 * 1024 * 1024,
  })
  const output = redact(result.output)
  diagnostics.push(`Generated npm test (exit ${result.exitCode ?? 'unknown'}):\n${tail(output)}`)
  console.log(`[integration] generated npm test completed: ${scenario} (exit ${result.exitCode ?? 'unknown'})`)
  console.log(`[integration] generated npm test output:\n${tail(output, 4_000)}`)

  assert(result.ok, `Generated npm test failed for ${scenario}:\n${tail(output)}`)
}

function makeAnswers(projectRoot: string, scenario: Scenario, projectName: string): Answers {
  const shadcn = scenario === 'shadcn-react-vite-ts-frontend-only'
  const nextjs = scenario === 'add-testing-nextjs-sqlite'
  const frontend = scenario.includes('-vue-')
    ? 'vue'
    : scenario.includes('-svelte-')
      ? 'svelte'
      : nextjs
        ? 'nextjs'
        : 'react'
  const javascript = scenario.includes('-js-') || scenario.includes('-javascript-')
  const separateApi =
    scenario.includes('-separate-api') ||
    scenario.includes('-express-drizzle-sqlite') ||
    scenario === 'add-testing-fastapi-sqlite' ||
    scenario === 'add-testing-laravel-sqlite'
  const backendRuntime =
    scenario === 'add-testing-fastapi-sqlite'
      ? 'python'
      : scenario === 'add-testing-laravel-sqlite'
        ? 'php'
        : separateApi
          ? 'node'
          : null
  const backendFramework =
    scenario === 'add-testing-fastapi-sqlite'
      ? 'fastapi'
      : scenario === 'add-testing-laravel-sqlite'
        ? 'laravel'
        : separateApi
          ? 'express'
          : null
  return {
    projectName,
    targetDir: projectRoot,
    projectType: 'web',
    frontend,
    language: javascript ? 'javascript' : 'typescript',
    fullStack: separateApi || nextjs,
    backendRuntime,
    backendFramework,
    orm: nextjs ? 'none' : separateApi && backendRuntime === 'node' ? 'drizzle' : null,
    database: separateApi || nextjs ? 'sqlite' : null,
    authentication: 'none',
    extras: { tailwind: shadcn || nextjs, eslintPrettier: shadcn || nextjs, shadcn },
    architecture: nextjs
      ? { kind: 'integrated-fullstack', framework: 'nextjs' }
      : separateApi
        ? { kind: 'separate-frontend-api' }
        : { kind: 'frontend-only' },
  }
}

function scaffold(projectRoot: string, answers: Answers): void {
  applyLayers(TEMPLATES_ROOT, composeLayers(answers), templateVariables(answers), projectRoot)
  createEnvFiles(projectRoot)
  saveManifest(projectRoot, buildManifest(answers, CLI_VERSION, 'npm'))
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

async function verifyPreview(origin: string, answers: Answers): Promise<void> {
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
  if (answers.extras.shadcn) {
    assert(bundle.includes('shadcn/ui'), 'The generated shadcn app was not present in the served bundle.')
    assert(bundle.includes('Add user'), 'The generated user form was not present in the served bundle.')
  }

  const missingAsset = await fetch(`${origin}/assets/__omnicraft_missing_asset__.js`, {
    headers: { accept: 'application/javascript' },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  })
  assert.equal(missingAsset.status, 404, 'A missing built JavaScript asset should return HTTP 404.')
}

async function runTestingScenario(
  projectRoot: string,
  answers: Answers,
  scenario: string,
  diagnostics: string[],
): Promise<void> {
  const testRoot = existsSync(join(projectRoot, 'client')) ? join(projectRoot, 'client') : projectRoot
  const configPath = join(projectRoot, 'vitest.config.ts')
  const packagePath = join(projectRoot, 'package.json')
  const manifestPath = join(projectRoot, '.omnicraft', 'project.json')
  const originalPackage = readFileSync(packagePath, 'utf8')
  const originalManifest = readFileSync(manifestPath, 'utf8')

  const collisionPaths = [
    'vitest.config.ts',
    ...(testRoot === projectRoot ? [] : ['client/vitest.config.ts']),
  ]
  for (const relativePath of collisionPaths) {
    const collisionPath = join(projectRoot, relativePath)
    writeFileSync(collisionPath, '// collision sentinel\n')
    const conflict = invokeAddTesting(projectRoot)
    assert.equal(conflict.ok, false, 'The testing module must reject an existing Vitest config.')
    assert(
      conflict.output.includes('a vitest config already exists'),
      `The generated add command returned an unexpected conflict: ${tail(conflict.output)}`,
    )
    assert.equal(readFileSync(packagePath, 'utf8'), originalPackage, 'A rejected add changed package.json.')
    assert.equal(readFileSync(manifestPath, 'utf8'), originalManifest, 'A rejected add changed the manifest.')
    assert(!existsSync(join(testRoot, 'src', 'App.test.tsx')))
    unlinkSync(collisionPath)
  }

  const added = invokeAddTesting(projectRoot)
  assert(added.ok, `The generated-project add command failed:\n${tail(added.output)}`)
  assert.equal(readFileSync(manifestPath, 'utf8').includes('"testing"'), true)
  assert(existsSync(join(testRoot, 'src', 'App.test.tsx')))
  assert(existsSync(join(testRoot, 'src', 'setupTests.ts')))
  const installedConfig = readFileSync(configPath, 'utf8')
  const installedTest = readFileSync(join(testRoot, 'src', 'App.test.tsx'), 'utf8')
  assert(installedConfig.includes('setupFiles: ["./src/setupTests.ts"]'))
  assert.equal(
    installedConfig.includes('root: "client"'),
    testRoot !== projectRoot,
    'The root Vitest config must discover tests from the generated client workspace.',
  )
  const expectedTitle = answers.extras.shadcn ? answers.projectName : `⚡ ${answers.projectName}`
  assert(installedTest.includes(`name: "${expectedTitle}"`))
  assert(installedTest.includes('render(createElement(App))'))
  const installedPackage = JSON.parse(readFileSync(packagePath, 'utf8')) as {
    scripts?: Record<string, string>
  }
  assert.equal(installedPackage.scripts?.test, 'vitest run')

  const packageAfterAdd = readFileSync(packagePath, 'utf8')
  const manifestAfterAdd = readFileSync(manifestPath, 'utf8')
  const repeated = invokeAddTesting(projectRoot)
  assert(repeated.ok, `The repeated testing add failed:\n${tail(repeated.output)}`)
  assert(repeated.output.includes('already installed'))
  assert.equal(readFileSync(packagePath, 'utf8'), packageAfterAdd)
  assert.equal(readFileSync(configPath, 'utf8'), installedConfig)
  assert.equal(readFileSync(manifestPath, 'utf8'), manifestAfterAdd)

  runRequired('Install generated testing dependencies', 'npm', ['install', '--no-audit', '--no-fund'], projectRoot, diagnostics)
  if (answers.language === 'typescript') {
    runRequired(
      'Typecheck generated React/Vite project with sample test',
      'npx',
      ['tsc', '--noEmit'],
      testRoot,
      diagnostics,
    )
  }
  runGeneratedTestingCommand(projectRoot, scenario, diagnostics)
  runRequired('Build generated React/Vite app', 'npm', ['run', 'build'], testRoot, diagnostics)
}

async function runExpectedTestingRejection(
  projectRoot: string,
  scenario: string,
  reason: string,
): Promise<void> {
  const packagePath = join(projectRoot, 'package.json')
  const manifestPath = join(projectRoot, '.omnicraft', 'project.json')
  const packageBefore = readFileSync(packagePath, 'utf8')
  const manifestBefore = readFileSync(manifestPath, 'utf8')
  const result = invokeAddTesting(projectRoot)
  assert.equal(result.ok, false, `The ${scenario} path must be rejected before applying the module.`)
  assert(
    result.output.includes(reason),
    `Expected the ${scenario} rejection reason "${reason}":\n${tail(result.output)}`,
  )
  assert.equal(readFileSync(packagePath, 'utf8'), packageBefore, 'A rejected add changed package.json.')
  assert.equal(readFileSync(manifestPath, 'utf8'), manifestBefore, 'A rejected add changed the manifest.')
  for (const relativePath of [
    'vitest.config.ts',
    'client/vitest.config.ts',
    'src/App.test.tsx',
    'src/setupTests.ts',
    'client/src/App.test.tsx',
    'client/src/setupTests.ts',
  ]) {
    assert(!existsSync(join(projectRoot, relativePath)), `A rejected add wrote ${relativePath}.`)
  }
  console.log(`[module:${scenario}] rejected before module writes: ${reason}`)
}

async function prepareShadcnScenario(
  projectRoot: string,
  appRoot: string,
  diagnostics: string[],
): Promise<void> {
  const packageJson = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8')) as {
    devDependencies?: Record<string, string>
  }
  assert(packageJson.devDependencies?.['@tailwindcss/vite'], 'Tailwind Vite dependencies must be in the app manifest.')
  assert(packageJson.devDependencies?.tailwindcss, 'Tailwind CSS dependencies must be in the app manifest.')
  assert(!existsSync(join(appRoot, 'src', 'package.json')), 'The src directory must not become a package workspace.')

  runRequired('Install generated React/Vite dependencies', 'npm', ['install', '--no-audit', '--no-fund'], projectRoot, diagnostics)
  runRequired(
    'Run production shadcn init path',
    'npx',
    [
      '--yes', 'shadcn@latest', 'init', '--base', SHADCN_BASE,
      '--preset', SHADCN_PRESET, '--no-monorepo', '--force',
    ],
    appRoot,
    diagnostics,
  )
  runRequired(
    'Run production shadcn component install path',
    'npx',
    ['--yes', 'shadcn@latest', 'add', ...SHADCN_COMPONENTS, '--yes', '--overwrite'],
    appRoot,
    diagnostics,
  )
  runRequired(
    'Run production shadcn formatting step',
    'npx',
    ['--yes', 'prettier@latest', '--write', '.'],
    appRoot,
    diagnostics,
  )

  for (const component of SHADCN_COMPONENTS) {
    assert(
      existsSync(join(appRoot, 'src', 'components', 'ui', `${component}.tsx`)),
      `The shadcn CLI did not generate the ${component} component.`,
    )
  }
  runRequired('Install shadcn component dependencies', 'npm', ['install', '--no-audit', '--no-fund'], projectRoot, diagnostics)
}

function verifyJavaScriptShadcnSetupLimitation(
  appRoot: string,
  diagnostics: string[],
): void {
  const result = runCommand(
    'npx',
    [
      '--yes', 'shadcn@latest', 'init', '--base', SHADCN_BASE,
      '--preset', SHADCN_PRESET, '--no-monorepo', '--force',
    ],
    appRoot,
    {
      env: isolatedEnvironment(),
      timeoutMs: CHILD_TIMEOUT_MS,
      maxBuffer: 32 * 1024 * 1024,
    },
  )
  const output = redact(result.output)
  diagnostics.push(`Production shadcn init limitation (exit ${result.exitCode ?? 'unknown'}):\n${tail(output)}`)
  assert.equal(result.ok, false, 'The current JavaScript shadcn path unexpectedly initialized successfully.')
  assert(
    output.includes('Could not find valid path aliases'),
    `The JavaScript shadcn path failed for an unexpected reason:\n${tail(output)}`,
  )
  console.log('[integration] production shadcn init failed because the JavaScript template has no path alias')
}

async function runShadcnScenario(projectRoot: string, diagnostics: string[]): Promise<void> {
  await prepareShadcnScenario(projectRoot, projectRoot, diagnostics)
  runRequired('Build generated shadcn React/Vite app', 'npm', ['run', 'build'], projectRoot, diagnostics)
}

async function runScenario(scenario: Scenario): Promise<void> {
  const tempRoot = mkdtempSync(join(tmpdir(), `omnicraft-${scenario}-`))
  const projectName = `omnicraft-${scenario}-${randomBytes(4).toString('hex')}`
  const nextjs = scenario === 'add-testing-nextjs-sqlite'
  const projectRoot = nextjs ? join(tempRoot, projectName) : tempRoot
  const diagnostics: string[] = []
  let child: StartedCommand | undefined
  let failure: unknown

  try {
    const answers = makeAnswers(projectRoot, scenario, projectName)
    console.log(
      `[module:${scenario}] composing production ${answers.frontend}/${answers.language} ${answers.architecture.kind} layers`,
    )
    if (nextjs) {
      runRequired(
        'Generate official Next.js base project',
        'npx',
        [
          '--yes',
          CNA_PACKAGE,
          projectName,
          '--ts',
          '--app',
          '--tailwind',
          '--no-src-dir',
          '--eslint',
          '--import-alias',
          '@/*',
          '--use-npm',
          '--skip-install',
          '--yes',
        ],
        tempRoot,
        diagnostics,
      )
    }
    scaffold(projectRoot, answers)
    if (scenario === 'shadcn-react-vite-ts-frontend-only') {
      await runShadcnScenario(projectRoot, diagnostics)
    } else if (EXPECTED_TESTING_REJECTIONS[scenario]) {
      await runExpectedTestingRejection(
        projectRoot,
        scenario,
        EXPECTED_TESTING_REJECTIONS[scenario] as string,
      )
    } else {
      await runTestingScenario(projectRoot, answers, scenario, diagnostics)
    }

    const shouldBootReactApp =
      (scenario.startsWith('add-testing-') && !EXPECTED_TESTING_REJECTIONS[scenario]) ||
      scenario === 'shadcn-react-vite-ts-frontend-only'
    if (shouldBootReactApp) {
      const port = await reservePort()
      const origin = `http://127.0.0.1:${port}`
      const appRoot = existsSync(join(projectRoot, 'client'))
        ? join(projectRoot, 'client')
        : projectRoot
      child = await startCommand(
        'npm',
        ['run', 'preview', '--', '--host', '127.0.0.1', '--port', `${port}`, '--strictPort'],
        appRoot,
        { env: isolatedEnvironment() },
      )
      await waitForApp(origin, child)
      await verifyPreview(origin, answers)
      console.log(`[module:${scenario}] install, build, boot, bundle, and failure checks passed`)
    } else if (EXPECTED_TESTING_REJECTIONS[scenario]) {
      console.log(`[module:${scenario}] generation and pre-write module rejection passed`)
    } else {
      console.log(`[module:${scenario}] generation, add, install, and sample test outcome recorded`)
    }
    if (scenario.startsWith('add-testing-')) {
      console.log(`[module:${scenario}] database operation is not applicable to this generated client test`)
    }
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
      rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 })
      console.log(`[module:${scenario}] isolated project resources cleaned`)
    }
  }

  if (failure) throw failure
}

function generatedTestingPathLabel(combination: SupportedCombination): string {
  const { flags } = combination
  const stack = flags.fullStack
    ? [flags.runtime, flags.backend, flags.orm ?? 'builtin', flags.db].join('-')
    : 'frontend-only'
  const extras = flags.extras.length > 0 ? flags.extras.join('-') : 'no-extras'
  return `${flags.lang}-${stack}-${extras}`
}

function answersForCombination(
  projectRoot: string,
  projectName: string,
  combination: SupportedCombination,
): Answers {
  return resolveAnswers(
    {
      latest: false,
      skipInstall: true,
      debug: false,
      help: false,
      version: false,
      yes: true,
      ...combination.flags,
      extras: [...combination.flags.extras],
    },
    projectName,
    projectRoot,
  )
}

async function runCombinationScenario(combination: SupportedCombination): Promise<void> {
  const pathLabel = generatedTestingPathLabel(combination)
  const tempRoot = mkdtempSync(join(tmpdir(), `omnicraft-add-testing-${pathLabel.slice(0, 30)}-`))
  const projectName = `omnicraft-${randomBytes(5).toString('hex')}`
  const diagnostics: string[] = []
  let child: StartedCommand | undefined
  let failure: unknown

  try {
    const answers = answersForCombination(tempRoot, projectName, combination)
    console.log(
      `[module-path:${pathLabel}] exact flags: ${JSON.stringify(combination.flags)}`,
    )
    scaffold(tempRoot, answers)
    const appRoot = answers.fullStack ? join(tempRoot, 'client') : tempRoot
    const moduleLabel = `add-testing-react-vite-${pathLabel}`
    if (answers.language === 'javascript' && answers.extras.shadcn) {
      runRequired(
        'Install generated JavaScript shadcn base project',
        'npm',
        ['install', '--no-audit', '--no-fund'],
        tempRoot,
        diagnostics,
      )
      verifyJavaScriptShadcnSetupLimitation(appRoot, diagnostics)
      await runExpectedTestingRejection(
        tempRoot,
        moduleLabel,
        'the current shadcn templates require the TypeScript React/Vite app template',
      )
      console.log(`[module-path:${pathLabel}] existing shadcn setup limitation and pre-write testing rejection verified`)
    } else {
      if (answers.extras.shadcn) await prepareShadcnScenario(tempRoot, appRoot, diagnostics)
      await runTestingScenario(tempRoot, answers, moduleLabel, diagnostics)

      const port = await reservePort()
      const origin = `http://127.0.0.1:${port}`
      child = await startCommand(
        'npm',
        ['run', 'preview', '--', '--host', '127.0.0.1', '--port', `${port}`, '--strictPort'],
        appRoot,
        { env: isolatedEnvironment() },
      )
      await waitForApp(origin, child)
      await verifyPreview(origin, answers)
      console.log(`[module-path:${pathLabel}] install, test, build, boot, bundle, and missing-asset checks passed`)
    }
  } catch (error) {
    const detail = redact(error instanceof Error ? error.message : String(error))
    const childOutput = child ? tail(redact(child.output)) : ''
    failure = new Error(
      `[module-path:${pathLabel}] failed\n${detail}${diagnostics.length ? `\n\n${diagnostics.slice(-5).join('\n\n')}` : ''}${childOutput ? `\n\nGenerated Vite output:\n${childOutput}` : ''}`,
      { cause: error },
    )
  } finally {
    try {
      if (child) await child.stop()
    } finally {
      rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 })
      console.log(`[module-path:${pathLabel}] isolated project resources cleaned`)
    }
  }

  if (failure) throw failure
}

async function runScenarioGroup(group: ScenarioGroup): Promise<void> {
  const combinations = REACT_VITE_TESTING_FOLLOWUP_COMBINATIONS.filter(
    (combination) => reactViteTestingGroupId(combination.flags) === group,
  )
  assert(combinations.length > 0, `Scenario group "${group}" does not contain a path.`)
  console.log(`[module-group:${group}] running ${combinations.length} exact generated-project paths`)
  for (const combination of combinations) await runCombinationScenario(combination)
  console.log(`[module-group:${group}] all ${combinations.length} exact paths passed`)
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const groupOptions = argv.filter(
    (arg) => arg === '--scenario-group' || arg.startsWith('--scenario-group='),
  )
  const scenarioOptions = argv.filter((arg) => arg === '--scenario' || arg.startsWith('--scenario='))
  if (groupOptions.length > 0 && scenarioOptions.length > 0) {
    throw new Error('Pass either --scenario or --scenario-group, not both.')
  }
  if (groupOptions.length > 0) {
    await runScenarioGroup(requestedScenarioGroup(argv))
    return
  }
  await runScenario(requestedScenario(argv))
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
})
