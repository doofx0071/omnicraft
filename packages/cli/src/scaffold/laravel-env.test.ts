import { describe, expect, it } from "vitest";
import { createLaravelSqliteMigrationEnv } from "./laravel-env.js";

describe("createLaravelSqliteMigrationEnv", () => {
  it("replaces caller database settings with the generated SQLite file", () => {
    const sourceEnv: NodeJS.ProcessEnv = {
      PATH: "tools",
      APP_ENV: "production",
      DB_CONNECTION: "mysql",
      DB_DATABASE: "unrelated",
      DB_URL: "mysql://user:pass@host/unrelated",
      DB_HOST: "host",
      db_username: "lowercase-user",
    };

    const env = createLaravelSqliteMigrationEnv(sourceEnv, "generated/database.sqlite");

    expect(
      Object.fromEntries(
        Object.entries(env).filter(([name]) => name.toUpperCase().startsWith("DB_")),
      ),
    ).toEqual({ DB_CONNECTION: "sqlite", DB_DATABASE: "generated/database.sqlite" });
    expect(env).toMatchObject({ PATH: "tools", APP_ENV: "production" });
    expect(sourceEnv).toMatchObject({ DB_CONNECTION: "mysql", DB_DATABASE: "unrelated" });
  });
});
