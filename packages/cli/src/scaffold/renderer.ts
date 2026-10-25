const TOKEN_RE = /\{\{\s*(\w+)\s*\}\}/g

/** Replaces {{token}} placeholders; unknown tokens are left untouched. */
export function renderString(input: string, variables: Record<string, string>): string {
  return input.replace(TOKEN_RE, (match, key: string) =>
    Object.hasOwn(variables, key) ? variables[key] : match,
  )
}

const DOTFILE_RENAME_RE = /^_/ // _gitignore -> .gitignore

/**
 * npm refuses to publish `.gitignore`-style files it considers special, so
 * templates ship them with a leading underscore and the engine restores the
 * dot prefix on copy.
 */
export function restoreDotfileName(name: string): string {
  if (DOTFILE_RENAME_RE.test(name)) return `.${name.slice(1)}`
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
