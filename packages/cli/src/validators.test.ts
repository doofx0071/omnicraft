import { describe, expect, it } from 'vitest'
import { checkProjectName, checkRawProjectName, slugify } from './validators.js'

describe('slugify', () => {
  it('lowercases and hyphenates free-text names', () => {
    expect(slugify('My Awesome App')).toBe('my-awesome-app')
    expect(slugify('  Omni_Craft 2026! ')).toBe('omni-craft-2026')
  })

  it('collapses duplicate dashes and trims edges', () => {
    expect(slugify('--weird---name--')).toBe('weird-name')
  })

  it('returns empty string for symbol-only input', () => {
    expect(slugify('!!!')).toBe('')
  })
})

describe('checkProjectName', () => {
  it('accepts normal names', () => {
    expect(checkProjectName('my-app').ok).toBe(true)
    expect(checkProjectName('omnicraft-demo2').ok).toBe(true)
  })

  it('rejects empty and invalid npm names', () => {
    expect(checkProjectName('').ok).toBe(false)
    expect(checkProjectName('.hidden').ok).toBe(false)
    expect(checkProjectName('node_modules').ok).toBe(false)
    expect(checkProjectName('-lead-dash').ok).toBe(false)
  })
})

describe('checkRawProjectName', () => {
  it('slugifies before validating and returns the slug', () => {
    const result = checkRawProjectName('My App!')
    expect(result.slug).toBe('my-app')
    expect(result.ok).toBe(true)
  })

  it('fails when nothing remains after slugifying', () => {
    expect(checkRawProjectName('###').ok).toBe(false)
  })
})
