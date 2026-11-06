import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ENV_IGNORE_ENTRY = ".env";

/**
 * Keeps generated Expo/Tauri root gitignores intact while ensuring local env
 * files are not committed. The bare entry deliberately leaves `.env.example`
 * visible to version control.
 */
export function ensureEnvIgnored(targetDir: string): void {
  const gitignorePath = join(targetDir, ".gitignore");
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, `${ENV_IGNORE_ENTRY}\n`);
    return;
  }

  const content = readFileSync(gitignorePath, "utf8");
  if (content.split(/\r?\n/).some((line) => line.trim() === ENV_IGNORE_ENTRY)) return;

  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const separator = content.length > 0 && !content.endsWith("\n") ? newline : "";
  appendFileSync(gitignorePath, `${separator}${ENV_IGNORE_ENTRY}${newline}`);
}
