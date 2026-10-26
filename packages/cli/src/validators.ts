import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import validateNpmPackageName from 'validate-npm-package-name'
import { restoreDotfileName } from './scaffold/renderer.js'

/**
 * Normalizes free-text app names into a folder-safe, npm-safe slug.
 * "My Awesome App" -> "my-awesome-app"
 */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

export interface NameCheck {
  ok: boolean
  reason?: string
}

/** Validates an already-slugified project name against npm package name rules. */
export function checkProjectName(name: string): NameCheck {
  if (!name) return { ok: false, reason: 'Please enter a name.' }
  const result = validateNpmPackageName(name)
  if (result.errors && result.errors.length > 0) {
    return { ok: false, reason: result.errors[0] }
  }
  if (result.warnings && result.warnings.length > 0) {
    return { ok: false, reason: result.warnings[0] }
  }
  return { ok: true }
}

/**
 * Validates raw user input: slugifies it first so names like "My App!" are
 * accepted, and reports the normalized form so the CLI can show what folder
 * will actually be created.
 */
export function checkRawProjectName(input: string): { slug: string } & NameCheck {
  const slug = slugify(input)
  const check = checkProjectName(slug)
  return { slug, ...check }
}

export function isNonEmptyDirectory(dir: string): boolean {
  return existsSync(dir) && readdirSync(dir).length > 0
}

/** File names the engine must never overwrite: secrets and VCS state. */
const PROTECTED_FILES = new Set(['.env', '.git'])

export function isProtectedPath(relativePath: string): boolean {
  const segments = relativePath.split(/[\\/]/)
  const fileName = segments[segments.length - 1]!
  if (PROTECTED_FILES.has(fileName)) return true
  // Other .env* files (.env.local, .env.production) are user-owned secrets —
  // but .env.example is a template asset shipping safe placeholders.
  return fileName.startsWith('.env.') && fileName !== '.env.example'
}

/**
 * Lists files that exist in `dir` which template layers would overwrite —
 * used to show an explicit collision summary before any write happens.
 * Protected files (.env*, .git) are flagged separately so they can be
 * excluded from generation entirely.
 */
export function findCollisions(dir: string, layerDirs: string[]): { collisions: string[]; protectedFiles: string[] } {
  const existing = new Set<string>()
  if (existsSync(dir)) {
    for (const layerRoot of layerDirs) {
      const abs = join(dir, layerRoot)
      if (!existsSync(abs)) continue
      for (const entry of readdirSync(abs, { recursive: true, encoding: 'utf8' })) {
        existing.add(join(layerRoot, String(entry).split(/[\\/]/).map((s) => restoreDotfileName(s)).join('/')))
      }
    }
  }
  const collisions: string[] = []
  const protectedFiles: string[] = []
  for (const rel of existing) {
    if (isProtectedPath(rel)) protectedFiles.push(rel)
    else collisions.push(rel)
  }
  return { collisions: collisions.sort(), protectedFiles: protectedFiles.sort() }
}

export function resolveTargetDir(projectName: string): string {
  return resolve(process.cwd(), projectName)
}
