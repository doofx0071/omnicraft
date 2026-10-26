import * as p from '@clack/prompts'
import type { Option } from '@clack/prompts'
import { CancelledError, unwrap, unwrapMany } from '../cancel.js'
import {
  BACKEND_FRAMEWORK_LABELS,
  BACKEND_RUNTIME_LABELS,
  DATABASE_LABELS,
  FRONTEND_LABELS,
  PROJECT_TYPE_LABELS,
  type Answers,
  type BackendFramework,
  type BackendRuntime,
  type Database,
  type Frontend,
  type ProjectType,
} from '../types.js'
import { checkRawProjectName, isNonEmptyDirectory, resolveTargetDir } from '../validators.js'
import { CLIENT_PORT, SERVER_PORT } from '../config.js'
import { AVAILABLE, parseEnumChoice } from '../prefill.js'
import type { ParsedArgs } from '../args.js'

interface Choice<T extends string> {
  value: T
  label: string
  hint?: string
  available: boolean
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

/**
 * Runs the interactive flow. Flags from the command line answer their prompt
 * directly; `--yes` answers everything with the defaults and skips the final
 * confirmation (CI-friendly, also what makes non-TTY runs possible).
 */
export async function runPrompts(argName?: string, args?: ParsedArgs): Promise<Answers> {
  const flags: ParsedArgs = args ?? ({} as ParsedArgs)
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
    const proceed = unwrap<boolean>(
      await p.confirm({
        message: `Directory "${projectName}" already exists and is not empty. Scaffold into it anyway?`,
        initialValue: false,
      }),
    )
    if (!proceed) throw new CancelledError('Nothing was created.')
  }

  // ── What for? ───────────────────────────────────────────────────────────
  let projectType: ProjectType = 'web'
  if (!forced) {
    projectType = await selectWithSoon<ProjectType>('What are you building?', [
      { value: 'web', label: PROJECT_TYPE_LABELS.web, available: true, hint: 'v1 focus' },
      { value: 'mobile', label: PROJECT_TYPE_LABELS.mobile, available: false },
      { value: 'desktop', label: PROJECT_TYPE_LABELS.desktop, available: false },
    ])
  }

  // ── Frontend ────────────────────────────────────────────────────────────
  const frontend: Frontend = flags.frontend
    ? parseEnumChoice('--frontend', flags.frontend, AVAILABLE.frontend)
    : forced
      ? 'react'
      : await selectWithSoon<Frontend>('Select a frontend framework:', [
          { value: 'react', label: FRONTEND_LABELS.react, available: true, hint: 'Vite + TypeScript' },
          { value: 'nextjs', label: FRONTEND_LABELS.nextjs, available: false },
          { value: 'vue', label: FRONTEND_LABELS.vue, available: false },
          { value: 'svelte', label: FRONTEND_LABELS.svelte, available: false },
        ])

  p.log.info('Language: TypeScript (JavaScript support is coming)')

  // ── Full stack? ─────────────────────────────────────────────────────────
  let fullStack = flags.fullStack ?? (forced ? true : false)
  if (flags.fullStack === undefined && !forced) {
    fullStack = unwrap<boolean>(
      await p.confirm({
        message: 'Full-stack? Adds a backend API, database and ready-made boilerplate.',
        initialValue: true,
      }),
    )
  }

  let backendRuntime: BackendRuntime = 'node'
  let backendFramework: BackendFramework = 'express'
  let database: 'postgres' | 'sqlite' | 'mysql' = 'postgres'
  let orm: 'drizzle' | 'prisma' | null = 'drizzle'

  if (fullStack) {
    backendRuntime = flags.runtime
      ? parseEnumChoice('--runtime', flags.runtime, AVAILABLE.runtime)
      : forced
        ? 'node'
        : await selectWithSoon<BackendRuntime>('Select a backend runtime:', [
            { value: 'node', label: BACKEND_RUNTIME_LABELS.node, available: true, hint: 'Express, Fastify, Hono' },
            { value: 'python', label: BACKEND_RUNTIME_LABELS.python, available: true, hint: 'FastAPI + SQLAlchemy' },
            { value: 'php', label: BACKEND_RUNTIME_LABELS.php, available: true, hint: 'Laravel + Eloquent' },
          ])

    const frameworkChoices: Record<BackendRuntime, Choice<BackendFramework>[]> = {
      node: [
        { value: 'express', label: BACKEND_FRAMEWORK_LABELS.express, available: true, hint: 'The classic, huge ecosystem' },
        { value: 'fastify', label: BACKEND_FRAMEWORK_LABELS.fastify, available: true, hint: 'Fast, schema-first' },
        { value: 'hono', label: BACKEND_FRAMEWORK_LABELS.hono, available: true, hint: 'Ultra-light' },
        { value: 'nestjs', label: BACKEND_FRAMEWORK_LABELS.nestjs, available: false },
      ],
      python: [
        { value: 'fastapi', label: BACKEND_FRAMEWORK_LABELS.fastapi, available: true, hint: 'SQLAlchemy + Alembic' },
        { value: 'django', label: BACKEND_FRAMEWORK_LABELS.django, available: false },
      ],
      php: [
        { value: 'laravel', label: BACKEND_FRAMEWORK_LABELS.laravel, available: true, hint: 'Laravel 12 + Eloquent' },
        { value: 'symfony', label: BACKEND_FRAMEWORK_LABELS.symfony, available: false },
      ],
    }

    backendFramework = flags.backend
      ? parseEnumChoice('--backend', flags.backend, AVAILABLE.backend[backendRuntime])
      : forced
        ? AVAILABLE.backend[backendRuntime][0]
        : await selectWithSoon<BackendFramework>(
            'Select a backend framework:',
            frameworkChoices[backendRuntime],
          )

    const dbChoices: Record<BackendRuntime, Choice<Database>[]> = {
      node: [
        { value: 'postgres', label: DATABASE_LABELS.postgres, available: true, hint: 'Drizzle or Prisma' },
        { value: 'sqlite', label: DATABASE_LABELS.sqlite, available: true, hint: 'Zero setup — file-based (Drizzle)' },
        { value: 'mysql', label: DATABASE_LABELS.mysql, available: true, hint: 'Drizzle' },
        { value: 'mongodb', label: DATABASE_LABELS.mongodb, available: false },
      ],
      python: [
        { value: 'postgres', label: DATABASE_LABELS.postgres, available: true, hint: 'asyncpg + Alembic' },
        { value: 'sqlite', label: DATABASE_LABELS.sqlite, available: true, hint: 'Zero setup — file-based (aiosqlite)' },
        { value: 'mysql', label: DATABASE_LABELS.mysql, available: false },
        { value: 'mongodb', label: DATABASE_LABELS.mongodb, available: false },
      ],
      php: [
        { value: 'postgres', label: DATABASE_LABELS.postgres, available: true, hint: 'Eloquent' },
        { value: 'sqlite', label: DATABASE_LABELS.sqlite, available: true, hint: 'Zero setup — file-based (Eloquent)' },
        { value: 'mysql', label: DATABASE_LABELS.mysql, available: true, hint: 'Eloquent' },
        { value: 'mongodb', label: DATABASE_LABELS.mongodb, available: false },
      ],
    }

    database = flags.db
      ? parseEnumChoice('--db', flags.db, AVAILABLE.db[backendRuntime])
      : forced
        ? 'postgres'
        : ((await selectWithSoon<Database>('Select a database:', dbChoices[backendRuntime])) as 'postgres' | 'sqlite' | 'mysql')

    if (backendRuntime === 'node') {
      orm = flags.orm
        ? parseEnumChoice('--orm', flags.orm, AVAILABLE.orm.node)
        : forced
          ? 'drizzle'
          : await selectWithSoon<'drizzle' | 'prisma'>('Select an ORM:', [
              { value: 'drizzle', label: 'Drizzle', available: true, hint: 'SQL-like, lightweight' },
              { value: 'prisma', label: 'Prisma', available: database === 'postgres', hint: database === 'postgres' ? 'Schema-first, great DX' : 'PostgreSQL only for now' },
            ])
      p.log.info(
        `ORM: ${orm === 'drizzle' ? 'Drizzle' : 'Prisma'}`,
      )
    } else if (backendRuntime === 'python') {
      orm = null
      p.log.info('ORM: SQLAlchemy + Alembic migrations')
    } else {
      orm = null
      p.log.info('ORM: Eloquent (Laravel migrations)')
    }

    p.log.info(`Database: ${DATABASE_LABELS[database]}`)
  }

  // ── Extras ──────────────────────────────────────────────────────────────
  let extras: { tailwind: boolean; eslintPrettier: boolean }
  if (flags.extras) {
    extras = {
      tailwind: flags.extras.includes('tailwind'),
      eslintPrettier: flags.extras.includes('eslint'),
    }
  } else if (forced) {
    extras = { tailwind: true, eslintPrettier: true }
  } else {
    const picked = unwrapMany(
      await p.multiselect<'tailwind' | 'eslint'>({
        message: 'Pick extras:',
        required: false,
        initialValues: ['tailwind', 'eslint'],
        options: [
          { value: 'tailwind', label: 'Tailwind CSS', hint: 'Utility-first styling' },
          { value: 'eslint', label: 'ESLint + Prettier', hint: 'Linting + formatting' },
        ],
      }),
    )
    extras = { tailwind: picked.includes('tailwind'), eslintPrettier: picked.includes('eslint') }
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  const summary: string[] = [`App:        ${projectName}`]
  summary.push(`Stack:      ${FRONTEND_LABELS[frontend]} (web)`)
  if (fullStack) {
    const ormLabel =
      backendRuntime === 'node'
        ? `(${orm === 'drizzle' ? 'Drizzle' : 'Prisma'})`
        : backendRuntime === 'python'
          ? '(SQLAlchemy + Alembic)'
          : '(Eloquent)'
    summary.push(
      `Backend:    ${BACKEND_FRAMEWORK_LABELS[backendFramework]} + ${DATABASE_LABELS[database]} ${ormLabel}`,
    )
  } else {
    summary.push('Backend:    none (frontend only)')
  }
  summary.push(
    `Extras:     ${[
      extras.tailwind ? 'Tailwind CSS' : null,
      extras.eslintPrettier ? 'ESLint + Prettier' : null,
    ]
      .filter(Boolean)
      .join(', ') || 'none'}`,
  )
  summary.push(`Folder:     ${targetDir}`)
  summary.push(`Ports:      client ${CLIENT_PORT} · server ${SERVER_PORT}`)
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

  return {
    projectName,
    targetDir,
    projectType,
    frontend,
    language: 'typescript',
    fullStack,
    backendRuntime: fullStack ? backendRuntime : null,
    backendFramework: fullStack ? backendFramework : null,
    orm: fullStack ? orm : null,
    database: fullStack ? database : null,
    extras,
  }
}
