/**
 * Keeps the one-time Laravel Livewire migration on the SQLite file created for
 * the new project, even when the caller has database overrides in their shell.
 */
export function createLaravelSqliteMigrationEnv(
  sourceEnv: NodeJS.ProcessEnv,
  sqliteFile: string,
): NodeJS.ProcessEnv {
  const env = { ...sourceEnv };
  for (const name of Object.keys(env)) {
    if (name.toUpperCase().startsWith("DB_")) delete env[name];
  }
  return { ...env, DB_CONNECTION: "sqlite", DB_DATABASE: sqliteFile };
}
