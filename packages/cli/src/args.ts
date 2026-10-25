export interface ParsedArgs {
  projectName?: string
  latest: boolean
  skipInstall: boolean
  debug: boolean
  help: boolean
  version: boolean
}

const FLAGS = new Set(['--latest', '--skip-install', '--debug', '--help', '-h', '--version', '-v'])

export function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    latest: false,
    skipInstall: false,
    debug: false,
    help: false,
    version: false,
  }
  const positional: string[] = []

  for (const arg of argv) {
    if (FLAGS.has(arg)) {
      if (arg === '--latest') args.latest = true
      else if (arg === '--skip-install') args.skipInstall = true
      else if (arg === '--debug') args.debug = true
      else if (arg === '--help' || arg === '-h') args.help = true
      else args.version = true
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}. Run with --help to see usage.`)
    } else {
      positional.push(arg)
    }
  }

  if (positional.length > 1) {
    throw new Error(`Expected at most one project name, got: ${positional.join(' ')}`)
  }
  if (positional.length === 1) args.projectName = positional[0]
  return args
}

export const HELP_TEXT = `Usage: npm create omnicraft@latest [project-name] [options]

Interactive scaffolding for full-stack apps — answer a few prompts and
OmniCraft generates a ready-to-run project.

Options:
  --latest        Pull the newest templates from GitHub instead of the
                  ones embedded in this CLI version
  --skip-install  Generate the project without installing dependencies
  --debug         Print stack traces on errors
  -h, --help      Show this help
  -v, --version   Show version

Examples:
  npm create omnicraft@latest
  npm create omnicraft@latest my-app
  npm create omnicraft@latest my-app -- --latest
`
