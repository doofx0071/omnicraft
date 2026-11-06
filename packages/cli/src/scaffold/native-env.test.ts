import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCommand } from "../exec.js";
import { ensureEnvIgnored } from "./native-env.js";

const gitAvailable = runCommand("git", ["--version"], process.cwd(), {
  timeoutMs: 5_000,
  maxBuffer: 1024 * 1024,
}).ok;

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function makeTargetDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "omnicraft-native-env-"));
  tempDirs.push(dir);
  return dir;
}

describe("ensureEnvIgnored", () => {
  it("preserves generated gitignore content and adds only a bare .env rule once", () => {
    const targetDir = makeTargetDir();
    const gitignorePath = join(targetDir, ".gitignore");
    const generated = "# official generator sentinel\nnode_modules/\n";
    writeFileSync(gitignorePath, generated);

    ensureEnvIgnored(targetDir);

    const firstResult = readFileSync(gitignorePath, "utf8");
    const lines = firstResult.split(/\r?\n/);
    expect(firstResult.startsWith(generated)).toBe(true);
    expect(lines.filter((line) => line === ".env")).toHaveLength(1);
    expect(lines).not.toContain(".env.example");

    ensureEnvIgnored(targetDir);
    expect(readFileSync(gitignorePath, "utf8")).toBe(firstResult);
  });

  it("does not duplicate an existing bare .env rule", () => {
    const targetDir = makeTargetDir();
    const gitignorePath = join(targetDir, ".gitignore");
    const generated = "# official generator sentinel\n.env\n";
    writeFileSync(gitignorePath, generated);

    ensureEnvIgnored(targetDir);

    expect(readFileSync(gitignorePath, "utf8")).toBe(generated);
  });

  it("creates a root gitignore when the official generator omitted one", () => {
    const targetDir = makeTargetDir();

    ensureEnvIgnored(targetDir);

    expect(readFileSync(join(targetDir, ".gitignore"), "utf8")).toBe(".env\n");
  });

  it.skipIf(!gitAvailable)("ignores .env but does not ignore .env.example", () => {
    const targetDir = makeTargetDir();
    const gitInit = runCommand("git", ["-c", "core.excludesFile=", "init", "--quiet"], targetDir, {
      timeoutMs: 5_000,
      maxBuffer: 1024 * 1024,
    });
    expect(gitInit.ok).toBe(true);

    ensureEnvIgnored(targetDir);
    writeFileSync(join(targetDir, ".env"), "SECRET=local-only\n");
    writeFileSync(join(targetDir, ".env.example"), "SECRET=placeholder\n");

    const localEnv = runCommand("git", ["check-ignore", "-q", "--", ".env"], targetDir, {
      timeoutMs: 5_000,
      maxBuffer: 1024 * 1024,
    });
    const exampleEnv = runCommand("git", ["check-ignore", "-q", "--", ".env.example"], targetDir, {
      timeoutMs: 5_000,
      maxBuffer: 1024 * 1024,
    });

    expect(localEnv.ok).toBe(true);
    expect(exampleEnv.ok).toBe(false);
    expect(exampleEnv.exitCode).toBe(1);
  });
});
