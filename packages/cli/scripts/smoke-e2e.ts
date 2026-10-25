/**
 * Scaffolds every supported stack combination into a target directory
 * without prompts — used to smoke-test the engine and generated projects.
 *
 *   npx tsx scripts/smoke-e2e.ts <output-dir>
 */
import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { createEnvFiles } from '../src/scaffold/env.js'
import { applyLayers } from '../src/scaffold/engine.js'
import { composeLayers, templateVariables } from '../src/scaffold/compose.js'
import { TEMPLATES_ROOT } from '../src/config.js'
import type { Answers } from '../src/types.js'

const outRoot = resolve(process.argv[2] ?? 'smoke-out')
const combos = [
  { framework: 'express', orm: 'drizzle' },
  { framework: 'express', orm: 'prisma' },
  { framework: 'fastify', orm: 'drizzle' },
  { framework: 'fastify', orm: 'prisma' },
] as const

for (const { framework, orm } of combos) {
  const answers: Answers = {
    projectName: `smoke-${framework}-${orm}`,
    targetDir: '.',
    projectType: 'web',
    frontend: 'react',
    language: 'typescript',
    fullStack: true,
    backendRuntime: 'node',
    backendFramework: framework,
    orm,
    database: 'postgres',
    extras: { tailwind: true, eslintPrettier: true },
  }
  const dir = resolve(outRoot, answers.projectName)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  applyLayers(TEMPLATES_ROOT, composeLayers(answers), templateVariables(answers), dir)
  createEnvFiles(dir)
  console.log(`scaffolded ${dir}`)
}

// Also one frontend-only project
{
  const answers: Answers = {
    projectName: 'smoke-frontend-only',
    targetDir: '.',
    projectType: 'web',
    frontend: 'react',
    language: 'typescript',
    fullStack: false,
    backendRuntime: null,
    backendFramework: null,
    orm: null,
    database: null,
    extras: { tailwind: true, eslintPrettier: true },
  }
  const dir = resolve(outRoot, answers.projectName)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  applyLayers(TEMPLATES_ROOT, composeLayers(answers), templateVariables(answers), dir)
  createEnvFiles(dir)
  console.log(`scaffolded ${dir}`)
}
