const TOKEN_RE = /\{\{\s*(\w+)\s*\}\}/g

/** Replaces {{token}} placeholders; unknown tokens are left untouched. */
export function renderString(input: string, variables: Record<string, string>): string {
  return input.replace(TOKEN_RE, (match, key: string) =>
    Object.hasOwn(variables, key) ? variables[key] : match,
  )
}

export class UnresolvedTokenError extends Error {
  constructor(
    public readonly file: string,
    public readonly tokens: string[],
  ) {
    super(`Unresolved template token(s) ${tokens.map((t) => `{{${t}}}`).join(', ')} in ${file}`)
    this.name = 'UnresolvedTokenError'
  }
}

/**
 * Post-render scan: any remaining {{token}} means a template references a
 * variable that doesn't exist (a typo becomes a leak into generated code).
 * `allowed` lists tokens that are intentionally left unrendered in a given
 * file kind (currently none — the option exists for future escaping needs).
 */
export function assertNoUnresolvedTokens(
  rendered: string,
  file: string,
  allowed: string[] = [],
): void {
  const found = [...rendered.matchAll(TOKEN_RE)]
    .map((m) => m[1])
    .filter((t) => !allowed.includes(t))
  const unique = [...new Set(found)]
  if (unique.length > 0) throw new UnresolvedTokenError(file, unique)
}

/**
 * npm refuses to publish the dotfiles it treats as special, so templates ship
 * exactly these names with a leading underscore and the engine restores the
 * dot prefix on copy. The set is exhaustive on purpose: a generic `/^_/`
 * rename would corrupt template files that legitimately start with an
 * underscore — Python's `__init__.py` was copied as `._init__.py` into every
 * generated FastAPI project. Extend this set only when a template needs a new
 * npm-hostile dotfile (see the template contract).
 */
const DOTFILE_RESTORES = new Set(['_gitignore', '_prettierignore', '_env.example', '_github', '_nvmrc'])

export function restoreDotfileName(name: string): string {
  if (DOTFILE_RESTORES.has(name)) return `.${name.slice(1)}`
  return name
}

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.avif',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.mp4', '.webm', '.wasm', '.zip', '.gz',
])

export function isBinaryFile(name: string): boolean {
  const dot = name.lastIndexOf('.')
  if (dot === -1) return false
  return BINARY_EXTENSIONS.has(name.slice(dot).toLowerCase())
}
