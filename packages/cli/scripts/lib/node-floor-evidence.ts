/**
 * Exact-minimum Node floor evidence for the generated `engines.node` claims.
 *
 * The generated root variants declare per-composition floors (Node 20.19,
 * 22.14, 22.18) derived from the pinned dependency graph. The hosted runtime
 * jobs all run on the latest Node of their major, so nothing proves the
 * generated apps actually install/build on the declared minimums. This script
 * scaffolds the floor-governed operation for each family through the BUILT
 * CLI on the exact floor line and fails if the runner resolved anything else:
 *
 *   node20-postgres — Express + raw SQL + PostgreSQL: install, client Vite
 *     build (the vite@8 floor that dominates ^20.19.0), typechecks, migrate,
 *     boot, and CRUD against a caller-provided PostgreSQL (DATABASE_URL).
 *   node22-sqlite — Express + raw SQL + SQLite: install (better-sqlite3 >=22
 *     build), client Vite build, typechecks, migrate, boot, CRUD.
 *   node22-laravel — Laravel 13 + Livewire (the pinned starters' vite-plus
 *     ^22.18 floor): production CLI scaffold with Composer/npm installs and
 *     an explicit, fatal Vite asset build.
 *
 * Supplementary evidence: no Supported matrix row registers these jobs.
 *
 * Run (after `npx tsup`):
 *   npx tsx scripts/lib/node-floor-evidence.ts --scenario node20-postgres
 *   npx tsx scripts/lib/node-floor-evidence.ts --scenario node22-sqlite
 *   npx tsx scripts/lib/node-floor-evidence.ts --scenario node22-laravel
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { runCommand, startCommand, type StartedCommand } from "../../src/exec.js";

const CLI_DIST = resolve(dirname(fileURLToPath(import.meta.url)), "../../dist/index.js");
const CHILD_TIMEOUT_MS = 15 * 60 * 1000;
const HTTP_TIMEOUT_MS = 15_000;
const HEALTH_DEADLINE_MS = 90_000;

type Scenario = "node20-postgres" | "node22-sqlite" | "node22-laravel";

const FLOOR_PREFIXES: Record<Scenario, string> = {
  "node20-postgres": "v20.19.",
  "node22-sqlite": "v22.14.",
  "node22-laravel": "v22.18.",
};

function runRequired(label: string, command: string, args: string[], cwd: string): string {
  const result = runCommand(command, args, cwd, {
    timeoutMs: CHILD_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (!result.ok) {
    throw new Error(
      `${label} failed (exit ${result.exitCode ?? "unknown"}):\n${result.output.slice(-16_000)}`,
    );
  }
  return result.output;
}

async function reservePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolvePromise());
  });
  const address = server.address();
  assert(
    address && typeof address === "object",
    "The operating system did not assign an app port.",
  );
  const { port } = address;
  await new Promise<void>((resolvePromise, reject) => {
    server.close((error) => (error ? reject(error) : resolvePromise()));
  });
  return port;
}

async function waitForHealth(origin: string, child: StartedCommand): Promise<void> {
  const deadline = Date.now() + HEALTH_DEADLINE_MS;
  while (Date.now() < deadline) {
    const exited = await Promise.race([child.exited, delay(0).then(() => null)]);
    if (exited) {
      throw new Error(
        `Generated API exited before the health check:\n${child.output.slice(-12_000)}`,
      );
    }
    try {
      const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // Poll until the API starts or the bounded startup deadline expires.
    }
    await delay(500);
  }
  throw new Error(`Generated API did not become healthy:\n${child.output.slice(-12_000)}`);
}

async function verifyCrud(origin: string): Promise<void> {
  const email = `floor-evidence-${Date.now()}@example.test`;
  const base = `${origin}/api/users`;
  const post = (body: Record<string, string>) =>
    fetch(base, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });

  const initial = await fetch(base, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
  assert.equal(initial.status, 200);
  assert.deepEqual(await initial.json(), []);

  const created = await post({ name: "Floor Evidence Check", email });
  assert.equal(created.status, 201, "Valid user creation failed.");
  const user = (await created.json()) as { id: number; email: string };
  assert.equal(user.email, email);
  const id = Number(user.id);
  assert(Number.isInteger(id) && id > 0, "The API did not return a persisted user id.");

  const listed = await fetch(base, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
  assert(
    ((await listed.json()) as unknown[]).some(
      (item) => (item as { email: string }).email === email,
    ),
    "The created database row was not returned by the list endpoint.",
  );

  const duplicate = await post({ name: "Duplicate User", email });
  assert.equal(duplicate.status, 409, "Duplicate email should return HTTP 409.");

  const invalid = await post({ name: "", email: "not-an-email" });
  assert.equal(invalid.status, 400, "Invalid input should return HTTP 400.");

  const deleted = await fetch(`${base}/${id}`, {
    method: "DELETE",
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  assert.equal(deleted.status, 200);
  const missing = await fetch(`${base}/${id}`, {
    method: "DELETE",
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  assert.equal(missing.status, 404, "Deleting a missing row should return HTTP 404.");
}

function scaffold(scratch: string, projectName: string, flags: string[]): string {
  console.log(`[floor] scaffolding ${flags.join(" ")} through the built CLI`);
  runRequired(
    "Scaffold the generated project",
    "node",
    [CLI_DIST, "--yes", ...flags, projectName],
    scratch,
  );
  const projectRoot = join(scratch, projectName);
  assert(existsSync(projectRoot), "The CLI did not create the project directory.");
  assert(
    existsSync(join(projectRoot, ".omnicraft", "project.json")),
    "The CLI must write the .omnicraft/project.json manifest.",
  );
  return projectRoot;
}

function buildClientVite(projectRoot: string): void {
  // The floor-relevant operation: the generated Vite client must BUILD on the
  // floor line, not merely typecheck.
  runRequired(
    "Build the generated client with Vite",
    "npm",
    ["run", "build", "--workspace=client"],
    projectRoot,
  );
}

async function runWebApiFloor(scenario: Exclude<Scenario, "node22-laravel">): Promise<void> {
  assert(
    process.env.DATABASE_URL,
    "DATABASE_URL must point at a reachable database service for this scenario.",
  );
  const dbFlags =
    scenario === "node20-postgres"
      ? ["--runtime", "node", "--backend", "express", "--orm", "none", "--db", "postgres"]
      : ["--runtime", "node", "--backend", "express", "--orm", "none", "--db", "sqlite"];
  const scratch = mkdtempSync(join(tmpdir(), `omnicraft-${scenario}-floor-`));
  let child: StartedCommand | undefined;
  let failure: unknown;
  try {
    const projectRoot = scaffold(scratch, "omnicraft-floor-check", dbFlags);
    assert(
      existsSync(join(projectRoot, "server", ".env")),
      "The CLI must create server/.env from .env.example.",
    );

    console.log("[floor] installing, building, typechecking, and migrating the generated project");
    runRequired(
      "Install generated dependencies",
      "npm",
      ["install", "--no-audit", "--no-fund"],
      projectRoot,
    );
    buildClientVite(projectRoot);
    runRequired(
      "Typecheck generated client",
      "npx",
      ["tsc", "--noEmit", "-p", "client"],
      projectRoot,
    );
    runRequired("Typecheck generated API", "npx", ["tsc", "--noEmit", "-p", "server"], projectRoot);
    runRequired(
      "Apply generated migrations",
      "npm",
      ["run", "db:migrate", "--workspace=server"],
      projectRoot,
    );

    const port = await reservePort();
    const origin = `http://127.0.0.1:${port}`;
    console.log(`[floor] booting the generated API on ${origin}`);
    child = startCommand("npm", ["run", "dev", "--workspace=server"], projectRoot, {
      env: { ...process.env, NODE_ENV: "test", PORT: `${port}`, CORS_ORIGIN: origin },
    });
    await waitForHealth(origin, child);
    await verifyCrud(origin);
    console.log(
      "[floor] install, client build, migrate, boot, and CRUD passed on",
      process.version,
    );
  } catch (error) {
    failure = error;
  } finally {
    try {
      if (child) await child.stop();
    } finally {
      rmSync(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
    }
  }
  if (failure) throw failure;
}

function runLaravelFloor(): void {
  const scratch = mkdtempSync(join(tmpdir(), "omnicraft-node22-laravel-floor-"));
  try {
    // No --skip-install: the floor claim covers the starter's Composer and npm
    // installs on the 22.18 line. The CLI's own asset build is advisory, so
    // the script repeats it as a required step below.
    const projectRoot = scaffold(scratch, "omnicraft-floor-livewire", ["--frontend", "livewire"]);
    const serverDir = join(projectRoot, "server");
    assert(existsSync(join(serverDir, ".env")), "The CLI must create server/.env.");
    assert(
      existsSync(join(serverDir, "database", "database.sqlite")),
      "The CLI must prepare SQLite.",
    );
    assert(
      existsSync(join(serverDir, "node_modules")),
      "The Livewire starter npm install must have run.",
    );

    console.log("[floor] building the Livewire/Vite assets as a required step");
    runRequired("Build the Livewire Vite assets", "npm", ["run", "build"], serverDir);
    const buildDir = join(serverDir, "public", "build");
    assert(
      existsSync(buildDir) && readdirSync(buildDir).length > 0,
      "The vite-plus asset build produced no output under server/public/build.",
    );
    console.log(
      "[floor] Composer/npm installs and the Vite asset build passed on",
      process.version,
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
  }
}

async function main(): Promise<void> {
  const scenarioArg = process.argv.indexOf("--scenario");
  const scenario = scenarioArg >= 0 ? (process.argv[scenarioArg + 1] as Scenario) : undefined;
  assert(
    scenario && scenario in FLOOR_PREFIXES,
    "Pass --scenario node20-postgres | node22-sqlite | node22-laravel.",
  );
  assert(
    existsSync(CLI_DIST),
    `The built CLI is missing at ${CLI_DIST}. Run "npx tsup" in packages/cli first.`,
  );
  // The entire point of this evidence: refuse to run on anything but the
  // exact floor line, so a runner bump cannot silently void the claim.
  assert(
    process.version.startsWith(FLOOR_PREFIXES[scenario]),
    `Scenario ${scenario} must run on Node ${FLOOR_PREFIXES[scenario]}x; the runner resolved ${process.version}.`,
  );

  if (scenario === "node22-laravel") {
    runLaravelFloor();
  } else {
    await runWebApiFloor(scenario);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
