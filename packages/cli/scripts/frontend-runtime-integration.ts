import assert from "node:assert/strict";
import { createServer } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { runCommand, startCommand, type StartedCommand } from "../src/exec.js";
import { saveManifest } from "../src/add.js";
import { CLI_VERSION, TEMPLATES_ROOT } from "../src/config.js";
import { buildManifest } from "../src/manifest.js";
import { createEnvFiles } from "../src/scaffold/env.js";
import { applyLayers } from "../src/scaffold/engine.js";
import { composeLayers, templateVariables } from "../src/scaffold/compose.js";
import type { Answers } from "../src/types.js";

const CHILD_TIMEOUT_MS = 10 * 60 * 1000;
const HTTP_TIMEOUT_MS = 10_000;
const SECRETS = Object.entries(process.env)
  .filter(([key, value]) => /(TOKEN|PASSWORD|SECRET|API_KEY|AUTH)/i.test(key) && Boolean(value))
  .map(([, value]) => value as string);

function redact(value: string): string {
  return SECRETS.reduce(
    (result, secret) => (secret.length < 5 ? result : result.replaceAll(secret, "[REDACTED]")),
    value,
  );
}

function isolatedEnvironment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of ["DATABASE_URL", "PORT", "NODE_ENV", "HOSTNAME"]) delete env[key];
  return { ...env, ...overrides };
}

function tail(value: string, length = 12_000): string {
  return value.length > length ? value.slice(-length) : value;
}

function runRequired(label: string, command: string, args: string[], cwd: string): string {
  console.log(`[integration] ${label}`);
  const result = runCommand(command, args, cwd, {
    env: isolatedEnvironment({ CI: "1" }),
    timeoutMs: CHILD_TIMEOUT_MS,
    maxBuffer: 32 * 1024 * 1024,
  });
  console.log(`[integration] command completed: ${label} (exit ${result.exitCode ?? "unknown"})`);
  const output = redact(result.output);
  if (!result.ok)
    throw new Error(`${label} failed (exit ${result.exitCode ?? "unknown"}):\n${tail(output)}`);
  return output;
}

function makeAnswers(projectRoot: string): Answers {
  return {
    projectName: "omnicraft-react-js-frontend-test",
    targetDir: projectRoot,
    projectType: "web",
    frontend: "react",
    language: "javascript",
    fullStack: false,
    backendRuntime: null,
    backendFramework: null,
    orm: null,
    database: null,
    authentication: 'none',
    extras: { tailwind: false, eslintPrettier: false, shadcn: false },
    architecture: { kind: "frontend-only" },
  };
}

function scaffold(projectRoot: string): void {
  const answers = makeAnswers(projectRoot);
  applyLayers(TEMPLATES_ROOT, composeLayers(answers), templateVariables(answers), projectRoot);
  createEnvFiles(projectRoot);
  saveManifest(projectRoot, buildManifest(answers, CLI_VERSION, "npm"));
}

async function reservePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(
    address && typeof address === "object",
    "The operating system did not assign an app port.",
  );
  const { port } = address;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

async function waitForApp(origin: string, child: StartedCommand): Promise<string> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const exited = await Promise.race([child.exited, delay(0).then(() => null)]);
    if (exited)
      throw new Error(
        `Generated Vite app exited before responding:\n${tail(redact(exited.output))}`,
      );
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return await response.text();
    } catch {
      // Poll until Vite starts or the bounded startup deadline expires.
    }
    await delay(250);
  }
  throw new Error(`Generated Vite app did not become ready:\n${tail(redact(child.output))}`);
}

async function runScenario(): Promise<void> {
  const projectRoot = mkdtempSync(join(tmpdir(), "omnicraft-react-js-frontend-"));
  let child: StartedCommand | undefined;
  let failure: unknown;

  try {
    console.log(
      "[frontend:react-js-frontend-only] preparing generated project from production layers",
    );
    scaffold(projectRoot);
    runRequired(
      "Install generated dependencies",
      "npm",
      ["install", "--no-audit", "--no-fund"],
      projectRoot,
    );
    runRequired("Build generated React/Vite app", "npm", ["run", "build"], projectRoot);

    const port = await reservePort();
    const origin = `http://127.0.0.1:${port}`;
    child = await startCommand(
      "npm",
      ["run", "preview", "--", "--host", "127.0.0.1", "--port", `${port}`, "--strictPort"],
      projectRoot,
      { env: isolatedEnvironment({ CI: "1" }) },
    );

    const page = await waitForApp(origin, child);
    assert(
      page.includes('<div id="root"></div>'),
      "The generated React page did not render its mount point.",
    );
    const assetPath = /<script[^>]+src="([^"]+\.js)"/.exec(page)?.[1];
    assert(assetPath, "The generated React page did not reference a built JavaScript entry.");

    const entry = await fetch(new URL(assetPath, origin), {
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    assert.equal(
      entry.status,
      200,
      "The generated React JavaScript bundle did not load from Vite preview.",
    );
    assert(
      (await entry.text()).includes("createRoot"),
      "The generated JavaScript bundle did not include React mounting code.",
    );

    const missingAsset = await fetch(`${origin}/assets/__omnicraft_missing_asset__.js`, {
      headers: { accept: "application/javascript" },
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    assert.equal(
      missingAsset.status,
      404,
      "A missing built JavaScript asset should return HTTP 404.",
    );
    console.log(
      "[frontend:react-js-frontend-only] build, preview boot, bundle, and missing-asset checks passed",
    );
    console.log(
      "[frontend:react-js-frontend-only] database operation is not applicable to frontend-only architecture",
    );
  } catch (error) {
    const childOutput = child ? tail(redact(child.output)) : "";
    failure = new Error(
      `[frontend:react-js-frontend-only] failed\n${error instanceof Error ? error.message : String(error)}${childOutput ? `\n\nGenerated Vite output:\n${childOutput}` : ""}`,
      { cause: error },
    );
  } finally {
    try {
      if (child) await child.stop();
    } finally {
      rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
      console.log("[frontend:react-js-frontend-only] isolated project resources cleaned");
    }
  }

  if (failure) throw failure;
}

runScenario().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});
