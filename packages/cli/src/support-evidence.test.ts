import { describe, expect, it } from 'vitest'
import { validateSupportEvidence } from '../scripts/check-support-evidence.js'
import {
  INTEGRATION_TARGETS,
  FRONTEND_RUNTIME_SCENARIOS,
  DOCKER_MODULE_SCENARIOS,
  integrationScenarios,
  LARAVEL_LIVEWIRE_AUTH_SCENARIOS,
  LARAVEL_INERTIA_REACT_AUTH_SCENARIOS,
  MODULE_RUNTIME_SCENARIOS,
  NEXTJS_DATABASE_SCENARIOS,
  NATIVE_PLATFORM_SCENARIOS,
  NODE_RUNTIME_SCENARIOS,
  REJECTED_MODULE_CAPABILITIES,
  REACT_VITE_TESTING_FOLLOWUP_COMBINATIONS,
  REACT_VITE_TESTING_FOLLOWUP_SCENARIOS,
  REACT_VITE_TESTING_REJECTED_COMBINATIONS,
  REACT_VITE_TESTING_NONREJECTED_COMBINATIONS,
  reactViteTestingGroupId,
  registeredRejectedMatrixRowPrefix,
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

  it('registers only the approved Inertia React authentication setups', () => {
    expect(integrationScenarios('php-laravel-inertia-react-auth')).toEqual(
      LARAVEL_INERTIA_REACT_AUTH_SCENARIOS,
    )
    expect(LARAVEL_INERTIA_REACT_AUTH_SCENARIOS).toEqual(['none', 'laravel-native'])
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

  it('registers creation-time Better Auth only for the three supported Express + Drizzle databases', () => {
    const capability = SUPPORTED_CAPABILITIES.find(
      ({ id }) => id === 'creation-auth-better-auth-express-drizzle',
    )

    expect(capability?.target).toBe('node-express-drizzle')
    expect(capability?.scenarios).toEqual(['sqlite', 'postgres', 'mysql'])
    expect(capability?.combinations.map(({ flags }) => [flags.auth, flags.db])).toEqual([
      ['better-auth', 'sqlite'],
      ['better-auth', 'postgres'],
      ['better-auth', 'mysql'],
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

  it('enumerates every remaining compatible React/Vite add-testing path by exact runtime group', () => {
    const combinations = REACT_VITE_TESTING_FOLLOWUP_COMBINATIONS
    const exactKeys = combinations.map(({ flags }) => JSON.stringify(flags))
    expect(combinations).toHaveLength(306)
    expect(REACT_VITE_TESTING_NONREJECTED_COMBINATIONS).toHaveLength(254)
    expect(REACT_VITE_TESTING_REJECTED_COMBINATIONS).toHaveLength(52)
    expect(
      REACT_VITE_TESTING_REJECTED_COMBINATIONS.every(
        ({ flags }) => flags.lang === 'javascript' && flags.extras.includes('shadcn'),
      ),
    ).toBe(true)
    expect(new Set(exactKeys).size).toBe(combinations.length)
    expect(REACT_VITE_TESTING_FOLLOWUP_SCENARIOS).toHaveLength(23)
    expect(integrationScenarios('module-runtime-react-vite')).toEqual(
      REACT_VITE_TESTING_FOLLOWUP_SCENARIOS,
    )
    const supportedFamily = SUPPORTED_CAPABILITIES.find(
      ({ id }) => id === 'testing-module-react-vite-other-exact-paths',
    )
    if (!supportedFamily) throw new Error('The supported React/Vite add-testing family is missing.')
    expect(supportedFamily?.combinations).toHaveLength(254)
    expect(supportedFamily?.scenarios).toEqual(
      REACT_VITE_TESTING_NONREJECTED_COMBINATIONS.map(({ flags }) =>
        reactViteTestingGroupId(flags),
      ),
    )
    expect(registeredMatrixRowPrefix(supportedFamily)).toBe(
      '| `omnicraft add testing` — 254 other exact React/Vite paths | **Supported** |',
    )
    const [rejectedFamily] = REJECTED_MODULE_CAPABILITIES
    if (!rejectedFamily) throw new Error('The rejected JavaScript + shadcn family is missing.')
    expect(REJECTED_MODULE_CAPABILITIES).toHaveLength(1)
    expect(rejectedFamily.combinations).toHaveLength(52)
    expect(registeredRejectedMatrixRowPrefix(rejectedFamily)).toBe(
      '| `omnicraft add testing` — React/Vite JavaScript + shadcn (52 exact module paths) | **Rejected — unsupported combination** |',
    )
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

  it('registers the exact Expo simulator and Tauri desktop platform scenarios', () => {
    expect(integrationScenarios('native-platform')).toEqual(NATIVE_PLATFORM_SCENARIOS)
    expect(NATIVE_PLATFORM_SCENARIOS).toEqual([
      'expo-ios-simulator',
      'expo-android-emulator',
      'tauri-linux-desktop',
      'tauri-macos-desktop',
      'tauri-windows-desktop',
    ])
  })

  it('registers both integrated Laravel Livewire authentication setups in their own CI job', () => {
    expect(integrationScenarios('php-laravel-livewire-auth')).toEqual(LARAVEL_LIVEWIRE_AUTH_SCENARIOS)
    expect(LARAVEL_LIVEWIRE_AUTH_SCENARIOS).toEqual(['none', 'laravel-native'])
    const target = INTEGRATION_TARGETS['php-laravel-livewire-auth']
    expect(target.workflowJob).toBe('php-laravel-livewire-auth-integration')
    expect(target.workflowCommand).toBe('npm run test:integration:php-livewire --workspace=create-omnicraft')

    const livewireCapabilities = SUPPORTED_CAPABILITIES.filter(
      ({ target: capabilityTarget }) => capabilityTarget === 'php-laravel-livewire-auth',
    )
    expect(livewireCapabilities.map(({ id }) => id)).toEqual([
      'laravel-livewire-none-sqlite',
      'laravel-livewire-native-auth-sqlite',
    ])
    expect(livewireCapabilities.map(({ combinations }) => combinations[0]?.flags.auth)).toEqual([
      'none',
      'laravel-native',
    ])
    expect(livewireCapabilities.map(registeredMatrixRowPrefix)).toEqual([
      '| Laravel 13 + Livewire 4 (None) | Eloquent | SQLite | **Supported** |',
      '| Laravel 13 + Livewire 4 (Laravel native/Fortify) | Eloquent | SQLite | **Supported** |',
    ])
  })

  it('registers both integrated Laravel Inertia React auth setups in their own CI job', () => {
    expect(integrationScenarios('php-laravel-inertia-react-auth')).toEqual(
      LARAVEL_INERTIA_REACT_AUTH_SCENARIOS,
    )
    expect(LARAVEL_INERTIA_REACT_AUTH_SCENARIOS).toEqual(['none', 'laravel-native'])
    const target = INTEGRATION_TARGETS['php-laravel-inertia-react-auth']
    expect(target.workflowJob).toBe('php-laravel-inertia-react-auth-integration')
    expect(target.workflowCommand).toBe(
      'npm run test:integration:php-inertia --workspace=create-omnicraft',
    )

    const inertiaReactCapabilities = SUPPORTED_CAPABILITIES.filter(
      ({ target: capabilityTarget }) => capabilityTarget === 'php-laravel-inertia-react-auth',
    )
    expect(inertiaReactCapabilities.map(({ id }) => id)).toEqual([
      'laravel-inertia-react-none-sqlite',
      'laravel-inertia-react-native-auth-sqlite',
    ])
    expect(inertiaReactCapabilities.map(({ combinations }) => combinations[0]?.flags.auth)).toEqual([
      'none',
      'laravel-native',
    ])
    expect(inertiaReactCapabilities.map(registeredMatrixRowPrefix)).toEqual([
      '| Laravel 13 + Inertia React (None) | Eloquent | SQLite | **Supported** |',
      '| Laravel 13 + Inertia React (Laravel native/Fortify) | Eloquent | SQLite | **Supported** |',
    ])
  })
})
