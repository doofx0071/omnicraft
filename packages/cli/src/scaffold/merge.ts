type Json = Record<string, unknown>

/**
 * Keys that must never take part in a merge: assigning them through ordinary
 * property assignment would walk the prototype chain instead of storing data
 * (`__proto__` can arrive as an own key via JSON.parse), and `constructor` /
 * `prototype` shadow global object surface. A package.json fragment has no
 * legitimate use for them.
 */
const UNSAFE_MERGE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

function isPlainObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Merges two parsed package.json objects: `override` wins on scalars and
 * arrays, plain objects merge recursively. This is what lets template layers
 * contribute dependencies and scripts without duplicating whole manifests.
 * Keys named `__proto__`, `constructor`, or `prototype` are dropped at every
 * nesting level so a crafted manifest cannot pollute Object.prototype.
 */
export function deepMergePackageJson(base: Json, override: Json): Json {
  const result: Json = { ...base }
  for (const [key, value] of Object.entries(override)) {
    if (UNSAFE_MERGE_KEYS.has(key)) continue
    const existing = result[key]
    if (isPlainObject(existing) && isPlainObject(value)) {
      result[key] = deepMergePackageJson(existing, value)
    } else {
      result[key] = value
    }
  }
  return result
}

/**
 * The one non-manifest file the engine merges across layers (same-path files
 * otherwise overwrite): `.vscode/extensions.json`. Every layer's fragment is
 * merged into the TARGET ROOT's file so its `recommendations` array is the
 * union of all fragments — deduped and sorted for deterministic output.
 * Non-array `recommendations` values are ignored; other keys follow the
 * ordinary override-wins rule (current fragments ship only recommendations).
 */
export function mergeExtensionsJson(base: Json, override: Json): Json {
  const baseRecommendations = Array.isArray(base.recommendations) ? base.recommendations : []
  const overrideRecommendations = Array.isArray(override.recommendations)
    ? override.recommendations
    : []
  const recommendations = [...new Set([...baseRecommendations, ...overrideRecommendations])].sort()
  return { ...base, ...override, recommendations }
}
