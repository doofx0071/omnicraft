import type { Answers } from '../types.js'
import type { Layer } from './engine.js'

/**
 * Maps the user's answers to an ordered list of template layers. Templates
 * are composed, not forked: the React client is shared between frontend-only
 * and full-stack projects, and each backend framework/ORM pair contributes a
 * base layer plus an adapter layer. Later layers overwrite earlier files and
 * deep-merge package.json manifests.
 */
export function composeLayers(answers: Answers): Layer[] {
  const layers: Layer[] = []
  const clientDest = answers.fullStack ? 'client' : '.'

  layers.push({ src: 'web/react/client', dest: clientDest })

  if (answers.fullStack) {
    layers.push({ src: `server/node/${answers.backendFramework}/base`, dest: 'server' })
    layers.push({ src: `server/node/${answers.backendFramework}/${answers.orm}`, dest: 'server' })
  }

  if (answers.extras.tailwind) {
    layers.push({ src: 'extras/tailwind', dest: clientDest })
  }
  if (answers.extras.eslintPrettier) {
    layers.push({ src: 'extras/eslint', dest: '.' })
  }

  layers.push({ src: answers.fullStack ? 'root/fullstack' : 'root/frontend-only', dest: '.' })

  return layers
}

/** Tokens available to every template file. */
export function templateVariables(answers: Answers): Record<string, string> {
  const name = answers.projectName
  return {
    projectName: name,
    clientPackageName: answers.fullStack ? `${name}-client` : name,
    serverPackageName: `${name}-server`,
    databaseName: name.replace(/-/g, '_'),
    backendFramework: answers.backendFramework ?? '',
    orm: answers.orm ?? '',
  }
}
