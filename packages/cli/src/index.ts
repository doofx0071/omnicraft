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
import { validateStackFlags } from './prefill.js'
import { checkForUpdate } from './update-check.js'
import { mkdirSync } from 'node:fs'

/**
 * The prompt library drives the console in raw mode; if the process exits
 * hard (Ctrl+C during install, a crash), cmd.exe keeps the raw console state
 * and every keystroke after the CLI exits garbles — arrows print as ^[[A and
 * commands get mangled. Restore the console on every way out.
 */
function restoreTerminal(): void {
  try {
    if (process.stdin.isTTY && process.stdin.isRaw) process.stdin.setRawMode(false)
    if (process.stdout.isTTY) process.stdout.write('\u001B[?25h') // ensure cursor visible
  } catch {
    // stdin/stdout already detached — nothing to restore
  }
}

process.on('exit', restoreTerminal)
process.on('SIGINT', () => {
  restoreTerminal()
  process.exit(130)
})
process.on('uncaughtException', (err) => {
  restoreTerminal()
  console.error(err)
  process.exit(1)
})

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

  if (!process.stdin.isTTY && !args.yes) {
    p.log.error('OmniCraft is interactive and needs a real terminal to run its prompts.')
    p.log.message(
      'For CI and scripted use, pass --yes (and any stack flags):\n  npm create omnicraft@latest my-app -- --yes --skip-install',
    )
    process.exitCode = 1
    return
  }

  try {
    validateStackFlags(args)
  } catch (err) {
    p.log.error((err as Error).message)
    process.exitCode = 1
    return
  }

  if (!process.env.NO_UPDATE_NOTIFIER && !process.env.CI) {
    const latest = await checkForUpdate(CLI_VERSION)
    if (latest) {
      p.log.info(`Update available: v${latest} — you are on v${CLI_VERSION}. Run: npm create omnicraft@latest`)
    }
  }

  const answers = await runPrompts(args.projectName, args)

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
        p.log.step(`Installing dependencies with ${pm} — live output below (this can take a minute)`)
        const ok = await installDependencies(answers.targetDir, pm)
        if (ok) {
          p.log.success(`Dependencies installed with ${pm}`)
        } else {
          p.log.warn(`Install failed — check the output above, then run "${pm} install" inside the project`)
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
