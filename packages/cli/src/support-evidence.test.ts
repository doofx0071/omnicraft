import { describe, expect, it } from 'vitest'
import { validateSupportEvidence } from '../scripts/check-support-evidence.js'
import {
  FRONTEND_RUNTIME_SCENARIOS,
  DOCKER_MODULE_SCENARIOS,
  integrationScenarios,
  MODULE_RUNTIME_SCENARIOS,
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

  it('records the exact Vue, Svelte, and JavaScript React client/API paths', () => {
    expect(NODE_RUNTIME_SCENARIOS.find(({ id }) => id === 'express-drizzle-sqlite-vue')).toEqual({
      framework: 'express',
      orm: 'drizzle',
      database: 'sqlite',
      id: 'express-drizzle-sqlite-vue',
      frontend: 'vue',
    })
    expect(NODE_RUNTIME_SCENARIOS.find(({ id }) => id === 'express-drizzle-sqlite-svelte')).toEqual({
      framework: 'express',
      orm: 'drizzle',
      database: 'sqlite',
      id: 'express-drizzle-sqlite-svelte',
      frontend: 'svelte',
    })
    expect(NODE_RUNTIME_SCENARIOS.find(({ id }) => id === 'express-drizzle-sqlite-react-js')).toEqual({
      framework: 'express',
      orm: 'drizzle',
      database: 'sqlite',
      id: 'express-drizzle-sqlite-react-js',
      language: 'javascript',
    })
  })

  it('registers SQLite, PostgreSQL, and MySQL for the generated Next.js integration runner', () => {
    expect(integrationScenarios('nextjs-runtime')).toEqual(NEXTJS_DATABASE_SCENARIOS)
    expect(NEXTJS_DATABASE_SCENARIOS).toEqual(['sqlite', 'postgres', 'mysql'])
  })

  it('registers the generated JavaScript frontend-only runtime scenario', () => {
    expect(integrationScenarios('frontend-runtime')).toEqual(FRONTEND_RUNTIME_SCENARIOS)
    expect(FRONTEND_RUNTIME_SCENARIOS).toEqual(['react-js-frontend-only'])
  })

  it('registers PostgreSQL and MySQL for the generated Docker-module integration runner', () => {
    expect(integrationScenarios('docker-module')).toEqual(DOCKER_MODULE_SCENARIOS)
    expect(DOCKER_MODULE_SCENARIOS).toEqual(['postgres', 'mysql'])
  })

  it('registers the generated testing-module and shadcn install scenarios', () => {
    expect(integrationScenarios('module-runtime')).toEqual(MODULE_RUNTIME_SCENARIOS)
    expect(MODULE_RUNTIME_SCENARIOS).toEqual([
      'add-testing-react-vite-ts',
      'shadcn-react-vite-ts-frontend-only',
    ])
  })
})
