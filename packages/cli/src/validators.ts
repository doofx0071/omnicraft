import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import validateNpmPackageName from 'validate-npm-package-name'

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

export function resolveTargetDir(projectName: string): string {
  return resolve(process.cwd(), projectName)
}
