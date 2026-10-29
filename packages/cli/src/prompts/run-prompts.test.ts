import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseArgs } from '../args.js'
import { resolveAnswers } from '../prefill.js'

const script: Array<{ prompt: 'text' | 'select' | 'confirm' | 'multiselect'; answer: unknown }> = []
const calls: string[] = []
const optionsSeen: Array<{ prompt: 'select' | 'multiselect'; options: Array<{ value: string }> }> = []

vi.mock('@clack/prompts', () => {
  const takeAnswer = (prompt: string): unknown => {
    calls.push(prompt)
    const next = script.shift()
    if (!next || next.prompt !== prompt) {
      throw new Error(`Unexpected ${prompt} call; script expected ${next?.prompt ?? 'nothing'}`)
    }
    return next.answer
  }
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), step: vi.fn(), message: vi.fn() }
  return {
    isCancel: (value: unknown) => typeof value === 'symbol',
    intro: vi.fn(),
    outro: vi.fn(),
    note: vi.fn(),
    log,
    text: vi.fn(() => takeAnswer('text')),
    select: vi.fn((config: { options: Array<{ value: string }> }) => {
      optionsSeen.push({ prompt: 'select', options: config.options })
      return takeAnswer('select')
    }),
    confirm: vi.fn(() => takeAnswer('confirm')),
    multiselect: vi.fn((config: { options: Array<{ value: string }> }) => {
      optionsSeen.push({ prompt: 'multiselect', options: config.options })
      return takeAnswer('multiselect')
    }),
  }
})

const { runPrompts } = await import('./run-prompts.js')

beforeEach(() => {
  script.length = 0
  calls.length = 0
  optionsSeen.length = 0
  vi.clearAllMocks()
})

describe('runPrompts flow', () => {
  it('walks the full-stack path and collects every answer', async () => {
    script.push(
      { prompt: 'text', answer: 'My Cool App!' },
      { prompt: 'select', answer: 'web' },
      { prompt: 'select', answer: 'react' },
      { prompt: 'select', answer: 'typescript' },
      { prompt: 'confirm', answer: true },
      { prompt: 'select', answer: 'node' },
      { prompt: 'select', answer: 'fastify' },
      { prompt: 'select', answer: 'postgres' },
      { prompt: 'select', answer: 'prisma' },
      { prompt: 'multiselect', answer: ['tailwind'] },
      { prompt: 'confirm', answer: true },
    )

    const answers = await runPrompts()

    expect(calls).toEqual([
      'text', // app name
      'select', // what are you building
      'select', // frontend
      'select', // language
      'confirm', // full-stack?
      'select', // runtime
      'select', // framework
      'select', // database
      'select', // orm
      'multiselect', // extras
      'confirm', // craft it?
    ])
    expect(answers.projectName).toBe('my-cool-app')
    expect(answers.fullStack).toBe(true)
    expect(answers.backendFramework).toBe('fastify')
    expect(answers.orm).toBe('prisma')
    expect(answers.database).toBe('postgres')
    expect(answers.language).toBe('typescript')
    expect(answers.extras).toEqual({ tailwind: true, eslintPrettier: false, shadcn: false })
  })

  it('offers only None and Better Auth for the supported Express + Drizzle stack', async () => {
    script.push(
      { prompt: 'text', answer: 'auth-app' },
      { prompt: 'select', answer: 'web' },
      { prompt: 'select', answer: 'react' },
      { prompt: 'select', answer: 'typescript' },
      { prompt: 'confirm', answer: true },
      { prompt: 'select', answer: 'node' },
      { prompt: 'select', answer: 'express' },
      { prompt: 'select', answer: 'postgres' },
      { prompt: 'select', answer: 'drizzle' },
      { prompt: 'select', answer: 'better-auth' },
      { prompt: 'multiselect', answer: [] },
      { prompt: 'confirm', answer: true },
    )

    const answers = await runPrompts()

    expect(answers.authentication).toBe('better-auth')
    expect(calls).toContain('select')
    const authOptions = optionsSeen.find((entry) =>
      entry.options.some((option) => option.value === 'better-auth'),
    )
    expect(authOptions?.options.map((option) => option.value)).toEqual(['none', 'better-auth'])
  })

  it('omits Better Auth for the selectable JavaScript client path', async () => {
    script.push(
      { prompt: 'text', answer: 'js-auth-app' },
      { prompt: 'select', answer: 'web' },
      { prompt: 'select', answer: 'react' },
      { prompt: 'select', answer: 'javascript' },
      { prompt: 'confirm', answer: true },
      { prompt: 'select', answer: 'node' },
      { prompt: 'select', answer: 'express' },
      { prompt: 'select', answer: 'postgres' },
      { prompt: 'select', answer: 'drizzle' },
      { prompt: 'multiselect', answer: [] },
      { prompt: 'confirm', answer: true },
    )

    const answers = await runPrompts()

    expect(answers.authentication).toBe('none')
    expect(
      optionsSeen.some((entry) => entry.options.some((option) => option.value === 'better-auth')),
    ).toBe(false)
  })

  it('keeps explicit Better Auth prompts aligned with the non-interactive defaults', async () => {
    script.push(
      { prompt: 'select', answer: 'web' },
      { prompt: 'select', answer: 'react' },
      { prompt: 'select', answer: 'typescript' },
      { prompt: 'select', answer: 'node' },
      { prompt: 'select', answer: 'express' },
      { prompt: 'select', answer: 'postgres' },
      { prompt: 'select', answer: 'drizzle' },
      { prompt: 'multiselect', answer: ['tailwind', 'eslint'] },
      { prompt: 'confirm', answer: true },
    )

    const args = parseArgs(['--auth', 'better-auth'])
    const interactive = await runPrompts('auth-app', args)
    const nonInteractive = resolveAnswers(
      parseArgs(['--yes', '--auth', 'better-auth']),
      'auth-app',
      interactive.targetDir,
    )

    expect(interactive).toMatchObject({
      frontend: nonInteractive.frontend,
      language: nonInteractive.language,
      fullStack: nonInteractive.fullStack,
      backendRuntime: nonInteractive.backendRuntime,
      backendFramework: nonInteractive.backendFramework,
      orm: nonInteractive.orm,
      database: nonInteractive.database,
      authentication: nonInteractive.authentication,
      extras: nonInteractive.extras,
    })
    const languageOptions = optionsSeen.find((entry) =>
      entry.options.some((option) => option.value === 'typescript'),
    )
    expect(languageOptions?.options.map((option) => option.value)).toEqual(['typescript'])
  })

  it('keeps an interactive None selection aligned with --yes --auth none', async () => {
    script.push(
      { prompt: 'text', answer: 'auth-app' },
      { prompt: 'select', answer: 'web' },
      { prompt: 'select', answer: 'react' },
      { prompt: 'select', answer: 'typescript' },
      { prompt: 'confirm', answer: true },
      { prompt: 'select', answer: 'node' },
      { prompt: 'select', answer: 'express' },
      { prompt: 'select', answer: 'postgres' },
      { prompt: 'select', answer: 'drizzle' },
      { prompt: 'select', answer: 'none' },
      { prompt: 'multiselect', answer: ['tailwind', 'eslint'] },
      { prompt: 'confirm', answer: true },
    )

    const interactive = await runPrompts()
    const nonInteractive = resolveAnswers(
      parseArgs(['--yes', '--auth', 'none']),
      interactive.projectName,
      interactive.targetDir,
    )

    expect(interactive).toMatchObject({
      frontend: nonInteractive.frontend,
      language: nonInteractive.language,
      fullStack: nonInteractive.fullStack,
      backendRuntime: nonInteractive.backendRuntime,
      backendFramework: nonInteractive.backendFramework,
      orm: nonInteractive.orm,
      database: nonInteractive.database,
      authentication: 'none',
      extras: nonInteractive.extras,
      architecture: nonInteractive.architecture,
    })
  })

  it('takes the frontend-only shortcut when full-stack is declined', async () => {
    script.push(
      { prompt: 'text', answer: 'front-only' },
      { prompt: 'select', answer: 'web' },
      { prompt: 'select', answer: 'react' },
      { prompt: 'select', answer: 'typescript' },
      { prompt: 'confirm', answer: false },
      { prompt: 'multiselect', answer: [] },
      { prompt: 'confirm', answer: true },
    )

    const answers = await runPrompts()
    expect(answers.fullStack).toBe(false)
    expect(answers.backendFramework).toBeNull() // no backend on frontend-only
    expect(answers.database).toBeNull()
    expect(calls.filter((c) => c === 'select')).toHaveLength(3) // no runtime/framework/orm prompts
  })

  it('omits Prisma from the ORM choices for Hono', async () => {
    script.push(
      { prompt: 'text', answer: 'hono-app' },
      { prompt: 'select', answer: 'web' },
      { prompt: 'select', answer: 'react' },
      { prompt: 'select', answer: 'typescript' },
      { prompt: 'confirm', answer: true },
      { prompt: 'select', answer: 'node' },
      { prompt: 'select', answer: 'hono' },
      { prompt: 'select', answer: 'postgres' },
      { prompt: 'select', answer: 'drizzle' },
      { prompt: 'multiselect', answer: [] },
      { prompt: 'confirm', answer: true },
    )

    await runPrompts()
    const ormOptions = optionsSeen.find((entry) => entry.options.some((option) => option.value === 'drizzle'))
    expect(ormOptions?.options.map((option) => option.value)).toEqual(['drizzle', 'none'])
  })

  it('uses raw SQL for Next.js and does not ask for an ORM', async () => {
    script.push(
      { prompt: 'text', answer: 'next-app' },
      { prompt: 'select', answer: 'web' },
      { prompt: 'select', answer: 'typescript' },
      { prompt: 'select', answer: 'postgres' },
      { prompt: 'confirm', answer: true },
    )

    const answers = await runPrompts(undefined, parseArgs(['--frontend', 'nextjs']))
    expect(answers.orm).toBe('none')
    expect(answers.backendRuntime).toBeNull()
    expect(answers.backendFramework).toBeNull()
    expect(answers.extras).toEqual({ tailwind: true, eslintPrettier: true, shadcn: false })
    expect(calls.filter((call) => call === 'confirm')).toHaveLength(1)
    expect(calls).not.toContain('multiselect')
    expect(optionsSeen[1]?.options.map((option) => option.value)).toEqual(['typescript'])
  })

  it('omits Next.js when explicit extras conflict with generator defaults', async () => {
    script.push(
      { prompt: 'select', answer: 'web' },
      { prompt: 'select', answer: 'react' },
      { prompt: 'select', answer: 'typescript' },
      { prompt: 'confirm', answer: false },
      { prompt: 'confirm', answer: true },
    )

    await runPrompts('extras-app', parseArgs(['--extras', 'none']))
    expect(optionsSeen[1]?.options.map((option) => option.value)).not.toContain('nextjs')
  })

  it('keeps backend flags in the full-stack prompt path', async () => {
    script.push(
      { prompt: 'select', answer: 'web' },
      { prompt: 'select', answer: 'react' },
      { prompt: 'select', answer: 'typescript' },
      { prompt: 'select', answer: 'node' },
      { prompt: 'select', answer: 'postgres' },
      { prompt: 'select', answer: 'drizzle' },
      { prompt: 'multiselect', answer: [] },
      { prompt: 'confirm', answer: true },
    )

    const answers = await runPrompts('hono-app', parseArgs(['--backend', 'hono']))
    expect(answers.fullStack).toBe(true)
    expect(answers.backendFramework).toBe('hono')
    expect(calls.filter((call) => call === 'confirm')).toHaveLength(1)
    expect(optionsSeen[1]?.options.map((option) => option.value)).not.toContain('nextjs')
  })

  it('restricts JavaScript to the web React/Vite choices', async () => {
    script.push(
      { prompt: 'select', answer: 'web' },
      { prompt: 'select', answer: 'react' },
      { prompt: 'confirm', answer: false },
      { prompt: 'multiselect', answer: [] },
      { prompt: 'confirm', answer: true },
    )

    const answers = await runPrompts('js-app', parseArgs(['--lang', 'javascript']))
    expect(answers.language).toBe('javascript')
    expect(optionsSeen[0]?.options.map((option) => option.value)).toEqual(['web'])
    expect(optionsSeen[1]?.options.map((option) => option.value)).toEqual(['react'])
  })

  it('omits shadcn from the extras for Vue', async () => {
    script.push(
      { prompt: 'select', answer: 'web' },
      { prompt: 'select', answer: 'typescript' },
      { prompt: 'confirm', answer: false },
      { prompt: 'multiselect', answer: [] },
      { prompt: 'confirm', answer: true },
    )

    await runPrompts('vue-app', parseArgs(['--frontend', 'vue']))
    const extras = optionsSeen.find((entry) => entry.prompt === 'multiselect')
    expect(extras?.options.map((option) => option.value)).toEqual(['tailwind', 'eslint'])
  })

  it('restricts an explicit shadcn choice to the React frontend', async () => {
    script.push(
      { prompt: 'select', answer: 'web' },
      { prompt: 'select', answer: 'react' },
      { prompt: 'select', answer: 'typescript' },
      { prompt: 'confirm', answer: false },
      { prompt: 'confirm', answer: true },
    )

    const answers = await runPrompts('shadcn-app', parseArgs(['--extras', 'shadcn']))
    expect(answers.extras).toEqual({ tailwind: true, eslintPrettier: false, shadcn: true })
    expect(optionsSeen[1]?.options.map((option) => option.value)).toEqual(['react'])
  })

  it('re-prompts when a roadmap option is picked', async () => {
    script.push(
      { prompt: 'text', answer: 'app' },
      { prompt: 'select', answer: 'web' },
      { prompt: 'select', answer: 'react' },
      { prompt: 'select', answer: 'typescript' },
      { prompt: 'confirm', answer: true },
      { prompt: 'select', answer: 'node' },
      { prompt: 'select', answer: 'express' },
      { prompt: 'select', answer: 'mongodb' }, // db roadmap -> warned, re-prompt
      { prompt: 'select', answer: 'postgres' },
      { prompt: 'select', answer: 'drizzle' },
      { prompt: 'select', answer: 'none' },
      { prompt: 'multiselect', answer: ['tailwind', 'eslint'] },
      { prompt: 'confirm', answer: true },
    )

    const answers = await runPrompts()
    expect(answers.projectType).toBe('web')
    const { log } = await import('@clack/prompts')
    expect(vi.mocked(log.warn)).toHaveBeenCalledOnce()
  })

  it('throws CancelledError when the user declines the final confirm', async () => {
    script.push(
      { prompt: 'text', answer: 'app' },
      { prompt: 'select', answer: 'web' },
      { prompt: 'select', answer: 'react' },
      { prompt: 'select', answer: 'typescript' },
      { prompt: 'confirm', answer: true },
      { prompt: 'select', answer: 'node' },
      { prompt: 'select', answer: 'express' },
      { prompt: 'select', answer: 'postgres' },
      { prompt: 'select', answer: 'drizzle' },
      { prompt: 'select', answer: 'none' },
      { prompt: 'multiselect', answer: [] },
      { prompt: 'confirm', answer: false },
    )

    await expect(runPrompts()).rejects.toThrow('Nothing was created')
  })

  it('rejects names that slugify to nothing', async () => {
    script.push(
      { prompt: 'text', answer: '!!!' },
      { prompt: 'text', answer: 'valid-app' },
      { prompt: 'select', answer: 'web' },
      { prompt: 'select', answer: 'react' },
      { prompt: 'select', answer: 'typescript' },
      { prompt: 'confirm', answer: false },
      { prompt: 'multiselect', answer: [] },
      { prompt: 'confirm', answer: true },
    )

    const answers = await runPrompts()
    expect(answers.projectName).toBe('valid-app')
  })
})
