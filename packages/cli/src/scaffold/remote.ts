import { downloadTemplate } from 'giget'
import { TEMPLATE_REPO } from '../config.js'

/**
 * Pulls the newest templates from the OmniCraft GitHub repo (the same
 * `packages/cli/templates` directory that ships embedded) and returns the
 * local cache directory to scaffold from.
 */
export async function fetchRemoteTemplates(): Promise<string> {
  const source = `gh:${TEMPLATE_REPO.owner}/${TEMPLATE_REPO.repo}/${TEMPLATE_REPO.subdir}#${TEMPLATE_REPO.branch}`
  const result = await downloadTemplate(source, {
    force: true,
    provider: 'github',
  })
  return result.dir
}
