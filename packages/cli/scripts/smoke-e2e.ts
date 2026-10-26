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
  { framework: 'express', orm: 'drizzle', db: 'postgres' },
  { framework: 'express', orm: 'prisma', db: 'postgres' },
  { framework: 'express', orm: 'drizzle', db: 'sqlite' },
  { framework: 'express', orm: 'drizzle', db: 'mysql' },
  { framework: 'fastify', orm: 'drizzle', db: 'sqlite' },
  { framework: 'fastify', orm: 'prisma', db: 'postgres' },
  { framework: 'hono', orm: 'drizzle', db: 'postgres' },
  { framework: 'hono', orm: 'drizzle', db: 'sqlite' },
  { framework: 'fastapi', orm: null, db: 'postgres' },
  { framework: 'fastapi', orm: null, db: 'sqlite' },
  { framework: 'laravel', orm: null, db: 'sqlite' },
] as const

function scaffold(answers: Answers): string {
  const dir = resolve(outRoot, answers.projectName)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  applyLayers(TEMPLATES_ROOT, composeLayers(answers), templateVariables(answers), dir)
  createEnvFiles(dir)
  console.log(`scaffolded ${dir}`)
  return dir
}

for (const { framework, orm, db } of combos) {
  scaffold({
    projectName: `smoke-${framework}-${orm ?? 'none'}-${db}`,
    targetDir: '.',
    projectType: 'web',
    frontend: 'react',
    language: 'typescript',
    fullStack: true,
    backendRuntime: framework === 'fastapi' ? 'python' : framework === 'laravel' ? 'php' : 'node',
    backendFramework: framework,
    orm,
    database: db,
    extras: { tailwind: true, eslintPrettier: true },
  })
}

// Also one frontend-only project
scaffold({
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
})
