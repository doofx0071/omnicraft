import assert from 'node:assert/strict'
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MODULES } from '../src/add.js'
import {
  isFrontendAllowedByFlags,
  isProjectTypeAllowedByFlags,
  isRuntimeAllowedByFlags,
} from '../src/compatibility.js'
import { TEMPLATES_ROOT } from '../src/config.js'
import { buildManifest } from '../src/manifest.js'
import { resolveAnswers, validateStackFlags } from '../src/prefill.js'
import { composeLayers } from '../src/scaffold/compose.js'
import {
  INTEGRATION_TARGETS,
  NODE_RUNTIME_SCENARIOS,
  REJECTED_MODULE_CAPABILITIES,
  registeredRejectedMatrixRowPrefix,
  registeredMatrixRowPrefix,
  reactViteTestingGroupId,
  SUPPORTED_CAPABILITIES,
  type NodeRuntimeScenario,
  type RejectedModuleCapability,
  type SupportedCapability,
  type SupportedCombination,
} from '../src/support-evidence.js'
import type { Answers, Database } from '../src/types.js'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

function workflowJob(lines: string[], name: string): string {
  const header = `  ${name}:`
  const start = lines.findIndex((line) => line.trimEnd() === header)
  assert(start >= 0, `CI is missing integration job "${name}".`)
  let end = start + 1
  while (end < lines.length && !/^  [a-zA-Z0-9_-]+:\s*$/.test(lines[end] ?? '')) end += 1
  return lines.slice(start, end).join('\n')
}

function jobDependencies(job: string, name: string): string[] {
  const lines = job.split(/\r?\n/)
  const start = lines.findIndex((line) => line === '    needs:')
  assert(start >= 0, `The supported-matrix job must declare required jobs in "needs".`)
  const dependencies: string[] = []
  for (const line of lines.slice(start + 1)) {
    const match = /^      - ([a-zA-Z0-9_-]+)$/.exec(line)
    if (!match) break
    dependencies.push(match[1] ?? '')
  }
  assert(dependencies.length > 0, `The "${name}" job must require at least one job.`)
  return dependencies
}

function matrixList(job: string, key: string): string[] {
  const lines = job.split(/\r?\n/)
  const start = lines.findIndex((line) => line === `        ${key}:`)
  assert(start >= 0, `The integration job is missing matrix key "${key}".`)
  const values: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith('          - ')) break
    values.push(line.slice('          - '.length).trim())
  }
  return values
}

function argsFor(combination: SupportedCombination) {
  return {
    latest: false,
    skipInstall: true,
    debug: false,
    help: false,
    version: false,
    yes: true,
    ...combination.flags,
    extras: [...(combination.flags.extras ?? [])],
  }
}

function requiredDatabase(answers: Answers, capability: SupportedCapability): Database {
  assert(answers.database, `Supported capability "${capability.id}" must specify a database.`)
  return answers.database
}

function assertExtras(
  answers: Answers,
  expected: Answers['extras'],
  capability: SupportedCapability,
): void {
  assert.deepEqual(answers.extras, expected, `"${capability.id}" does not match its generated-project extras.`)
}

function assertReactTypescriptApi(answers: Answers, capability: SupportedCapability): void {
  assert.equal(answers.frontend, 'react', `"${capability.id}" must use React/Vite.`)
  assert.equal(answers.language, 'typescript', `"${capability.id}" must use TypeScript.`)
  assert.equal(answers.architecture.kind, 'separate-frontend-api', `"${capability.id}" must use a separate API.`)
  assertExtras(answers, { tailwind: false, eslintPrettier: false, shadcn: false }, capability)
}

function expectedScenario(
  capability: SupportedCapability,
  combination: SupportedCombination,
  answers: Answers,
): string {
  switch (capability.target) {
    case 'node-runtime': {
      const database = requiredDatabase(answers, capability)
      const nodeScenarios: readonly NodeRuntimeScenario[] = NODE_RUNTIME_SCENARIOS
      const scenario = nodeScenarios.find(
        (candidate) =>
          candidate.framework === answers.backendFramework &&
          candidate.orm === answers.orm &&
          candidate.database === database &&
          (candidate.frontend === undefined || candidate.frontend === answers.frontend) &&
          (candidate.language === undefined || candidate.language === answers.language),
      )
      assert(scenario, `No exact Node runtime scenario matches Supported capability "${capability.id}".`)
      assert.equal(answers.architecture.kind, 'separate-frontend-api', `"${capability.id}" must use a separate API.`)
      if (scenario.frontend === undefined) {
        assert.equal(answers.frontend, 'react', `"${capability.id}" must use React/Vite.`)
      }
      if (scenario.language === undefined) {
        assert.equal(answers.language, 'typescript', `"${capability.id}" must use TypeScript.`)
      }
      assertExtras(answers, { tailwind: false, eslintPrettier: false, shadcn: false }, capability)
      return scenario.id
    }
    case 'node-express-drizzle': {
      const database = requiredDatabase(answers, capability)
      assert.equal(answers.backendRuntime, 'node', `"${capability.id}" must use Node.js.`)
      assert.equal(answers.backendFramework, 'express', `"${capability.id}" must use Express.`)
      assert.equal(answers.orm, 'drizzle', `"${capability.id}" must use Drizzle.`)
      assertReactTypescriptApi(answers, capability)
      if (capability.matrixFormat === 'auth-module') {
        assert.equal(combination.module, 'auth', `"${capability.id}" must validate the auth module.`)
      }
      if (capability.matrixFormat === 'creation-auth') {
        assert.equal(answers.authentication, 'better-auth', `"${capability.id}" must select Better Auth.`)
        assert.equal(combination.flags.auth, 'better-auth', `"${capability.id}" must pass --auth better-auth.`)
        assert.equal(combination.module, undefined, `"${capability.id}" must not model auth as an add module.`)
      }
      return database
    }
    case 'nextjs-runtime': {
      const database = requiredDatabase(answers, capability)
      assert.equal(answers.frontend, 'nextjs', `"${capability.id}" must use Next.js.`)
      assert.equal(answers.language, 'typescript', `"${capability.id}" must use TypeScript.`)
      assert.equal(answers.architecture.kind, 'integrated-fullstack', `"${capability.id}" must use integrated full-stack.`)
      assert.equal(answers.orm, 'none', `"${capability.id}" must use raw SQL.`)
      assertExtras(answers, { tailwind: true, eslintPrettier: true, shadcn: false }, capability)
      return database
    }
    case 'frontend-runtime':
      assert.equal(answers.frontend, 'react', `"${capability.id}" must use React/Vite.`)
      assert.equal(answers.language, 'javascript', `"${capability.id}" must use JavaScript.`)
      assert.equal(answers.architecture.kind, 'frontend-only', `"${capability.id}" must be frontend-only.`)
      assertExtras(answers, { tailwind: false, eslintPrettier: false, shadcn: false }, capability)
      return 'react-js-frontend-only'
    case 'supabase-auth': {
      assert.equal(answers.frontend, 'react', `"${capability.id}" must use React/Vite.`)
      assert.equal(answers.language, 'typescript', `"${capability.id}" must use TypeScript.`)
      assert.equal(answers.fullStack, false, `"${capability.id}" must be frontend-only.`)
      assert.equal(answers.architecture.kind, 'frontend-only', `"${capability.id}" must be frontend-only.`)
      assert.equal(answers.backendRuntime, null, `"${capability.id}" must not add a backend.`)
      assert.equal(answers.backendFramework, null, `"${capability.id}" must not add a backend.`)
      assert.equal(answers.database, null, `"${capability.id}" must not select a local database.`)
      assert.equal(answers.authentication, 'supabase-auth', `"${capability.id}" must select Supabase Auth.`)
      assert.equal(combination.flags.auth, 'supabase-auth', `"${capability.id}" must pass --auth supabase-auth.`)
      assert.equal(combination.module, undefined, `"${capability.id}" must not model auth as an add module.`)
      assertExtras(answers, { tailwind: false, eslintPrettier: false, shadcn: false }, capability)
      const manifest = buildManifest(answers, 'support-evidence', 'npm')
      assert.equal(manifest.authentication, 'supabase-auth')
      assert.deepEqual(manifest.modules, [], `"${capability.id}" must keep auth separate from module history.`)
      return 'react-ts-supabase-auth-frontend-only'
    }
    case 'python-fastapi': {
      const database = requiredDatabase(answers, capability)
      assert.equal(answers.backendRuntime, 'python', `"${capability.id}" must use Python.`)
      assert.equal(answers.backendFramework, 'fastapi', `"${capability.id}" must use FastAPI.`)
      assertReactTypescriptApi(answers, capability)
      return database
    }
    case 'php-laravel': {
      const database = requiredDatabase(answers, capability)
      assert.equal(answers.backendRuntime, 'php', `"${capability.id}" must use PHP.`)
      assert.equal(answers.backendFramework, 'laravel', `"${capability.id}" must use Laravel.`)
      assertReactTypescriptApi(answers, capability)
      return database
    }
    case 'php-laravel-sanctum-spa-auth': {
      assert.equal(answers.backendRuntime, 'php', `"${capability.id}" must use PHP.`)
      assert.equal(answers.backendFramework, 'laravel', `"${capability.id}" must use Laravel.`)
      assertReactTypescriptApi(answers, capability)
      assert.equal(answers.fullStack, true, `"${capability.id}" must use a separate Laravel API.`)
      assert.equal(answers.orm, null, `"${capability.id}" must use Eloquent without a separate ORM choice.`)
      assert.equal(answers.database, 'sqlite', `"${capability.id}" is verified only on SQLite.`)
      assert.equal(answers.authentication, 'laravel-native', `"${capability.id}" must select Laravel native auth.`)
      assert.equal(combination.flags.auth, 'laravel-native', `"${capability.id}" must pass --auth laravel-native.`)
      assert.equal(combination.module, undefined, `"${capability.id}" must not model auth as an add module.`)
      const manifest = buildManifest(answers, 'support-evidence', 'npm')
      assert.equal(manifest.authentication, 'laravel-native')
      assert.deepEqual(manifest.modules, [], `"${capability.id}" must keep auth separate from module history.`)
      return 'laravel-native'
    }
    case 'php-laravel-livewire-auth': {
      const authentication = combination.flags.auth
      assert(
        authentication === 'none' || authentication === 'laravel-native',
        `"${capability.id}" must select None or Laravel native auth.`,
      )
      assert.equal(answers.frontend, 'livewire', `"${capability.id}" must use Livewire.`)
      assert.equal(answers.language, null, `"${capability.id}" must not select a separate frontend language.`)
      assert.equal(answers.fullStack, true, `"${capability.id}" must be integrated full-stack.`)
      assert.equal(answers.backendRuntime, 'php', `"${capability.id}" must use PHP.`)
      assert.equal(answers.backendFramework, 'laravel', `"${capability.id}" must use Laravel.`)
      assert.equal(answers.orm, null, `"${capability.id}" must use Eloquent without a separate ORM choice.`)
      assert.equal(answers.database, 'sqlite', `"${capability.id}" must use SQLite.`)
      assert.equal(answers.architecture.kind, 'integrated-laravel', `"${capability.id}" must be integrated Laravel.`)
      assert.equal(answers.authentication, authentication)
      assert.equal(combination.module, undefined, `"${capability.id}" must not model auth as an add module.`)
      assertExtras(answers, { tailwind: false, eslintPrettier: false, shadcn: false }, capability)
      return authentication
    }
    case 'php-laravel-inertia-react-auth': {
      const authentication = combination.flags.auth
      assert(
        authentication === 'none' || authentication === 'laravel-native',
        `"${capability.id}" must select None or Laravel native auth.`,
      )
      assert.equal(answers.frontend, 'inertia-react', `"${capability.id}" must use Inertia React.`)
      assert.equal(answers.language, 'typescript', `"${capability.id}" must use TypeScript.`)
      assert.equal(answers.fullStack, true, `"${capability.id}" must be integrated full-stack.`)
      assert.equal(answers.backendRuntime, 'php', `"${capability.id}" must use PHP.`)
      assert.equal(answers.backendFramework, 'laravel', `"${capability.id}" must use Laravel.`)
      assert.equal(answers.orm, null, `"${capability.id}" must use Eloquent without a separate ORM choice.`)
      assert.equal(answers.database, 'sqlite', `"${capability.id}" must use SQLite.`)
      assert.equal(answers.architecture.kind, 'integrated-laravel', `"${capability.id}" must be integrated Laravel.`)
      assert.equal(answers.architecture.mode, 'inertia-react', `"${capability.id}" must use the Inertia React mode.`)
      assert.equal(answers.authentication, authentication)
      assert.equal(combination.module, undefined, `"${capability.id}" must not model auth as an add module.`)
      assertExtras(answers, { tailwind: false, eslintPrettier: false, shadcn: false }, capability)
      return authentication
    }
    case 'docker-module': {
      const database = requiredDatabase(answers, capability)
      assert.equal(combination.module, 'docker', `"${capability.id}" must validate the docker module.`)
      assert.equal(answers.backendRuntime, 'node', `"${capability.id}" must use Node.js.`)
      assert.equal(answers.backendFramework, 'express', `"${capability.id}" must use Express.`)
      assert.equal(answers.orm, 'drizzle', `"${capability.id}" must use Drizzle.`)
      assert.equal(answers.architecture.kind, 'separate-frontend-api', `"${capability.id}" must use a separate API.`)
      assert.equal(answers.frontend, 'react', `"${capability.id}" must use React/Vite.`)
      assert.equal(answers.language, 'typescript', `"${capability.id}" must use TypeScript.`)
      assertExtras(answers, { tailwind: false, eslintPrettier: false, shadcn: false }, capability)
      return database
    }
    case 'module-runtime':
      if (capability.matrixFormat === 'testing-module') {
        assert.equal(combination.module, 'testing', `"${capability.id}" must validate the testing module.`)
        assertExtras(answers, { tailwind: false, eslintPrettier: false, shadcn: false }, capability)
        const testingScenarios = [
          {
            id: 'add-testing-react-vite-ts',
            frontend: 'react',
            language: 'typescript',
            fullStack: false,
            architecture: 'frontend-only',
            backendRuntime: null,
            backendFramework: null,
            orm: null,
            database: null,
          },
          {
            id: 'add-testing-react-vite-js-frontend-only',
            frontend: 'react',
            language: 'javascript',
            fullStack: false,
            architecture: 'frontend-only',
            backendRuntime: null,
            backendFramework: null,
            orm: null,
            database: null,
          },
          {
            id: 'add-testing-react-vite-ts-separate-api',
            frontend: 'react',
            language: 'typescript',
            fullStack: true,
            architecture: 'separate-frontend-api',
            backendRuntime: 'node',
            backendFramework: 'express',
            orm: 'drizzle',
            database: 'sqlite',
          },
          {
            id: 'add-testing-react-vite-js-separate-api',
            frontend: 'react',
            language: 'javascript',
            fullStack: true,
            architecture: 'separate-frontend-api',
            backendRuntime: 'node',
            backendFramework: 'express',
            orm: 'drizzle',
            database: 'sqlite',
          },
          {
            id: 'add-testing-fastapi-sqlite',
            frontend: 'react',
            language: 'typescript',
            fullStack: true,
            architecture: 'separate-frontend-api',
            backendRuntime: 'python',
            backendFramework: 'fastapi',
            orm: null,
            database: 'sqlite',
          },
          {
            id: 'add-testing-laravel-sqlite',
            frontend: 'react',
            language: 'typescript',
            fullStack: true,
            architecture: 'separate-frontend-api',
            backendRuntime: 'php',
            backendFramework: 'laravel',
            orm: null,
            database: 'sqlite',
          },
        ] as const
        const scenario = testingScenarios.find(
          (candidate) =>
            candidate.frontend === answers.frontend &&
            candidate.language === answers.language &&
            candidate.fullStack === answers.fullStack &&
            candidate.architecture === answers.architecture.kind &&
            candidate.backendRuntime === answers.backendRuntime &&
            candidate.backendFramework === answers.backendFramework &&
            candidate.orm === answers.orm &&
            candidate.database === answers.database,
        )
        assert(scenario, `No exact testing module scenario matches Supported capability "${capability.id}".`)
        return scenario.id
      }
      assert.equal(answers.frontend, 'react', `"${capability.id}" must use React/Vite.`)
      assert.equal(answers.language, 'typescript', `"${capability.id}" must use TypeScript.`)
      assert.equal(answers.architecture.kind, 'frontend-only', `"${capability.id}" must be frontend-only.`)
      assert.equal(capability.matrixFormat, 'shadcn-extra', `"${capability.id}" has an unsupported module matrix format.`)
      assert.equal(answers.extras.shadcn, true, `"${capability.id}" must enable shadcn.`)
      assertExtras(answers, { tailwind: true, eslintPrettier: true, shadcn: true }, capability)
      assert.equal(combination.module, undefined, `"${capability.id}" must use the shadcn extra, not an add module.`)
      return 'shadcn-react-vite-ts-frontend-only'
    case 'module-runtime-react-vite':
      assert.equal(capability.matrixFormat, 'testing-module-react-vite-family')
      assert.equal(combination.module, 'testing', `"${capability.id}" must validate the testing module.`)
      assertExtras(
        answers,
        {
          tailwind:
            combination.flags.extras.includes('tailwind') ||
            combination.flags.extras.includes('shadcn'),
          eslintPrettier: combination.flags.extras.includes('eslint'),
          shadcn: combination.flags.extras.includes('shadcn'),
        },
        capability,
      )
      assert.equal(answers.frontend, 'react')
      return reactViteTestingGroupId(combination.flags)
    default:
      throw new Error(`Supported capability "${capability.id}" has no exact scenario mapping for "${capability.target}".`)
  }
}

function validateCombination(
  capability: SupportedCapability,
  combination: SupportedCombination,
  index: number,
): string {
  const args = argsFor(combination)
  const targetDir = join(tmpdir(), `omnicraft-support-check-${capability.id}-${index}`)
  validateStackFlags(args)
  assert(
    isProjectTypeAllowedByFlags('web', args),
    `Prompt filtering rejects the project type for "${capability.id}".`,
  )

  const answers = resolveAnswers(args, `support-${capability.id}`, targetDir)
  assert(
    isFrontendAllowedByFlags(answers.frontend, args),
    `Prompt filtering rejects the frontend for "${capability.id}".`,
  )
  if (answers.backendRuntime) {
    assert(
      isRuntimeAllowedByFlags(answers.backendRuntime, args),
      `Prompt filtering rejects runtime "${answers.backendRuntime}" for "${capability.id}".`,
    )
  }

  const layers = composeLayers(answers)
  assert(layers.length > 0, `Composition produced no production layers for "${capability.id}".`)
  for (const layer of layers) {
    assert(
      existsSync(join(TEMPLATES_ROOT, layer.src)),
      `Supported capability "${capability.id}" references a missing production layer: ${layer.src}.`,
    )
  }

  if (combination.module) {
    const module = MODULES.find((candidate) => candidate.id === combination.module)
    assert(
      module,
      `Supported capability "${capability.id}" references an unavailable module "${combination.module}".`,
    )
    const manifest = buildManifest(answers, 'support-evidence', 'npm')
    const reason = module.incompatible?.(manifest, targetDir) ?? null
    assert.equal(
      reason,
      null,
      `Module "${combination.module}" rejects Supported capability "${capability.id}": ${reason}`,
    )
  }

  if (combination.flags.auth === 'better-auth') {
    const module = MODULES.find((candidate) => candidate.id === 'auth')
    assert(module, `Supported capability "${capability.id}" requires the existing auth module.`)
    const manifest = buildManifest(answers, 'support-evidence', 'npm')
    assert.equal(manifest.authentication, 'better-auth')
    assert.deepEqual(manifest.modules, [], `"${capability.id}" must keep auth separate from module history.`)
    const reason = module.incompatible?.(manifest, targetDir) ?? null
    assert.equal(
      reason,
      null,
      `The existing auth module rejects Supported creation-time capability "${capability.id}": ${reason}`,
    )
  }

  if (
    capability.matrixFormat === 'laravel-livewire-auth' ||
    capability.matrixFormat === 'laravel-inertia-react-auth' ||
    capability.matrixFormat === 'laravel-sanctum-spa-auth'
  ) {
    const manifest = buildManifest(answers, 'support-evidence', 'npm')
    assert.equal(manifest.authentication, answers.authentication)
    assert.deepEqual(manifest.modules, [], `"${capability.id}" must keep auth separate from module history.`)
  }

  return expectedScenario(capability, combination, answers)
}

function validateRejectedCombination(
  capability: RejectedModuleCapability,
  combination: SupportedCombination,
  index: number,
): string {
  const args = argsFor(combination)
  const targetDir = mkdtempSync(join(tmpdir(), `omnicraft-rejected-support-check-${capability.id}-${index}-`))
  try {
    validateStackFlags(args)
    assert(
      isProjectTypeAllowedByFlags('web', args),
      `Prompt filtering rejects the project type for "${capability.id}".`,
    )
    const answers = resolveAnswers(args, `support-${capability.id}`, targetDir)
    assert(
      isFrontendAllowedByFlags(answers.frontend, args),
      `Prompt filtering rejects the frontend for "${capability.id}".`,
    )
    if (answers.backendRuntime) {
      assert(
        isRuntimeAllowedByFlags(answers.backendRuntime, args),
        `Prompt filtering rejects runtime "${answers.backendRuntime}" for "${capability.id}".`,
      )
    }
    assert.equal(answers.frontend, 'react')
    assert.equal(answers.language, 'javascript')
    assert(
      answers.extras.shadcn,
      `Rejected capability "${capability.id}" must enable shadcn.`,
    )

    const layers = composeLayers(answers)
    assert(layers.length > 0, `Composition produced no production layers for "${capability.id}".`)
    for (const layer of layers) {
      assert(
        existsSync(join(TEMPLATES_ROOT, layer.src)),
        `Rejected capability "${capability.id}" references a missing production layer: ${layer.src}.`,
      )
    }

    const module = MODULES.find((candidate) => candidate.id === combination.module)
    assert(module, `Rejected capability "${capability.id}" references a missing module.`)
    const appRoot = answers.architecture.kind === 'separate-frontend-api' ? join(targetDir, 'client') : targetDir
    mkdirSync(join(appRoot, 'src'), { recursive: true })
    writeFileSync(join(appRoot, 'src', 'main.jsx'), 'export default function App() {}\n')
    const manifest = buildManifest(answers, 'support-evidence', 'npm')
    assert.equal(
      module.incompatible?.(manifest, targetDir) ?? null,
      capability.reason,
      `Rejected module capability "${capability.id}" no longer matches the production preflight guard.`,
    )
    return reactViteTestingGroupId(combination.flags)
  } finally {
    rmSync(targetDir, { recursive: true, force: true })
  }
}

export function validateSupportEvidence(
  capabilities: readonly SupportedCapability[] = SUPPORTED_CAPABILITIES,
): void {
  const matrixPath = join(repoRoot, 'docs', 'templates', 'stack-support-matrix.md')
  const workflowPath = join(repoRoot, '.github', 'workflows', 'ci.yml')
  const matrix = readFileSync(matrixPath, 'utf8')
  const matrixLines = matrix.split(/\r?\n/)
  const workflowLines = readFileSync(workflowPath, 'utf8').split(/\r?\n/)
  const workflow = workflowLines.join('\n')
  const supportedRows = matrixLines.filter(
    (line) => line.startsWith('|') && line.includes('**Supported**'),
  )
  const idPattern = /<!-- support-id: ([a-z0-9-]+) -->/g
  const documentedIds = new Map<string, string>()

  for (const row of supportedRows) {
    const ids = [...row.matchAll(idPattern)].map((match) => match[1] ?? '')
    assert.equal(
      ids.length,
      1,
      `Every Supported matrix row must have exactly one support id: ${row}`,
    )
    const id = ids[0] ?? ''
    assert(!documentedIds.has(id), `Support id "${id}" appears more than once in the matrix.`)
    documentedIds.set(id, row)
  }

  const rejectedRows = matrixLines.filter(
    (line) => line.startsWith('|') && line.includes('**Rejected — unsupported combination**'),
  )
  const rejectionIdPattern = /<!-- rejection-id: ([a-z0-9-]+) -->/g
  const documentedRejections = new Map<string, string>()
  for (const row of rejectedRows) {
    const ids = [...row.matchAll(rejectionIdPattern)].map((match) => match[1] ?? '')
    if (ids.length === 0) continue
    assert.equal(ids.length, 1, `Every registered rejection row must have exactly one rejection id: ${row}`)
    const id = ids[0] ?? ''
    assert(!documentedRejections.has(id), `Rejection id "${id}" appears more than once in the matrix.`)
    documentedRejections.set(id, row)
  }

  const registryIds = new Set<string>()
  for (const capability of capabilities) {
    assert(!registryIds.has(capability.id), `Support registry duplicates id "${capability.id}".`)
    registryIds.add(capability.id)

    const row = documentedIds.get(capability.id)
    assert(row, `Support registry entry "${capability.id}" has no Supported matrix row.`)
    const exactScenarios = capability.combinations.map((combination, index) =>
      validateCombination(capability, combination, index),
    )
    assert.deepEqual(
      [...capability.scenarios].sort(),
      [...exactScenarios].sort(),
      `Supported capability "${capability.id}" must map each exact combination to its matching runtime scenario.`,
    )
    const matrixRowPrefix = registeredMatrixRowPrefix(capability)
    assert(
      row.startsWith(matrixRowPrefix),
      `Supported matrix row "${capability.id}" no longer matches its registered combination.`,
    )

    const target = INTEGRATION_TARGETS[capability.target]
    const targetScenarios: readonly string[] = target.scenarios
    assert(
      capability.scenarios.every((scenario) => targetScenarios.includes(scenario)),
      `Support entry "${capability.id}" references a scenario missing from target "${capability.target}".`,
    )
  }

  assert.deepEqual(
    [...documentedIds.keys()].sort(),
    [...registryIds].sort(),
    'The Supported matrix rows and the evidence registry must contain the same ids.',
  )

  const rejectionRegistryIds = new Set<string>()
  for (const capability of REJECTED_MODULE_CAPABILITIES) {
    assert(
      !rejectionRegistryIds.has(capability.id),
      `Rejection registry duplicates id "${capability.id}".`,
    )
    rejectionRegistryIds.add(capability.id)
    const row = documentedRejections.get(capability.id)
    assert(row, `Rejection registry entry "${capability.id}" has no Rejected matrix row.`)
    const exactScenarios = capability.combinations.map((combination, index) =>
      validateRejectedCombination(capability, combination, index),
    )
    const targetScenarios = INTEGRATION_TARGETS[capability.target].scenarios
    assert(
      exactScenarios.every((scenario) => targetScenarios.includes(scenario)),
      `Rejection capability "${capability.id}" references a scenario missing from target "${capability.target}".`,
    )
    assert(
      row.startsWith(registeredRejectedMatrixRowPrefix(capability)),
      `Rejected matrix row "${capability.id}" no longer matches its registered combinations.`,
    )
  }
  assert.deepEqual(
    [...documentedRejections.keys()].sort(),
    [...rejectionRegistryIds].sort(),
    'Registered Rejected matrix rows and the rejection registry must contain the same ids.',
  )

  for (const [id, target] of Object.entries(INTEGRATION_TARGETS)) {
    assert(target.scenarios.length > 0, `Integration target "${id}" must declare at least one scenario.`)
    assert(
      existsSync(join(repoRoot, 'packages', 'cli', target.script)),
      `Integration target "${id}" points to a missing script: ${target.script}.`,
    )
    const job = workflowJob(workflowLines, target.workflowJob)
    assert(
      job.includes(target.workflowCommand),
      `CI job "${target.workflowJob}" no longer runs the registered command: ${target.workflowCommand}.`,
    )
    if (id === 'module-runtime-react-vite') {
      assert.deepEqual(
        [...matrixList(job, 'group')].sort(),
        [...target.scenarios].sort(),
        'Every registered React/Vite add-testing group must run in the hosted matrix.',
      )
    }
    if (id === 'native-platform') {
      const nativeScenarios = [...job.matchAll(/^          - scenario: ([a-z0-9-]+)$/gm)].map(
        (match) => match[1] as string,
      )
      assert.deepEqual(
        [...nativeScenarios].sort(),
        [...target.scenarios].sort(),
        'Every registered native platform scenario must run in the hosted matrix.',
      )
      const nativeScript = readFileSync(join(repoRoot, 'packages', 'cli', target.script), 'utf8')
      for (const scenario of target.scenarios) {
        assert(
          nativeScript.includes(`scenario === '${scenario}'`),
          `Native platform scenario "${scenario}" has no script handler.`,
        )
      }
    }
  }

  const releaseGate = workflowJob(workflowLines, 'supported-matrix')
  assert(releaseGate.includes('always()'), 'The supported-matrix aggregate job must run after failed dependencies.')
  const requiredJobs = new Set(jobDependencies(releaseGate, 'supported-matrix'))
  for (const target of Object.values(INTEGRATION_TARGETS)) {
    assert(
      requiredJobs.has(target.workflowJob),
      `The supported-matrix aggregate job must require "${target.workflowJob}".`,
    )
  }
  for (const requiredResult of ['unix', 'support-evidence', 'package']) {
    assert(
      requiredJobs.has(requiredResult),
      `The supported-matrix aggregate job must require "${requiredResult}" checks.`,
    )
  }

  assert(workflow.includes('workflow_dispatch:'), 'CI must support an explicit pre-release validation run.')
  assert(workflow.includes('schedule:'), 'CI must run the supported-stack release gate nightly.')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  validateSupportEvidence()
  console.log(`[support-matrix] ${SUPPORTED_CAPABILITIES.length} Supported rows map to CI evidence.`)
}
