import * as p from '@clack/prompts'
import {
  MODULES,
  loadManifest,
  moduleVars,
  renderModuleContent,
  resolveTarget,
} from './add.js'
import { deepMergePackageJson } from './scaffold/merge.js'
import { unwrap } from './cancel.js'
import { existsSync, mkdirSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import type { ModuleId } from './capabilities.js'

type ModuleDef = (typeof MODULES)[number]

export type ModuleApplyResult =
  | { status: 'applied'; module: ModuleDef }
  | { status: 'already-installed'; module: ModuleDef }
  | { status: 'dry-run'; module: ModuleDef; operations: string[] }
  | { status: 'rejected'; module: ModuleDef; message: string; details?: string[] }

function applyChangesTransactionally(targetDir: string, changes: Map<string, string>): void {
  const targetRoot = resolve(targetDir)
  const targetPrefix = targetRoot.endsWith(sep) ? targetRoot : `${targetRoot}${sep}`
  const snapshots = new Map<string, string | null>()
  const directoriesMissingBeforeWrite = new Set<string>()
  for (const relativePath of changes.keys()) {
    const absolutePath = resolve(targetRoot, relativePath)
    if (!absolutePath.startsWith(targetPrefix)) {
      throw new Error(`Module path "${relativePath}" resolves outside the project directory.`)
    }
    snapshots.set(
      absolutePath,
      existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : null,
    )
    let parent = dirname(absolutePath)
    while (parent.startsWith(targetPrefix) && !existsSync(parent)) {
      directoriesMissingBeforeWrite.add(parent)
      parent = dirname(parent)
    }
  }

  try {
    for (const [relativePath, content] of changes) {
      const absolutePath = resolve(targetRoot, relativePath)
      mkdirSync(dirname(absolutePath), { recursive: true })
      writeFileSync(absolutePath, content)
    }
  } catch (writeError) {
    const rollbackErrors: unknown[] = []
    for (const [absolutePath, previousContent] of [...snapshots].reverse()) {
      try {
        if (previousContent === null) {
          if (existsSync(absolutePath)) unlinkSync(absolutePath)
        } else {
          writeFileSync(absolutePath, previousContent)
        }
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
    }
    for (const directory of [...directoriesMissingBeforeWrite].sort(
      (left, right) => right.length - left.length,
    )) {
      try {
        rmdirSync(directory)
      } catch (rollbackError) {
        const code = (rollbackError as NodeJS.ErrnoException).code
        if (code !== 'ENOENT' && code !== 'ENOTEMPTY') rollbackErrors.push(rollbackError)
      }
    }

    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [writeError, ...rollbackErrors],
        'Module changes failed and one or more rollback operations also failed.',
      )
    }
    throw writeError
  }
}

export function applyModuleToProject(
  moduleId: ModuleId,
  targetDir: string,
  options: { dryRun?: boolean; recordModule?: boolean; onApplying?: () => void } = {},
): ModuleApplyResult {
  const module = MODULES.find((candidate) => candidate.id === moduleId)
  if (!module) throw new Error(`Unknown module "${moduleId}".`)

  const manifest = loadManifest(targetDir)
  if (
    manifest.modules.includes(module.id) ||
    (module.id === 'auth' && manifest.authentication === 'better-auth')
  ) {
    return { status: 'already-installed', module }
  }

  const incompatibility = module.incompatible?.(manifest, targetDir) ?? null
  if (incompatibility) {
    return {
      status: 'rejected',
      module,
      message: `Module "${module.id}" cannot be added: ${incompatibility}`,
    }
  }

  const vars = moduleVars(manifest)
  const files = Object.entries(module.files({
    projectName: manifest.projectName,
    databaseName: manifest.projectName.replace(/-/g, '_'),
    targetDir,
  }, manifest)).map(([path, content]) => [
    path,
    renderModuleContent(content, vars),
  ] as const)

  // Collision check — never overwrite existing files.
  const collisions = files.filter(([path]) => existsSync(join(targetDir, path)))
  if (collisions.length > 0) {
    return {
      status: 'rejected',
      module,
      message: `Refusing to overwrite existing file(s): ${collisions.map(([path]) => path).join(', ')}.`,
    }
  }

  // Patch anchors are validated BEFORE any write — a missing anchor means the
  // project doesn't match the template the module expects, so the whole add
  // aborts cleanly.
  const renderedPatches = (module.patches ?? []).map((patch) => ({
    ...patch,
    find: renderModuleContent(patch.find, vars),
    replace: renderModuleContent(patch.replace, vars),
  }))
  const patchFailures: string[] = []
  for (const patch of renderedPatches) {
    const abs = join(targetDir, patch.file)
    if (!existsSync(abs)) {
      patchFailures.push(`${patch.file} (file missing)`)
      continue
    }
    if (!readFileSync(abs, 'utf8').includes(patch.find)) {
      patchFailures.push(`${patch.file} (anchor not found: "${patch.find.slice(0, 60)}")`)
    }
  }
  if (patchFailures.length > 0) {
    return {
      status: 'rejected',
      module,
      message: 'Patches cannot be applied — aborting before any write:',
      details: patchFailures,
    }
  }

  if (options.dryRun) {
    return {
      status: 'dry-run',
      module,
      operations: [
        ...files.map(([path, content]) => `create  ${path}  (${content.length} bytes)`),
        ...renderedPatches.map((patch) => `patch   ${patch.file}  ("${patch.find.slice(0, 40)}")`),
        ...(module.packageJson?.dependencies
          ? [`deps    ${Object.keys(module.packageJson.dependencies).join(', ')}`]
          : []),
        ...(module.packageJson?.devDependencies
          ? [`devDeps ${Object.keys(module.packageJson.devDependencies).join(', ')}`]
          : []),
        ...(module.packageJson?.scripts
          ? [`scripts ${Object.keys(module.packageJson.scripts).join(', ')}`]
          : []),
      ],
    }
  }

  const changes = new Map<string, string>()
  for (const patch of renderedPatches) {
    const abs = join(targetDir, patch.file)
    const current = changes.get(patch.file) ?? readFileSync(abs, 'utf8')
    changes.set(patch.file, current.replace(patch.find, patch.replace))
  }
  for (const [path, content] of files) {
    if (changes.has(path)) throw new Error(`Module definition writes "${path}" more than once.`)
    changes.set(path, content)
  }

  // Merge package.json fragment into the ROOT manifest (single-manifest rule
  // for module additions; workspaces projects add deps at root for simplicity).
  const rootPkgPath = join(targetDir, 'package.json')
  if (module.packageJson && existsSync(rootPkgPath)) {
    const pkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'))
    const merged = deepMergePackageJson(pkg, module.packageJson)
    changes.set('package.json', `${JSON.stringify(merged, null, 2)}\n`)
  }

  const authentication = module.id === 'auth' ? 'better-auth' : manifest.authentication
  const updatedManifest = {
    ...manifest,
    ...(authentication ? { authentication } : {}),
    modules: options.recordModule === false ? manifest.modules : [...manifest.modules, module.id],
  }
  changes.set('.omnicraft/project.json', `${JSON.stringify(updatedManifest, null, 2)}\n`)

  options.onApplying?.()
  applyChangesTransactionally(targetDir, changes)
  return { status: 'applied', module }
}

export async function runAdd(
  moduleArg: string | undefined,
  targetArg: string | undefined,
  dryRun: boolean,
): Promise<void> {
  const targetDir = resolveTarget(targetArg)
  let module: ModuleDef | undefined

  if (moduleArg) {
    module = MODULES.find((candidate) => candidate.id === moduleArg)
    if (!module) {
      p.log.error(`Unknown module "${moduleArg}". Available: ${MODULES.map((m) => m.id).join(', ')}`)
      process.exitCode = 1
      return
    }
  } else {
    module = unwrap<ModuleDef>(
      await p.select<ModuleDef>({
        message: 'Which module do you want to add?',
        options: MODULES.map((candidate) => ({
          value: candidate,
          label: candidate.id,
          hint: candidate.description,
        })),
      }),
    )
  }

  const spinner = dryRun ? null : p.spinner()
  const result = applyModuleToProject(module.id as ModuleId, targetDir, {
    dryRun,
    onApplying: () => spinner?.start(),
  })
  if (result.status === 'already-installed') {
    p.log.warn(`Module "${module.id}" is already installed — nothing to do (adds are idempotent).`)
    return
  }
  if (result.status === 'rejected') {
    p.log.error(result.message)
    for (const detail of result.details ?? []) p.log.error(`  - ${detail}`)
    process.exitCode = 1
    return
  }
  if (result.status === 'dry-run') {
    p.note(result.operations.join('\n'), `Dry run — omnicraft add ${module.id}`)
    return
  }

  spinner?.stop(`Module "${module.id}" added`)
  if (module.packageJson) {
    p.log.warn('New dependencies were added to package.json — run your package manager install.')
  }
  if (module.nextSteps?.length) p.log.message(module.nextSteps.join('\n'))
}
