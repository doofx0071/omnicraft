import * as p from '@clack/prompts'
import type { Option } from '@clack/prompts'
import { CancelledError, unwrap, unwrapMany } from '../cancel.js'
import {
  BACKEND_FRAMEWORK_LABELS,
  DATABASE_LABELS,
  FRONTEND_LABELS,
  type Answers,
  type AuthenticationSetup,
  type BackendFramework,
  type BackendRuntime,
  type Database,
  type Frontend,
  type Language,
  type ProjectType,
} from '../types.js'
import { checkRawProjectName, findCollisions, isNonEmptyDirectory, resolveTargetDir } from '../validators.js'
import { CLIENT_PORT, SERVER_PORT } from '../config.js'
import { CAPABILITY_REGISTRY } from '../capabilities.js'
import { AVAILABLE, parseEnumChoice, validateStackFlags } from '../prefill.js'
import type { ParsedArgs } from '../args.js'
import {
  hasFullStackFlags,
  compatibleAuthenticationSetups,
  isFrontendAllowedByFlags,
  isProjectTypeAllowedByFlags,
  isRuntimeAllowedByFlags,
  nodeOrmsForFramework,
  MODULE_COMPATIBILITY,
  supportsLanguage,
  supportsShadcn,
  validateAnswerCompatibility,
} from '../compatibility.js'

interface Choice<T extends string> {
  value: T
  label: string
  hint?: string
  available: boolean
}

function registryChoices<const Options extends readonly {
  value: string
  label: string
  available: boolean
  hint?: string
}[]>(options: Options): Choice<Options[number]['value']>[] {
  return options.map(({ value, label, available, hint }) => ({
    value,
    label,
    available,
    ...(hint === undefined ? {} : { hint }),
  }))
}

/**
 * A select prompt where roadmap items are shown with a "(soon)" hint but
 * bounce back with a friendly notice instead of being hidden — users can see
 * where OmniCraft is headed.
 *
 * The generic signature keeps call sites fully typed; the implementation runs
 * on concrete strings because clack's `Option<Value>` conditional type cannot
 * be satisfied for an unresolved generic.
 */
function selectWithSoon<T extends string>(message: string, choices: Choice<T>[]): Promise<T> {
  return selectWithSoonLoop(message, choices as Choice<string>[]) as Promise<T>
}

async function selectWithSoonLoop(message: string, choices: Choice<string>[]): Promise<string> {
  for (;;) {
    const picked = unwrap<string>(
      await p.select<string>({
        message,
        options: choices.map((c) => {
          const option: Option<string> = {
            value: c.value,
            label: c.available ? c.label : `${c.label} (soon)`,
          }
          if (c.hint !== undefined) option.hint = c.hint
          return option
        }),
      }),
    )
    const choice = choices.find((c) => c.value === picked)!
    if (choice.available) return choice.value
    p.log.warn(`${choice.label} is on the roadmap — it's not available yet. Pick another for now.`)
  }
}

function projectTypeChoices(flags: ParsedArgs): Choice<ProjectType>[] {
  const choices = registryChoices(CAPABILITY_REGISTRY.projectType)
  return choices.filter((choice) => isProjectTypeAllowedByFlags(choice.value, flags))
}

function frontendChoices(flags: ParsedArgs): Choice<Frontend>[] {
  const choices = registryChoices(CAPABILITY_REGISTRY.frontend)
  return choices.filter((choice) => isFrontendAllowedByFlags(choice.value, flags))
}

function runtimeChoices(flags: ParsedArgs): Choice<BackendRuntime>[] {
  const choices = registryChoices(CAPABILITY_REGISTRY.runtime)
  return choices.filter((choice) => isRuntimeAllowedByFlags(choice.value, flags))
}

/**
 * Runs the interactive flow. Flags from the command line answer their prompt
 * directly; `--yes` answers everything with the defaults and skips the final
 * confirmation (CI-friendly, also what makes non-TTY runs possible).
 */
export async function runPrompts(argName?: string, args?: ParsedArgs): Promise<Answers> {
  const flags: ParsedArgs = args ?? ({} as ParsedArgs)
  validateStackFlags(flags)
  const forced = flags.yes === true

  // ── App name ────────────────────────────────────────────────────────────
  let projectName: string
  if (argName) {
    const { slug, ok, reason } = checkRawProjectName(argName)
    if (!ok) {
      p.log.error(`"${argName}" is not a valid app name: ${reason}`)
      process.exitCode = 1
      throw new CancelledError('Please re-run with a different name.')
    }
    projectName = slug
    p.log.step(`App name: ${projectName}`)
  } else if (forced) {
    projectName = 'my-app'
    p.log.step(`App name: ${projectName} (default — pass a name to override)`)
  } else {
    for (;;) {
      const raw = unwrap<string>(
        await p.text({
          message: 'What is the name of your app?',
          placeholder: 'my-app',
          validate: (value) => {
            if (!value || !value.trim()) return 'Please enter a name.'
            const { slug, ok, reason } = checkRawProjectName(value)
            if (!ok) return `${reason} (would become "${slug || '—'}")`
            return undefined
          },
        }),
      )
      const { slug, ok, reason } = checkRawProjectName(raw)
      if (!ok) {
        p.log.error(reason ?? 'Invalid name.')
        continue
      }
      projectName = slug
      if (slug !== raw.trim()) p.log.step(`Using folder name: ${slug}`)
      break
    }
  }

  const targetDir = resolveTargetDir(projectName)
  if (isNonEmptyDirectory(targetDir)) {
    if (forced) {
      throw new CancelledError(
        `Directory "${projectName}" exists and is not empty — refusing to scaffold over it in non-interactive mode.`,
      )
    }
    // Show exactly what would collide so "continue" is an informed choice.
    const layerDirs = ['.', 'client', 'server']
    const { collisions, protectedFiles } = findCollisions(targetDir, layerDirs)
    if (protectedFiles.length > 0) {
      p.log.warn(
        `These files are user-owned and will NOT be touched: ${protectedFiles.join(', ')}`,
      )
    }
    if (collisions.length > 0) {
      const preview = collisions.slice(0, 10).join(', ')
      const more = collisions.length > 10 ? ` … and ${collisions.length - 10} more` : ''
      const proceed = unwrap<boolean>(
        await p.confirm({
          message: `Directory "${projectName}" is not empty — ${collisions.length} file(s) would be overwritten (${preview}${more}). Continue?`,
          initialValue: false,
        }),
      )
      if (!proceed) throw new CancelledError('Nothing was created.')
    }
  }

  // ── What for? ───────────────────────────────────────────────────────────
  let projectType: ProjectType = 'web'
  if (flags.platform) {
    projectType = parseEnumChoice('--platform', flags.platform, AVAILABLE.projectType)
  } else if (forced) {
    projectType = 'web'
  } else {
    projectType = await selectWithSoon<ProjectType>('What are you building?', projectTypeChoices(flags))
  }

  // Native platforms: the official generator IS the scaffold — no frontend,
  // full-stack, or database prompts. The device app talks to a backend the
  // user runs separately (documented in the generated project).
  const native = projectType !== 'web'
  if (native) {
    p.log.info(
      projectType === 'mobile'
        ? 'Mobile: Expo (SDK 58, TypeScript, Expo Router) — generated by create-expo-app'
        : 'Desktop: Tauri 2 with a React UI — generated by create-tauri-app',
    )
  }

  // ── Frontend ────────────────────────────────────────────────────────────
  const nativeAuthRequested = flags.auth?.trim().toLowerCase() === 'laravel-native'
  const frontend: Frontend = native
    ? 'react' // Expo (React Native) and the Tauri UI are both React-based
    : nativeAuthRequested && flags.frontend === undefined
      ? 'livewire'
      : flags.frontend
      ? parseEnumChoice('--frontend', flags.frontend, AVAILABLE.frontend)
      : forced
        ? 'react'
        : await selectWithSoon<Frontend>('Select a frontend framework:', frontendChoices(flags))

  // Integrated frameworks are the server; neither has a separate client/API picker.
  const integrated = frontend === 'nextjs'
  const integratedLaravel = frontend === 'livewire'

  const language: Language | null = integratedLaravel
    ? null
    : flags.lang
      ? parseEnumChoice('--lang', flags.lang, AVAILABLE.lang)
      : forced
        ? 'typescript'
        : !native
          ? await selectWithSoon<Language>(
              'Select a language:',
              registryChoices(CAPABILITY_REGISTRY.language).filter((choice) =>
                supportsLanguage(projectType, frontend, choice.value) &&
                (flags.auth?.trim().toLowerCase() !== 'better-auth' ||
                  choice.value === MODULE_COMPATIBILITY.auth.language),
              ),
            )
          : 'typescript'
  if (language) p.log.info(`Language: ${language === 'typescript' ? 'TypeScript' : 'JavaScript'}`)

  // ── Full stack? ─────────────────────────────────────────────────────────
  const fullStackFlagRequested = hasFullStackFlags(flags)
  let fullStack = integrated || integratedLaravel ? true : (flags.fullStack ?? (forced || fullStackFlagRequested))
  if (!native && !integrated && !integratedLaravel && flags.fullStack === undefined && !forced && !fullStackFlagRequested) {
    fullStack = unwrap<boolean>(
      await p.confirm({
        message: 'Full-stack? Adds a backend API, database and ready-made boilerplate.',
        initialValue: true,
      }),
    )
  }

  const architecture: Answers['architecture'] = integratedLaravel
    ? { kind: 'integrated-laravel', framework: 'laravel', mode: 'livewire' }
    : integrated
      ? { kind: 'integrated-fullstack', framework: 'nextjs' }
    : fullStack && !native
      ? { kind: 'separate-frontend-api' }
      : native
        ? { kind: 'native-app', platform: projectType === 'mobile' ? 'mobile' : 'desktop' }
        : { kind: 'frontend-only' }

  let backendRuntime: BackendRuntime = integratedLaravel ? 'php' : 'node'
  let backendFramework: BackendFramework = integratedLaravel ? 'laravel' : 'express'
  let database: 'postgres' | 'sqlite' | 'mysql' = integratedLaravel ? 'sqlite' : 'postgres'
  let orm: 'drizzle' | 'prisma' | 'none' | null = integratedLaravel ? null : 'drizzle'

  if (fullStack && !native) {
    // Integrated full-stack (Next.js) runs on Node and skips the separate
    // runtime/framework prompts — the framework IS the server.
    if (!integrated && !integratedLaravel) {
      backendRuntime = flags.runtime
        ? parseEnumChoice('--runtime', flags.runtime, AVAILABLE.runtime)
        : forced
          ? 'node'
          : await selectWithSoon<BackendRuntime>('Select a backend runtime:', runtimeChoices(flags))

      const frameworkChoices: Record<BackendRuntime, Choice<BackendFramework>[]> = {
        node: registryChoices(CAPABILITY_REGISTRY.backend.node),
        python: registryChoices(CAPABILITY_REGISTRY.backend.python),
        php: registryChoices(CAPABILITY_REGISTRY.backend.php),
      }

      backendFramework = flags.backend
        ? parseEnumChoice('--backend', flags.backend, AVAILABLE.backend[backendRuntime])
        : forced
          ? AVAILABLE.backend[backendRuntime][0]
          : await selectWithSoon<BackendFramework>(
              'Select a backend framework:',
              frameworkChoices[backendRuntime].filter(
                (choice) => {
                  if (
                    flags.auth?.trim().toLowerCase() === 'better-auth' &&
                    choice.value !== MODULE_COMPATIBILITY.auth.backendFramework
                  )
                    return false
                  return (
                    !choice.available ||
                    !flags.orm ||
                    nodeOrmsForFramework(choice.value).includes(flags.orm as 'drizzle' | 'prisma' | 'none')
                  )
                },
              ),
            )
    } else if (integrated) {
      backendRuntime = 'node'
      backendFramework = 'nextjs' as BackendFramework
    } else {
      backendRuntime = 'php'
      backendFramework = 'laravel'
    }

    // Shared across runtimes (Next.js reuses the node choices — it runs on Node).
    const dbChoices: Record<BackendRuntime, Choice<Database>[]> = {
      node: registryChoices(CAPABILITY_REGISTRY.database.node),
      python: registryChoices(CAPABILITY_REGISTRY.database.python),
      php: registryChoices(CAPABILITY_REGISTRY.database.php),
    }

    database = integratedLaravel
      ? 'sqlite'
      : flags.db
        ? parseEnumChoice('--db', flags.db, AVAILABLE.db[backendRuntime])
        : forced
          ? 'postgres'
          : ((await selectWithSoon<Database>('Select a database:', dbChoices[backendRuntime])) as 'postgres' | 'sqlite' | 'mysql')

    if (integrated) {
      orm = 'none'
      p.log.info('ORM: none — Next.js uses raw SQL')
    } else if (integratedLaravel) {
      orm = null
      p.log.info('ORM: Eloquent — integrated Laravel + Livewire')
    } else if (backendRuntime === 'node') {
      const ormChoices = registryChoices(CAPABILITY_REGISTRY.orm)
        .filter(
          (choice): choice is Choice<'drizzle' | 'prisma' | 'none'> =>
            choice.value !== 'mongoose',
        )
        .map((choice) =>
          choice.value === 'prisma'
            ? {
                ...choice,
                available: database === 'postgres',
                hint: database === 'postgres' ? 'Schema-first, great DX' : 'PostgreSQL only for now',
              }
            : choice,
        )
      orm = flags.orm
        ? parseEnumChoice('--orm', flags.orm, AVAILABLE.orm.node)
        : forced
          ? 'drizzle'
          : await selectWithSoon<'drizzle' | 'prisma' | 'none'>(
              'Select an ORM:',
              ormChoices.filter(
                (choice) =>
                  nodeOrmsForFramework(backendFramework).includes(choice.value) &&
                  (flags.auth?.trim().toLowerCase() !== 'better-auth' ||
                    choice.value === MODULE_COMPATIBILITY.auth.orm),
              ),
            )
      p.log.info(orm === 'none' ? 'ORM: none — raw SQL via the driver' : `ORM: ${orm === 'drizzle' ? 'Drizzle' : 'Prisma'}`)
    } else if (backendRuntime === 'python') {
      orm = null
      p.log.info('ORM: SQLAlchemy + Alembic migrations')
    } else {
      orm = null
      p.log.info('ORM: Eloquent (Laravel migrations)')
    }

    p.log.info(`Database: ${DATABASE_LABELS[database]}`)
  }

  const authenticationContext = {
    frontend,
    language,
    architecture,
    backendRuntime: fullStack && (!integrated || integratedLaravel) && !native ? backendRuntime : null,
    backendFramework: fullStack && (!integrated || integratedLaravel) && !native ? backendFramework : null,
    orm: fullStack && !native ? orm : null,
    database: fullStack && !native ? database : null,
  }
  const compatibleAuthSetups = compatibleAuthenticationSetups(authenticationContext)
  const authentication: AuthenticationSetup = flags.auth
    ? parseEnumChoice('--auth', flags.auth, AVAILABLE.authentication)
    : forced || compatibleAuthSetups.length <= 1
      ? compatibleAuthSetups[0] ?? 'none'
      : await selectWithSoon<AuthenticationSetup>(
          'Select an authentication setup:',
          registryChoices(CAPABILITY_REGISTRY.authentication).filter((choice) =>
            compatibleAuthSetups.includes(choice.value),
          ),
        )

  // ── Extras ──────────────────────────────────────────────────────────────
  let extras: { tailwind: boolean; eslintPrettier: boolean; shadcn: boolean }
  if (native) {
    extras = { tailwind: false, eslintPrettier: false, shadcn: false }
  } else if (integratedLaravel) {
    extras = { tailwind: false, eslintPrettier: false, shadcn: false }
  } else if (integrated) {
    // create-next-app is invoked with --tailwind and --eslint; these are fixed
    // generator defaults rather than optional Vite overlay choices.
    extras = { tailwind: true, eslintPrettier: true, shadcn: false }
  } else if (flags.extras) {
    extras = {
      tailwind: flags.extras.includes('tailwind') || flags.extras.includes('shadcn'),
      eslintPrettier: flags.extras.includes('eslint'),
      shadcn: flags.extras.includes('shadcn'),
    }
  } else if (forced) {
    extras = { tailwind: true, eslintPrettier: true, shadcn: false }
  } else {
    const extraChoices = registryChoices(CAPABILITY_REGISTRY.extras)
    const picked = unwrapMany(
      await p.multiselect<'tailwind' | 'eslint' | 'shadcn'>({
        message: 'Pick extras:',
        required: false,
        initialValues: ['tailwind', 'eslint'],
        options: extraChoices
          .filter((choice) =>
            choice.value !== 'shadcn' || supportsShadcn(projectType, frontend, architecture),
          )
          .map(({ value, label, hint }) => ({ value, label, hint })),
      }),
    )
    extras = {
      tailwind: picked.includes('tailwind') || picked.includes('shadcn'),
      eslintPrettier: picked.includes('eslint'),
      shadcn: picked.includes('shadcn'),
    }
  }

  const answers: Answers = {
    projectName,
    targetDir,
    projectType,
    frontend,
    language,
    fullStack: fullStack && !native,
    backendRuntime: fullStack && (!integrated || integratedLaravel) && !native ? backendRuntime : null,
    backendFramework: fullStack && (!integrated || integratedLaravel) && !native ? backendFramework : null,
    orm: fullStack && !native ? orm : null,
    database: fullStack && !native ? database : null,
    authentication,
    extras: native ? { tailwind: false, eslintPrettier: false, shadcn: false } : extras,
    architecture,
  }
  validateAnswerCompatibility(answers)

  // ── Summary ─────────────────────────────────────────────────────────────
  const summary: string[] = [`App:        ${projectName}`]
  if (native) {
    summary.push(
      `Stack:      ${projectType === 'mobile' ? 'Expo (React Native, SDK 58) + TypeScript' : 'Tauri 2 + React + TypeScript'}`,
    )
    summary.push('Backend:    none — the device app calls a backend you run separately (see generated notes)')
  } else {
    summary.push(`Stack:      ${FRONTEND_LABELS[frontend]}${integratedLaravel ? ' (integrated)' : ' (web)'}`)
    if (integratedLaravel) {
      summary.push(`Server:     Laravel + ${DATABASE_LABELS[database]} (Eloquent, Livewire UI)`)
    } else if (integrated) {
      summary.push(`Server:     Next.js route handlers + ${DATABASE_LABELS[database]} (${orm === 'drizzle' ? 'Drizzle' : orm === 'prisma' ? 'Prisma' : 'raw SQL'})`)
    } else if (fullStack) {
      const ormLabel =
        backendRuntime === 'node'
          ? orm === 'none'
            ? '(none — raw SQL)'
            : `(${orm === 'drizzle' ? 'Drizzle' : 'Prisma'})`
          : backendRuntime === 'python'
            ? '(SQLAlchemy + Alembic)'
            : '(Eloquent)'
      summary.push(
        `Backend:    ${BACKEND_FRAMEWORK_LABELS[backendFramework]} + ${DATABASE_LABELS[database]} ${ormLabel}`,
      )
    } else {
      summary.push('Backend:    none (frontend only)')
    }
  }
  if (!native) {
    summary.push(
      `Extras:     ${[
        extras.tailwind && !extras.shadcn ? 'Tailwind CSS' : null,
        extras.shadcn ? 'shadcn/ui' : null,
        extras.eslintPrettier ? 'ESLint + Prettier' : null,
      ]
        .filter(Boolean)
        .join(', ') || 'none'}`,
    )
  }
  summary.push(
    `Authentication: ${
      authentication === 'better-auth'
        ? 'Better Auth (email/password)'
        : authentication === 'laravel-native'
          ? 'Laravel native auth (Fortify)'
          : 'none'
    }`,
  )
  summary.push(`Folder:     ${targetDir}`)
  if (!native && !integratedLaravel) summary.push(`Ports:      client ${CLIENT_PORT} · server ${SERVER_PORT}`)
  p.note(summary.join('\n'), 'Here is what will be generated')

  if (!forced) {
    const ready = unwrap<boolean>(
      await p.confirm({
        message: 'Craft it?',
        initialValue: true,
      }),
    )
    if (!ready) throw new CancelledError('Nothing was created.')
  }

  return answers
}
