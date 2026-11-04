/**
 * Shared Docker readiness wait for integration scripts (audit remediation E5).
 *
 * db-integration and fastapi-integration previously made a single 15s
 * `docker info` attempt while the other integration scripts retried 5x2s;
 * this helper gives both the same bounded retry loop instead of duplicating
 * it. Callers describe their context so the failure message stays actionable.
 */
import { setTimeout as delay } from 'node:timers/promises'
import { runCommand } from '../../src/exec.js'

const DOCKER_CHECK_ATTEMPTS = 5
const DOCKER_CHECK_TIMEOUT_MS = 10_000
const DOCKER_CHECK_RETRY_DELAY_MS = 2_000

export async function ensureDockerAvailable(context: string): Promise<void> {
  for (let attempt = 1; attempt <= DOCKER_CHECK_ATTEMPTS; attempt += 1) {
    const result = runCommand('docker', ['info'], process.cwd(), {
      timeoutMs: DOCKER_CHECK_TIMEOUT_MS,
      maxBuffer: 1_000_000,
    })
    if (result.ok) return
    if (attempt < DOCKER_CHECK_ATTEMPTS) await delay(DOCKER_CHECK_RETRY_DELAY_MS)
  }
  throw new Error(
    `Docker Engine did not become ready after ${DOCKER_CHECK_ATTEMPTS} bounded checks; ${context} requires Docker. Start Docker and retry.`,
  )
}
