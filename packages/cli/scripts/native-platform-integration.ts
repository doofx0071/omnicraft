import { randomBytes } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { runCommand, startCommand } from '../src/exec.js'
import { composeLayers, templateVariables } from '../src/scaffold/compose.js'
import { createEnvFiles } from '../src/scaffold/env.js'
import { applyLayers } from '../src/scaffold/engine.js'
import { CLI_VERSION, TEMPLATES_ROOT } from '../src/config.js'
import { buildManifest } from '../src/manifest.js'
import { saveManifest } from '../src/add.js'
import type { Answers } from '../src/types.js'

const PREPARATION_TIMEOUT_MS = 8 * 60 * 1000
const BUILD_TIMEOUT_MS = 25 * 60 * 1000
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024

function tail(value: string, length = 12_000): string {
  return value.length > length ? value.slice(-length) : value
}

function failureDetails(value: string): string {
  const lines = value.split(/\r?\n/)
  const diagnosticIndices = lines.flatMap((line, index) =>
    /(?:^|\s)(?:fatal\s+)?error:|error generated\b|The following build commands failed|\*\* BUILD FAILED \*\*|Command .* failed/i.test(line)
      ? [index]
      : [],
  )
  const selected = [...diagnosticIndices.slice(0, 40), ...diagnosticIndices.slice(-20)]
  const context = new Set<number>()
  for (const index of selected) {
    for (let nearby = Math.max(0, index - 1); nearby <= Math.min(lines.length - 1, index + 2); nearby += 1) {
      context.add(nearby)
    }
  }
  const excerpt = [...context]
    .sort((left, right) => left - right)
    .map((index) => `${index + 1}: ${lines[index] ?? ''}`)
    .join('\n')
  const diagnostics =
    excerpt.length > 8_000
      ? `${excerpt.slice(0, 4_000)}\n... ${excerpt.length - 8_000} diagnostic characters omitted ...\n${excerpt.slice(-4_000)}`
      : excerpt || 'No compiler error line was captured.'
  return `Relevant failure diagnostics:\n${diagnostics}\nFinal output:\n${tail(value, 3_000)}`
}

function redact(value: string): string {
  let result = value
  for (const [key, secret] of Object.entries(process.env)) {
    if (secret && /TOKEN|PASSWORD|SECRET|DATABASE_URL|PRIVATE_KEY/i.test(key)) {
      result = result.split(secret).join('[REDACTED]')
    }
  }
  return result
}

function isolatedEnvironment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env = { ...process.env }
  for (const key of ['DATABASE_URL', 'PORT', 'NODE_ENV', 'HOSTNAME', 'EXPO_TOKEN']) delete env[key]
  return { ...env, CI: '1', NO_UPDATE_NOTIFIER: '1', EXPO_NO_TELEMETRY: '1', ...overrides }
}

function runRequired(
  label: string,
  command: string,
  args: string[],
  cwd: string,
  timeoutMs = PREPARATION_TIMEOUT_MS,
  environment: NodeJS.ProcessEnv = {},
): string {
  console.log(`[native] ${label}`)
  const result = runCommand(command, args, cwd, {
    env: isolatedEnvironment(environment),
    timeoutMs,
    maxBuffer: MAX_OUTPUT_BYTES,
  })
  const output = redact(result.output)
  if (!result.ok) {
    throw new Error(`${label} failed (exit ${result.exitCode ?? 'unknown'}):\n${failureDetails(output)}`)
  }
  console.log(`[native] completed: ${label}`)
  return output
}

function requirePath(path: string, label: string): void {
  if (!existsSync(path)) throw new Error(`${label} is missing: ${path}`)
}

function makeAnswers(
  projectRoot: string,
  projectName: string,
  platform: 'mobile' | 'desktop',
): Answers {
  return {
    projectName,
    targetDir: projectRoot,
    projectType: platform,
    frontend: 'react',
    language: 'typescript',
    fullStack: false,
    backendRuntime: null,
    backendFramework: null,
    orm: null,
    database: null,
    extras: { tailwind: false, eslintPrettier: false, shadcn: false },
    architecture: { kind: 'native-app', platform },
  }
}

function applyProductionLayers(projectRoot: string, answers: Answers): void {
  applyLayers(TEMPLATES_ROOT, composeLayers(answers), templateVariables(answers), projectRoot)
  createEnvFiles(projectRoot)
  saveManifest(projectRoot, buildManifest(answers, CLI_VERSION, 'npm'))
}

function createScratchProject(platform: 'expo' | 'tauri'): {
  parent: string
  projectName: string
  projectRoot: string
} {
  const parent = mkdtempSync(join(tmpdir(), `omnicraft-${platform}-runtime-`))
  const projectName = `omnicraft-${platform}-${randomBytes(4).toString('hex')}`
  return { parent, projectName, projectRoot: join(parent, projectName) }
}

function parseJsonOutput<T>(output: string, label: string): T {
  const start = output.indexOf('{')
  const end = output.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error(`${label} did not return a JSON object.`)
  return JSON.parse(output.slice(start, end + 1)) as T
}

interface SimulatorDevice {
  name: string
  udid: string
  isAvailable: boolean
}

interface SimulatorInventory {
  devices: Record<string, SimulatorDevice[]>
}

interface SelectedSimulator extends SimulatorDevice {
  runtimeIdentifier: string
  runtimeVersion: number[]
}

interface IosAppTarget {
  targetName: string
  targetBuildDir: string
  fullProductName: string
}

function selectIosSimulator(inventory: SimulatorInventory): SelectedSimulator {
  const devices = Object.entries(inventory.devices).flatMap(([runtimeIdentifier, runtimeDevices]) => {
    const version = /^com\.apple\.CoreSimulator\.SimRuntime\.iOS-(\d+)-(\d+)$/.exec(runtimeIdentifier)
    if (!version) return []
    const runtimeVersion = [Number(version[1]), Number(version[2])]
    return runtimeDevices
      .filter((device) => device.isAvailable && device.name.includes('iPhone'))
      .map((device) => ({ ...device, runtimeIdentifier, runtimeVersion }))
  })
  devices.sort((left, right) => {
    for (let index = 0; index < Math.max(left.runtimeVersion.length, right.runtimeVersion.length); index += 1) {
      const difference = (right.runtimeVersion[index] ?? 0) - (left.runtimeVersion[index] ?? 0)
      if (difference !== 0) return difference
    }
    return left.name.localeCompare(right.name)
  })
  const device = devices[0]
  if (!device) throw new Error('No available iPhone simulator exists in the Xcode simulator inventory.')
  return device
}

function iosAppTargetsFromBuildSettings(output: string): IosAppTarget[] {
  const headers = [...output.matchAll(/^Build settings for action .+ and target (.+):\s*$/gm)]
  return headers.flatMap((header, index) => {
    const targetName = header[1]?.trim()
    const start = (header.index ?? 0) + header[0].length
    const end = headers[index + 1]?.index ?? output.length
    const block = output.slice(start, end)
    const setting = (name: string) => new RegExp(`^\\s*${name} = (.+)$`, 'm').exec(block)?.[1]?.trim()
    const productType = setting('PRODUCT_TYPE')
    const targetBuildDir = setting('TARGET_BUILD_DIR')
    const fullProductName = setting('FULL_PRODUCT_NAME')
    if (
      productType !== 'com.apple.product-type.application' ||
      !targetBuildDir ||
      !fullProductName?.endsWith('.app') ||
      /tests?\.app$/i.test(fullProductName)
    ) {
      return []
    }
    return [{ targetName: targetName ?? 'unknown', targetBuildDir, fullProductName }]
  })
}

function findIosAppTarget(
  workspacePath: string,
  derivedData: string,
  schemes: readonly string[],
  projectName: string,
  simulatorId: string,
  projectRoot: string,
): { scheme: string; target: IosAppTarget } {
  const preferred = schemes.find((candidate) => candidate.toLowerCase() === projectName.toLowerCase())
  const candidates = preferred
    ? [preferred, ...schemes.filter((candidate) => candidate !== preferred)]
    : schemes
  const inspected: string[] = []

  for (const scheme of candidates) {
    const settings = runRequired(
      `Inspect native iOS app target for scheme ${scheme}`,
      'xcodebuild',
      [
        '-showBuildSettings',
        '-workspace',
        workspacePath,
        '-scheme',
        scheme,
        '-configuration',
        'Release',
        '-sdk',
        'iphonesimulator',
        '-destination',
        `id=${simulatorId}`,
        '-derivedDataPath',
        derivedData,
      ],
      projectRoot,
    )
    const appTargets = iosAppTargetsFromBuildSettings(settings)
    if (appTargets.length === 1) return { scheme, target: appTargets[0] as IosAppTarget }
    inspected.push(`${scheme}: ${appTargets.length} simulator app targets`)
  }

  throw new Error(
    `No Xcode scheme produced one iOS simulator app target. Schemes inspected: ${inspected.join('; ') || 'none'}.`,
  )
}

function findIosAppBundle(derivedData: string): string {
  const productsRoot = join(derivedData, 'Build', 'Products')
  const appBundles: string[] = []

  function visit(directory: string): void {
    let entries
    try {
      entries = readdirSync(directory, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const path = join(directory, entry.name)
      let isDirectory = false
      try {
        isDirectory = statSync(path).isDirectory()
      } catch {
        continue
      }
      if (!isDirectory) continue
      if (entry.name.endsWith('.app')) {
        if (!entry.name.endsWith('Tests.app')) appBundles.push(path)
      } else {
        visit(path)
      }
    }
  }

  visit(productsRoot)
  if (appBundles.length !== 1) {
    let products = 'missing'
    try {
      products = readdirSync(productsRoot, { withFileTypes: true })
        .map((entry) => `${entry.isDirectory() ? 'directory' : entry.isSymbolicLink() ? 'symlink' : 'file'}:${entry.name}`)
        .join(', ') || 'empty'
    } catch {
      // Keep the missing directory in the diagnostic.
    }
    throw new Error(
      `Expected one generated iOS simulator app under ${productsRoot}, found ${appBundles.length}: ${appBundles.join(', ') || 'none'}. Products: ${products}.`,
    )
  }
  return appBundles[0] ?? ''
}

function findIosProject(iosRoot: string): { projectPath: string; workspacePath: string } {
  const project = readdirSync(iosRoot).find((name) => name.endsWith('.xcodeproj'))
  if (!project) throw new Error(`Expo prebuild did not create an Xcode project in ${iosRoot}.`)
  return {
    projectPath: join(iosRoot, project),
    workspacePath: join(iosRoot, `${project.replace(/\.xcodeproj$/, '')}.xcworkspace`),
  }
}

function iosBundleIdentifier(projectPath: string): string {
  const projectFile = join(projectPath, 'project.pbxproj')
  const source = readFileSync(projectFile, 'utf8')
  const ids = [...source.matchAll(/PRODUCT_BUNDLE_IDENTIFIER\s*=\s*([^;]+);/g)]
    .map((match) => match[1]?.trim() ?? '')
    .filter((value) => value && !value.includes('$') && !/\.tests?$/i.test(value))
  const unique = [...new Set(ids)]
  if (unique.length !== 1) {
    throw new Error(`Expected one Expo app bundle identifier, found: ${unique.join(', ') || 'none'}.`)
  }
  return unique[0] ?? ''
}

interface TauriConfig {
  app?: {
    windows?: Array<{ title?: string }>
  }
}

function tauriWindowTitle(projectRoot: string): string {
  const configPath = join(projectRoot, 'src-tauri', 'tauri.conf.json')
  const config = JSON.parse(readFileSync(configPath, 'utf8')) as TauriConfig
  const title = config.app?.windows?.[0]?.title
  if (!title) throw new Error('The generated Tauri configuration has no primary window title.')
  return title
}

function findTauriBinary(releaseDir: string): string {
  const binaries = readdirSync(releaseDir)
    .map((name) => join(releaseDir, name))
    .filter((path) => {
      const stat = statSync(path)
      return stat.isFile() && (stat.mode & 0o111) !== 0 && !path.endsWith('.d')
    })
  if (binaries.length !== 1) {
    throw new Error(`Expected one generated Tauri executable in ${releaseDir}, found ${binaries.length}.`)
  }
  return binaries[0] ?? ''
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function waitForTauriWindow(
  process: ReturnType<typeof startCommand>,
  projectRoot: string,
  title: string,
  env: NodeJS.ProcessEnv,
): Promise<string> {
  let exitResult: { ok: boolean; output: string; exitCode: number | null } | undefined
  void process.exited.then((result) => {
    exitResult = result
  })
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    const result = runCommand('xdotool', ['search', '--onlyvisible', '--name', escapeRegularExpression(title)], projectRoot, {
      env,
      timeoutMs: 5_000,
      maxBuffer: 1024 * 1024,
    })
    const windowId = result.ok ? result.output.split(/\r?\n/)[0]?.trim() : undefined
    if (windowId && /^\d+$/.test(windowId)) {
      const actualTitle = runCommand('xdotool', ['getwindowname', windowId], projectRoot, {
        env,
        timeoutMs: 5_000,
        maxBuffer: 1024 * 1024,
      })
      if (actualTitle.ok && actualTitle.output.trim() === title) return windowId
    }
    if (exitResult) {
      throw new Error(`The Tauri process exited before its window appeared (exit ${exitResult.exitCode ?? 'unknown'}):\n${tail(redact(`${exitResult.output}\n${process.output}`))}`)
    }
    await delay(1_000)
  }
  throw new Error(`No visible Tauri window titled "${title}" appeared within 60 seconds:\n${tail(redact(process.output))}`)
}

async function waitForX11Display(
  server: ReturnType<typeof startCommand>,
  projectRoot: string,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  let exitResult: { ok: boolean; output: string; exitCode: number | null } | undefined
  void server.exited.then((result) => {
    exitResult = result
  })
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    const result = runCommand('xdotool', ['getdisplaygeometry'], projectRoot, {
      env,
      timeoutMs: 5_000,
      maxBuffer: 1024 * 1024,
    })
    if (result.ok) return
    if (exitResult) {
      throw new Error(`Xvfb exited before its display was ready (exit ${exitResult.exitCode ?? 'unknown'}):\n${tail(redact(`${exitResult.output}\n${server.output}`))}`)
    }
    await delay(500)
  }
  throw new Error(`Xvfb did not expose a display within 30 seconds:\n${tail(redact(server.output))}`)
}

async function runExpoIosSimulator(): Promise<void> {
  if (process.platform !== 'darwin') {
    throw new Error('The Expo simulator scenario requires a macOS runner with Xcode.')
  }

  const { parent, projectName, projectRoot } = createScratchProject('expo')
  const answers = makeAnswers(projectRoot, projectName, 'mobile')
  let simulatorId: string | undefined

  try {
    runRequired(
      'Generate Expo SDK 58 project with the production generator command',
      'npx',
      [
        '--yes',
        'create-expo-app@latest',
        projectRoot,
        '--template',
        'default@sdk-58',
        '--yes',
        '--no-install',
        '--no-agents-md',
      ],
      parent,
    )
    applyProductionLayers(projectRoot, answers)
    runRequired('Install Expo project dependencies', 'npm', ['install', '--no-audit', '--no-fund'], projectRoot)
    runRequired(
      'Generate the native iOS project',
      'npx',
      ['expo', 'prebuild', '--platform', 'ios', '--no-install'],
      projectRoot,
    )

    const iosRoot = join(projectRoot, 'ios')
    const { projectPath, workspacePath } = findIosProject(iosRoot)
    runRequired('Install generated CocoaPods dependencies', 'pod', ['install'], iosRoot)
    requirePath(workspacePath, 'Expo CocoaPods workspace')

    const inventory = parseJsonOutput<SimulatorInventory>(
      runRequired('List available iOS simulators', 'xcrun', ['simctl', 'list', 'devices', 'available', '--json'], projectRoot),
      'simctl simulator inventory',
    )
    const simulator = selectIosSimulator(inventory)
    simulatorId = simulator.udid
    console.log(`[native] Selected ${simulator.name} on ${simulator.runtimeIdentifier}.`)
    runCommand('xcrun', ['simctl', 'shutdown', simulatorId], projectRoot, { timeoutMs: 30_000 })
    runRequired('Boot the iOS simulator', 'xcrun', ['simctl', 'boot', simulatorId], projectRoot, 60_000)
    runRequired('Wait for iOS simulator startup', 'xcrun', ['simctl', 'bootstatus', simulatorId, '-b'], projectRoot, 180_000)

    const xcode = parseJsonOutput<{
      workspace?: { schemes?: string[] }
      project?: { schemes?: string[] }
    }>(runRequired('Discover the generated Xcode scheme', 'xcodebuild', ['-list', '-json', '-workspace', workspacePath], projectRoot), 'xcodebuild scheme listing')
    const schemes = (xcode.workspace?.schemes ?? xcode.project?.schemes ?? []).filter(
      (candidate) => !candidate.startsWith('Pods-') && !/tests?$/i.test(candidate),
    )
    const derivedData = join(projectRoot, '.ci-derived-data')
    const appTarget = findIosAppTarget(
      workspacePath,
      derivedData,
      schemes,
      projectName,
      simulatorId,
      projectRoot,
    )
    const scheme = appTarget.scheme
    console.log(
      `[native] Selected Xcode scheme ${scheme}, app target ${appTarget.target.targetName}: ${appTarget.target.fullProductName}`,
    )
    runRequired(
      'Build the native iOS simulator app',
      'xcodebuild',
      [
        '-quiet',
        '-workspace',
        workspacePath,
        '-scheme',
        scheme,
        '-configuration',
        'Release',
        '-sdk',
        'iphonesimulator',
        '-destination',
        `id=${simulatorId}`,
        '-derivedDataPath',
        derivedData,
        'CODE_SIGNING_ALLOWED=NO',
        'build',
      ],
      projectRoot,
      BUILD_TIMEOUT_MS,
    )

    const expectedAppPath = join(appTarget.target.targetBuildDir, appTarget.target.fullProductName)
    const appPath = existsSync(expectedAppPath) ? expectedAppPath : findIosAppBundle(derivedData)
    const bundleId = iosBundleIdentifier(projectPath)
    runRequired('Install the native app in the simulator', 'xcrun', ['simctl', 'install', simulatorId, appPath], projectRoot, 120_000)
    const launchOutput = runRequired(
      'Launch the native app in the simulator',
      'xcrun',
      ['simctl', 'launch', '--terminate-running-process', simulatorId, bundleId],
      projectRoot,
      60_000,
    )
    if (!/:\s*\d+\b/.test(launchOutput)) {
      throw new Error(`simctl did not report a launched app process for ${bundleId}: ${tail(launchOutput)}`)
    }
    const appContainer = runRequired(
      'Verify the installed simulator app container',
      'xcrun',
      ['simctl', 'get_app_container', simulatorId, bundleId, 'app'],
      projectRoot,
      60_000,
    )
    requirePath(appContainer.trim(), 'Installed Expo app container')
    await delay(4_000)
    const screenshotPath = join(parent, 'expo-ios-simulator.png')
    runRequired('Capture the running simulator screen', 'xcrun', ['simctl', 'io', simulatorId, 'screenshot', screenshotPath], projectRoot, 60_000)
    requirePath(screenshotPath, 'iOS simulator screenshot')
    if (statSync(screenshotPath).size < 1024) throw new Error('The iOS simulator screenshot was unexpectedly empty.')
    console.log(`[native] Expo ${simulator.name}: native Release build installed and launched (${bundleId}).`)
  } finally {
    if (simulatorId) runCommand('xcrun', ['simctl', 'shutdown', simulatorId], projectRoot, { timeoutMs: 30_000 })
    rmSync(parent, { recursive: true, force: true })
  }
}

async function runTauriLinuxDesktop(): Promise<void> {
  if (process.platform !== 'linux') {
    throw new Error('The Tauri desktop scenario requires a Linux runner with WebKitGTK and Xvfb.')
  }

  const { parent, projectName, projectRoot } = createScratchProject('tauri')
  const answers = makeAnswers(projectRoot, projectName, 'desktop')
  let appProcess: ReturnType<typeof startCommand> | undefined
  let displayProcess: ReturnType<typeof startCommand> | undefined

  try {
    const identifier = `com.omnicraft.${projectName.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'app'}`
    runRequired(
      'Generate Tauri 2 React/TypeScript project with the production generator command',
      'npx',
      [
        '--yes',
        'create-tauri-app@latest',
        projectName,
        '--template',
        'react-ts',
        '--manager',
        'npm',
        '--yes',
        '--identifier',
        identifier,
      ],
      parent,
    )
    applyProductionLayers(projectRoot, answers)
    // create-tauri-app does not include a package-lock.json in its template.
    // Use npm install for this generated project rather than npm ci.
    runRequired('Install generated Tauri dependencies', 'npm', ['install', '--no-audit', '--no-fund'], projectRoot)
    runRequired('Build the generated Tauri frontend', 'npm', ['run', 'build'], projectRoot)
    runRequired('Verify Rust toolchain', 'cargo', ['--version'], projectRoot, 30_000)
    runRequired(
      'Build the native Tauri desktop executable',
      'npm',
      ['run', 'tauri', '--', 'build', '--no-bundle'],
      projectRoot,
      BUILD_TIMEOUT_MS,
      { CI: 'true' },
    )

    const executable = findTauriBinary(join(projectRoot, 'src-tauri', 'target', 'release'))
    const title = tauriWindowTitle(projectRoot)
    const display = ':99'
    const launchEnv = isolatedEnvironment({
      DISPLAY: display,
      GDK_BACKEND: 'x11',
      LIBGL_ALWAYS_SOFTWARE: '1',
      WEBKIT_DISABLE_COMPOSITING_MODE: '1',
      NO_AT_BRIDGE: '1',
    })
    console.log('[native] Start an isolated Xvfb display')
    displayProcess = startCommand(
      'Xvfb',
      [display, '-screen', '0', '1280x800x24', '-nolisten', 'tcp', '-ac'],
      projectRoot,
      { env: launchEnv, maxOutputBytes: MAX_OUTPUT_BYTES },
    )
    await waitForX11Display(displayProcess, projectRoot, launchEnv)
    console.log('[native] Launch the generated desktop executable')
    appProcess = startCommand(executable, [], projectRoot, {
      env: launchEnv,
      maxOutputBytes: MAX_OUTPUT_BYTES,
    })
    const windowId = await waitForTauriWindow(appProcess, projectRoot, title, launchEnv)
    console.log(`[native] Tauri desktop build launched a visible window titled "${title}" (window ${windowId}).`)
  } finally {
    if (appProcess) await appProcess.stop(10_000)
    if (displayProcess) await displayProcess.stop(10_000)
    rmSync(parent, { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  const scenarioIndex = process.argv.indexOf('--scenario')
  const scenario = scenarioIndex < 0 ? undefined : process.argv[scenarioIndex + 1]
  if (scenario === 'expo-ios-simulator') {
    await runExpoIosSimulator()
    return
  }
  if (scenario === 'tauri-linux-desktop') {
    await runTauriLinuxDesktop()
    return
  }
  throw new Error(
    'Usage: tsx scripts/native-platform-integration.ts --scenario expo-ios-simulator|tauri-linux-desktop',
  )
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[native] ${redact(message)}`)
  process.exitCode = 1
})
