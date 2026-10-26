import * as p from '@clack/prompts'
import { HELP_TEXT, parseArgs } from './args.js'
import { CancelledError, unwrap } from './cancel.js'
import { CLI_VERSION, CNA_PACKAGE, SHADCN_COMPONENTS, SHADCN_PRESET, TEMPLATES_ROOT, TEMPLATE_REPO } from './config.js'
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
import { copyFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

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
      templatesRoot = (await fetchRemoteTemplates()).dir
      spinner.stop(`Templates fetched (${TEMPLATE_REPO.ref})`)
    } catch {
      spinner.stop('Could not fetch templates from GitHub')
      p.log.warn(
        `Make sure release tag ${TEMPLATE_REPO.ref} exists on GitHub, check your connection, or run without --latest to use the embedded templates.`,
      )
      p.outro('Aborted.')
      return
    }
  }

  // Native platforms (mobile/desktop): the official generator IS the
  // scaffold; OmniCraft applies its overlay afterwards and returns — no web
  // flow, no db prompts, no tailwind/shadcn steps.
  if (answers.architecture.kind === 'native-app') {
    const mobile = answers.architecture.platform === 'mobile'
    const layers = composeLayers(answers)
    const variables = templateVariables(answers)
    const spinner = p.spinner()

    if (mobile) {
      spinner.start('Creating the Expo app with create-expo-app (this can take a minute)...')
      const cea = runCommand(
        'npx',
        ['--yes', 'create-expo-app@latest', answers.targetDir, '--template', 'default@sdk-58', '--yes', '--no-install', '--no-agents-md'],
        dirname(answers.targetDir),
        64 * 1024 * 1024,
      )
      if (!cea.ok) {
        spinner.stop('create-expo-app failed')
        throw new Error('create-expo-app failed — see the output above. Check your connection and that Node ≥ 20 is installed.')
      }
      applyLayers(templatesRoot, layers, variables, answers.targetDir)
      spinner.stop('Expo app created and configured')
    } else {
      spinner.start('Creating the Tauri app with create-tauri-app (this can take a minute)...')
      const identifier = `com.omnicraft.${answers.projectName.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'app'}`
      const cta = runCommand(
        'npx',
        ['--yes', 'create-tauri-app@latest', basename(answers.targetDir), '--template', 'react-ts', '--manager', 'npm', '--yes', '--identifier', identifier],
        dirname(answers.targetDir),
        64 * 1024 * 1024,
      )
      if (!cta.ok) {
        spinner.stop('create-tauri-app failed')
        throw new Error('create-tauri-app failed — see the output above. Check your connection.')
      }
      applyLayers(templatesRoot, layers, variables, answers.targetDir)
      spinner.stop('Tauri app created and configured')
    }

    const envFiles = createEnvFiles(answers.targetDir)
    for (const file of envFiles) p.log.step(`Created ${file.replace(answers.targetDir + '\\', '').replace(answers.targetDir + '/', '')}`)

    spinner.start('Initializing git repository...')
    const gitOkNative = gitInit(answers.targetDir)
    spinner.stop(gitOkNative ? 'Git repository initialized' : 'Git not available — skipped git init')

    if (!args.skipInstall && mobile) {
      const shouldInstall = unwrap(
        await p.confirm({
          message: 'Install Expo dependencies with npm now? (Expo SDK + Expo Router — this can take a couple of minutes)',
          initialValue: true,
        }),
      )
      if (shouldInstall) {
        p.log.step('Installing dependencies with npm — live output below')
        const ok = await installDependencies(answers.targetDir, 'npm')
        if (ok) p.log.success('Dependencies installed')
        else p.log.warn('Install failed — run "npm install" inside the project')
      } else {
        p.log.step('Skipped — run "npm install" when ready')
      }
    }
    if (!mobile) {
      p.log.info('Dependencies were installed by create-tauri-app (npm)')
    }

    p.note(
      mobile
        ? `cd ${answers.projectName}\nnpx expo start              # press a (Android) / i (iOS)\n# pair with a backend: see OMNICRAFT.md`
        : `cd ${answers.projectName}\ncargo --version            # Rust is required to build the shell\nnpm run tauri dev          # desktop app with hot reload\n# pair with a backend: see OMNICRAFT.md`,
      'Next steps',
    )
    p.outro('Crafted! Happy building ⚡')
    return
  }

  try {
    const spinner = p.spinner()
    const layers = composeLayers(answers)
    const variables = templateVariables(answers)
    const integrated = answers.architecture.kind === 'integrated-fullstack'
    const isNextOverlay = (layer: { src: string }) => layer.src.startsWith('web/nextjs/')
    const pre = layers.filter((layer) => !isPostComposerLayer(layer) && !(integrated && isNextOverlay(layer)))
    const post = layers.filter((layer) => isPostComposerLayer(layer) || (integrated && isNextOverlay(layer)))

    if (integrated) {
      // Next.js is created by the pinned create-next-app (the overlay can
      // only be applied onto an existing skeleton). Non-interactive flags
      // mirror our defaults: TS, App Router, Tailwind, @/ alias, npm, no install.
      spinner.start('Creating the Next.js application with create-next-app (this can take a couple of minutes)...')
      const cna = runCommand(
        'npx',
        [
          '--yes', CNA_PACKAGE, answers.projectName,
          '--ts', '--app', '--tailwind', '--no-src-dir', '--eslint',
          '--import-alias', '@/*', '--use-npm', '--skip-install', '--yes',
        ],
        // create-next-app refuses to write into an existing non-empty dir —
        // scaffold into the (fresh) target and move the app up.
        dirname(answers.targetDir),
        64 * 1024 * 1024,
      )
      if (!cna.ok) {
        spinner.stop('create-next-app failed')
        throw new Error(
          `create-next-app failed — see the output above. You can retry manually:\n  npx ${CNA_PACKAGE} ${answers.projectName} --ts --app --tailwind --no-src-dir --import-alias @/\\* --use-npm --skip-install --yes`,
        )
      }
      const created = join(dirname(answers.targetDir), answers.projectName)
      if (created !== answers.targetDir && !existsSync(answers.targetDir)) {
        // cna created <parent>/<name>; move it to the requested target when
        // they differ (nested/renamed target paths).
        renameSync(created, answers.targetDir)
      }
      applyLayers(templatesRoot, post, variables, answers.targetDir)
      spinner.stop('Next.js application created and configured')
    } else {
      spinner.start('Crafting your project...')
      mkdirSync(answers.targetDir, { recursive: true })
      applyLayers(templatesRoot, pre, variables, answers.targetDir)
      spinner.stop('Project generated')
    }

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

          // shadcn/ui: components are pulled from the registry by the pinned
          // shadcn CLI (an official-generator adapter, like Laravel/Composer).
          // The client must be installed first — the CLI writes into it and
          // installs component deps itself.
          if (answers.extras.shadcn && ok) {
            const clientDir = answers.fullStack ? join(answers.targetDir, 'client') : answers.targetDir
            spinner.start('Setting up shadcn/ui (init + components — this can take a minute)...')
            const init = runCommand(
              'npx',
              ['--yes', 'shadcn@latest', 'init', '--template', 'vite', '--base', 'radix', '--preset', SHADCN_PRESET, '--no-monorepo', '--force'],
              clientDir,
            )
            const add =
              init.ok &&
              runCommand('npx', ['--yes', 'shadcn@latest', 'add', ...SHADCN_COMPONENTS, '--yes', '--overwrite'], clientDir).ok
            if (init.ok && add) {
              // The shadcn CLI emits its own formatting — normalize to the
              // project's prettier config so the lint gates stay clean.
              runCommand('npx', ['--yes', 'prettier@latest', '--write', '.'], clientDir)
              spinner.stop(`shadcn/ui ready (${SHADCN_PRESET}: ${SHADCN_COMPONENTS.join(', ')})`)
            } else {
              spinner.stop('shadcn setup failed')
              p.log.warn(
                `Run manually inside ${answers.fullStack ? 'client/' : 'the project'}:\n  npx shadcn@latest init --template vite --base radix --preset ${SHADCN_PRESET} --no-monorepo --force\n  npx shadcn@latest add ${SHADCN_COMPONENTS.join(' ')}`,
              )
            }
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
