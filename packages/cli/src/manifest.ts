import type { Answers, AuthenticationSetup } from './types.js'

export interface ProjectManifest {
  schema: 1
  cliVersion: string
  createdAt: string
  projectName: string
  stack: {
    platform: 'web' | 'mobile' | 'desktop'
    frontend: string
    architecture: Answers['architecture']
    backendRuntime: string | null
    backendFramework: string | null
    orm: string | null
    database: string | null
    extras: string[]
  }
  /** Creation-time auth selection; independent from the `omnicraft add` module history. */
  authentication?: AuthenticationSetup
  modules: string[]
  packageManager: string
}

export function buildManifest(answers: Answers, cliVersion: string, packageManager: string): ProjectManifest {
  const stack: ProjectManifest['stack'] = {
    platform: answers.projectType,
    frontend: answers.frontend,
    architecture: answers.architecture,
    backendRuntime: answers.backendRuntime,
    backendFramework: answers.backendFramework,
    orm: answers.orm,
    database: answers.database,
    extras: Object.entries(answers.extras)
      .filter(([, on]) => on)
      .map(([key]) => key),
  }
  return {
    schema: 1,
    cliVersion,
    createdAt: new Date().toISOString(),
    projectName: answers.projectName,
    stack,
    authentication: answers.authentication,
    modules: [],
    packageManager,
  }
}
