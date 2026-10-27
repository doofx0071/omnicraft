import type { Answers } from '../types.js'
import type { Layer } from './engine.js'
import { validateAnswerCompatibility } from '../compatibility.js'

/**
 * Maps the user's answers to an ordered list of template layers. Templates
 * are composed, not forked. Later layers overwrite earlier files and
 * deep-merge package.json manifests:
 *
 *   node:   client → server base → db adapter → framework×ORM wiring
 *   python: client → fastapi base → sqlalchemy db adapter
 *   php:    client → laravel API overlay (applied AFTER composer create-project)
 *   nextjs: (none pre) → next overlay (applied AFTER create-next-app) → db adapter into app/
 *
 * The database choice selects both the db adapter and the root variant
 * (docker-compose only ships for containerized databases).
 */
export function composeLayers(answers: Answers): Layer[] {
  validateAnswerCompatibility(answers)
  const layers: Layer[] = []
  const integrated = answers.architecture.kind === 'integrated-fullstack'
  const native = answers.architecture.kind === 'native-app'
  const clientDest = answers.fullStack && !integrated ? 'client' : '.'

  // Native platforms: the official generator (create-expo-app /
  // create-tauri-app) IS the scaffold — OmniCraft applies only a notes +
  // API-client overlay after it runs (see index.ts).
  if (native) {
    layers.push({
      src:
        answers.architecture.kind === 'native-app' && answers.architecture.platform === 'mobile'
          ? 'platform/mobile/expo'
          : 'platform/desktop/tauri',
      dest: '.',
    })
    return layers
  }

  if (!integrated) {
    // The JS client exists for the React/Vite path (server-agnostic); the
    // vue/svelte clients are TS-only for now (#25 scope note).
    if (answers.frontend === 'react' && answers.language === 'javascript') {
      layers.push({ src: 'web/react/client-js', dest: clientDest })
    } else {
      layers.push({ src: `web/${answers.frontend}/client`, dest: clientDest })
    }
  }

  if (answers.fullStack) {
    if (integrated) {
      // The create-next-app skeleton is generated post-layer (see index.ts).
      // The Next overlay is self-contained (app/api route handlers, users
      // page); the db layer lands in app/db — sibling imports, drizzle-kit
      // for schema tooling, SQL-file migrations via db:migrate.
      layers.push({ src: 'web/nextjs/overlay', dest: '.' })
      layers.push({ src: `web/nextjs/db-${answers.database}`, dest: 'app/db', mergeManifestAtRoot: true })
    } else if (answers.backendRuntime === 'python') {
      layers.push({ src: `server/python/${answers.backendFramework}/base`, dest: 'server' })
      layers.push({ src: `db/sqlalchemy/${answers.database}`, dest: 'server' })
    } else if (answers.backendRuntime === 'php') {
      layers.push({ src: `server/php/${answers.backendFramework}`, dest: 'server' })
    } else {
      layers.push({ src: `server/node/${answers.backendFramework}/base`, dest: 'server' })
      layers.push({ src: `db/${answers.orm}/${answers.database}`, dest: 'server' })
      layers.push({ src: `server/node/${answers.backendFramework}/${answers.orm}`, dest: 'server' })
    }
  }

  // Next.js ships Tailwind wired by create-next-app (turbopack loader) —
  // the Vite tailwind extra (and the vite-config-based shadcn setup) is
  // only for Vite clients. The vite.config.ts override is per-framework
  // (each client's plugin differs).
  if (answers.extras.tailwind && !integrated) {
    layers.push({ src: `extras/tailwind/vite-${answers.frontend}`, dest: clientDest })
    layers.push({ src: 'extras/tailwind/css', dest: `${clientDest}/src` })
  }
  if (answers.extras.eslintPrettier) {
    layers.push({ src: 'extras/eslint', dest: '.' })
  }
  // shadcn builds on Tailwind: pre-provisions the `@/` alias (tsconfig/vite)
  // and the shadcn-based App; `npx shadcn init/add` run post-scaffold (see
  // index.ts) to pull the pinned preset and components. React+Vite only —
  // the generated components and vite alias assume that stack.
  if (answers.extras.shadcn && answers.frontend === 'react' && !integrated) {
    layers.push({ src: 'extras/shadcn', dest: clientDest })
  }

  const rootPrefix =
    integrated
      ? 'root/fullstack-next'
      : answers.fullStack && answers.backendRuntime === 'python'
        ? 'root/fullstack-python'
        : answers.fullStack && answers.backendRuntime === 'php'
          ? 'root/fullstack-php'
          : 'root/fullstack'

  layers.push({
    src: answers.fullStack ? `${rootPrefix}/${answers.database}` : 'root/frontend-only',
    dest: '.',
  })

  return layers
}

/** Layers applied after `composer create-project` (Laravel). */
export function isPostComposerLayer(layer: Layer): boolean {
  return layer.src.startsWith('server/php/')
}

/** Splits template layers around the official generators used by the web flow. */
export function planLayerApplication(
  layers: Layer[],
  architecture: Answers['architecture'],
): { afterOfficialGenerator: Layer[]; beforeComposer: Layer[]; afterComposer: Layer[] } {
  if (architecture.kind === 'integrated-fullstack') {
    return { afterOfficialGenerator: layers, beforeComposer: [], afterComposer: [] }
  }

  const afterComposer = layers.filter(isPostComposerLayer)
  return {
    afterOfficialGenerator: [],
    beforeComposer: layers.filter((layer) => !isPostComposerLayer(layer)),
    afterComposer,
  }
}

/** Tokens available to every template file. */
export function templateVariables(answers: Answers): Record<string, string> {
  const name = answers.projectName
  const databaseName = name.replace(/-/g, '_')
  const variables: Record<string, string> = {
    projectName: name,
    clientPackageName: answers.fullStack && answers.architecture.kind !== 'integrated-fullstack' ? `${name}-client` : name,
    serverPackageName: `${name}-server`,
    databaseName,
    backendFramework: answers.backendFramework ?? '',
    orm: answers.orm ?? '',
  }

  // Laravel .env database block, composed per database choice.
  if (answers.database === 'postgres') {
    variables.dbConfig = [
      'DB_CONNECTION=pgsql',
      'DB_HOST=127.0.0.1',
      'DB_PORT=5432',
      `DB_DATABASE=${databaseName}`,
      'DB_USERNAME=omnicraft',
      'DB_PASSWORD=omnicraft',
    ].join('\n')
  } else if (answers.database === 'mysql') {
    variables.dbConfig = [
      'DB_CONNECTION=mysql',
      'DB_HOST=127.0.0.1',
      'DB_PORT=3306',
      `DB_DATABASE=${databaseName}`,
      'DB_USERNAME=omnicraft',
      'DB_PASSWORD=omnicraft',
    ].join('\n')
  } else if (answers.database === 'sqlite') {
    variables.dbConfig = 'DB_CONNECTION=sqlite'
  }

  return variables
}
