import * as p from '@clack/prompts'
import { HELP_TEXT, parseArgs } from './args.js'
import { CancelledError, unwrap } from './cancel.js'
import { CLI_VERSION, TEMPLATES_ROOT } from './config.js'
import { printNextSteps } from './next-steps.js'
import { runPrompts } from './prompts/run-prompts.js'
import { composeLayers, templateVariables } from './scaffold/compose.js'
import { createEnvFiles } from './scaffold/env.js'
import { applyLayers } from './scaffold/engine.js'
import { gitInit } from './scaffold/git.js'
import { detectPackageManager, installDependencies } from './scaffold/pkg-manager.js'
import { fetchRemoteTemplates } from './scaffold/remote.js'
import { mkdirSync } from 'node:fs'

async function main(): Promise<void> {
  let args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (err) {
    console.error((err as Error).message)
    process.exitCode = 1
    return
  }

  if (args.help) {
    console.log(HELP_TEXT)
    return
  }
  if (args.version) {
    console.log(CLI_VERSION)
    return
  }

  p.intro(`⚡ OmniCraft v${CLI_VERSION} — craft any stack`)

  if (!process.stdin.isTTY) {
    p.log.error('OmniCraft is interactive and needs a real terminal to run its prompts.')
    p.log.message(
      'Open a terminal, cd to where you want the project, and run:\n  npm create omnicraft@latest',
    )
    process.exitCode = 1
    return
  }

  const answers = await runPrompts(args.projectName)

  let templatesRoot = TEMPLATES_ROOT
  if (args.latest) {
    const spinner = p.spinner()
    spinner.start('Fetching latest templates from GitHub...')
    try {
      templatesRoot = await fetchRemoteTemplates()
      spinner.stop('Latest templates fetched')
    } catch {
      spinner.stop('Could not fetch templates from GitHub')
      p.log.warn(
        'Check the repo config in src/config.ts and your connection, or run without --latest to use the embedded templates.',
      )
      p.outro('Aborted.')
      return
    }
  }

  try {
    const spinner = p.spinner()
    spinner.start('Crafting your project...')
    mkdirSync(answers.targetDir, { recursive: true })
    applyLayers(templatesRoot, composeLayers(answers), templateVariables(answers), answers.targetDir)
    spinner.stop('Project generated')

    const envFiles = createEnvFiles(answers.targetDir)
    for (const file of envFiles) p.log.step(`Created ${file.replace(answers.targetDir + '\\', '').replace(answers.targetDir + '/', '')}`)

    spinner.start('Initializing git repository...')
    const gitOk = gitInit(answers.targetDir)
    spinner.stop(gitOk ? 'Git repository initialized' : 'Git not available — skipped git init')

    const pm = detectPackageManager()
    if (!args.skipInstall) {
      const shouldInstall = unwrap(
        await p.confirm({
          message: `Install dependencies with ${pm} now?`,
          initialValue: true,
        }),
      )
      if (shouldInstall) {
        spinner.start(`Installing dependencies with ${pm}...`)
        const result = installDependencies(answers.targetDir, pm)
        if (result.ok) {
          spinner.stop('Dependencies installed')
        } else {
          spinner.stop(`Install failed — run "${pm} install" manually`)
          p.log.warn(result.output.split('\n').slice(-5).join('\n'))
        }
      } else {
        p.log.step(`Skipped install — run "${pm} install" when ready`)
      }
    }

    printNextSteps(answers, pm)
    p.outro('Crafted! Happy building ⚡')
  } catch (err) {
    if (err instanceof CancelledError) {
      p.cancel(err.message)
      return
    }
    p.cancel('Something went wrong while scaffolding.')
    if (args.debug) {
      console.error(err)
    } else {
      p.log.error(`${(err as Error).message} (re-run with --debug for the stack trace)`)
    }
    process.exitCode = 1
  }
}

main().catch((err) => {
  if (err instanceof CancelledError) {
    p.cancel(err.message)
    return
  }
  console.error(err)
  process.exitCode = 1
})
