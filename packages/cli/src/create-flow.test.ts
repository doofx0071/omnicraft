import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { runCommand } from "./exec.js";

/**
 * Drives the real CLI entry as a piped-stdin (non-TTY) subprocess, so any
 * prompt that survives `--yes` — an ungated install confirm, an unanswered
 * question — fails the run instead of hanging forever (audit A3). The
 * subprocess runs from a temp cwd: project names are slugified and resolved
 * against the cwd, and the generated tree must never land in the repo.
 */
const CLI_ENTRY = fileURLToPath(new URL("./index.ts", import.meta.url));
const requireFromHere = createRequire(import.meta.url);
const TSX_CLI = join(dirname(requireFromHere.resolve("tsx/package.json")), "dist", "cli.mjs");

describe("create flow in non-TTY mode", () => {
  const tempDirs: string[] = [];
  function makeOutDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "omnicraft-create-flow-"));
    tempDirs.push(dir);
    return dir;
  }

  afterAll(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  });

  it(
    "scaffolds a frontend-only project with --yes --skip-install without prompting",
    () => {
      const outDir = makeOutDir();
      const result = runCommand(
        "node",
        [TSX_CLI, CLI_ENTRY, "yes-flow-app", "--yes", "--skip-install", "--no-full-stack"],
        outDir,
        { timeoutMs: 90_000, env: { ...process.env, NO_UPDATE_NOTIFIER: "1" } },
      );

      expect(result.exitCode).toBe(0);
      expect(result.output).not.toContain("Something went wrong");
      const target = join(outDir, "yes-flow-app");
      expect(existsSync(join(target, "package.json"))).toBe(true);
      expect(existsSync(join(target, "src", "App.tsx"))).toBe(true);
      expect(existsSync(join(target, ".omnicraft", "project.json"))).toBe(true);
    },
    120_000,
  );

  it(
    "configures Better Auth with an environment placeholder, persisted state, and next steps",
    () => {
      const outDir = makeOutDir();
      const result = runCommand(
        "node",
        [
          TSX_CLI,
          CLI_ENTRY,
          "better-auth-flow-app",
          "--yes",
          "--skip-install",
          "--auth",
          "better-auth",
        ],
        outDir,
        { timeoutMs: 90_000, env: { ...process.env, NO_UPDATE_NOTIFIER: "1" } },
      );

      expect(result.exitCode).toBe(0);
      const target = join(outDir, "better-auth-flow-app");
      const manifest = JSON.parse(
        readFileSync(join(target, ".omnicraft", "project.json"), "utf8"),
      ) as { authentication: string; modules: string[] };
      expect(manifest.authentication).toBe("better-auth");
      expect(manifest.modules).toEqual([]);
      const serverEnv = readFileSync(join(target, "server", ".env"), "utf8");
      const serverEnvExample = readFileSync(join(target, "server", ".env.example"), "utf8");
      expect(serverEnv).toBe(serverEnvExample);
      expect(serverEnv).toContain("BETTER_AUTH_SECRET=");
      expect(result.output).toContain("BETTER_AUTH_SECRET=<a long random string>");
      expect(result.output).toContain("npm run db:push");
    },
    120_000,
  );

  it(
    "refuses a bare interactive `add` without a TTY instead of hanging",
    () => {
      const result = runCommand("node", [TSX_CLI, CLI_ENTRY, "add"], process.cwd(), {
        timeoutMs: 60_000,
        env: { ...process.env, NO_UPDATE_NOTIFIER: "1" },
      });

      expect(result.exitCode).toBe(1);
      expect(result.output).toContain("needs a real terminal");
    },
    90_000,
  );
});
