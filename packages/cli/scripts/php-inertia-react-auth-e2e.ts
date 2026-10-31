import assert from "node:assert/strict";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { integrationScenarios } from "../src/support-evidence.js";
import type { AuthenticationSetup } from "../src/types.js";
import { runCommand } from "../src/exec.js";

const COMMAND_TIMEOUT_MS = 15 * 60 * 1000;
const AUTHENTICATION_SETUPS = integrationScenarios(
  "php-laravel-inertia-react-auth",
) as readonly AuthenticationSetup[];

function runRequired(
  label: string,
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const result = runCommand(command, args, cwd, {
    env,
    timeoutMs: COMMAND_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (!result.ok) {
    throw new Error(
      `${label} failed (exit ${result.exitCode ?? "unknown"}):\n${result.output.slice(-16_000)}`,
    );
  }
  return result.output;
}

function isolatedTestEnv(databasePath: string): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of [
    "DB_URL",
    "DB_CONNECTION",
    "DB_DATABASE",
    "DB_HOST",
    "DB_PORT",
    "DB_USERNAME",
    "DB_PASSWORD",
  ]) {
    delete env[key];
  }
  return {
    ...env,
    APP_ENV: "testing",
    DB_CONNECTION: "sqlite",
    DB_DATABASE: databasePath,
    CACHE_STORE: "array",
    MAIL_MAILER: "array",
    SESSION_DRIVER: "array",
  };
}

interface LaravelRoute {
  uri: string;
  name: string | null;
  middleware: string[];
}

function routeList(serverDir: string): LaravelRoute[] {
  const output = runRequired(
    "List generated Laravel routes",
    "php",
    ["artisan", "route:list", "--json"],
    serverDir,
  );
  return JSON.parse(output) as LaravelRoute[];
}

function generateProject(
  cliPath: string,
  tempRoot: string,
  setup: AuthenticationSetup,
  env: NodeJS.ProcessEnv,
): string {
  const projectName = `inertia-${setup}`;
  const output = runRequired(
    `Generate Laravel Inertia React project with ${setup} auth`,
    "node",
    [
      cliPath,
      "--yes",
      "--frontend",
      "inertia-react",
      "--db",
      "sqlite",
      "--auth",
      setup,
      projectName,
    ],
    tempRoot,
    env,
  );
  assert(
    output.includes("Laravel Inertia React"),
    "The production CLI should report the integrated Inertia React mode.",
  );
  assert(
    output.includes("Inertia React assets built"),
    "The production CLI should build the generated Inertia React app.",
  );

  const projectRoot = join(tempRoot, projectName);
  const serverDir = join(projectRoot, "server");
  const manifest = JSON.parse(
    readFileSync(join(projectRoot, ".omnicraft", "project.json"), "utf8"),
  ) as {
    authentication: string;
    modules: string[];
    stack: {
      architecture: { kind: string; mode?: string };
      frontend: string;
      backendRuntime: string;
      backendFramework: string;
      database: string;
      orm: null;
    };
  };
  assert.equal(manifest.authentication, setup);
  assert.deepEqual(
    manifest.modules,
    [],
    "Authentication must remain separate from manifest.modules.",
  );
  assert.deepEqual(manifest.stack, {
    platform: "web",
    frontend: "inertia-react",
    architecture: { kind: "integrated-laravel", framework: "laravel", mode: "inertia-react" },
    backendRuntime: "php",
    backendFramework: "laravel",
    orm: null,
    database: "sqlite",
    extras: [],
  });
  assert(existsSync(join(serverDir, ".env")));
  assert(existsSync(join(serverDir, "resources", "js", "app.tsx")));
  assert(existsSync(join(serverDir, "database", "database.sqlite")));
  assert(
    existsSync(join(serverDir, "node_modules")),
    "The default --yes flow should install frontend dependencies.",
  );
  assert(
    !existsSync(join(projectRoot, "client")),
    "Inertia React must remain one integrated Laravel app.",
  );

  const composer = JSON.parse(readFileSync(join(serverDir, "composer.json"), "utf8")) as {
    require: Record<string, string>;
  };
  assert.equal(
    "laravel/fortify" in composer.require,
    setup === "laravel-native",
    "Only Laravel native auth should include Fortify.",
  );

  const routes = routeList(serverDir);
  const routeNames = new Set(routes.flatMap((route) => (route.name ? [route.name] : [])));
  assert.equal(routeNames.has("login"), setup === "laravel-native");
  assert.equal(routeNames.has("register"), setup === "laravel-native");
  assert.equal(routeNames.has("dashboard"), setup === "laravel-native");
  for (const route of routes.filter(({ uri }) => /^api\/users(?:\/|$)/.test(uri))) {
    const protectedByAuth = route.middleware.some((middleware) =>
      middleware.toLowerCase().startsWith("auth"),
    );
    assert.equal(
      protectedByAuth,
      setup === "laravel-native",
      "/api/users must stay public for None and require authentication when the sample resource exists.",
    );
  }

  return projectRoot;
}

function assertIncompatibleChoiceRejectsBeforeWrites(cliPath: string, tempRoot: string): void {
  const incompatibleFlags = [
    ["postgres", ["--db", "postgres"]],
    ["mysql", ["--db", "mysql"]],
    ["better-auth", ["--auth", "better-auth"]],
    ["javascript", ["--lang", "javascript"]],
    ["no-full-stack", ["--no-full-stack"]],
    ["extras", ["--extras", "tailwind"]],
    ["orm", ["--orm", "none"]],
    ["node-runtime", ["--runtime", "node"]],
  ] as const;

  for (const [caseName, extraFlags] of incompatibleFlags) {
    const projectName = `incompatible-inertia-${caseName}`;
    const targetDir = join(tempRoot, projectName);
    const result = runCommand(
      "node",
      [cliPath, "--yes", "--frontend", "inertia-react", ...extraFlags, projectName],
      tempRoot,
      { timeoutMs: COMMAND_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
    );
    assert(
      !result.ok,
      `The incompatible Laravel Inertia React flags ${extraFlags.join(" ")} unexpectedly passed preflight.`,
    );
    assert(
      !existsSync(targetDir),
      `The incompatible ${caseName} choice wrote project files before rejection.`,
    );
  }
}

function runProjectChecks(projectRoot: string, setup: AuthenticationSetup): void {
  const serverDir = join(projectRoot, "server");
  const databasePath = join(serverDir, "database", "database.sqlite").replaceAll("\\", "/");
  const env = isolatedTestEnv(databasePath);
  const fixtureName =
    setup === "none"
      ? "OmniCraftInertiaReactNoneAuthTest.php"
      : "OmniCraftInertiaReactNativeAuthTest.php";
  const fixture = fileURLToPath(new URL(`../tests/php/${fixtureName}`, import.meta.url));
  const featureTests = join(serverDir, "tests", "Feature");
  mkdirSync(featureTests, { recursive: true });
  copyFileSync(fixture, join(featureTests, fixtureName));

  assert(
    statSync(join(serverDir, "database", "database.sqlite")).size > 0,
    "SQLite migrations did not write the database file.",
  );
  runRequired(
    "Verify generated Laravel migrations",
    "php",
    ["artisan", "migrate:status", "--no-ansi"],
    serverDir,
    env,
  );
  runRequired(
    "Typecheck generated Inertia React project",
    "npm",
    ["run", "types:check"],
    serverDir,
  );
  runRequired("Build generated Inertia React assets", "npm", ["run", "build"], serverDir);
  runRequired(
    "Run generated Laravel auth and SQLite feature tests",
    "php",
    ["artisan", "test", "--no-ansi"],
    serverDir,
    env,
  );
}

function assertOwnedTempDirectory(tempRoot: string): void {
  const tempBase = resolve(tmpdir());
  const absoluteRoot = resolve(tempRoot);
  const relativeRoot = relative(tempBase, absoluteRoot);
  assert(
    !isAbsolute(relativeRoot) && relativeRoot !== ".." && !relativeRoot.startsWith(`..${sep}`),
  );
  assert(basename(absoluteRoot).startsWith("omnicraft-laravel-inertia-react-auth-"));
}

function main(): void {
  const cliPath = resolve(fileURLToPath(new URL("../dist/index.js", import.meta.url)));
  assert(
    existsSync(cliPath),
    "Build the CLI with `npx tsup` before running Laravel Inertia React integration checks.",
  );

  const tempRoot = resolve(mkdtempSync(join(tmpdir(), "omnicraft-laravel-inertia-react-auth-")));
  assertOwnedTempDirectory(tempRoot);
  let failure: unknown;
  try {
    assertIncompatibleChoiceRejectsBeforeWrites(cliPath, tempRoot);
    for (const setup of AUTHENTICATION_SETUPS) {
      console.log(`[laravel-inertia-react:${setup}] generating through the production CLI`);
      const callerDatabase = join(tempRoot, `caller-${setup}.sqlite`);
      writeFileSync(callerDatabase, "");
      const callerEnv = {
        ...process.env,
        DB_CONNECTION: "sqlite",
        DB_DATABASE: callerDatabase,
      };
      const projectRoot = generateProject(cliPath, tempRoot, setup, callerEnv);
      assert.equal(
        statSync(callerDatabase).size,
        0,
        "Initial Laravel migrations must not modify the caller-selected database.",
      );
      runProjectChecks(projectRoot, setup);
      console.log(
        `[laravel-inertia-react:${setup}] generation, SQLite, assets, and auth checks passed`,
      );
    }
  } catch (error) {
    failure = error;
  } finally {
    try {
      assertOwnedTempDirectory(tempRoot);
      rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
    } catch (cleanupError) {
      failure = failure
        ? new AggregateError(
            [failure, cleanupError],
            "Inertia React integration failed and temp cleanup failed.",
          )
        : cleanupError;
    }
  }

  if (failure) throw failure;
}

main();
