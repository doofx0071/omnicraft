import {
  BACKEND_FRAMEWORK_LABELS,
  DATABASE_LABELS,
  FRONTEND_LABELS,
  ORM_LABELS,
  type BackendFramework,
  type Database,
  type Frontend,
  type Orm,
} from '../types.js'
import type { SupportedCombination } from './combinations.js'
import type { RejectedModuleCapability } from './rejected-capabilities.js'
import type { SupportedCapability } from './supported-capabilities.js'

function requiredDatabase(combination: SupportedCombination): Database {
  const database = combination.flags.db
  if (!database) throw new Error('A Supported matrix combination must specify its database.')
  return database as Database
}

function displayOrm(orm: string | undefined): string {
  if (!orm) throw new Error('A Supported Node combination must specify its ORM/data access.')
  return orm === 'none' ? 'Raw SQL (`none`)' : ORM_LABELS[orm as Orm]
}

function requireOneCombination(capability: SupportedCapability): SupportedCombination {
  if (capability.combinations.length !== 1) {
    throw new Error(`Matrix format "${capability.matrixFormat}" requires one exact combination.`)
  }
  return capability.combinations[0] as SupportedCombination
}

/** Renders the exact matrix label from the typed combination registered with its evidence. */
export function registeredMatrixRowPrefix(capability: SupportedCapability): string {
  const combinations = capability.combinations
  if (combinations.length === 0)
    throw new Error('A Supported matrix row must register a combination.')
  const first = combinations[0] as SupportedCombination
  const frontend = first.flags.frontend as Frontend
  const language = first.flags.lang
  const frontendLabel =
    language === 'javascript'
      ? `${FRONTEND_LABELS[frontend]} + Vite JavaScript`
      : `${FRONTEND_LABELS[frontend]} + Vite + TypeScript`
  const database = (item: SupportedCombination) => DATABASE_LABELS[requiredDatabase(item)]
  const oneDatabase = () => database(requireOneCombination(capability))
  const databaseList = (separator = ', ') => combinations.map(database).join(separator)
  const databases = combinations.flatMap((combination) =>
    combination.flags.db ? [combination.flags.db] : [],
  )
  if (
    capability.matrixFormat !== 'testing-module-react-vite-family' &&
    databases.length > 0 &&
    new Set(databases).size !== databases.length
  ) {
    throw new Error(`Supported row "${capability.id}" repeats a database combination.`)
  }

  let label: string
  switch (capability.matrixFormat) {
    case 'frontend-app': {
      const flags = requireOneCombination(capability).flags
      label = `${frontendLabel} + ${BACKEND_FRAMEWORK_LABELS[flags.backend as BackendFramework]} + ${displayOrm(flags.orm)} + ${oneDatabase()}`
      break
    }
    case 'frontend-client-api': {
      const flags = requireOneCombination(capability).flags
      label = `${frontendLabel} + ${BACKEND_FRAMEWORK_LABELS[flags.backend as BackendFramework]} + ${displayOrm(flags.orm)} + ${oneDatabase()}${language === 'javascript' ? ' separate API' : ''}`
      break
    }
    case 'frontend-only':
      label = `${frontendLabel}, frontend-only`
      break
    case 'supabase-auth': {
      const authentication = requireOneCombination(capability).flags.auth
      if (authentication !== 'supabase-auth') {
        throw new Error(`Supabase Auth row "${capability.id}" must select Supabase Auth.`)
      }
      label = 'React + Vite + TypeScript + Supabase Auth + Data API/RLS, frontend-only'
      break
    }
    case 'nextjs-integrated':
      label =
        oneDatabase() === 'MySQL'
          ? 'Next.js integrated full-stack + MySQL'
          : `Next.js integrated full-stack + raw SQL + ${oneDatabase()}`
      break
    case 'node-backend': {
      const flags = first.flags
      if (
        combinations.some(
          (combination) =>
            combination.flags.backend !== flags.backend || combination.flags.orm !== flags.orm,
        )
      ) {
        throw new Error(`Node backend row "${capability.id}" mixes frameworks or ORMs.`)
      }
      label = `${BACKEND_FRAMEWORK_LABELS[flags.backend as BackendFramework]} | ${displayOrm(flags.orm)} | ${databaseList()}`
      break
    }
    case 'python-backend':
      label = `FastAPI | SQLAlchemy 2 async + Alembic | ${oneDatabase()}`
      break
    case 'php-backend':
      label = `Laravel 12 | Eloquent | ${oneDatabase()}`
      break
    case 'laravel-livewire-auth': {
      const authentication = requireOneCombination(capability).flags.auth
      if (authentication !== 'none' && authentication !== 'laravel-native') {
        throw new Error(
          `Livewire auth row "${capability.id}" must select None or Laravel native auth.`,
        )
      }
      const mode = authentication === 'none' ? 'None' : 'Laravel native/Fortify'
      label = `Laravel 13 + Livewire 4 (${mode}) | Eloquent | ${oneDatabase()}`
      break
    }
    case 'laravel-inertia-react-auth': {
      const authentication = requireOneCombination(capability).flags.auth
      if (authentication !== 'none' && authentication !== 'laravel-native') {
        throw new Error(
          `Inertia React auth row "${capability.id}" must select None or Laravel native auth.`,
        )
      }
      const mode = authentication === 'none' ? 'None' : 'Laravel native/Fortify'
      label = `Laravel 13 + Inertia React (${mode}) | Eloquent | ${oneDatabase()}`
      break
    }
    case 'laravel-sanctum-spa-auth': {
      const combination = requireOneCombination(capability)
      const flags = combination.flags
      if (
        flags.frontend !== 'react' ||
        flags.lang !== 'typescript' ||
        !flags.fullStack ||
        flags.runtime !== 'php' ||
        flags.backend !== 'laravel' ||
        flags.orm !== undefined ||
        flags.db === undefined ||
        flags.auth !== 'laravel-native' ||
        flags.extras.length !== 0 ||
        combination.module !== undefined
      ) {
        throw new Error(
          `Sanctum SPA auth row "${capability.id}" must use React/Vite TypeScript + Laravel 12 API + a registered SQL database with Laravel native auth.`,
        )
      }
      label = `React + Vite + TypeScript + Laravel 12 API + Sanctum SPA sessions | Eloquent | ${DATABASE_LABELS[flags.db as Database]}`
      break
    }
    case 'auth-module':
      label = `\`omnicraft add auth\` — Express + Drizzle + ${databaseList('/')}`
      break
    case 'creation-auth':
      label = `Creation-time Better Auth — ${frontendLabel} + Express + Drizzle + ${databaseList('/')}`
      break
    case 'docker-module':
      label = `\`omnicraft add docker\` — Express + Drizzle + ${oneDatabase()} separate API`
      break
    case 'testing-module': {
      const flags = requireOneCombination(capability).flags
      const testingTarget = '`omnicraft add testing` — '
      if (!flags.fullStack) {
        label = `${testingTarget}React/Vite ${language === 'javascript' ? 'JavaScript' : 'TypeScript'} frontend-only`
      } else {
        const backend = flags.backend as BackendFramework
        const dataAccess =
          flags.runtime === 'node'
            ? displayOrm(flags.orm)
            : flags.runtime === 'python'
              ? 'SQLAlchemy 2 async + Alembic'
              : 'Eloquent'
        label = `${testingTarget}${frontendLabel} + ${BACKEND_FRAMEWORK_LABELS[backend]} + ${dataAccess} + ${oneDatabase()} separate API`
      }
      break
    }
    case 'testing-module-react-vite-family':
      label = `\`omnicraft add testing\` — ${combinations.length} other exact React/Vite paths`
      break
    case 'shadcn-extra':
      label = 'shadcn/ui — React/Vite TypeScript frontend-only'
      break
  }
  return `| ${label} | **Supported** |`
}

export function registeredRejectedMatrixRowPrefix(capability: RejectedModuleCapability): string {
  return `| ${capability.rowLabel} | **Rejected — unsupported combination** |`
}

/**
 * Each Supported row records the exact flag-level stack/module combination,
 * the generated-project scenario, and how to render its matrix label. The
 * consistency checker resolves these flags through the current CLI rules.
 */
