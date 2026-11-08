import { readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { isProtectedPath } from '../validators.js'
import type { Layer } from './engine.js'
import { restoreDotfileName } from './renderer.js'

const EXTENSIONS_JSON_FRAGMENT_PATH = '.vscode/extensions.json'

type EntryType = 'file' | 'directory' | 'other'
type FileSystemStats = NonNullable<ReturnType<typeof statSync>>

interface TypeConflict {
  path: string
  actual: EntryType
  required: 'file' | 'directory'
}

interface FoundTypeConflict {
  absolutePath: string
  actual: EntryType
  required: 'file' | 'directory'
}

export class LayerTypeConflictError extends Error {
  readonly conflictingPaths: readonly string[]

  constructor(conflicts: TypeConflict[]) {
    const lines = conflicts.map((conflict) => {
      const actual = conflict.actual === 'other' ? 'filesystem entry' : conflict.actual
      return `  - ${conflict.path} is an existing ${actual}, but a ${conflict.required} is required.`
    })

    super(
      [
        'Scaffold generation cannot continue because existing paths block generated files:',
        ...lines,
        'Remove or rename the blocking filesystem entry and retry.',
      ].join('\n'),
    )
    this.name = 'LayerTypeConflictError'
    this.conflictingPaths = conflicts.map((conflict) => conflict.path)
  }
}

/** Maps selected layer files to the paths the writer will use, relative to the target root. */
export function planLayerOutputPaths(
  templatesRoot: string,
  layers: readonly Layer[],
  targetDir: string,
): string[] {
  const outputPaths = new Set<string>()
  let rootManifestAvailable = statSyncOrNull(join(targetDir, 'package.json'))?.isFile() ?? false

  for (const layer of layers) {
    const layerRoot = join(templatesRoot, layer.src)
    if (!statSyncOrNull(layerRoot)?.isDirectory()) continue

    for (const entry of readdirSync(layerRoot, { recursive: true, encoding: 'utf8' })) {
      const srcPath = join(layerRoot, entry)
      if (!statSyncOrNull(srcPath)?.isFile()) continue

      const segments = relative(layerRoot, srcPath)
        .split(/[\\/]/)
        .map((segment) => restoreDotfileName(segment))
      const destinationPath = [layer.dest, ...segments].filter((segment) => segment !== '.').join('/')

      if (isProtectedPath(destinationPath)) continue

      if (segments.join('/') === EXTENSIONS_JSON_FRAGMENT_PATH) {
        outputPaths.add(EXTENSIONS_JSON_FRAGMENT_PATH)
        continue
      }

      if (
        segments.at(-1) === 'package.json' &&
        layer.mergeManifestAtRoot &&
        rootManifestAvailable
      ) {
        outputPaths.add('package.json')
        continue
      }

      outputPaths.add(destinationPath)

      // A preceding selected layer can create the root manifest that makes a
      // later mergeManifestAtRoot layer write to the root instead of its
      // nested fallback destination.
      if (isRootManifestPath(destinationPath)) rootManifestAvailable = true
    }
  }

  return [...outputPaths].sort()
}

function isRootManifestPath(destinationPath: string): boolean {
  const segments = destinationPath.split(/[\\/]/).filter((segment) => segment && segment !== '.')
  return segments.length === 1 && segments[0] === 'package.json'
}

/** Rejects selected outputs whose existing target entries have incompatible filesystem types. */
export function assertNoLayerTypeConflicts(
  templatesRoot: string,
  layers: readonly Layer[],
  targetDir: string,
): void {
  const outputPaths = planLayerOutputPaths(templatesRoot, layers, targetDir)
  if (outputPaths.length === 0) return

  const targetEntry = statSyncOrNull(targetDir)
  if (targetEntry && !targetEntry.isDirectory()) {
    throw new LayerTypeConflictError([
      {
        path: '.',
        actual: entryType(targetEntry),
        required: 'directory',
      },
    ])
  }

  const conflicts = new Map<string, TypeConflict>()
  for (const outputPath of outputPaths) {
    const conflict = findTypeConflict(targetDir, outputPath)
    if (!conflict) continue

    const relativePath = relative(targetDir, conflict.absolutePath).split(sep).join('/') || '.'
    conflicts.set(relativePath, {
      path: relativePath,
      actual: conflict.actual,
      required: conflict.required,
    })
  }

  if (conflicts.size > 0) {
    const orderedConflicts = [...conflicts.values()].sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    )
    throw new LayerTypeConflictError(orderedConflicts)
  }
}

function findTypeConflict(targetDir: string, outputPath: string): FoundTypeConflict | null {
  const segments = outputPath.split(/[\\/]/).filter(Boolean)
  let currentPath = targetDir

  for (let index = 0; index < segments.length; index += 1) {
    currentPath = join(currentPath, segments[index]!)
    const entry = statSyncOrNull(currentPath)
    if (!entry) return null

    const isFinalPath = index === segments.length - 1
    if (isFinalPath && entry.isFile()) return null
    if (!isFinalPath && entry.isDirectory()) continue

    return {
      absolutePath: currentPath,
      actual: entryType(entry),
      required: isFinalPath ? 'file' : 'directory',
    }
  }

  return null
}

function entryType(entry: FileSystemStats): EntryType {
  if (entry.isFile()) return 'file'
  if (entry.isDirectory()) return 'directory'
  return 'other'
}

function statSyncOrNull(path: string): FileSystemStats | null {
  try {
    return statSync(path) ?? null
  } catch (error) {
    if (isMissingPathError(error)) return null
    throw error
  }
}

function isMissingPathError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false
  return error.code === 'ENOENT' || error.code === 'ENOTDIR'
}
