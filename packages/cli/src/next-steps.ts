import * as p from '@clack/prompts'
import { CLIENT_PORT, SERVER_PORT } from './config.js'
import { DATABASE_LABELS } from './types.js'
import type { PackageManager } from './scaffold/pkg-manager.js'
import type { Answers } from './types.js'

export interface NextSteps {
  steps: string[]
  details: string
}

/** Builds the tailored commands and endpoints shown before the CLI exits. */
export function buildNextSteps(answers: Answers, pm: PackageManager): NextSteps {
  const steps: string[] = [`cd ${answers.projectName}`]

  if (answers.architecture.kind === 'integrated-laravel') {
    steps.push('cd server')
    steps.push('npm install                # if you skipped frontend dependency setup')
    steps.push('php artisan migrate')
    steps.push('composer run dev')
    return {
      steps,
      details:
        `  app      → open the URL printed by Laravel's development server\n` +
        `  UI       → Laravel + Livewire (integrated PHP-driven app)\n` +
        `  database → SQLite at server/database/database.sqlite`,
    }
  }

  if (answers.architecture.kind === 'integrated-fullstack') {
    if (answers.database !== 'sqlite') {
      steps.push(`docker compose up -d        # start ${DATABASE_LABELS[answers.database!]}`)
    }
    steps.push(`${pm} run db:migrate         # apply SQL migrations`)
    steps.push(`${pm} run dev`)

    const database =
      answers.database === 'sqlite'
        ? 'SQLite file configured by DATABASE_URL in .env'
        : `${DATABASE_LABELS[answers.database!]} configured by DATABASE_URL in .env`
    return {
      steps,
      details:
        `  app      → http://localhost:${CLIENT_PORT}\n` +
        `  API      → http://localhost:${CLIENT_PORT}/api/users (Next.js route handlers)\n` +
        `  database → ${database}`,
    }
  }

  if (answers.fullStack) {
    // SQLite is file-based — nothing to start.
    if (answers.database !== 'sqlite') {
      steps.push(`docker compose up -d        # start ${DATABASE_LABELS[answers.database!]}`)
    }
    steps.push(`${pm} run db:push            # create tables from the schema`)
  }
  steps.push(`${pm} run dev`)

  if (answers.fullStack) {
    const studio = `npm run db:studio`
    const dbLine =
      answers.backendRuntime === 'python'
        ? `  database → SQLite file at server/data/app.db (migrations: npm run db:migrate)`
        : answers.backendRuntime === 'php'
          ? `  database → ${DATABASE_LABELS[answers.database!]} (php artisan migrate)`
          : answers.database === 'sqlite'
            ? `  database → SQLite file at server/data/app.db (GUI: ${studio})`
            : `  database → ${DATABASE_LABELS[answers.database!]} (GUI: ${studio})`
    return {
      steps,
      details:
        `  client   → http://localhost:${CLIENT_PORT}\n` +
        `  server   → http://localhost:${SERVER_PORT} (try /api/health)\n` +
        dbLine,
    }
  }

  return { steps, details: `  app → http://localhost:${CLIENT_PORT}` }
}

/** Prints the tailored "what to do next" panel before the CLI exits. */
export function printNextSteps(answers: Answers, pm: PackageManager): void {
  const { steps, details } = buildNextSteps(answers, pm)
  p.note(steps.join('\n'), 'Next steps')
  p.log.message(details)
}
