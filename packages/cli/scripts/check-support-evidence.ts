import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { INTEGRATION_TARGETS, SUPPORTED_CAPABILITIES } from '../src/support-evidence.js'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

function workflowJob(lines: string[], name: string): string {
  const header = `  ${name}:`
  const start = lines.findIndex((line) => line.trimEnd() === header)
  assert(start >= 0, `CI is missing integration job "${name}".`)
  let end = start + 1
  while (end < lines.length && !/^  [a-zA-Z0-9_-]+:\s*$/.test(lines[end] ?? '')) end += 1
  return lines.slice(start, end).join('\n')
}

function jobDependencies(job: string, name: string): string[] {
  const lines = job.split(/\r?\n/)
  const start = lines.findIndex((line) => line === '    needs:')
  assert(start >= 0, `The supported-matrix job must declare required jobs in "needs".`)
  const dependencies: string[] = []
  for (const line of lines.slice(start + 1)) {
    const match = /^      - ([a-zA-Z0-9_-]+)$/.exec(line)
    if (!match) break
    dependencies.push(match[1] ?? '')
  }
  assert(dependencies.length > 0, `The "${name}" job must require at least one job.`)
  return dependencies
}

export function validateSupportEvidence(): void {
  const matrixPath = join(repoRoot, 'docs', 'templates', 'stack-support-matrix.md')
  const workflowPath = join(repoRoot, '.github', 'workflows', 'ci.yml')
  const matrix = readFileSync(matrixPath, 'utf8')
  const matrixLines = matrix.split(/\r?\n/)
  const workflowLines = readFileSync(workflowPath, 'utf8').split(/\r?\n/)
  const workflow = workflowLines.join('\n')
  const supportedRows = matrixLines.filter(
    (line) => line.startsWith('|') && line.includes('**Supported**'),
  )
  const idPattern = /<!-- support-id: ([a-z0-9-]+) -->/g
  const documentedIds = new Map<string, string>()

  for (const row of supportedRows) {
    const ids = [...row.matchAll(idPattern)].map((match) => match[1] ?? '')
    assert.equal(
      ids.length,
      1,
      `Every Supported matrix row must have exactly one support id: ${row}`,
    )
    const id = ids[0] ?? ''
    assert(!documentedIds.has(id), `Support id "${id}" appears more than once in the matrix.`)
    documentedIds.set(id, row)
  }

  const registryIds = new Set<string>()
  for (const capability of SUPPORTED_CAPABILITIES) {
    assert(!registryIds.has(capability.id), `Support registry duplicates id "${capability.id}".`)
    registryIds.add(capability.id)

    const row = documentedIds.get(capability.id)
    assert(row, `Support registry entry "${capability.id}" has no Supported matrix row.`)
    assert(
      row.includes(capability.matrixRowPrefix),
      `Supported matrix row "${capability.id}" no longer matches its registered combination.`,
    )

    const target = INTEGRATION_TARGETS[capability.target]
    const targetScenarios: readonly string[] = target.scenarios
    assert(
      capability.scenarios.every((scenario) => targetScenarios.includes(scenario)),
      `Support entry "${capability.id}" references a scenario missing from target "${capability.target}".`,
    )
  }

  assert.deepEqual(
    [...documentedIds.keys()].sort(),
    [...registryIds].sort(),
    'The Supported matrix rows and the evidence registry must contain the same ids.',
  )

  for (const [id, target] of Object.entries(INTEGRATION_TARGETS)) {
    assert(target.scenarios.length > 0, `Integration target "${id}" must declare at least one scenario.`)
    assert(
      existsSync(join(repoRoot, 'packages', 'cli', target.script)),
      `Integration target "${id}" points to a missing script: ${target.script}.`,
    )
    const job = workflowJob(workflowLines, target.workflowJob)
    assert(
      job.includes(target.workflowCommand),
      `CI job "${target.workflowJob}" no longer runs the registered command: ${target.workflowCommand}.`,
    )
  }

  const releaseGate = workflowJob(workflowLines, 'supported-matrix')
  assert(releaseGate.includes('always()'), 'The supported-matrix aggregate job must run after failed dependencies.')
  const requiredJobs = new Set(jobDependencies(releaseGate, 'supported-matrix'))
  for (const target of Object.values(INTEGRATION_TARGETS)) {
    assert(
      requiredJobs.has(target.workflowJob),
      `The supported-matrix aggregate job must require "${target.workflowJob}".`,
    )
  }
  for (const requiredResult of ['unix', 'support-evidence', 'package']) {
    assert(
      requiredJobs.has(requiredResult),
      `The supported-matrix aggregate job must require "${requiredResult}" checks.`,
    )
  }

  assert(workflow.includes('workflow_dispatch:'), 'CI must support an explicit pre-release validation run.')
  assert(workflow.includes('schedule:'), 'CI must run the supported-stack release gate nightly.')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  validateSupportEvidence()
  console.log(`[support-matrix] ${SUPPORTED_CAPABILITIES.length} Supported rows map to CI evidence.`)
}
