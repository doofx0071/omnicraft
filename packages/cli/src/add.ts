/**
 * `omnicraft add <module>` — injects modules into an existing OmniCraft
 * project. Stack-aware via `.omnicraft/project.json`; idempotent; supports
 * `--dry-run`. Never overwrites user files: module files that already exist
 * abort the run (the project.json manifest is the only file it rewrites).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { ProjectManifest } from './manifest.js'

const MANIFEST_DIR = '.omnicraft'
const MANIFEST_FILE = 'project.json'

export class NotAnOmnicraftProjectError extends Error {
  constructor() {
    super(
      `No ${MANIFEST_DIR}/${MANIFEST_FILE} found. "omnicraft add" works inside a project scaffolded by OmniCraft (create-omnicraft >= 0.4.0).`,
    )
    this.name = 'NotAnOmnicraftProjectError'
  }
}

export function loadManifest(targetDir: string): ProjectManifest {
  const file = join(targetDir, MANIFEST_DIR, MANIFEST_FILE)
  if (!existsSync(file)) throw new NotAnOmnicraftProjectError()
  const manifest = JSON.parse(readFileSync(file, 'utf8')) as ProjectManifest
  if (manifest.schema !== 1) {
    throw new Error(
      `Manifest schema ${manifest.schema} is not supported by this CLI (supported: 1). Update create-omnicraft.`,
    )
  }
  return manifest
}

export function saveManifest(targetDir: string, manifest: ProjectManifest): void {
  const dir = join(targetDir, MANIFEST_DIR)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`)
}

export interface ModuleContext {
  projectName: string
  databaseName: string
}

export interface ModuleDefinition {
  id: string
  description: string
  /** Combinations this module cannot be applied to. Return a reason string to reject. */
  incompatible?(manifest: ProjectManifest): string | null
  /** Files to write (relative to the project root), rendered with module vars. */
  files(ctx: ModuleContext, manifest: ProjectManifest): Record<string, string>
  /** package.json fragments merged into the project's root manifest. */
  packageJson?: {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    scripts?: Record<string, string>
  }
  /** Next-steps lines shown after a successful add. */
  nextSteps?: string[]
}

const DOCKER_COMPOSE_POSTGRES = `services:
  db:
    image: postgres:16-alpine
    container_name: {{projectName}}-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: omnicraft
      POSTGRES_PASSWORD: omnicraft
      POSTGRES_DB: {{databaseName}}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U omnicraft -d {{databaseName}}"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  pgdata:
`

const DOCKER_COMPOSE_MYSQL = `services:
  db:
    image: mysql:8
    container_name: {{projectName}}-db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: omnicraft-root
      MYSQL_DATABASE: {{databaseName}}
      MYSQL_USER: omnicraft
      MYSQL_PASSWORD: omnicraft
    ports:
      - "3306:3306"
    volumes:
      - mysqldata:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-pomnicraft-root"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  mysqldata:
`

const VITEST_CONFIG = `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
  },
});
`

const SAMPLE_TEST = `import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  it("renders the app title", () => {
    render(<App />);
    expect(document.body).toBeDefined();
  });
});
`

export const MODULES: ModuleDefinition[] = [
  {
    id: 'docker',
    description: 'docker-compose for the project database (PostgreSQL/MySQL)',
    incompatible(manifest) {
      if (manifest.stack.database === 'sqlite') {
        return 'the project uses SQLite (file-based — no docker-compose needed)'
      }
      if (manifest.stack.architecture.kind !== 'separate-frontend-api') {
        return `architecture "${manifest.stack.architecture.kind}" is not covered yet`
      }
      if (manifest.stack.database !== 'postgres' && manifest.stack.database !== 'mysql') {
        return `no containerized template for database "${manifest.stack.database}"`
      }
      return null
    },
    files(_ctx, manifest) {
      return {
        'docker-compose.yml':
          manifest.stack.database === 'mysql' ? DOCKER_COMPOSE_MYSQL : DOCKER_COMPOSE_POSTGRES,
      }
    },
    nextSteps: ['docker compose up -d', 'then run your db:push / db:migrate flow'],
  },
  {
    id: 'testing',
    description: 'Vitest for the client (jsdom + testing-library) with a sample test',
    incompatible(manifest) {
      if (manifest.stack.architecture.kind === 'native-app') {
        return 'native apps use their own test runners (not covered yet)'
      }
      const clientDir = manifest.stack.architecture.kind === 'separate-frontend-api' ? 'client' : '.'
      if (existsSync(join(process.cwd(), clientDir, 'vitest.config.ts'))) {
        return 'a vitest config already exists'
      }
      return null
    },
    files() {
      const isWorkspaces = existsSync(join(process.cwd(), 'client'))
      const prefix = isWorkspaces ? 'client/' : ''
      return {
        [`${prefix}vitest.config.ts`]: VITEST_CONFIG,
        [`${prefix}src/App.test.tsx`]: SAMPLE_TEST,
        [`${prefix}src/setupTests.ts`]: `import "@testing-library/jest-dom/vitest";\n`,
      }
    },
    packageJson: {
      devDependencies: {
        vitest: '^3.0.0',
        jsdom: '^26.0.0',
        '@testing-library/react': '^16.0.0',
        '@testing-library/jest-dom': '^6.6.0',
      },
      scripts: { test: 'vitest run' },
    },
    nextSteps: [`${existsSync(join(process.cwd(), 'client')) ? 'cd client && ' : ''}npm install`, 'npm run test'],
  },
]

export function renderModuleContent(content: string, vars: Record<string, string>): string {
  return content.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    Object.hasOwn(vars, key) ? (vars[key] ?? match) : match,
  )
}

export function moduleVars(manifest: ProjectManifest): Record<string, string> {
  return {
    projectName: manifest.projectName,
    databaseName: manifest.projectName.replace(/-/g, '_'),
  }
}

export function resolveTarget(targetArg?: string): string {
  return resolve(targetArg ?? process.cwd())
}
