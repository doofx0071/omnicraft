import type { Answers } from '../types.js'
import type { Layer } from './engine.js'

/**
 * Maps the user's answers to an ordered list of template layers. Templates
 * are composed, not forked: the React client, each backend framework base,
 * each database adapter, and each framework×ORM wiring are separate layers.
 * Later layers overwrite earlier files and deep-merge package.json manifests:
 *
 *   node:   client → server base → db adapter → framework×ORM wiring
 *   python: client → fastapi base → sqlalchemy db adapter
 *   php:    client → laravel API overlay (applied AFTER composer create-project)
 *
 * The database choice selects both the db adapter and the root variant
 * (docker-compose only ships for containerized databases).
 */
export function composeLayers(answers: Answers): Layer[] {
  const layers: Layer[] = []
  const clientDest = answers.fullStack ? 'client' : '.'

  layers.push({ src: 'web/react/client', dest: clientDest })

  if (answers.fullStack) {
    if (answers.backendRuntime === 'python') {
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

  if (answers.extras.tailwind) {
    layers.push({ src: 'extras/tailwind', dest: clientDest })
  }
  if (answers.extras.eslintPrettier) {
    layers.push({ src: 'extras/eslint', dest: '.' })
  }
  // shadcn builds on Tailwind: pre-provisions the `@/` alias (tsconfig/vite)
  // and the shadcn-based App; `npx shadcn init/add` run post-scaffold (see
  // index.ts) to pull the pinned preset and components.
  if (answers.extras.shadcn) {
    layers.push({ src: 'extras/shadcn', dest: clientDest })
  }

  const rootPrefix =
    answers.fullStack && answers.backendRuntime === 'python'
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

/** Layers that must be applied after `composer create-project` (Laravel). */
export function isPostComposerLayer(layer: Layer): boolean {
  return layer.src.startsWith('server/php/')
}

/** Tokens available to every template file. */
export function templateVariables(answers: Answers): Record<string, string> {
  const name = answers.projectName
  const databaseName = name.replace(/-/g, '_')
  const variables: Record<string, string> = {
    projectName: name,
    clientPackageName: answers.fullStack ? `${name}-client` : name,
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
