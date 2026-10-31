export interface ParsedArgs {
  projectName?: string
  latest: boolean
  skipInstall: boolean
  debug: boolean
  help: boolean
  version: boolean
  /** Accept all defaults — skip every prompt (CI-friendly, also enables non-TTY runs). */
  yes: boolean
  /** Stack overrides; when present the matching prompt is skipped. */
  fullStack?: boolean
  platform?: string
  lang?: string
  runtime?: string
  frontend?: string
  backend?: string
  orm?: string
  db?: string
  auth?: string
  extras?: string[]
}

export const HELP_TEXT = `Usage: npm create omnicraft@latest [project-name] [options]

Interactive project scaffolding — answer a few prompts and OmniCraft generates a project from the
available web, backend, or native-platform choices.

Options:
  --yes                Accept all defaults, skip every prompt (CI-friendly;
                       also allows running without a TTY)
  --lang <name>        Skip the language prompt (typescript, javascript; JS is web React/Vite only)
  --platform <name>    Skip the "What are you building?" prompt (web, mobile, desktop)
  --full-stack         Force the full-stack flow (default: yes; backend/database/ORM, non-None auth, or integrated frontend flags imply it)
  --no-full-stack      Frontend only (cannot be combined with backend/database flags)
  --runtime <name>     Skip the runtime prompt (node, python, php)
  --frontend <name>    Skip the frontend prompt (react, nextjs, vue, svelte, livewire, inertia-react; integrated modes include Next.js, Livewire, and Laravel Inertia React)
  --backend <name>     Skip the framework prompt (node: express, fastify, hono ·
                       python: fastapi · php: laravel)
  --db <name>          Skip the database prompt (node: postgres, sqlite, mysql ·
                       python: postgres, sqlite · php: postgres, sqlite, mysql)
  --auth <name>        Authentication setup (none, better-auth, laravel-native; Better Auth requires
                       TypeScript React + Node/Express/Drizzle; Laravel native requires integrated
                       Livewire or Inertia React + SQLite)
  --orm <name>         Skip ORM selection (drizzle, prisma, none; Prisma is PostgreSQL-only and
                       unavailable for Hono). Separate Node APIs only; Next.js uses raw SQL and
                       rejects --runtime, --backend, --orm, and --no-full-stack
  --extras <list>      Comma-separated extras (tailwind, eslint, shadcn;
                       default: tailwind,eslint). shadcn is web React/Vite-only and
                       implies tailwind. Next.js always includes Tailwind + ESLint;
                       if set with Next.js, use --extras tailwind,eslint. Use none on other stacks to skip all.
  --latest             Pull templates from this CLI version's release tag
                       instead of the embedded templates
  --skip-install       Skip optional JS/Python/Livewire/Inertia React frontend setup; Laravel Composer setup still runs
  --debug              Print stack traces on errors
  -h, --help           Show this help
  -v, --version        Show version

Examples:
  npm create omnicraft@latest
  npm create omnicraft@latest my-app
  npm create omnicraft@latest my-app -- --yes --skip-install
  npm create omnicraft@latest my-app -- --no-full-stack --extras tailwind
  npm create omnicraft@latest my-app -- --yes --frontend livewire --auth laravel-native
  npm create omnicraft@latest my-app -- --yes --frontend inertia-react --auth laravel-native
`

const VALUE_FLAGS = new Set(['--lang', '--platform', '--runtime', '--frontend', '--backend', '--orm', '--db', '--auth', '--extras'])

export function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    latest: false,
    skipInstall: false,
    debug: false,
    help: false,
    version: false,
    yes: false,
  }
  const positional: string[] = []

  let i = 0
  while (i < argv.length) {
    const arg = argv[i]
    const valueFlag = VALUE_FLAGS.has(arg.split('=')[0]) ? arg.split('=')[0] : null

    if (valueFlag) {
      let value: string
      if (arg.startsWith(valueFlag + '=')) {
        value = arg.slice(valueFlag.length + 1)
      } else {
        const next = argv[i + 1]
        if (next === undefined || next.startsWith('-')) {
          throw new Error(`Missing value for ${valueFlag}. Example: ${valueFlag} react`)
        }
        value = next
        i++
      }
      if (valueFlag === '--lang') args.lang = value
      else if (valueFlag === '--runtime') args.runtime = value
      else if (valueFlag === '--platform') args.platform = value
      else if (valueFlag === '--frontend') args.frontend = value
      else if (valueFlag === '--backend') args.backend = value
      else if (valueFlag === '--orm') args.orm = value
      else if (valueFlag === '--db') args.db = value
      else if (valueFlag === '--auth') args.auth = value
      else args.extras = splitList(value)
    } else if (arg === '--latest') args.latest = true
    else if (arg === '--skip-install') args.skipInstall = true
    else if (arg === '--debug') args.debug = true
    else if (arg === '--help' || arg === '-h') args.help = true
    else if (arg === '--version' || arg === '-v') args.version = true
    else if (arg === '--yes') args.yes = true
    else if (arg === '--full-stack') args.fullStack = true
    else if (arg === '--no-full-stack') args.fullStack = false
    else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}. Run with --help to see usage.`)
    } else {
      positional.push(arg)
    }
    i++
  }

  if (positional.length > 1) {
    throw new Error(`Expected at most one project name, got: ${positional.join(' ')}`)
  }
  if (positional.length === 1) args.projectName = positional[0]
  return args
}

function splitList(value: string): string[] {
  const items = value
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (items.length === 0) {
    throw new Error('Empty list. Available extras: tailwind, eslint (or "none")')
  }
  if (items.length === 1 && items[0] === 'none') return []
  return items
}
