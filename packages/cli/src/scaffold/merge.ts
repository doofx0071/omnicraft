type Json = Record<string, unknown>

function isPlainObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Merges two parsed package.json objects: `override` wins on scalars and
 * arrays, plain objects merge recursively. This is what lets template layers
 * contribute dependencies and scripts without duplicating whole manifests.
 */
export function deepMergePackageJson(base: Json, override: Json): Json {
  const result: Json = { ...base }
  for (const [key, value] of Object.entries(override)) {
    const existing = result[key]
    if (isPlainObject(existing) && isPlainObject(value)) {
      result[key] = deepMergePackageJson(existing, value)
    } else {
      result[key] = value
    }
  }
  return result
}
