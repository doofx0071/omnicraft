import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
) as { name: string; version: string }

export const CLI_NAME = 'omnicraft'
export const CLI_VERSION = pkg.version

/**
 * Where `--latest` pulls templates from. Update `owner` once the repo is
 * pushed to GitHub — remote templates use the same `packages/cli/templates`
 * directory that ships embedded in the package.
 */
export const TEMPLATE_REPO = {
  owner: 'doofx0071',
  repo: 'omnicraft',
  branch: 'main',
  subdir: 'packages/cli/templates',
} as const

/**
 * Resolves the embedded templates directory relative to the compiled file.
 * Works for both `dist/index.js` (bundled) and `src/` (tsx dev) because both
 * sit one level below the package root.
 */
export const TEMPLATES_ROOT = fileURLToPath(new URL('../templates/', import.meta.url))

/** Ports the generated projects standardize on. */
export const SERVER_PORT = 3000
export const CLIENT_PORT = 5173
