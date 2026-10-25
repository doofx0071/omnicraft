import { spawnSync } from 'node:child_process'

/** Initializes a git repo on `main`, returning false when git is unavailable. */
export function gitInit(dir: string): boolean {
  try {
    if (spawnSync('git', ['--version'], { stdio: 'ignore', shell: process.platform === 'win32' }).status !== 0) {
      return false
    }
    const withBranch = spawnSync('git', ['init', '-b', 'main'], { cwd: dir, stdio: 'ignore', shell: process.platform === 'win32' })
    if (withBranch.status !== 0) {
      spawnSync('git', ['init'], { cwd: dir, stdio: 'ignore', shell: process.platform === 'win32' })
    }
    return true
  } catch {
    return false
  }
}
