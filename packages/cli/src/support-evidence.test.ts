import { describe, expect, it } from 'vitest'
import { validateSupportEvidence } from '../scripts/check-support-evidence.js'
import {
  FRONTEND_RUNTIME_SCENARIOS,
  DOCKER_MODULE_SCENARIOS,
  integrationScenarios,
  MODULE_RUNTIME_SCENARIOS,
  NEXTJS_DATABASE_SCENARIOS,
  NATIVE_PLATFORM_SCENARIOS,
  NODE_RUNTIME_SCENARIOS,
  registeredMatrixRowPrefix,
  SUPPORTED_CAPABILITIES,
  type SupportedCapability,
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
      'add-testing-react-vite-js-frontend-only',
      'add-testing-react-vite-ts-separate-api',
      'add-testing-react-vite-js-separate-api',
      'add-testing-vue-express-drizzle-sqlite',
      'add-testing-svelte-express-drizzle-sqlite',
      'add-testing-fastapi-sqlite',
      'add-testing-laravel-sqlite',
      'add-testing-nextjs-sqlite',
      'shadcn-react-vite-ts-frontend-only',
    ])
  })

  it('ties each Supported add-testing row to one exact generated-project path', () => {
    const testingCapabilities = SUPPORTED_CAPABILITIES.filter(
      ({ matrixFormat }) => matrixFormat === 'testing-module',
    )
    expect(
      testingCapabilities.map((capability) => [
        capability.id,
        capability.scenarios,
        registeredMatrixRowPrefix(capability),
      ]),
    ).toEqual([
      [
        'testing-module-react-vite-ts-frontend-only',
        ['add-testing-react-vite-ts'],
        '| `omnicraft add testing` — React/Vite TypeScript frontend-only | **Supported** |',
      ],
      [
        'testing-module-react-vite-js-frontend-only',
        ['add-testing-react-vite-js-frontend-only'],
        '| `omnicraft add testing` — React/Vite JavaScript frontend-only | **Supported** |',
      ],
      [
        'testing-module-react-vite-ts-express-drizzle-sqlite',
        ['add-testing-react-vite-ts-separate-api'],
        '| `omnicraft add testing` — React + Vite + TypeScript + Express + Drizzle + SQLite separate API | **Supported** |',
      ],
      [
        'testing-module-react-vite-js-express-drizzle-sqlite',
        ['add-testing-react-vite-js-separate-api'],
        '| `omnicraft add testing` — React + Vite JavaScript + Express + Drizzle + SQLite separate API | **Supported** |',
      ],
      [
        'testing-module-react-vite-ts-fastapi-sqlite',
        ['add-testing-fastapi-sqlite'],
        '| `omnicraft add testing` — React + Vite + TypeScript + FastAPI + SQLAlchemy 2 async + Alembic + SQLite separate API | **Supported** |',
      ],
      [
        'testing-module-react-vite-ts-laravel-sqlite',
        ['add-testing-laravel-sqlite'],
        '| `omnicraft add testing` — React + Vite + TypeScript + Laravel + Eloquent + SQLite separate API | **Supported** |',
      ],
    ])
  })

  it('rejects Supported combinations that the CLI compatibility rules disallow', () => {
    const capabilities = SUPPORTED_CAPABILITIES.map((capability) => {
      if (capability.id !== 'fastify-prisma-postgres') return capability
      const combination = capability.combinations[0]
      if (!combination) throw new Error('Fastify Prisma evidence is missing its combination.')
      return {
        ...capability,
        combinations: [
          {
            ...combination,
            flags: { ...combination.flags, backend: 'hono', orm: 'prisma' },
          },
        ],
      } as SupportedCapability
    })

    expect(() => validateSupportEvidence(capabilities)).toThrow(/Prisma is not available for Hono/)
  })

  it('rejects matrix text that no longer describes its registered exact combination', () => {
    const capabilities = SUPPORTED_CAPABILITIES.map((capability) => {
      if (capability.id !== 'express-drizzle-postgres') return capability
      const combination = capability.combinations[0]
      if (!combination) throw new Error('React Express evidence is missing its combination.')
      return {
        ...capability,
        scenarios: ['sqlite'],
        combinations: [
          { ...combination, flags: { ...combination.flags, db: 'sqlite' } },
        ],
      } as SupportedCapability
    })

    expect(() => validateSupportEvidence(capabilities)).toThrow(
      /no longer matches its registered combination/,
    )
  })

  it('keeps combination extras aligned with the generated-project scenario', () => {
    const capabilities = SUPPORTED_CAPABILITIES.map((capability) => {
      if (capability.id !== 'fastify-drizzle-postgres') return capability
      const combination = capability.combinations[0]
      if (!combination) throw new Error('Fastify Drizzle evidence is missing its combination.')
      return {
        ...capability,
        combinations: [
          { ...combination, flags: { ...combination.flags, extras: ['tailwind'] } },
        ],
      } as SupportedCapability
    })

    expect(() => validateSupportEvidence(capabilities)).toThrow(/generated-project extras/)
  })

  it('registers exact Expo simulator and Tauri desktop scenarios', () => {
    expect(integrationScenarios('native-platform')).toEqual(NATIVE_PLATFORM_SCENARIOS)
    expect(NATIVE_PLATFORM_SCENARIOS).toEqual(['expo-ios-simulator', 'tauri-linux-desktop'])
  })
})
