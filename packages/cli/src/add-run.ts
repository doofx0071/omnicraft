import * as p from '@clack/prompts'
import {
  MODULES,
  loadManifest,
  moduleVars,
  renderModuleContent,
  resolveTarget,
  saveManifest,
} from './add.js'
import { deepMergePackageJson } from './scaffold/merge.js'
import { unwrap } from './cancel.js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export async function runAdd(moduleArg: string | undefined, targetArg: string | undefined, dryRun: boolean): Promise<void> {
  const targetDir = resolveTarget(targetArg)
  type ModuleDef = (typeof MODULES)[number]
  let module: ModuleDef | undefined

  if (moduleArg) {
    module = MODULES.find((m) => m.id === moduleArg)
    if (!module) {
      p.log.error(`Unknown module "${moduleArg}". Available: ${MODULES.map((m) => m.id).join(', ')}`)
      process.exitCode = 1
      return
    }
  } else {
    module = unwrap<ModuleDef>(
      await p.select<ModuleDef>({
        message: 'Which module do you want to add?',
        options: MODULES.map((m) => ({ value: m, label: m.id, hint: m.description })),
      }),
    )
  }

  const manifest = loadManifest(targetDir)
  const installed = manifest.modules.includes(module.id)
  if (installed) {
    p.log.warn(`Module "${module.id}" is already installed — nothing to do (adds are idempotent).`)
    return
  }

  const incompatibility = module.incompatible?.(manifest) ?? null
  if (incompatibility) {
    p.log.error(`Module "${module.id}" cannot be added: ${incompatibility}`)
    process.exitCode = 1
    return
  }

  const vars = moduleVars(manifest)
  const files = Object.entries(module.files({ projectName: manifest.projectName, databaseName: manifest.projectName.replace(/-/g, '_') }, manifest)).map(([path, content]) => [
    path,
    renderModuleContent(content, vars),
  ] as const)

  // Collision check — never overwrite existing files.
  const collisions = files.filter(([path]) => existsSync(join(targetDir, path)))
  if (collisions.length > 0) {
    p.log.error(
      `Refusing to overwrite existing file(s): ${collisions.map(([path]) => path).join(', ')}.`,
    )
    process.exitCode = 1
    return
  }

  if (dryRun) {
    p.note(
      [
        ...files.map(([path, content]) => `create  ${path}  (${content.length} bytes)`),
        module.packageJson?.dependencies
          ? `deps    ${Object.keys(module.packageJson.dependencies).join(', ')}`
          : null,
        module.packageJson?.devDependencies
          ? `devDeps ${Object.keys(module.packageJson.devDependencies).join(', ')}`
          : null,
        module.packageJson?.scripts
          ? `scripts ${Object.keys(module.packageJson.scripts).join(', ')}`
          : null,
      ]
        .filter(Boolean)
        .join('\n'),
      `Dry run — omnicraft add ${module.id}`,
    )
    return
  }

  const spinner = p.spinner()
  for (const [path, content] of files) {
    const abs = join(targetDir, path)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }

  // Merge package.json fragment into the ROOT manifest (single-manifest rule
  // for module additions; workspaces projects add deps at root for simplicity).
  const rootPkgPath = join(targetDir, 'package.json')
  if (module.packageJson && existsSync(rootPkgPath)) {
    const pkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'))
    const merged = deepMergePackageJson(pkg, module.packageJson)
    writeFileSync(rootPkgPath, `${JSON.stringify(merged, null, 2)}\n`)
  }

  manifest.modules.push(module.id)
  saveManifest(targetDir, manifest)

  spinner.stop(`Module "${module.id}" added`)
  if (module.packageJson) {
    p.log.warn('New dependencies were added to package.json — run your package manager install.')
  }
  if (module.nextSteps?.length) p.log.message(module.nextSteps.join('\n'))
}
