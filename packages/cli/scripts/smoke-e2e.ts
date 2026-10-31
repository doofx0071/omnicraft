/**
 * Scaffolds selected stack combinations into a target directory without
 * prompts — used to smoke-test template composition, not the full catalog.
 *
 *   npx tsx scripts/smoke-e2e.ts <output-dir>
 */
import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { createEnvFiles } from '../src/scaffold/env.js'
import { applyLayers } from '../src/scaffold/engine.js'
import { composeLayers, templateVariables } from '../src/scaffold/compose.js'
import { TEMPLATES_ROOT, CLI_VERSION } from '../src/config.js'
import { buildManifest } from '../src/manifest.js'
import { saveManifest } from '../src/add.js'
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
  { framework: 'express', orm: 'none', db: 'sqlite' },
  { framework: 'express', orm: 'none', db: 'postgres' },
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
  saveManifest(dir, buildManifest(answers, CLI_VERSION, 'npm'))
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
    authentication: 'none',
    extras: { tailwind: true, eslintPrettier: true, shadcn: false },
    architecture: { kind: 'separate-frontend-api' },
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
  authentication: 'none',
  extras: { tailwind: true, eslintPrettier: true, shadcn: false },
  architecture: { kind: 'frontend-only' },
})

// Frontend variants (full-stack separate-API, sqlite = zero-docker verification)
for (const fe of ['vue', 'svelte'] as const) {
  scaffold({
    projectName: `smoke-${fe}-fullstack`,
    targetDir: '.',
    projectType: 'web',
    frontend: fe,
    language: 'typescript',
    fullStack: true,
    backendRuntime: 'node',
    backendFramework: 'express',
    orm: 'drizzle',
    database: 'sqlite',
    authentication: 'none',
    extras: { tailwind: true, eslintPrettier: true, shadcn: false },
    architecture: { kind: 'separate-frontend-api' },
  })
}

// Next.js integrated full-stack: NOTE this only scaffolds the overlay + db
// adapter onto a target dir. A complete project needs `create-next-app` run
// first (the CLI does this; see src/index.ts). For smoke purposes we run CNA
// when network+node are available, else record the overlay-only output.
{
  const name = 'smoke-nextjs-fullstack'
  const dir = resolve(outRoot, name)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  console.log(`running create-next-app for ${name}...`)
  const { spawnSync } = await import('node:child_process')
  const cna = spawnSync(
    ['npx', '--yes', 'create-next-app@16', name, '--ts', '--app', '--tailwind', '--no-src-dir', '--eslint', '--import-alias', '@/*', '--use-npm', '--skip-install', '--yes'].join(' '),
    { cwd: outRoot, stdio: 'inherit', shell: process.platform === 'win32' },
  )
  if (cna.status !== 0) {
    console.error(`create-next-app failed for ${name} — skipping overlay (run manually to verify)`)
  } else {
    const answers: Answers = {
      projectName: name,
      targetDir: dir,
      projectType: 'web',
      frontend: 'nextjs',
      language: 'typescript',
      fullStack: true,
      backendRuntime: null,
      backendFramework: null,
      orm: 'none',
      database: 'sqlite',
      authentication: 'none',
      extras: { tailwind: true, eslintPrettier: true, shadcn: false },
      architecture: { kind: 'integrated-fullstack', framework: 'nextjs' },
    }
    applyLayers(TEMPLATES_ROOT, composeLayers(answers), templateVariables(answers), dir)
    createEnvFiles(dir)
    console.log(`scaffolded (next overlay) ${dir}`)
  }
}
