import { beforeEach, describe, expect, it, vi } from 'vitest'

const script: Array<{ prompt: 'text' | 'select' | 'confirm' | 'multiselect'; answer: unknown }> = []
const calls: string[] = []

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
    select: vi.fn(() => takeAnswer('select')),
    confirm: vi.fn(() => takeAnswer('confirm')),
    multiselect: vi.fn(() => takeAnswer('multiselect')),
  }
})

const { runPrompts } = await import('./run-prompts.js')

beforeEach(() => {
  script.length = 0
  calls.length = 0
  vi.clearAllMocks()
})

describe('runPrompts flow', () => {
  it('walks the full-stack path and collects every answer', async () => {
    script.push(
      { prompt: 'text', answer: 'My Cool App!' },
      { prompt: 'select', answer: 'web' },
      { prompt: 'select', answer: 'react' },
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

  it('takes the frontend-only shortcut when full-stack is declined', async () => {
    script.push(
      { prompt: 'text', answer: 'front-only' },
      { prompt: 'select', answer: 'web' },
      { prompt: 'select', answer: 'react' },
      { prompt: 'confirm', answer: false },
      { prompt: 'multiselect', answer: [] },
      { prompt: 'confirm', answer: true },
    )

    const answers = await runPrompts()
    expect(answers.fullStack).toBe(false)
    expect(answers.backendFramework).toBeNull() // no backend on frontend-only
    expect(answers.database).toBeNull()
    expect(calls.filter((c) => c === 'select')).toHaveLength(2) // no runtime/framework/orm prompts
  })

  it('re-prompts when a roadmap option is picked', async () => {
    script.push(
      { prompt: 'text', answer: 'app' },
      { prompt: 'select', answer: 'mobile' }, // roadmap -> warned, re-prompt
      { prompt: 'select', answer: 'web' },
      { prompt: 'select', answer: 'react' },
      { prompt: 'confirm', answer: true },
      { prompt: 'select', answer: 'node' },
      { prompt: 'select', answer: 'express' },
      { prompt: 'select', answer: 'postgres' },
      { prompt: 'select', answer: 'drizzle' },
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
      { prompt: 'confirm', answer: true },
      { prompt: 'select', answer: 'node' },
      { prompt: 'select', answer: 'express' },
      { prompt: 'select', answer: 'postgres' },
      { prompt: 'select', answer: 'drizzle' },
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
      { prompt: 'confirm', answer: false },
      { prompt: 'multiselect', answer: [] },
      { prompt: 'confirm', answer: true },
    )

    const answers = await runPrompts()
    expect(answers.projectName).toBe('valid-app')
  })
})
