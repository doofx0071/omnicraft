import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'
import { isProtectedPath } from '../validators.js'
import { deepMergePackageJson, mergeExtensionsJson } from './merge.js'
import { assertNoLayerTypeConflicts } from './preflight.js'
import { assertNoUnresolvedTokens, isBinaryFile, renderString, restoreDotfileName } from './renderer.js'

/**
 * Layer-relative path of the one non-manifest file the engine merges instead
 * of overwriting. Fragments from any layer (client, extras, db) land in the
 * TARGET ROOT's `.vscode/extensions.json` with their `recommendations` arrays
 * unioned, so a workspace opened at the root sees one combined list — the
 * same relocation idea as `mergeManifestAtRoot`, restricted to exactly this
 * path pattern. `.vscode` is a normal publishable directory: npm's special
 * dotfile rules do not apply to it, so no `_`-prefixed name is needed.
 */
const EXTENSIONS_JSON_FRAGMENT_PATH = '.vscode/extensions.json'

/** A template layer: a directory under the templates root copied into `dest` relative to the target. */
export interface Layer {
  src: string
  dest: string
  /**
   * Merge the layer's package.json fragment into the TARGET-ROOT manifest
   * instead of the file at its own destination. For single-manifest projects
   * (Next.js integrated apps) whose db layer lives in a nested dir but whose
   * dependencies belong to the one root package.json.
   */
  mergeManifestAtRoot?: boolean
}

export class MissingLayerError extends Error {
  constructor(layer: Layer, templatesRoot: string) {
    super(`Template layer "${layer.src}" not found in ${templatesRoot}`)
    this.name = 'MissingLayerError'
  }
}

/** Copies one layer into the target directory, rendering tokens and merging package.json manifests. */
export function applyLayer(
  templatesRoot: string,
  layer: Layer,
  variables: Record<string, string>,
  targetDir: string,
): void {
  assertNoLayerTypeConflicts(templatesRoot, [layer], targetDir)
  writeLayerFiles(templatesRoot, layer, variables, targetDir)
}

function writeLayerFiles(
  templatesRoot: string,
  layer: Layer,
  variables: Record<string, string>,
  targetDir: string,
): void {
  const layerRoot = join(templatesRoot, layer.src)
  if (!statSyncSafe(layerRoot)) throw new MissingLayerError(layer, templatesRoot)

  const entries = readdirSync(layerRoot, { recursive: true, encoding: 'utf8' })

  for (const entry of entries) {
    const srcPath = join(layerRoot, entry)
    if (!statSync(srcPath).isFile()) continue

    const segments = relative(layerRoot, srcPath).split(/[\\/]/)
    const renamed = segments.map((s) => restoreDotfileName(s))
    const destRelToTarget = [layer.dest, ...renamed].filter((s) => s !== '.').join('/')

    // Secrets and VCS state in the destination are user-owned — templates
    // never touch them (their .env.example / _gitignore forms still ship).
    if (isProtectedPath(destRelToTarget)) continue

    const destPath = join(targetDir, layer.dest, ...renamed)

    if (isBinaryFile(entry)) {
      mkdirSync(dirname(destPath), { recursive: true })
      writeFileSync(destPath, readFileSync(srcPath))
      continue
    }

    const content = renderString(readFileSync(srcPath, 'utf8'), variables)
    // Vue templates legitimately use {{ }} mustache interpolation for their
    // own state — the unresolved-token scan only applies to non-Vue files.
    if (!basename(destPath).endsWith('.vue')) {
      assertNoUnresolvedTokens(content, destRelToTarget)
    }

    // extensions.json fragments merge into the target root instead of
    // overwriting each other (client + extras + db fragments coexist). This
    // runs before the fragment's own destination mkdir so no stray empty
    // directory is left at the layer's dest.
    if (renamed.join('/') === EXTENSIONS_JSON_FRAGMENT_PATH) {
      mergeExtensionsJsonAtRoot(targetDir, content)
      continue
    }

    mkdirSync(dirname(destPath), { recursive: true })

    const manifestTarget =
      basename(destPath) === 'package.json'
        ? layer.mergeManifestAtRoot
          ? join(targetDir, 'package.json')
          : destPath
        : null

    if (manifestTarget && existsAndIsFile(manifestTarget)) {
      const existing = JSON.parse(readFileSync(manifestTarget, 'utf8'))
      const incoming = JSON.parse(content)
      writeFileSync(manifestTarget, `${JSON.stringify(deepMergePackageJson(existing, incoming), null, 2)}\n`)
    } else {
      writeFileSync(destPath, content)
    }
  }
}

function statSyncSafe(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/** Unions a rendered extensions.json fragment into the target root's file. */
function mergeExtensionsJsonAtRoot(targetDir: string, content: string): void {
  const rootExtensionsPath = join(targetDir, '.vscode', 'extensions.json')
  const existing = existsAndIsFile(rootExtensionsPath)
    ? (JSON.parse(readFileSync(rootExtensionsPath, 'utf8')) as Record<string, unknown>)
    : {}
  const incoming = JSON.parse(content) as Record<string, unknown>
  mkdirSync(dirname(rootExtensionsPath), { recursive: true })
  writeFileSync(
    rootExtensionsPath,
    `${JSON.stringify(mergeExtensionsJson(existing, incoming), null, 2)}\n`,
  )
}

function existsAndIsFile(path: string): boolean {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

/** Applies layers in order — later layers may overwrite files or merge into package.json. */
export function applyLayers(
  templatesRoot: string,
  layers: Layer[],
  variables: Record<string, string>,
  targetDir: string,
): void {
  assertNoLayerTypeConflicts(templatesRoot, layers, targetDir)
  for (const layer of layers) writeLayerFiles(templatesRoot, layer, variables, targetDir)
}
