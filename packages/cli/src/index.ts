import * as p from "@clack/prompts";
import { HELP_TEXT, parseArgs } from "./args.js";
import { CancelledError, unwrap } from "./cancel.js";
import { applyModuleToProject, runAdd } from "./add-run.js";
import {
  CLI_VERSION,
  CNA_PACKAGE,
  LARAVEL_INERTIA_REACT_STARTER_KITS,
  LARAVEL_LIVEWIRE_STARTER_KITS,
  SHADCN_BASE,
  SHADCN_COMPONENTS,
  SHADCN_PRESET,
  TEMPLATES_ROOT,
  TIGED_PACKAGE,
  TEMPLATE_REPO,
} from "./config.js";
import { printNextSteps } from "./next-steps.js";
import { runPrompts } from "./prompts/run-prompts.js";
import { composeLayers, planLayerApplication, templateVariables } from "./scaffold/compose.js";
import { createEnvFiles } from "./scaffold/env.js";
import { applyLayers } from "./scaffold/engine.js";
import { createLaravelSqliteMigrationEnv } from "./scaffold/laravel-env.js";
import { gitInit } from "./scaffold/git.js";
import { runCommand, runCommandVisible } from "./exec.js";
import { detectPackageManager, installDependencies } from "./scaffold/pkg-manager.js";
import { fetchRemoteTemplates } from "./scaffold/remote.js";
import { validateStackFlags } from "./prefill.js";
import { checkForUpdate } from "./update-check.js";
import { copyFileSync, existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

/**
 * The prompt library drives the console in raw mode; if the process exits
 * hard (Ctrl+C during install, a crash), cmd.exe keeps the raw console state
 * and every keystroke after the CLI exits garbles — arrows print as ^[[A and
 * commands get mangled. Restore the console on every way out.
 */
function restoreTerminal(): void {
  try {
    if (process.stdin.isTTY && process.stdin.isRaw) process.stdin.setRawMode(false);
    if (process.stdout.isTTY) process.stdout.write("\u001B[?25h"); // ensure cursor visible
  } catch {
    // stdin/stdout already detached — nothing to restore
  }
}

process.on("exit", restoreTerminal);
process.on("SIGINT", () => {
  restoreTerminal();
  process.exit(130);
});
process.on("uncaughtException", (err) => {
  restoreTerminal();
  console.error(err);
  process.exit(1);
});

async function main(): Promise<void> {
  // Subcommand routing: `omnicraft add <module>` runs the module injector;
  // everything else (or no args) is the create flow.
  const argv = process.argv.slice(2);
  if (argv[0] === "add") {
    const addArgs = argv.slice(1).filter((arg) => !arg.startsWith("--"));
    const dryRun = argv.includes("--dry-run");
    const [moduleName, targetArg] = addArgs;
    try {
      await runAdd(moduleName, targetArg, dryRun);
    } catch (err) {
      if (err instanceof CancelledError) {
        p.cancel(err.message);
        return;
      }
      p.cancel("Something went wrong.");
      p.log.error((err as Error).message);
      process.exitCode = 1;
    }
    return;
  }

  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error((err as Error).message);
    process.exitCode = 1;
    return;
  }

  if (args.help) {
    console.log(HELP_TEXT);
    return;
  }
  if (args.version) {
    console.log(CLI_VERSION);
    return;
  }

  p.intro(`⚡ OmniCraft v${CLI_VERSION} — compose a project`);

  if (!process.stdin.isTTY && !args.yes) {
    p.log.error("OmniCraft is interactive and needs a real terminal to run its prompts.");
    p.log.message(
      "For CI and scripted use, pass --yes (and any stack flags):\n  npm create omnicraft@latest my-app -- --yes --skip-install",
    );
    process.exitCode = 1;
    return;
  }

  try {
    validateStackFlags(args);
  } catch (err) {
    p.log.error((err as Error).message);
    process.exitCode = 1;
    return;
  }

  if (!process.env.NO_UPDATE_NOTIFIER && !process.env.CI) {
    const latest = await checkForUpdate(CLI_VERSION);
    if (latest) {
      p.log.info(
        `Update available: v${latest} — you are on v${CLI_VERSION}. Run: npm create omnicraft@latest`,
      );
    }
  }

  const answers = await runPrompts(args.projectName, args);

  let templatesRoot = TEMPLATES_ROOT;
  if (args.latest) {
    const spinner = p.spinner();
    spinner.start(`Fetching templates for ${TEMPLATE_REPO.ref} from GitHub...`);
    try {
      templatesRoot = (await fetchRemoteTemplates()).dir;
      spinner.stop(`Templates fetched (${TEMPLATE_REPO.ref})`);
    } catch {
      spinner.stop("Could not fetch templates from GitHub");
      p.log.warn(
        `Make sure release tag ${TEMPLATE_REPO.ref} exists on GitHub, check your connection, or run without --latest to use the embedded templates.`,
      );
      p.outro("Aborted.");
      return;
    }
  }

  // Native platforms (mobile/desktop): the official generator IS the
  // scaffold; OmniCraft applies its overlay afterwards and returns — no web
  // flow, no db prompts, no tailwind/shadcn steps.
  if (answers.architecture.kind === "native-app") {
    const mobile = answers.architecture.platform === "mobile";
    const layers = composeLayers(answers);
    const variables = templateVariables(answers);
    const spinner = p.spinner();

    if (mobile) {
      spinner.start("Creating the Expo app with create-expo-app (this can take a minute)...");
      const cea = runCommand(
        "npx",
        [
          "--yes",
          "create-expo-app@latest",
          answers.targetDir,
          "--template",
          "default@sdk-58",
          "--yes",
          "--no-install",
          "--no-agents-md",
        ],
        dirname(answers.targetDir),
        64 * 1024 * 1024,
      );
      if (!cea.ok) {
        spinner.stop("create-expo-app failed");
        throw new Error(
          "create-expo-app failed — see the output above. Check your connection and that Node ≥ 20 is installed.",
        );
      }
      applyLayers(templatesRoot, layers, variables, answers.targetDir);
      spinner.stop("Expo app created and configured");
    } else {
      spinner.start("Creating the Tauri app with create-tauri-app (this can take a minute)...");
      const identifier = `com.omnicraft.${answers.projectName.replace(/[^a-z0-9]/gi, "").toLowerCase() || "app"}`;
      const cta = runCommand(
        "npx",
        [
          "--yes",
          "create-tauri-app@latest",
          basename(answers.targetDir),
          "--template",
          "react-ts",
          "--manager",
          "npm",
          "--yes",
          "--identifier",
          identifier,
        ],
        dirname(answers.targetDir),
        64 * 1024 * 1024,
      );
      if (!cta.ok) {
        spinner.stop("create-tauri-app failed");
        throw new Error("create-tauri-app failed — see the output above. Check your connection.");
      }
      applyLayers(templatesRoot, layers, variables, answers.targetDir);
      spinner.stop("Tauri app created and configured");
    }

    const envFiles = createEnvFiles(answers.targetDir);
    for (const file of envFiles)
      p.log.step(
        `Created ${file.replace(answers.targetDir + "\\", "").replace(answers.targetDir + "/", "")}`,
      );

    // Project manifest — enables omnicraft add stack detection.
    const { buildManifest } = await import("./manifest.js");
    const { saveManifest } = await import("./add.js");
    saveManifest(answers.targetDir, buildManifest(answers, CLI_VERSION, detectPackageManager()));
    p.log.step("Created .omnicraft/project.json");

    spinner.start("Initializing git repository...");
    const gitOkNative = gitInit(answers.targetDir);
    spinner.stop(
      gitOkNative ? "Git repository initialized" : "Git not available — skipped git init",
    );

    if (!args.skipInstall && mobile) {
      const shouldInstall = unwrap(
        await p.confirm({
          message:
            "Install Expo dependencies with npm now? (Expo SDK + Expo Router — this can take a couple of minutes)",
          initialValue: true,
        }),
      );
      if (shouldInstall) {
        p.log.step("Installing dependencies with npm — live output below");
        const ok = await installDependencies(answers.targetDir, "npm");
        if (ok) p.log.success("Dependencies installed");
        else p.log.warn('Install failed — run "npm install" inside the project');
      } else {
        p.log.step('Skipped — run "npm install" when ready');
      }
    }
    if (!mobile) {
      p.log.info("Dependencies were installed by create-tauri-app (npm)");
    }

    p.note(
      mobile
        ? `cd ${answers.projectName}\nnpx expo start              # press a (Android) / i (iOS)\n# pair with a backend: see OMNICRAFT.md`
        : `cd ${answers.projectName}\ncargo --version            # Rust is required to build the shell\nnpm run tauri dev          # desktop app with hot reload\n# pair with a backend: see OMNICRAFT.md`,
      "Next steps",
    );
    p.outro("Crafted! Happy building ⚡");
    return;
  }

  try {
    const spinner = p.spinner();
    const layers = composeLayers(answers);
    const variables = templateVariables(answers);
    const integrated = answers.architecture.kind === "integrated-fullstack";
    const integratedLaravel = answers.architecture.kind === "integrated-laravel";
    const layerPlan = planLayerApplication(layers, answers.architecture);

    if (
      integratedLaravel &&
      answers.architecture.kind === "integrated-laravel" &&
      answers.architecture.mode === "inertia-react"
    ) {
      if (answers.authentication !== "none" && answers.authentication !== "laravel-native") {
        throw new Error(
          "Laravel Inertia React accepts only None or Laravel native authentication.",
        );
      }
      spinner.start(
        "Creating the Laravel Inertia React app from its pinned official starter kit...",
      );
      mkdirSync(answers.targetDir, { recursive: true });
      const starterKit = LARAVEL_INERTIA_REACT_STARTER_KITS[answers.authentication];
      const starterCreated = runCommand(
        "composer",
        [
          "create-project",
          starterKit,
          "server",
          "--stability=dev",
          "--no-install",
          "--no-scripts",
          "--no-interaction",
          "--prefer-dist",
          "--no-progress",
        ],
        answers.targetDir,
        64 * 1024 * 1024,
      );
      if (!starterCreated.ok) {
        spinner.stop("Laravel Inertia React starter retrieval failed");
        throw new Error(
          `Could not retrieve the pinned Laravel Inertia React starter kit — check PHP, Composer, and your connection.\n${starterCreated.output.split("\n").slice(-10).join("\n")}`,
        );
      }
      applyLayers(templatesRoot, layerPlan.afterOfficialGenerator, variables, answers.targetDir);
      const serverDir = join(answers.targetDir, "server");
      const sqliteFile = join(serverDir, "database", "database.sqlite");
      if (!existsSync(join(serverDir, ".env"))) {
        copyFileSync(join(serverDir, ".env.example"), join(serverDir, ".env"));
      }
      if (!existsSync(sqliteFile)) writeFileSync(sqliteFile, "");

      spinner.stop("Laravel Inertia React starter retrieved");
      const installerEnv = {
        ...process.env,
        LARAVEL_INSTALLER_DEFER_HOOKS: "true",
        LARAVEL_INSTALLER_NO_NODE: "true",
      };
      p.log.step("Installing PHP dependencies with Composer — live output below");
      const composerInstalled = await runCommandVisible(
        "composer",
        ["install", "--no-interaction", "--prefer-dist", "--no-progress"],
        serverDir,
        { env: installerEnv },
      );
      if (!composerInstalled) {
        throw new Error(
          "composer install failed — check the output above, then verify PHP 8.3+ and Composer.",
        );
      }

      const migrationEnv = createLaravelSqliteMigrationEnv(process.env, sqliteFile);
      for (const [label, commandArgs] of [
        ["Generate Laravel application key", ["artisan", "key:generate", "--force"]],
        ...(answers.authentication === "laravel-native"
          ? [
              [
                "Apply official Laravel starter features",
                ["artisan", "install:features", "--answers={}", "--no-interaction"],
              ] as const,
            ]
          : []),
        ["Apply the initial SQLite migrations", ["artisan", "migrate", "--force"]],
      ] as const) {
        const result = runCommand("php", [...commandArgs], serverDir, { env: migrationEnv });
        if (!result.ok) {
          spinner.stop(`${label} failed`);
          throw new Error(`${label} failed.\n${result.output.split("\n").slice(-10).join("\n")}`);
        }
      }
      spinner.stop("Laravel Inertia React application created and configured");
    } else if (integratedLaravel) {
      if (answers.authentication !== "none" && answers.authentication !== "laravel-native") {
        throw new Error("Laravel Livewire accepts only None or Laravel native authentication.");
      }
      spinner.start("Creating the Laravel Livewire app from its pinned official starter kit...");
      mkdirSync(answers.targetDir, { recursive: true });
      const starterKit = LARAVEL_LIVEWIRE_STARTER_KITS[answers.authentication];
      const cloned = runCommand(
        "npx",
        ["--yes", TIGED_PACKAGE, starterKit, "server"],
        answers.targetDir,
        64 * 1024 * 1024,
      );
      if (!cloned.ok) {
        spinner.stop("Laravel Livewire starter retrieval failed");
        throw new Error(
          `Could not retrieve the pinned Laravel Livewire starter kit — check your connection and Node.js.\n${cloned.output.split("\n").slice(-10).join("\n")}`,
        );
      }
      applyLayers(templatesRoot, layerPlan.afterOfficialGenerator, variables, answers.targetDir);
      const serverDir = join(answers.targetDir, "server");
      const sqliteFile = join(serverDir, "database", "database.sqlite");
      copyFileSync(join(serverDir, ".env.example"), join(serverDir, ".env"));
      if (!existsSync(sqliteFile)) writeFileSync(sqliteFile, "");

      spinner.stop("Laravel Livewire starter retrieved");
      if (existsSync(join(serverDir, "rename_livewire_files.php"))) {
        const renamed = runCommand("php", ["rename_livewire_files.php"], serverDir);
        if (!renamed.ok) {
          throw new Error(
            `Laravel Livewire file setup failed.\n${renamed.output.split("\n").slice(-10).join("\n")}`,
          );
        }
      }
      const installerEnv = {
        ...process.env,
        LARAVEL_INSTALLER_DEFER_HOOKS: "true",
        LARAVEL_INSTALLER_NO_NODE: "true",
      };
      p.log.step("Installing PHP dependencies with Composer — live output below");
      const composerInstalled = await runCommandVisible(
        "composer",
        ["install", "--no-interaction", "--prefer-dist", "--no-progress"],
        serverDir,
        { env: installerEnv },
      );
      if (!composerInstalled) {
        throw new Error(
          "composer install failed — check the output above, then verify PHP 8.3+ and Composer.",
        );
      }
      if (answers.authentication === "laravel-native") {
        p.log.step("Applying official Laravel starter features with their defaults");
        const featuresInstalled = await runCommandVisible(
          "php",
          ["artisan", "install:features", "--answers={}", "--no-interaction"],
          serverDir,
          { env: installerEnv },
        );
        if (!featuresInstalled) {
          throw new Error("Laravel starter feature setup failed — check the output above.");
        }
      }
      spinner.start("Preparing Laravel application key and SQLite migrations...");
      const migrationEnv = createLaravelSqliteMigrationEnv(process.env, sqliteFile);
      for (const [label, commandArgs] of [
        ["Generate Laravel application key", ["artisan", "key:generate", "--force"]],
        ["Apply the initial SQLite migrations", ["artisan", "migrate", "--force"]],
      ] as const) {
        const result = runCommand(
          "php",
          [...commandArgs],
          serverDir,
          label === "Apply the initial SQLite migrations" ? { env: migrationEnv } : undefined,
        );
        if (!result.ok) {
          spinner.stop(`${label} failed`);
          throw new Error(`${label} failed.\n${result.output.split("\n").slice(-10).join("\n")}`);
        }
      }
      spinner.stop("Laravel Livewire application created and configured");
    } else if (integrated) {
      // Next.js is created by the pinned create-next-app (the overlay can
      // only be applied onto an existing skeleton). Non-interactive flags
      // mirror our defaults: TS, App Router, Tailwind, @/ alias, npm, no install.
      spinner.start(
        "Creating the Next.js application with create-next-app (this can take a couple of minutes)...",
      );
      const cna = runCommand(
        "npx",
        [
          "--yes",
          CNA_PACKAGE,
          answers.projectName,
          "--ts",
          "--app",
          "--tailwind",
          "--no-src-dir",
          "--eslint",
          "--import-alias",
          "@/*",
          "--use-npm",
          "--skip-install",
          "--yes",
        ],
        // create-next-app refuses to write into an existing non-empty dir —
        // scaffold into the (fresh) target and move the app up.
        dirname(answers.targetDir),
        64 * 1024 * 1024,
      );
      if (!cna.ok) {
        spinner.stop("create-next-app failed");
        throw new Error(
          `create-next-app failed — see the output above. You can retry manually:\n  npx ${CNA_PACKAGE} ${answers.projectName} --ts --app --tailwind --no-src-dir --import-alias @/\\* --use-npm --skip-install --yes`,
        );
      }
      const created = join(dirname(answers.targetDir), answers.projectName);
      if (created !== answers.targetDir && !existsSync(answers.targetDir)) {
        // cna created <parent>/<name>; move it to the requested target when
        // they differ (nested/renamed target paths).
        renameSync(created, answers.targetDir);
      }
      applyLayers(templatesRoot, layerPlan.afterOfficialGenerator, variables, answers.targetDir);
      spinner.stop("Next.js application created and configured");
    } else {
      spinner.start("Crafting your project...");
      mkdirSync(answers.targetDir, { recursive: true });
      applyLayers(templatesRoot, layerPlan.beforeComposer, variables, answers.targetDir);
      spinner.stop("Project generated");
    }

    // Laravel is created by Composer itself (the overlay can only be applied
    // onto an existing skeleton), then configured by OmniCraft.
    if (layerPlan.afterComposer.length > 0) {
      spinner.start(
        "Creating the Laravel application with Composer (this can take a couple of minutes)...",
      );
      const starterSqliteFile = join(answers.targetDir, "server", "database", "database.sqlite");
      const composer = runCommand(
        "composer",
        [
          "create-project",
          "laravel/laravel:^12.0",
          "server",
          "--no-interaction",
          "--prefer-dist",
          "--no-progress",
        ],
        answers.targetDir,
        {
          maxBuffer: 64 * 1024 * 1024,
          env: createLaravelSqliteMigrationEnv(process.env, starterSqliteFile),
        },
      );
      if (!composer.ok) {
        spinner.stop("Composer failed");
        throw new Error(
          `composer create-project failed — is Composer installed?\n${composer.output.split("\n").slice(-10).join("\n")}`,
        );
      }
      applyLayers(templatesRoot, layerPlan.afterComposer, variables, answers.targetDir);
      const serverDir = join(answers.targetDir, "server");
      if (answers.database === "sqlite" && answers.architecture.kind === "separate-frontend-api") {
        // laravel/laravel runs its stock migrations during create-project.
        // The generated project uses OmniCraft's migration overlay, so start
        // from an empty SQLite file instead of retaining the starter schema.
        writeFileSync(join(serverDir, "database", "database.sqlite"), "");
      }
      copyFileSync(join(serverDir, ".env.example"), join(serverDir, ".env"));
      if (
        answers.authentication === "laravel-native" &&
        answers.architecture.kind === "separate-frontend-api"
      ) {
        p.log.step(
          "Installing Laravel Sanctum for first-party SPA sessions — no token scaffolding",
        );
        const sanctumInstalled = await runCommandVisible(
          "composer",
          ["require", "laravel/sanctum:4.3.3", "--no-interaction", "--no-progress"],
          serverDir,
        );
        if (!sanctumInstalled) {
          throw new Error(
            "Could not install the pinned Laravel Sanctum dependency — check PHP and Composer.",
          );
        }
      }
      const keyGenerated = runCommand("php", ["artisan", "key:generate", "--force"], serverDir);
      if (!keyGenerated.ok) {
        throw new Error(
          `Laravel application key generation failed.\n${keyGenerated.output.split("\n").slice(-10).join("\n")}`,
        );
      }
      spinner.stop("Laravel application created and configured");
    }

    const envFiles = createEnvFiles(answers.targetDir);
    for (const file of envFiles)
      p.log.step(
        `Created ${file.replace(answers.targetDir + "\\", "").replace(answers.targetDir + "/", "")}`,
      );

    // Project manifest — enables omnicraft add stack detection.
    const { buildManifest } = await import("./manifest.js");
    const { saveManifest } = await import("./add.js");
    const manifest = buildManifest(answers, CLI_VERSION, detectPackageManager());
    saveManifest(
      answers.targetDir,
      answers.authentication === "better-auth" ? { ...manifest, authentication: "none" } : manifest,
    );
    p.log.step("Created .omnicraft/project.json");

    if (answers.authentication === "better-auth") {
      const result = applyModuleToProject("auth", answers.targetDir, { recordModule: false });
      if (result.status !== "applied") {
        const details = result.status === "rejected" ? ` ${result.message}` : "";
        throw new Error(`Could not configure Better Auth during project creation.${details}`);
      }
      p.log.step("Configured Better Auth");
    }

    spinner.start("Initializing git repository...");
    const gitOk = gitInit(answers.targetDir);
    spinner.stop(gitOk ? "Git repository initialized" : "Git not available — skipped git init");

    const pm = detectPackageManager();
    if (!args.skipInstall) {
      if (answers.backendRuntime === "python") {
        const shouldSync = unwrap(
          await p.confirm({
            message: "Set up the Python environment with uv now?",
            initialValue: true,
          }),
        );
        if (shouldSync) {
          spinner.start("Syncing Python dependencies with uv (this can take a minute)...");
          const res = runCommand("uv", ["sync"], join(answers.targetDir, "server"));
          if (res.ok) {
            spinner.stop("Python environment ready");
          } else {
            spinner.stop("uv sync failed");
            p.log.warn('Is uv installed? Run: pip install uv — then "uv sync" inside server/');
          }
        } else {
          p.log.step('Skipped — run "uv sync" inside server/ when ready');
        }
      } else if (
        integratedLaravel &&
        answers.architecture.kind === "integrated-laravel" &&
        answers.architecture.mode === "inertia-react"
      ) {
        const shouldInstall =
          !args.skipInstall &&
          (args.yes
            ? true
            : unwrap(
                await p.confirm({
                  message:
                    "Install Inertia React/Vite frontend dependencies with npm and build assets now?",
                  initialValue: true,
                }),
              ));
        if (shouldInstall) {
          const serverDir = join(answers.targetDir, "server");
          p.log.step("Installing Inertia React frontend dependencies with npm — live output below");
          const installed = await installDependencies(serverDir, "npm");
          if (!installed) {
            p.log.warn(
              'npm install failed — run "npm install" inside server/ and then "npm run build"',
            );
          } else {
            p.log.success("Inertia React dependencies installed");
            const built = await runCommandVisible("npm", ["run", "build"], serverDir);
            if (built) p.log.success("Inertia React assets built");
            else p.log.warn('Asset build failed — run "npm run build" inside server/ when ready');
          }
        } else {
          p.log.step('Skipped — run "npm install" and "npm run build" inside server/ when ready');
        }
      } else if (integratedLaravel) {
        const shouldInstall =
          !args.skipInstall &&
          (args.yes
            ? true
            : unwrap(
                await p.confirm({
                  message:
                    "Install Livewire/Vite frontend dependencies with npm and build assets now?",
                  initialValue: true,
                }),
              ));
        if (shouldInstall) {
          const serverDir = join(answers.targetDir, "server");
          p.log.step("Installing Livewire frontend dependencies with npm — live output below");
          const installed = await installDependencies(serverDir, "npm");
          if (!installed) {
            p.log.warn(
              'npm install failed — run "npm install" inside server/ and then "npm run build"',
            );
          } else {
            p.log.success("Frontend dependencies installed");
            const built = await runCommandVisible("npm", ["run", "build"], serverDir);
            if (built) p.log.success("Livewire assets built");
            else p.log.warn('Asset build failed — run "npm run build" inside server/ when ready');
          }
        } else {
          p.log.step('Skipped — run "npm install" and "npm run build" inside server/ when ready');
        }
      } else if (
        answers.backendRuntime === "php" &&
        answers.authentication === "laravel-native" &&
        answers.architecture.kind === "separate-frontend-api"
      ) {
        const shouldInstall = args.yes
          ? true
          : unwrap(
              await p.confirm({
                message: "Install and build the React/Vite API client dependencies now?",
                initialValue: true,
              }),
            );
        if (shouldInstall) {
          p.log.step("Installing React/Vite API client dependencies with npm — live output below");
          const installed = await installDependencies(answers.targetDir, "npm");
          if (!installed) {
            p.log.warn(
              'npm install failed — run "npm install" at the project root, then "npm run build"',
            );
          } else {
            const built = await runCommandVisible("npm", ["run", "build"], answers.targetDir);
            if (built) p.log.success("React/Vite API client dependencies installed and built");
            else
              p.log.warn(
                'Client build failed — run "npm run build" at the project root when ready',
              );
          }
        } else {
          p.log.step(
            'Skipped — run "npm install" and "npm run build" at the project root when ready',
          );
        }
      } else if (answers.backendRuntime === "php") {
        p.log.step("PHP dependencies already installed by Composer");
      } else {
        const shouldInstall = unwrap(
          await p.confirm({
            message: `Install dependencies with ${pm} now?`,
            initialValue: true,
          }),
        );
        if (shouldInstall) {
          p.log.step(
            `Installing dependencies with ${pm} — live output below (this can take a minute)`,
          );
          const ok = await installDependencies(answers.targetDir, pm);
          if (ok) {
            p.log.success(`Dependencies installed with ${pm}`);
          } else {
            p.log.warn(
              `Install failed — check the output above, then run "${pm} install" inside the project`,
            );
          }

          // shadcn/ui: components are pulled from the registry by the pinned
          // shadcn CLI (an official-generator adapter, like Laravel/Composer).
          // The client must be installed first — the CLI writes into it and
          // installs component deps itself.
          if (answers.extras.shadcn && ok) {
            const clientDir = answers.fullStack
              ? join(answers.targetDir, "client")
              : answers.targetDir;
            spinner.start("Setting up shadcn/ui (init + components — this can take a minute)...");
            const init = runCommand(
              "npx",
              [
                "--yes",
                "shadcn@latest",
                "init",
                "--base",
                SHADCN_BASE,
                "--preset",
                SHADCN_PRESET,
                "--no-monorepo",
                "--force",
              ],
              clientDir,
            );
            const add =
              init.ok &&
              runCommand(
                "npx",
                ["--yes", "shadcn@latest", "add", ...SHADCN_COMPONENTS, "--yes", "--overwrite"],
                clientDir,
              ).ok;
            if (init.ok && add) {
              // The shadcn CLI emits its own formatting — normalize to the
              // project's prettier config so the lint gates stay clean.
              runCommand("npx", ["--yes", "prettier@latest", "--write", "."], clientDir);
              spinner.stop(`shadcn/ui ready (${SHADCN_PRESET}: ${SHADCN_COMPONENTS.join(", ")})`);
            } else {
              spinner.stop("shadcn setup failed");
              p.log.warn(
                `Run manually inside ${answers.fullStack ? "client/" : "the project"}:\n  npx shadcn@latest init --base ${SHADCN_BASE} --preset ${SHADCN_PRESET} --no-monorepo --force\n  npx shadcn@latest add ${SHADCN_COMPONENTS.join(" ")}`,
              );
            }
          }
        } else {
          p.log.step(`Skipped install — run "${pm} install" when ready`);
        }
      }
    }

    printNextSteps(answers, pm);
    p.outro("Crafted! Happy building ⚡");
  } catch (err) {
    if (err instanceof CancelledError) {
      p.cancel(err.message);
      return;
    }
    p.cancel("Something went wrong while scaffolding.");
    if (args.debug) {
      console.error(err);
    } else {
      p.log.error(`${(err as Error).message} (re-run with --debug for the stack trace)`);
    }
    process.exitCode = 1;
  }
}

main().catch((err) => {
  if (err instanceof CancelledError) {
    p.cancel(err.message);
    return;
  }
  console.error(err);
  process.exitCode = 1;
});
