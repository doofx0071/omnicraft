import { runCommand } from '../exec.js'

/** Initializes a git repo on `main`, returning false when git is unavailable. */
export function gitInit(dir: string): boolean {
  if (!runCommand('git', ['--version'], process.cwd()).ok) return false
  return (
    runCommand('git', ['init', '-b', 'main'], dir).ok ||
    runCommand('git', ['init'], dir).ok
  )
}
