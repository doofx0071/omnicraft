import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
) as { name: string; version: string }

export const CLI_NAME = 'omnicraft'
export const CLI_VERSION = pkg.version

/**
 * Where `--latest` pulls templates from. The ref is the **release tag**
 * matching the CLI version (`v` + version), not a mutable branch — two runs
 * of the same CLI version must produce identical projects. Templates are
 * tagged in lockstep with releases (see CONTRIBUTING.md).
 */
export const TEMPLATE_REPO = {
  owner: 'doofx0071',
  repo: 'omnicraft',
  branch: 'main',
  /** Resolved at runtime: the release tag matching the CLI version. */
  ref: `v${CLI_VERSION}`,
  subdir: 'packages/cli/templates',
} as const

/**
 * Resolves the embedded templates directory relative to the compiled file.
 * Works for both `dist/index.js` (bundled) and `src/` (tsx dev) because both
 * sit one level below the package root.
 */
export const TEMPLATES_ROOT = fileURLToPath(new URL('../templates/', import.meta.url))

/** create-next-app pinned major — Next templates are verified against this line. */
export const CNA_PACKAGE = 'create-next-app@16'

/**
 * Laravel Livewire generator inputs are pinned to reviewed official starter-kit commits.
 * The blank kit has no auth routes; the authenticated kit uses Laravel Fortify.
 */
export const TIGED_PACKAGE = 'tiged@2.12.8'
export const LARAVEL_LIVEWIRE_STARTER_KITS = {
  none: 'laravel/blank-livewire-starter-kit#75cf9e5cfbc18161027774fc025a1ead81eddcea',
  'laravel-native': 'laravel/livewire-starter-kit#143e0c1e574e122ebe7e294e5342b7bf251df799',
} as const

/** Ports the generated projects standardize on. */
export const SERVER_PORT = 3000
export const CLIENT_PORT = 5173

/**
 * shadcn/ui setup, run post-scaffold by the pinned shadcn CLI (an
 * official-generator adapter like Laravel/Composer). Pin: preset name +
 * primitive base + component list are fixed and tested together; bump them
 * deliberately (they are part of the template contract) and re-verify.
 */
export const SHADCN_PRESET = 'nova'
export const SHADCN_BASE = 'radix' as const
export const SHADCN_COMPONENTS = ['button', 'input', 'card', 'badge', 'separator']
