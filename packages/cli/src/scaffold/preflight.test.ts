import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { applyLayers } from './engine.js'
import { assertNoLayerTypeConflicts, planLayerOutputPaths } from './preflight.js'
import type { Layer } from './engine.js'

const fixtures: string[] = []

function makeFixture(): { root: string; templatesRoot: string; targetDir: string } {
  const root = mkdtempSync(join(tmpdir(), 'omnicraft-preflight-'))
  fixtures.push(root)
  const templatesRoot = join(root, 'templates')
  const targetDir = join(root, 'target')
  mkdirSync(templatesRoot)
  mkdirSync(targetDir)
  return { root, templatesRoot, targetDir }
}

function writeTemplateFile(templatesRoot: string, relativePath: string, content = 'fixture'): void {
  const path = join(templatesRoot, relativePath)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('selected layer output planning', () => {
  it('restores dotfiles, skips protected files, and maps special merge destinations', () => {
    const { templatesRoot, targetDir } = makeFixture()
    writeTemplateFile(templatesRoot, 'layer/_gitignore')
    writeTemplateFile(templatesRoot, 'layer/.env')
    writeTemplateFile(templatesRoot, 'layer/package.json', '{"dependencies":{"fixture":"1"}}')
    writeTemplateFile(templatesRoot, 'layer/.vscode/extensions.json', '{"recommendations":[]}')
    writeFileSync(join(targetDir, 'package.json'), '{"name":"existing"}')

    const layer: Layer = { src: 'layer', dest: 'server/db', mergeManifestAtRoot: true }
    expect(planLayerOutputPaths(templatesRoot, [layer], targetDir)).toEqual([
      '.vscode/extensions.json',
      'package.json',
      'server/db/.gitignore',
    ])
    expect(() => assertNoLayerTypeConflicts(templatesRoot, [layer], targetDir)).not.toThrow()

    rmSync(join(targetDir, 'package.json'))
    expect(planLayerOutputPaths(templatesRoot, [layer], targetDir)).toContain('server/db/package.json')
  })

  it('detects a directory at a generated file path', () => {
    const { templatesRoot, targetDir } = makeFixture()
    writeTemplateFile(templatesRoot, 'layer/package.json')
    mkdirSync(join(targetDir, 'package.json'))

    expect(() =>
      assertNoLayerTypeConflicts(templatesRoot, [{ src: 'layer', dest: '.' }], targetDir),
    ).toThrow(/package\.json is an existing directory.*Remove or rename/s)
  })

  it('detects a file blocking a required parent and permits normal directory ancestors', () => {
    const { templatesRoot, targetDir } = makeFixture()
    writeTemplateFile(templatesRoot, 'layer/src/routes/index.ts')
    writeFileSync(join(targetDir, 'src'), 'blocking file')

    expect(() =>
      assertNoLayerTypeConflicts(templatesRoot, [{ src: 'layer', dest: '.' }], targetDir),
    ).toThrow(/src is an existing file.*directory is required/s)

    rmSync(join(targetDir, 'src'))
    mkdirSync(join(targetDir, 'src'))
    expect(() => applyLayers(templatesRoot, [{ src: 'layer', dest: '.' }], {}, targetDir)).not.toThrow()
    expect(readFileSync(join(targetDir, 'src', 'routes', 'index.ts'), 'utf8')).toBe('fixture')
  })

  it('checks the root extensions merge destination when a layer stores its fragment elsewhere', () => {
    const { templatesRoot, targetDir } = makeFixture()
    writeTemplateFile(templatesRoot, 'layer/.vscode/extensions.json')
    writeFileSync(join(targetDir, '.vscode'), 'blocking file')

    const layer: Layer = { src: 'layer', dest: 'client' }
    expect(planLayerOutputPaths(templatesRoot, [layer], targetDir)).toEqual(['.vscode/extensions.json'])
    expect(() => assertNoLayerTypeConflicts(templatesRoot, [layer], targetDir)).toThrow(
      /\.vscode is an existing file.*directory is required/s,
    )
  })

  it('tracks a root manifest created by an earlier selected layer for later special merges', () => {
    const { templatesRoot, targetDir } = makeFixture()
    writeTemplateFile(templatesRoot, 'root/package.json', '{"name":"fixture"}')
    writeTemplateFile(templatesRoot, 'db/package.json', '{"dependencies":{"db":"1"}}')
    mkdirSync(join(targetDir, 'app', 'db', 'package.json'), { recursive: true })

    const layers: Layer[] = [
      { src: 'root', dest: '.' },
      { src: 'db', dest: 'app/db', mergeManifestAtRoot: true },
    ]
    expect(planLayerOutputPaths(templatesRoot, layers, targetDir)).toEqual(['package.json'])
    expect(() => applyLayers(templatesRoot, layers, {}, targetDir)).not.toThrow()
    expect(JSON.parse(readFileSync(join(targetDir, 'package.json'), 'utf8'))).toMatchObject({
      dependencies: { db: '1' },
      name: 'fixture',
    })
  })

  it('preserves protected-only layers as no-ops when there are no output paths', () => {
    const { root, templatesRoot } = makeFixture()
    writeTemplateFile(templatesRoot, 'layer/.env', 'user secret')
    const targetFile = join(root, 'target-file')
    writeFileSync(targetFile, 'existing target')

    expect(planLayerOutputPaths(templatesRoot, [{ src: 'layer', dest: '.' }], targetFile)).toEqual([])
    expect(() =>
      applyLayers(templatesRoot, [{ src: 'layer', dest: '.' }], {}, targetFile),
    ).not.toThrow()
    expect(readFileSync(targetFile, 'utf8')).toBe('existing target')
  })
})
