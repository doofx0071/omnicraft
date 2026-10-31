import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { runCommand, startCommand, type StartedCommand } from "../src/exec.js";
import { integrationScenarios } from "../src/support-evidence.js";
import type { AuthenticationSetup } from "../src/types.js";

const COMMAND_TIMEOUT_MS = 15 * 60 * 1000;
const SPA_ORIGIN = "http://127.0.0.1:5173";
const AUTHENTICATION_SETUPS = integrationScenarios(
  "php-laravel-sanctum-spa-auth",
) as readonly AuthenticationSetup[];

interface GeneratedManifest {
  authentication: string;
  modules: string[];
  stack: {
    architecture: { kind: string };
    backendFramework: string;
    backendRuntime: string;
    database: string;
    extras: string[];
    frontend: string;
    orm: null;
    platform: string;
  };
}

interface ApiUser {
  id: number;
  name: string;
  email: string;
  owner_id?: number;
}

type CookieJar = Map<string, string>;

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
      label +
        " failed (exit " +
        (result.exitCode ?? "unknown") +
        "):\n" +
        result.output.slice(-16_000),
    );
  }
  return result.output;
}

function generateProject(
  cliPath: string,
  tempRoot: string,
  projectName: string,
  flags: string[],
  expectedInstall: boolean,
): string {
  const output = runRequired(
    "Generate " + projectName + " through the production CLI",
    "node",
    [cliPath, "--yes", ...flags, projectName],
    tempRoot,
  );
  assert.equal(
    output.includes("Installing React/Vite API client dependencies"),
    expectedInstall,
    "The generated CLI path should honor its install mode.",
  );
  const projectRoot = join(tempRoot, projectName);
  assert(
    existsSync(projectRoot),
    "The production CLI did not create the expected project directory.",
  );
  assert(
    existsSync(join(projectRoot, "server", "artisan")),
    "The generated Laravel application is missing.",
  );
  return projectRoot;
}

function assertRejectedBeforeWrites(cliPath: string, tempRoot: string): void {
  const cases = [
    {
      name: "sanctum-postgres",
      flags: ["--frontend", "react", "--auth", "laravel-native", "--db", "postgres"],
    },
    {
      name: "sanctum-mysql",
      flags: ["--frontend", "react", "--auth", "laravel-native", "--db", "mysql"],
    },
    {
      name: "sanctum-javascript",
      flags: ["--frontend", "react", "--lang", "javascript", "--auth", "laravel-native"],
    },
    {
      name: "sanctum-no-full-stack",
      flags: ["--frontend", "react", "--no-full-stack", "--auth", "laravel-native"],
    },
    {
      name: "sanctum-node-runtime",
      flags: ["--frontend", "react", "--runtime", "node", "--auth", "laravel-native"],
    },
    {
      name: "sanctum-supabase-auth",
      flags: [
        "--frontend",
        "react",
        "--runtime",
        "php",
        "--backend",
        "laravel",
        "--db",
        "sqlite",
        "--auth",
        "supabase-auth",
      ],
    },
    {
      name: "sanctum-unavailable-managed-provider",
      flags: [
        "--frontend",
        "react",
        "--runtime",
        "php",
        "--backend",
        "laravel",
        "--auth",
        "workos",
      ],
    },
  ];

  for (const testCase of cases) {
    const target = join(tempRoot, testCase.name);
    const result = runCommand(
      "node",
      [cliPath, "--yes", ...testCase.flags, testCase.name],
      tempRoot,
      { timeoutMs: COMMAND_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
    );
    assert(!result.ok, testCase.name + " unexpectedly passed compatibility checks.");
    assert(
      !existsSync(target),
      testCase.name + " wrote files before rejecting the incompatible choice.",
    );
  }
}

function assertNativeManifest(projectRoot: string): void {
  const manifest = JSON.parse(
    readFileSync(join(projectRoot, ".omnicraft", "project.json"), "utf8"),
  ) as GeneratedManifest;
  assert.equal(manifest.authentication, "laravel-native");
  assert.deepEqual(
    manifest.modules,
    [],
    "Authentication must remain separate from manifest.modules.",
  );
  assert.deepEqual(manifest.stack, {
    platform: "web",
    frontend: "react",
    architecture: { kind: "separate-frontend-api" },
    backendRuntime: "php",
    backendFramework: "laravel",
    orm: null,
    database: "sqlite",
    extras: ["tailwind", "eslintPrettier"],
  });
}

function assertNoneManifest(projectRoot: string): void {
  const manifest = JSON.parse(
    readFileSync(join(projectRoot, ".omnicraft", "project.json"), "utf8"),
  ) as GeneratedManifest;
  assert.equal(manifest.authentication, "none");
  assert.deepEqual(
    manifest.modules,
    [],
    "None mode must not add authentication to module history.",
  );
}

function assertSanctumSetup(projectRoot: string): void {
  const serverDir = join(projectRoot, "server");
  const composer = JSON.parse(readFileSync(join(serverDir, "composer.json"), "utf8")) as {
    require: Record<string, string>;
  };
  assert.equal(composer.require["laravel/sanctum"], "4.3.3");
  assert(
    !("laravel/fortify" in composer.require),
    "The API mode must not add a second native auth starter.",
  );

  const userModel = readFileSync(join(serverDir, "app", "Models", "User.php"), "utf8");
  assert(
    !userModel.includes("HasApiTokens"),
    "The SPA session mode must not add personal access tokens.",
  );
  const routes = readFileSync(join(serverDir, "routes", "api.php"), "utf8");
  assert(
    !routes.match(/personal.?access.?token|createToken/i),
    "The API must not expose personal token behavior.",
  );
  const cors = readFileSync(join(serverDir, "config", "cors.php"), "utf8");
  assert(
    cors.includes("'supports_credentials' => true"),
    "Sanctum SPA CORS must allow credentialed requests.",
  );
  assert(
    !cors.includes("'allowed_origins' => ['*']"),
    "Credentialed CORS must not use a wildcard origin.",
  );
  const environmentExample = readFileSync(join(serverDir, ".env.example"), "utf8");
  assert(
    environmentExample.includes("CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173"),
  );
  const migrationNames = readdirSync(join(serverDir, "database", "migrations"));
  assert(
    !migrationNames.some((name) => name.toLowerCase().includes("personal_access_tokens")),
    "The SPA session mode must not add a personal access token table.",
  );
}

function assertOwnedTempDirectory(tempRoot: string): void {
  const tempBase = resolve(tmpdir());
  const absoluteRoot = resolve(tempRoot);
  const relativeRoot = relative(tempBase, absoluteRoot);
  assert(
    !isAbsolute(relativeRoot) && relativeRoot !== ".." && !relativeRoot.startsWith(".." + sep),
  );
  assert(basename(absoluteRoot).startsWith("omnicraft-laravel-sanctum-auth-"));
}

function isolatedTestEnv(serverDir: string): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of [
    "DATABASE_URL",
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
    APP_DEBUG: "false",
    DB_CONNECTION: "sqlite",
    DB_DATABASE: join(serverDir, "database", "database.sqlite"),
    CACHE_STORE: "file",
    MAIL_MAILER: "array",
    SESSION_DRIVER: "file",
    SANCTUM_STATEFUL_DOMAINS: "localhost:5173,127.0.0.1:5173",
  };
}

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolveListen());
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose())),
  );
  return port;
}

async function wait(milliseconds: number): Promise<void> {
  await new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

async function startLaravel(
  serverDir: string,
): Promise<{ process: StartedCommand; baseUrl: string }> {
  const port = await availablePort();
  const process = startCommand(
    "php",
    ["artisan", "serve", "--host=127.0.0.1", "--port=" + port],
    serverDir,
    {
      env: isolatedTestEnv(serverDir),
      maxOutputBytes: 32 * 1024,
    },
  );
  const baseUrl = "http://127.0.0.1:" + port;
  for (let attempt = 0; attempt < 60; attempt++) {
    const exit = await Promise.race([
      process.exited.then((result) => result),
      wait(100).then(() => null),
    ]);
    if (exit) {
      throw new Error(
        "Generated Laravel server exited during startup:\n" + exit.output.slice(-4_000),
      );
    }
    try {
      const response = await fetch(baseUrl + "/up", { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return { process, baseUrl };
    } catch {
      // The local server has not bound its loopback port yet.
    }
    await wait(100);
  }
  const output = process.output;
  await process.stop();
  throw new Error("Generated Laravel server did not become ready:\n" + output.slice(-4_000));
}

function updateCookies(jar: CookieJar, response: Response): void {
  for (const cookie of response.headers.getSetCookie()) {
    const first = cookie.split(";", 1)[0];
    const separator = first.indexOf("=");
    if (separator < 1) continue;
    jar.set(first.slice(0, separator), first.slice(separator + 1));
  }
}

function cookieHeader(jar: CookieJar): string {
  return [...jar].map(([name, value]) => name + "=" + value).join("; ");
}

function csrfToken(jar: CookieJar): string {
  const value = jar.get("XSRF-TOKEN");
  assert(value, "The Sanctum CSRF endpoint did not set an XSRF-TOKEN cookie.");
  return decodeURIComponent(value);
}

async function apiRequest(
  baseUrl: string,
  jar: CookieJar,
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    csrf?: boolean;
  } = {},
): Promise<{ status: number; body: unknown; setCookies: string[] }> {
  const headers = new Headers({
    Accept: "application/json",
    Origin: SPA_ORIGIN,
    Referer: SPA_ORIGIN + "/",
  });
  const cookie = cookieHeader(jar);
  if (cookie) headers.set("Cookie", cookie);
  if (options.body) headers.set("Content-Type", "application/json");
  if (options.csrf) headers.set("X-XSRF-TOKEN", csrfToken(jar));

  const response = await fetch(baseUrl + path, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  const setCookies = response.headers.getSetCookie();
  updateCookies(jar, response);
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text.slice(0, 2_000);
    }
  }
  return { status: response.status, body, setCookies };
}

function assertStatus(
  response: { status: number; body: unknown },
  expected: number,
  label: string,
): void {
  assert.equal(
    response.status,
    expected,
    label + " returned " + response.status + ": " + JSON.stringify(response.body).slice(0, 2_000),
  );
}

function assertUser(value: unknown, label: string): asserts value is ApiUser {
  assert(value && typeof value === "object", label + " response must contain a JSON object.");
  const user = value as Partial<ApiUser>;
  assert.equal(typeof user.id, "number", label + " response must include an id.");
  assert.equal(typeof user.email, "string", label + " response must include an email.");
  assert(!("owner_id" in user), label + " response must not reveal owner_id.");
}

async function withLaravel(
  serverDir: string,
  run: (server: { process: StartedCommand; baseUrl: string }) => Promise<void>,
): Promise<void> {
  const server = await startLaravel(serverDir);
  try {
    await run(server);
  } finally {
    await server.process.stop();
  }
}

async function verifyPublicNoneApi(cliPath: string, tempRoot: string): Promise<void> {
  const projectRoot = generateProject(
    cliPath,
    tempRoot,
    "laravel-api-none",
    [
      "--skip-install",
      "--frontend",
      "react",
      "--runtime",
      "php",
      "--backend",
      "laravel",
      "--db",
      "sqlite",
      "--auth",
      "none",
    ],
    false,
  );
  const serverDir = join(projectRoot, "server");
  assertNoneManifest(projectRoot);
  const composer = JSON.parse(readFileSync(join(serverDir, "composer.json"), "utf8")) as {
    require: Record<string, string>;
  };
  assert(!("laravel/sanctum" in composer.require), "None mode must not install Sanctum.");
  assert(!("laravel/fortify" in composer.require), "None mode must not install Fortify.");
  const databaseFile = join(serverDir, "database", "database.sqlite");
  assert(existsSync(databaseFile), "The None-mode Laravel database file was not generated.");
  assert.equal(
    statSync(databaseFile).size,
    0,
    "The Laravel starter database must be reset so the selected OmniCraft migrations run from a clean schema.",
  );
  const env = isolatedTestEnv(serverDir);
  runRequired(
    "Migrate the Laravel None-mode SQLite project",
    "php",
    ["artisan", "migrate", "--force", "--no-ansi"],
    serverDir,
    env,
  );
  const routes = JSON.parse(
    runRequired(
      "List generated Laravel None-mode routes",
      "php",
      ["artisan", "route:list", "--json"],
      serverDir,
      env,
    ),
  ) as Array<{ uri: string }>;
  for (const uri of [
    "api/auth/register",
    "api/auth/login",
    "api/auth/logout",
    "api/me",
    "sanctum/csrf-cookie",
  ]) {
    assert(!routes.some((route) => route.uri === uri), "None mode must not add auth route: " + uri);
  }
  assert(
    statSync(databaseFile).size > 0,
    "The Laravel None-mode migration did not write its SQLite database.",
  );

  await withLaravel(serverDir, async ({ baseUrl }) => {
    const jar: CookieJar = new Map();
    const empty = await apiRequest(baseUrl, jar, "/api/users");
    assertStatus(empty, 200, "Anonymous None-mode user list");
    assert.deepEqual(empty.body, []);

    const created = await apiRequest(baseUrl, jar, "/api/users", {
      method: "POST",
      body: { name: "Public API sample", email: "public-api@example.test" },
    });
    assertStatus(created, 201, "Anonymous None-mode user creation");
    assertUser(created.body, "None-mode user creation");
    const record = created.body;
    const listed = await apiRequest(baseUrl, jar, "/api/users");
    assertStatus(listed, 200, "Anonymous None-mode user list after creation");
    assert.deepEqual(listed.body, [record]);

    assertStatus(
      await apiRequest(baseUrl, jar, "/api/users/" + record.id, { method: "DELETE" }),
      200,
      "Anonymous None-mode user deletion",
    );
  });
}

async function verifySanctumAuth(cliPath: string, tempRoot: string): Promise<void> {
  const projectRoot = generateProject(
    cliPath,
    tempRoot,
    "laravel-api-native-auth",
    [
      "--frontend",
      "react",
      "--runtime",
      "php",
      "--backend",
      "laravel",
      "--db",
      "sqlite",
      "--auth",
      "laravel-native",
    ],
    true,
  );
  assertNativeManifest(projectRoot);
  assertSanctumSetup(projectRoot);

  const serverDir = join(projectRoot, "server");
  const databaseFile = join(serverDir, "database", "database.sqlite");
  assert(existsSync(databaseFile), "The Sanctum-mode Laravel database file was not generated.");
  assert.equal(
    statSync(databaseFile).size,
    0,
    "The Laravel starter database must be reset before the Sanctum schema is migrated.",
  );
  const env = isolatedTestEnv(serverDir);
  runRequired(
    "Migrate the Laravel Sanctum SQLite project",
    "php",
    ["artisan", "migrate", "--force", "--no-ansi"],
    serverDir,
    env,
  );
  assert(
    statSync(databaseFile).size > 0,
    "The Laravel Sanctum migration did not write its SQLite database.",
  );

  const routesOutput = runRequired(
    "List generated Laravel Sanctum routes",
    "php",
    ["artisan", "route:list", "--json"],
    serverDir,
    env,
  );
  const routes = JSON.parse(routesOutput) as Array<{ uri: string; middleware: string[] }>;
  for (const uri of [
    "sanctum/csrf-cookie",
    "api/auth/register",
    "api/auth/login",
    "api/auth/logout",
    "api/me",
    "api/users",
  ]) {
    assert(
      routes.some((route) => route.uri === uri),
      "Generated Laravel Sanctum route missing: " + uri,
    );
  }
  for (const uri of ["api/auth/register", "api/auth/login"]) {
    const route = routes.find((candidate) => candidate.uri === uri);
    assert(route, "Generated Laravel Sanctum auth route missing: " + uri);
    assert(
      route.middleware.some((middleware) => middleware.includes("ThrottleRequests:10,15")),
      uri + " must keep the explicit sign-in rate limit; found: " + route.middleware.join(", "),
    );
  }

  const fixture = fileURLToPath(
    new URL("../tests/php/OmniCraftLaravelSanctumAuthTest.php", import.meta.url),
  );
  const featureTests = join(serverDir, "tests", "Feature");
  mkdirSync(featureTests, { recursive: true });
  copyFileSync(fixture, join(featureTests, "OmniCraftLaravelSanctumAuthTest.php"));
  runRequired(
    "Run generated Laravel auth feature tests",
    "php",
    ["artisan", "test", "--no-ansi"],
    serverDir,
    { ...env, CACHE_STORE: "array" },
  );

  const userSuffix = randomBytes(5).toString("hex");
  const accountA = {
    name: "Runtime Account A",
    email: "runtime-a-" + userSuffix + "@example.test",
    password: "RuntimeA-" + userSuffix + "-password",
  };
  const accountB = {
    name: "Runtime Account B",
    email: "runtime-b-" + userSuffix + "@example.test",
    password: "RuntimeB-" + userSuffix + "-password",
  };
  const jarA: CookieJar = new Map();
  const jarB: CookieJar = new Map();

  let live = await startLaravel(serverDir);
  try {
    const preflight = await fetch(live.baseUrl + "/api/auth/register", {
      method: "OPTIONS",
      headers: {
        Origin: SPA_ORIGIN,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,x-xsrf-token",
      },
      signal: AbortSignal.timeout(10_000),
    });
    assertStatus({ status: preflight.status, body: null }, 204, "Credentialed CORS preflight");
    assert.equal(preflight.headers.get("access-control-allow-origin"), SPA_ORIGIN);
    assert.equal(preflight.headers.get("access-control-allow-credentials"), "true");

    assertStatus(
      await apiRequest(live.baseUrl, jarA, "/api/me"),
      401,
      "Anonymous protected profile",
    );
    assertStatus(
      await apiRequest(live.baseUrl, jarA, "/api/users"),
      401,
      "Anonymous protected user list",
    );
    assertStatus(
      await apiRequest(live.baseUrl, jarA, "/sanctum/csrf-cookie"),
      204,
      "Sanctum CSRF bootstrap",
    );
    csrfToken(jarA);
    assertStatus(
      await apiRequest(live.baseUrl, jarA, "/api/auth/register", {
        method: "POST",
        body: { ...accountA, password_confirmation: accountA.password },
      }),
      419,
      "Registration without the XSRF header",
    );

    const registeredA = await apiRequest(live.baseUrl, jarA, "/api/auth/register", {
      method: "POST",
      csrf: true,
      body: { ...accountA, password_confirmation: accountA.password },
    });
    assertStatus(registeredA, 201, "Account A registration");
    assert(registeredA.body && typeof registeredA.body === "object");
    assert.equal((registeredA.body as { user?: { email?: string } }).user?.email, accountA.email);
    const sessionCookie = registeredA.setCookies.find((cookie) => /^[^=]+_session=/i.test(cookie));
    assert(sessionCookie, "Registration must return the Laravel session cookie.");
    assert(
      /(?:^|;)\s*httponly(?:;|$)/i.test(sessionCookie),
      "The session cookie must be HttpOnly.",
    );
    assert(
      /(?:^|;)\s*samesite=lax(?:;|$)/i.test(sessionCookie),
      "The session cookie must use SameSite=Lax.",
    );
    assert(
      !/(?:^|;)\s*secure(?:;|$)/i.test(sessionCookie),
      "Local HTTP session cookies must not require HTTPS.",
    );
    assertStatus(await apiRequest(live.baseUrl, jarA, "/api/me"), 200, "Account A session profile");

    await live.process.stop();
    live = await startLaravel(serverDir);
    assertStatus(
      await apiRequest(live.baseUrl, jarA, "/api/me"),
      200,
      "Account A session restored after server restart",
    );

    const createdA = await apiRequest(live.baseUrl, jarA, "/api/users", {
      method: "POST",
      csrf: true,
      body: { name: "Account A private sample", email: "sample-a-" + userSuffix + "@example.test" },
    });
    assertStatus(createdA, 201, "Account A private sample creation");
    assertUser(createdA.body, "Account A private sample creation");
    const recordA = createdA.body;

    assertStatus(
      await apiRequest(live.baseUrl, jarB, "/sanctum/csrf-cookie"),
      204,
      "Account B Sanctum CSRF bootstrap",
    );
    const registeredB = await apiRequest(live.baseUrl, jarB, "/api/auth/register", {
      method: "POST",
      csrf: true,
      body: { ...accountB, password_confirmation: accountB.password },
    });
    assertStatus(registeredB, 201, "Account B registration");

    const accountAUser = (registeredA.body as { user?: { id?: number } }).user;
    assert(accountAUser && typeof accountAUser.id === "number");
    const spoofedOwner = await apiRequest(live.baseUrl, jarB, "/api/users", {
      method: "POST",
      csrf: true,
      body: {
        name: "Account B scoped sample",
        email: "sample-b-" + userSuffix + "@example.test",
        owner_id: accountAUser.id,
      },
    });
    assertStatus(spoofedOwner, 201, "Account B creation with a spoofed owner id");
    assertUser(spoofedOwner.body, "Account B owner-scoped sample");
    const recordB = spoofedOwner.body;

    const listB = await apiRequest(live.baseUrl, jarB, "/api/users");
    assertStatus(listB, 200, "Account B private user list");
    assert.deepEqual(listB.body, [recordB], "Account B must see only its own records.");
    assertStatus(
      await apiRequest(live.baseUrl, jarB, "/api/users/" + recordA.id, {
        method: "DELETE",
        csrf: true,
      }),
      404,
      "Account B cross-account deletion attempt",
    );

    const listA = await apiRequest(live.baseUrl, jarA, "/api/users");
    assertStatus(listA, 200, "Account A private user list");
    assert.deepEqual(listA.body, [recordA], "Account A must retain access to its own record.");
    assertStatus(
      await apiRequest(live.baseUrl, jarA, "/api/users/" + recordA.id, {
        method: "DELETE",
        csrf: true,
      }),
      200,
      "Account A own-record deletion",
    );

    assertStatus(
      await apiRequest(live.baseUrl, jarA, "/api/auth/logout", { method: "POST", csrf: true }),
      200,
      "Account A sign-out",
    );
    assertStatus(
      await apiRequest(live.baseUrl, jarA, "/api/me"),
      401,
      "Account A session after sign-out",
    );
    assertStatus(
      await apiRequest(live.baseUrl, jarA, "/api/users"),
      401,
      "Account A protected route after sign-out",
    );

    const loginA = await apiRequest(live.baseUrl, jarA, "/api/auth/login", {
      method: "POST",
      csrf: true,
      body: { email: accountA.email, password: accountA.password },
    });
    assertStatus(loginA, 200, "Account A sign-in");
    assertStatus(
      await apiRequest(live.baseUrl, jarA, "/api/me"),
      200,
      "Account A authenticated after sign-in",
    );
    assertStatus(
      await apiRequest(live.baseUrl, jarB, "/api/auth/logout", { method: "POST", csrf: true }),
      200,
      "Account B sign-out",
    );
    assertStatus(
      await apiRequest(live.baseUrl, jarB, "/api/me"),
      401,
      "Account B session after sign-out",
    );

    runRequired(
      "Clear generated Laravel cache before the isolated rate-limit test",
      "php",
      ["artisan", "cache:clear", "--no-ansi"],
      serverDir,
      isolatedTestEnv(serverDir),
    );

    const failedLoginJar: CookieJar = new Map();
    assertStatus(
      await apiRequest(live.baseUrl, failedLoginJar, "/sanctum/csrf-cookie"),
      204,
      "Rate-limit test CSRF bootstrap",
    );
    for (let attempt = 0; attempt < 9; attempt += 1) {
      const failedLogin = await apiRequest(live.baseUrl, failedLoginJar, "/api/auth/login", {
        method: "POST",
        csrf: true,
        body: { email: "missing@example.test", password: "incorrect-password" },
      });
      assertStatus(failedLogin, 422, "Failed sign-in attempt " + (attempt + 1));
      assert(
        !JSON.stringify(failedLogin.body).includes('"exception"') &&
          !JSON.stringify(failedLogin.body).includes('"trace"'),
        "Authentication errors must not expose framework exception details.",
      );
    }
    assertStatus(
      await apiRequest(live.baseUrl, failedLoginJar, "/api/auth/login", {
        method: "POST",
        csrf: true,
        body: { email: accountA.email, password: accountA.password },
      }),
      200,
      "Tenth sign-in attempt remains available",
    );
    const rateLimitedLogin = await apiRequest(live.baseUrl, failedLoginJar, "/api/auth/login", {
      method: "POST",
      csrf: true,
      body: { email: "missing@example.test", password: "incorrect-password" },
    });
    assertStatus(rateLimitedLogin, 429, "Sign-in rate limit after ten attempts");
    assert(
      !JSON.stringify(rateLimitedLogin.body).includes('"exception"') &&
        !JSON.stringify(rateLimitedLogin.body).includes('"trace"'),
      "Rate-limit responses must not expose framework exception details.",
    );
  } finally {
    await live.process.stop();
  }
}

async function main(): Promise<void> {
  const cliPath = resolve(fileURLToPath(new URL("../dist/index.js", import.meta.url)));
  assert(
    existsSync(cliPath),
    'Build the CLI with "npx tsup" before running Laravel Sanctum integration checks.',
  );

  const tempRoot = resolve(mkdtempSync(join(tmpdir(), "omnicraft-laravel-sanctum-auth-")));
  assertOwnedTempDirectory(tempRoot);
  let failure: unknown;
  try {
    assertRejectedBeforeWrites(cliPath, tempRoot);
    assert.deepEqual(AUTHENTICATION_SETUPS, ["none", "laravel-native"]);
    await verifyPublicNoneApi(cliPath, tempRoot);
    await verifySanctumAuth(cliPath, tempRoot);
    console.log(
      "[laravel-api-sanctum] None and Sanctum generation, SQLite, CSRF, sessions, ownership, and sign-out passed",
    );
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
            "Laravel Sanctum integration failed and temp cleanup failed.",
          )
        : cleanupError;
    }
  }

  if (failure) throw failure;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(message);
  process.exitCode = 1;
});
