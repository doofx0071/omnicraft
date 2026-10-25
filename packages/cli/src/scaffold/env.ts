import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Copies every `.env.example` the scaffold produced to a real `.env` so the
 * project runs immediately — the whole point of the database boilerplate.
 * Returns the created paths for reporting.
 */
export function createEnvFiles(targetDir: string): string[] {
  const created: string[] = []
  const candidates = [
    join(targetDir, '.env.example'),
    join(targetDir, 'server', '.env.example'),
    join(targetDir, 'client', '.env.example'),
  ]
  for (const example of candidates) {
    if (!existsSync(example)) continue
    const env = example.replace(/\.env\.example$/, '.env')
    if (existsSync(env)) continue
    copyFileSync(example, env)
    created.push(env)
  }
  return created
}
