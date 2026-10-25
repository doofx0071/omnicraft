import * as p from '@clack/prompts'
import { CLIENT_PORT, SERVER_PORT } from './config.js'
import type { PackageManager } from './scaffold/pkg-manager.js'
import type { Answers } from './types.js'

/** Prints the tailored "what to do next" panel before the CLI exits. */
export function printNextSteps(answers: Answers, pm: PackageManager): void {
  const steps: string[] = [`cd ${answers.projectName}`]

  if (answers.fullStack) {
    steps.push('docker compose up -d        # start PostgreSQL')
    steps.push(`${pm} run db:push            # create tables from the schema`)
  }
  steps.push(`${pm} run dev`)

  p.note(steps.join('\n'), 'Next steps')

  if (answers.fullStack) {
    p.log.message(
      `  client   → http://localhost:${CLIENT_PORT}\n` +
        `  server   → http://localhost:${SERVER_PORT} (try /api/health)\n` +
        `  database → ${answers.orm === 'prisma' ? 'Prisma Studio: npm run db:studio' : 'Drizzle Studio: npm run db:studio'}`,
    )
  } else {
    p.log.message(`  app → http://localhost:${CLIENT_PORT}`)
  }
}
