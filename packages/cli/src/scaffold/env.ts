import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Copies every `.env.example` the scaffold produced to a real `.env` (next
 * to it) so the project runs immediately — the whole point of the database
 * boilerplate. Then, for layouts where the server runs from the project root
 * (Next.js integrated apps keep db code in `app/db`), ensures a root `.env`
 * exists so `dotenv` resolves it from the `npm run` cwd.
 * Returns the created paths for reporting. Never overwrites existing files.
 */
export function createEnvFiles(targetDir: string): string[] {
  const created: string[] = []
  const candidates = [
    join(targetDir, '.env.example'),
    join(targetDir, 'server', '.env.example'),
    join(targetDir, 'client', '.env.example'),
    join(targetDir, 'app', 'db', '.env.example'),
  ]
  for (const example of candidates) {
    if (!existsSync(example)) continue
    const env = example.replace(/\.env\.example$/, '.env')
    if (!existsSync(env)) {
      copyFileSync(example, env)
      created.push(env)
    }
  }

  // Next.js integrated full-stack: scripts run from the project root, and
  // `dotenv/config` reads ./.env — mirror the app/db env there.
  const appDbEnv = join(targetDir, 'app', 'db', '.env')
  const rootEnv = join(targetDir, '.env')
  if (existsSync(appDbEnv) && !existsSync(rootEnv)) {
    copyFileSync(appDbEnv, rootEnv)
    created.push(rootEnv)
  }
  return created
}
