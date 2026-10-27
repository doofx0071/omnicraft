import { describe, expect, it } from 'vitest'
import { AVAILABLE, CAPABILITY_REGISTRY } from './capabilities.js'
import { MODULES } from './add.js'

function selectedValues<T extends readonly { value: string; available: boolean }[]>(
  options: T,
): string[] {
  return options.filter((option) => option.available).map((option) => option.value)
}

describe('capability registry', () => {
  it('derives all prompt and flag values from registry entries marked available', () => {
    expect(AVAILABLE.projectType).toEqual(selectedValues(CAPABILITY_REGISTRY.projectType))
    expect(AVAILABLE.frontend).toEqual(selectedValues(CAPABILITY_REGISTRY.frontend))
    expect(AVAILABLE.lang).toEqual(selectedValues(CAPABILITY_REGISTRY.language))
    expect(AVAILABLE.runtime).toEqual(selectedValues(CAPABILITY_REGISTRY.runtime))
    expect(AVAILABLE.backend.node).toEqual(selectedValues(CAPABILITY_REGISTRY.backend.node))
    expect(AVAILABLE.backend.python).toEqual(selectedValues(CAPABILITY_REGISTRY.backend.python))
    expect(AVAILABLE.backend.php).toEqual(selectedValues(CAPABILITY_REGISTRY.backend.php))
    expect(AVAILABLE.db.node).toEqual(selectedValues(CAPABILITY_REGISTRY.database.node))
    expect(AVAILABLE.db.python).toEqual(selectedValues(CAPABILITY_REGISTRY.database.python))
    expect(AVAILABLE.db.php).toEqual(selectedValues(CAPABILITY_REGISTRY.database.php))
    expect(AVAILABLE.orm.node).toEqual(selectedValues(CAPABILITY_REGISTRY.orm))
    expect(AVAILABLE.extras).toEqual(selectedValues(CAPABILITY_REGISTRY.extras))
  })

  it('builds the module menu from the registry module ids', () => {
    expect(MODULES.map((module) => module.id)).toEqual(AVAILABLE.modules)
  })
})
