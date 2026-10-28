import { describe, expect, it } from 'vitest'
import { validateSupportEvidence } from '../scripts/check-support-evidence.js'
import {
  integrationScenarios,
  NEXTJS_DATABASE_SCENARIOS,
  NODE_RUNTIME_SCENARIOS,
} from './support-evidence.js'

describe('support matrix evidence', () => {
  it('links every Supported claim to a CI target and release aggregate', () => {
    expect(() => validateSupportEvidence()).not.toThrow()
  })

  it('declares the exact FastAPI databases exercised by its generated-project runner', () => {
    expect(integrationScenarios('python-fastapi')).toEqual(['sqlite', 'postgres'])
  })

  it('keeps registered Node runtime scenarios aligned with the production integration cases', () => {
    expect(integrationScenarios('node-runtime')).toEqual(NODE_RUNTIME_SCENARIOS.map(({ id }) => id))
  })

  it('registers SQLite, PostgreSQL, and MySQL for the generated Next.js integration runner', () => {
    expect(integrationScenarios('nextjs-runtime')).toEqual(NEXTJS_DATABASE_SCENARIOS)
    expect(NEXTJS_DATABASE_SCENARIOS).toEqual(['sqlite', 'postgres', 'mysql'])
  })
})
