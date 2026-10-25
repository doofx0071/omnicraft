import * as p from '@clack/prompts'
import { CLIENT_PORT, SERVER_PORT } from './config.js'
import { DATABASE_LABELS } from './types.js'
import type { PackageManager } from './scaffold/pkg-manager.js'
import type { Answers } from './types.js'

/** Prints the tailored "what to do next" panel before the CLI exits. */
export function printNextSteps(answers: Answers, pm: PackageManager): void {
  const steps: string[] = [`cd ${answers.projectName}`]

  if (answers.fullStack) {
    // SQLite is file-based — nothing to start.
    if (answers.database !== 'sqlite') {
      steps.push(`docker compose up -d        # start ${DATABASE_LABELS[answers.database!]}`)
    }
    steps.push(`${pm} run db:push            # create tables from the schema`)
  }
  steps.push(`${pm} run dev`)

  p.note(steps.join('\n'), 'Next steps')

  if (answers.fullStack) {
    const studio = `npm run db:studio`
    const dbLine =
      answers.database === 'sqlite'
        ? `  database → SQLite file at server/data/app.db (GUI: ${studio})`
        : `  database → ${DATABASE_LABELS[answers.database!]} (${studio})`
    p.log.message(
      `  client   → http://localhost:${CLIENT_PORT}\n` +
        `  server   → http://localhost:${SERVER_PORT} (try /api/health)\n` +
        dbLine,
    )
  } else {
    p.log.message(`  app → http://localhost:${CLIENT_PORT}`)
  }
}
