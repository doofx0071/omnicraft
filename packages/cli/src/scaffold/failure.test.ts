import { describe, expect, it } from 'vitest'
import { formatScaffoldFailure } from './failure.js'

describe('formatScaffoldFailure', () => {
  it('names the target and tells users to inspect a partial scaffold before retrying', () => {
    expect(formatScaffoldFailure(new Error('Composer failed'), 'C:/apps/demo')).toContain(
      'Partial scaffold may remain at "C:/apps/demo". Inspect it and remove incomplete files before retrying.',
    )
  })
})
