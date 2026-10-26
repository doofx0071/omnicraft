import { describe, expect, it } from 'vitest'
import { UnresolvedTokenError, assertNoUnresolvedTokens, isBinaryFile, renderString, restoreDotfileName } from './scaffold/renderer.js'

describe('renderString', () => {
  const vars = { projectName: 'my-app', serverPort: '3000' }

  it('replaces known tokens', () => {
    expect(renderString('name": "{{projectName}}"', vars)).toBe('name": "my-app"')
    expect(renderString('port {{ serverPort }}', vars)).toBe('port 3000')
  })

  it('leaves unknown tokens untouched', () => {
    expect(renderString('keep {{unknownToken}}', vars)).toBe('keep {{unknownToken}}')
  })

  it('handles templates without tokens', () => {
    expect(renderString('nothing here', vars)).toBe('nothing here')
  })
})

describe('restoreDotfileName', () => {
  it('restores npm-publishable dotfiles', () => {
    expect(restoreDotfileName('_gitignore')).toBe('.gitignore')
    expect(restoreDotfileName('_prettierignore')).toBe('.prettierignore')
  })

  it('leaves normal names alone', () => {
    expect(restoreDotfileName('package.json')).toBe('package.json')
    expect(restoreDotfileName('.env.example')).toBe('.env.example')
  })
})

describe('assertNoUnresolvedTokens', () => {
  it('passes when every token resolved', () => {
    expect(() => assertNoUnresolvedTokens('name: my-app', 'package.json')).not.toThrow()
  })

  it('throws with file and token names on leftovers', () => {
    try {
      assertNoUnresolvedTokens('title: {{projectNam}} rest {{unknownTok}}', 'src/file.ts')
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(UnresolvedTokenError)
      expect((err as UnresolvedTokenError).tokens).toEqual(['projectNam', 'unknownTok'])
      expect((err as UnresolvedTokenError).file).toBe('src/file.ts')
    }
  })

  it('allows whitelisted tokens', () => {
    expect(() => assertNoUnresolvedTokens('keep {{dbConfig}}', 'x', ['dbConfig'])).not.toThrow()
  })
})
describe('isBinaryFile', () => {
  it('detects common binary extensions', () => {
    expect(isBinaryFile('logo.png')).toBe(true)
    expect(isBinaryFile('FONT.TTF')).toBe(true)
  })

  it('treats code and config files as text', () => {
    expect(isBinaryFile('package.json')).toBe(false)
    expect(isBinaryFile('App.tsx')).toBe(false)
    expect(isBinaryFile('README')).toBe(false)
  })
})
