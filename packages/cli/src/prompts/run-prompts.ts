import * as p from '@clack/prompts'
import type { Option } from '@clack/prompts'
import { CancelledError, unwrap } from '../cancel.js'
import {
  BACKEND_FRAMEWORK_LABELS,
  BACKEND_RUNTIME_LABELS,
  FRONTEND_LABELS,
  PROJECT_TYPE_LABELS,
  type BackendFramework,
  type BackendRuntime,
  type Frontend,
  type ProjectType,
} from '../types.js'
import { checkRawProjectName, isNonEmptyDirectory, resolveTargetDir } from '../validators.js'
import { CLIENT_PORT, SERVER_PORT } from '../config.js'
import type { Answers } from '../types.js'

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

export async function runPrompts(argName?: string): Promise<Answers> {
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
    const proceed = unwrap(
      await p.confirm({
        message: `Directory "${projectName}" already exists and is not empty. Scaffold into it anyway?`,
        initialValue: false,
      }),
    )
    if (!proceed) throw new CancelledError('Nothing was created.')
  }

  // ── What for? ───────────────────────────────────────────────────────────
  const projectType = await selectWithSoon<ProjectType>('What are you building?', [
    { value: 'web', label: PROJECT_TYPE_LABELS.web, available: true, hint: 'v1 focus' },
    { value: 'mobile', label: PROJECT_TYPE_LABELS.mobile, available: false },
    { value: 'desktop', label: PROJECT_TYPE_LABELS.desktop, available: false },
  ])

  // ── Frontend ────────────────────────────────────────────────────────────
  const frontend = await selectWithSoon<Frontend>('Select a frontend framework:', [
    { value: 'react', label: FRONTEND_LABELS.react, available: true, hint: 'Vite + TypeScript' },
    { value: 'nextjs', label: FRONTEND_LABELS.nextjs, available: false },
    { value: 'vue', label: FRONTEND_LABELS.vue, available: false },
    { value: 'svelte', label: FRONTEND_LABELS.svelte, available: false },
  ])

  p.log.info('Language: TypeScript (JavaScript support is coming)')

  // ── Full stack? ─────────────────────────────────────────────────────────
  const fullStack = unwrap<boolean>(
    await p.confirm({
      message: 'Full-stack? Adds a backend API, database and ready-made boilerplate.',
      initialValue: true,
    }),
  )

  let backendRuntime: BackendRuntime = 'node'
  let backendFramework: BackendFramework = 'express'
  let orm: 'drizzle' | 'prisma' = 'drizzle'

  if (fullStack) {
    backendRuntime = await selectWithSoon<BackendRuntime>('Select a backend runtime:', [
      { value: 'node', label: BACKEND_RUNTIME_LABELS.node, available: true, hint: 'v1 focus' },
      { value: 'python', label: BACKEND_RUNTIME_LABELS.python, available: false },
      { value: 'php', label: BACKEND_RUNTIME_LABELS.php, available: false },
    ])

    backendFramework = await selectWithSoon<BackendFramework>('Select a backend framework:', [
      { value: 'express', label: BACKEND_FRAMEWORK_LABELS.express, available: true, hint: 'The classic, huge ecosystem' },
      { value: 'fastify', label: BACKEND_FRAMEWORK_LABELS.fastify, available: true, hint: 'Fast, schema-first' },
      { value: 'hono', label: BACKEND_FRAMEWORK_LABELS.hono, available: false },
      { value: 'nestjs', label: BACKEND_FRAMEWORK_LABELS.nestjs, available: false },
    ])

    orm = await selectWithSoon<'drizzle' | 'prisma'>('Select an ORM:', [
      { value: 'drizzle', label: 'Drizzle', available: true, hint: 'SQL-like, lightweight' },
      { value: 'prisma', label: 'Prisma', available: true, hint: 'Schema-first, great DX' },
    ])

    p.log.info('Database: PostgreSQL (MySQL, SQLite and MongoDB are coming)')
  }

  // ── Extras ──────────────────────────────────────────────────────────────
  type Extra = 'tailwind' | 'eslintPrettier'
  const extras = unwrap<Extra[]>(
    await p.multiselect<Extra>({
      message: 'Pick extras:',
      required: false,
      initialValues: ['tailwind', 'eslintPrettier'],
      options: [
        { value: 'tailwind', label: 'Tailwind CSS', hint: 'Utility-first styling' },
        { value: 'eslintPrettier', label: 'ESLint + Prettier', hint: 'Linting + formatting' },
      ],
    }),
  )

  // ── Summary ─────────────────────────────────────────────────────────────
  const summary: string[] = [`App:        ${projectName}`]
  summary.push(`Stack:      ${FRONTEND_LABELS[frontend]} (web)`)
  if (fullStack) {
    summary.push(`Backend:    ${BACKEND_FRAMEWORK_LABELS[backendFramework]} + PostgreSQL (${orm === 'drizzle' ? 'Drizzle' : 'Prisma'})`)
  } else {
    summary.push('Backend:    none (frontend only)')
  }
  summary.push(
    `Extras:     ${[
      extras.includes('tailwind') ? 'Tailwind CSS' : null,
      extras.includes('eslintPrettier') ? 'ESLint + Prettier' : null,
    ]
      .filter(Boolean)
      .join(', ') || 'none'}`,
  )
  summary.push(`Folder:     ${targetDir}`)
  summary.push(`Ports:      client ${CLIENT_PORT} · server ${SERVER_PORT}`)
  p.note(summary.join('\n'), 'Here is what will be generated')

  const ready = unwrap<boolean>(
    await p.confirm({
      message: 'Craft it?',
      initialValue: true,
    }),
  )
  if (!ready) throw new CancelledError('Nothing was created.')

  return {
    projectName,
    targetDir,
    projectType,
    frontend,
    language: 'typescript',
    fullStack,
    backendRuntime,
    backendFramework,
    orm,
    database: fullStack ? 'postgres' : null,
    extras: {
      tailwind: extras.includes('tailwind'),
      eslintPrettier: extras.includes('eslintPrettier'),
    },
  }
}
