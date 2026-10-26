import * as p from '@clack/prompts'
import { HELP_TEXT, parseArgs } from './args.js'
import { CancelledError, unwrap } from './cancel.js'
import { CLI_VERSION, TEMPLATES_ROOT, TEMPLATE_REPO } from './config.js'
import { printNextSteps } from './next-steps.js'
import { runPrompts } from './prompts/run-prompts.js'
import { composeLayers, isPostComposerLayer, templateVariables } from './scaffold/compose.js'
import { createEnvFiles } from './scaffold/env.js'
import { applyLayers } from './scaffold/engine.js'
import { gitInit } from './scaffold/git.js'
import { runCommand } from './exec.js'
import { detectPackageManager, installDependencies } from './scaffold/pkg-manager.js'
import { fetchRemoteTemplates } from './scaffold/remote.js'
import { validateStackFlags } from './prefill.js'
import { checkForUpdate } from './update-check.js'
import { mkdirSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'

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
    spinner.start(`Fetching templates for ${TEMPLATE_REPO.ref} from GitHub...`)
    try {
      const remote = await fetchRemoteTemplates()
      templatesRoot = remote.dir
      spinner.stop(`Templates fetched (${remote.ref})`)
    } catch {
      spinner.stop('Could not fetch templates from GitHub')
      p.log.warn(
        `Make sure release tag ${TEMPLATE_REPO.ref} exists on GitHub, check your connection, or run without --latest to use the embedded templates.`,
      )
      p.outro('Aborted.')
      return
    }
  }

  try {
    const spinner = p.spinner()
    const layers = composeLayers(answers)
    const variables = templateVariables(answers)
    const pre = layers.filter((layer) => !isPostComposerLayer(layer))
    const post = layers.filter((layer) => isPostComposerLayer(layer))

    spinner.start('Crafting your project...')
    mkdirSync(answers.targetDir, { recursive: true })
    applyLayers(templatesRoot, pre, variables, answers.targetDir)
    spinner.stop('Project generated')

    // Laravel is created by Composer itself (the overlay can only be applied
    // onto an existing skeleton), then configured by OmniCraft.
    if (post.length > 0) {
      spinner.start('Creating the Laravel application with Composer (this can take a couple of minutes)...')
      const composer = runCommand(
        'composer',
        ['create-project', 'laravel/laravel:^12.0', 'server', '--no-interaction', '--prefer-dist', '--no-progress'],
        answers.targetDir,
        64 * 1024 * 1024,
      )
      if (!composer.ok) {
        spinner.stop('Composer failed')
        throw new Error(
          `composer create-project failed — is Composer installed?\n${composer.output.split('\n').slice(-10).join('\n')}`,
        )
      }
      applyLayers(templatesRoot, post, variables, answers.targetDir)
      copyFileSync(join(answers.targetDir, 'server', '.env.example'), join(answers.targetDir, 'server', '.env'))
      runCommand('php', ['artisan', 'key:generate', '--force'], join(answers.targetDir, 'server'))
      spinner.stop('Laravel application created and configured')
    }

    const envFiles = createEnvFiles(answers.targetDir)
    for (const file of envFiles) p.log.step(`Created ${file.replace(answers.targetDir + '\\', '').replace(answers.targetDir + '/', '')}`)

    spinner.start('Initializing git repository...')
    const gitOk = gitInit(answers.targetDir)
    spinner.stop(gitOk ? 'Git repository initialized' : 'Git not available — skipped git init')

    const pm = detectPackageManager()
    if (!args.skipInstall) {
      if (answers.backendRuntime === 'python') {
        const shouldSync = unwrap(
          await p.confirm({
            message: 'Set up the Python environment with uv now?',
            initialValue: true,
          }),
        )
        if (shouldSync) {
          spinner.start('Syncing Python dependencies with uv (this can take a minute)...')
          const res = runCommand('uv', ['sync'], join(answers.targetDir, 'server'))
          if (res.ok) {
            spinner.stop('Python environment ready')
          } else {
            spinner.stop('uv sync failed')
            p.log.warn('Is uv installed? Run: pip install uv — then "uv sync" inside server/')
          }
        } else {
          p.log.step('Skipped — run "uv sync" inside server/ when ready')
        }
      } else if (answers.backendRuntime === 'php') {
        p.log.step('PHP dependencies already installed by Composer')
      } else {
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
