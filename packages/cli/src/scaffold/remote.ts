import { downloadTemplate } from 'giget'
import { TEMPLATE_REPO } from '../config.js'

/**
 * Fetches the template subtree pinned to the release tag matching the CLI
 * version (the same `packages/cli/templates` directory that ships embedded).
 * Two runs of the same CLI version therefore produce identical output —
 * the ref is a `v<version>` tag, not a mutable branch.
 */
export async function fetchRemoteTemplates(): Promise<{ dir: string; ref: string }> {
  const ref = TEMPLATE_REPO.ref
  const source = `gh:${TEMPLATE_REPO.owner}/${TEMPLATE_REPO.repo}/${TEMPLATE_REPO.subdir}#${ref}`
  const result = await downloadTemplate(source, {
    force: true,
    provider: 'github',
  })
  return { dir: result.dir, ref }
}
