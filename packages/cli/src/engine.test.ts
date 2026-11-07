import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { afterAll, describe, expect, it } from "vitest";
// transitive dependency (vite/tsup) used here only to validate generated YAML
import { parse } from "yaml";
import { TEMPLATES_ROOT } from "./config.js";
import { buildManifest } from "./manifest.js";
import { createEnvFiles } from "./scaffold/env.js";
import { applyLayers } from "./scaffold/engine.js";
import { composeLayers, planLayerApplication, templateVariables } from "./scaffold/compose.js";
import type { Answers } from "./types.js";

function makeAnswers(overrides: Partial<Answers> = {}): Answers {
  const fullStack = overrides.fullStack ?? true;
  return {
    projectName: "demo-app",
    targetDir: ".",
    projectType: "web",
    frontend: "react",
    language: "typescript",
    fullStack,
    backendRuntime: fullStack ? "node" : null,
    backendFramework: fullStack ? "express" : null,
    orm: fullStack ? "drizzle" : null,
    database: fullStack ? "postgres" : null,
    authentication: "none",
    extras: { tailwind: true, eslintPrettier: true, shadcn: false },
    architecture: fullStack ? { kind: "separate-frontend-api" } : { kind: "frontend-only" },
    ...overrides,
  };
}

function makeLivewireAnswers(authentication: "none" | "laravel-native" = "none"): Answers {
  return makeAnswers({
    frontend: "livewire",
    language: null,
    fullStack: true,
    backendRuntime: "php",
    backendFramework: "laravel",
    orm: null,
    database: "sqlite",
    authentication,
    extras: { tailwind: false, eslintPrettier: false, shadcn: false },
    architecture: { kind: "integrated-laravel", framework: "laravel", mode: "livewire" },
  });
}

function makeInertiaReactAnswers(authentication: "none" | "laravel-native" = "none"): Answers {
  return makeAnswers({
    frontend: "inertia-react",
    language: "typescript",
    fullStack: true,
    backendRuntime: "php",
    backendFramework: "laravel",
    orm: null,
    database: "sqlite",
    authentication,
    extras: { tailwind: false, eslintPrettier: false, shadcn: false },
    architecture: { kind: "integrated-laravel", framework: "laravel", mode: "inertia-react" },
  });
}

function makeLaravelApiAuthAnswers(
  authentication: "none" | "laravel-native" = "laravel-native",
  database: "sqlite" | "postgres" | "mysql" = "sqlite",
): Answers {
  return makeAnswers({
    frontend: "react",
    language: "typescript",
    fullStack: true,
    backendRuntime: "php",
    backendFramework: "laravel",
    orm: null,
    database,
    authentication,
    extras: { tailwind: false, eslintPrettier: false, shadcn: false },
    architecture: { kind: "separate-frontend-api" },
  });
}

function scaffoldInto(dir: string, answers: Answers): void {
  applyLayers(TEMPLATES_ROOT, composeLayers(answers), templateVariables(answers), dir);
  createEnvFiles(dir);
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8"));
}

const tempDirs: string[] = [];
function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), `omnicraft-${prefix}-`));
  tempDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

describe("official-generator layer order", () => {
  it("applies every Next.js layer after create-next-app and skips Composer", () => {
    const answers = makeAnswers({
      frontend: "nextjs",
      backendRuntime: null,
      backendFramework: null,
      orm: "none",
      database: "sqlite",
      architecture: { kind: "integrated-fullstack", framework: "nextjs" },
    });
    const layers = composeLayers(answers);
    const plan = planLayerApplication(layers, answers.architecture);

    expect(plan.afterOfficialGenerator).toEqual(layers);
    expect(plan.afterOfficialGenerator.map(({ src }) => src)).toContain("web/nextjs/db-sqlite");
    expect(plan.afterOfficialGenerator.map(({ src }) => src)).toContain(
      "root/fullstack-next/sqlite",
    );
    expect(plan.beforeComposer).toEqual([]);
    expect(plan.afterComposer).toEqual([]);
  });

  it("applies the Laravel overlay after Composer and the other layers before it", () => {
    const answers = makeAnswers({
      backendRuntime: "php",
      backendFramework: "laravel",
      orm: null,
      database: "sqlite",
    });
    const layers = composeLayers(answers);
    const plan = planLayerApplication(layers, answers.architecture);

    expect(plan.afterOfficialGenerator).toEqual([]);
    expect(plan.beforeComposer.map(({ src }) => src)).toContain("web/react/client");
    expect(plan.beforeComposer.map(({ src }) => src)).toContain("root/fullstack-php/sqlite");
    expect(plan.afterComposer.map(({ src }) => src)).toEqual(["server/php/laravel"]);
  });

  it.each(["sqlite", "postgres", "mysql"] as const)(
    "applies the Laravel API auth overlay and database-specific README for %s",
    (database) => {
      const answers = makeLaravelApiAuthAnswers("laravel-native", database);
      const layers = composeLayers(answers);
      const plan = planLayerApplication(layers, answers.architecture);

      expect(plan.afterComposer.map(({ src }) => src)).toEqual([
        "server/php/laravel",
        "server/php/laravel-sanctum-spa",
      ]);
      expect(layers.map(({ src }) => src)).toContain(
        `root/fullstack-php/${database}-sanctum-spa-auth`,
      );
      expect(layers.map(({ src }) => src)).toContain("auth/laravel-sanctum-spa-react-vite");
      expect(layers.find(({ src }) => src === "auth/laravel-sanctum-spa-react-vite")?.dest).toBe(
        "client",
      );
    },
  );

  it("applies only OmniCraft root setup after the selected Livewire starter kit", () => {
    for (const authentication of ["none", "laravel-native"] as const) {
      const answers = makeLivewireAnswers(authentication);
      const layers = composeLayers(answers);
      const plan = planLayerApplication(layers, answers.architecture);

      expect(layers.map(({ src }) => src)).toEqual(["root/fullstack-laravel-livewire"]);
      expect(plan.afterOfficialGenerator).toEqual(layers);
      expect(plan.beforeComposer).toEqual([]);
      expect(plan.afterComposer).toEqual([]);
    }
  });

  it("applies only the integrated Inertia React root setup after the selected Laravel starter kit", () => {
    for (const authentication of ["none", "laravel-native"] as const) {
      const answers = makeInertiaReactAnswers(authentication);
      const layers = composeLayers(answers);
      const plan = planLayerApplication(layers, answers.architecture);

      expect(layers.map(({ src }) => src)).toEqual(["root/fullstack-laravel-inertia-react"]);
      expect(plan.afterOfficialGenerator).toEqual(layers);
      expect(plan.beforeComposer).toEqual([]);
      expect(plan.afterComposer).toEqual([]);
    }
  });
});

describe("composition compatibility", () => {
  it.each([
    [{ frontend: "vue", language: "javascript" }, /JavaScript is only available/],
    [{ backendFramework: "hono", orm: "prisma" }, /prisma is not available for hono/i],
    [
      { frontend: "vue", extras: { tailwind: true, eslintPrettier: true, shadcn: true } },
      /shadcn\/ui is only available/,
    ],
    [
      {
        frontend: "nextjs",
        backendRuntime: null,
        backendFramework: null,
        orm: "drizzle",
        architecture: { kind: "integrated-fullstack", framework: "nextjs" },
      },
      /Next\.js must use the integrated full-stack architecture/,
    ],
    [
      {
        frontend: "nextjs",
        backendRuntime: null,
        backendFramework: null,
        orm: "none",
        database: "mongodb",
        architecture: { kind: "integrated-fullstack", framework: "nextjs" },
      },
      /Next\.js must use the integrated full-stack architecture/,
    ],
    [
      {
        frontend: "nextjs",
        backendRuntime: null,
        backendFramework: null,
        orm: "none",
        extras: { tailwind: false, eslintPrettier: true, shadcn: false },
        architecture: { kind: "integrated-fullstack", framework: "nextjs" },
      },
      /Next\.js must use the integrated full-stack architecture/,
    ],
  ] as const)("rejects incompatible answers before returning layers", (overrides, message) => {
    expect(() => composeLayers(makeAnswers(overrides))).toThrow(message);
  });

  it("rejects Inertia React answers that do not match its integrated Laravel mode", () => {
    expect(() => composeLayers(makeInertiaReactAnswers("none"))).not.toThrow();
    expect(() =>
      composeLayers(
        makeAnswers({
          ...makeInertiaReactAnswers(),
          language: "javascript",
        }),
      ),
    ).toThrow(
      /Integrated Laravel Inertia React currently requires PHP \+ Laravel \+ SQLite \+ TypeScript/,
    );
    expect(() =>
      composeLayers(
        makeAnswers({
          ...makeInertiaReactAnswers(),
          architecture: { kind: "separate-frontend-api" },
        }),
      ),
    ).toThrow(/must use the integrated Laravel architecture/);
  });

  it("accepts Better Auth only on the existing Express + Drizzle composition", () => {
    const withoutAuth = composeLayers(makeAnswers());
    const withAuth = composeLayers(makeAnswers({ authentication: "better-auth" }));
    expect(withAuth).toEqual(withoutAuth);
    expect(() =>
      composeLayers(makeAnswers({ authentication: "better-auth", backendFramework: "fastify" })),
    ).toThrow(/Better Auth currently requires Node\.js \+ Express \+ Drizzle/);
    expect(() =>
      composeLayers(makeAnswers({ authentication: "better-auth", language: "javascript" })),
    ).toThrow(/Better Auth creation currently requires TypeScript/);
  });

  it("accepts the approved API databases and rejects an incompatible frontend", () => {
    for (const database of ["sqlite", "postgres", "mysql"] as const) {
      expect(() =>
        composeLayers(makeLaravelApiAuthAnswers("laravel-native", database)),
      ).not.toThrow();
    }
    expect(() => composeLayers(makeLaravelApiAuthAnswers("none"))).not.toThrow();
    expect(() =>
      composeLayers(
        makeAnswers({
          ...makeLaravelApiAuthAnswers(),
          frontend: "vue",
        }),
      ),
    ).toThrow(
      /Laravel native authentication currently requires integrated Livewire\/Inertia React or the React\/Vite Laravel API/,
    );
  });

  it.each(["sqlite", "postgres", "mysql"] as const)(
    "scaffolds the Laravel Sanctum SPA overlays and database-specific README for %s",
    (database) => {
      const dir = makeTempDir(`laravel-sanctum-spa-${database}`);
      scaffoldInto(dir, makeLaravelApiAuthAnswers("laravel-native", database));

      const apiRoutes = readFileSync(join(dir, "server/routes/api.php"), "utf8");
      const serverBootstrap = readFileSync(join(dir, "server/bootstrap/app.php"), "utf8");
      const controller = readFileSync(
        join(dir, "server/app/Http/Controllers/AuthController.php"),
        "utf8",
      );
      const userController = readFileSync(
        join(dir, "server/app/Http/Controllers/UserController.php"),
        "utf8",
      );
      const clientApi = readFileSync(join(dir, "client/src/lib/api.ts"), "utf8");
      const clientApp = readFileSync(join(dir, "client/src/App.tsx"), "utf8");
      const corsConfig = readFileSync(join(dir, "server/config/cors.php"), "utf8");
      const environmentExample = readFileSync(join(dir, "server/.env.example"), "utf8");
      const readme = readFileSync(join(dir, "README.md"), "utf8");

      expect(serverBootstrap).toContain("$middleware->statefulApi();");
      expect(apiRoutes).toContain("Route::middleware('auth:sanctum')");
      expect(apiRoutes).toContain("Route::post('/auth/register'");
      expect(apiRoutes).toContain("Route::post('/auth/login'");
      expect(apiRoutes).toContain("Route::post('/auth/logout'");
      expect(controller).toContain("$request->session()->regenerate();");
      expect(controller).toContain("$request->session()->invalidate();");
      expect(controller).toContain("Hash::make($validated['password'])");
      expect(userController).toContain("$request->user()->apiUsers()");
      // response-shape parity: Laravel serializes camelCase createdAt like
      // the node/fastapi users routes (contract rule 6)
      expect(userController).toContain("'createdAt' => $user->created_at?->toISOString()");
      expect(clientApi).toContain("createdAt: string;");
      expect(clientApi).not.toContain("created_at");
      expect(clientApi).toContain("X-XSRF-TOKEN");
      expect(clientApi).toContain('credentials: "include"');
      expect(clientApp).toContain("Sign out");
      // busy-state parity with the Supabase overlay: the shared helper comes
      // from the base React client and wraps every overlay action
      expect(readFileSync(join(dir, "client/src/lib/run-busy-action.ts"), "utf8")).toContain(
        "export async function runBusyAction",
      );
      expect(clientApp).toContain('from "./lib/run-busy-action"');
      expect(clientApp.match(/await runBusyAction\(/g)?.length).toBe(4);
      expect(corsConfig).toContain("'supports_credentials' => true");
      expect(corsConfig).toContain("'allowed_origins' => $allowedOrigins");
      expect(corsConfig).not.toContain("'allowed_origins' => ['*']");
      expect(environmentExample).toContain(
        "CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173",
      );
      expect(readme).toContain("does not issue personal access tokens");
      expect(readme).toContain("SANCTUM_STATEFUL_DOMAINS");
      expect(readme).toContain(
        database === "postgres" ? "PostgreSQL" : database === "mysql" ? "MySQL" : "SQLite",
      );
      expect(readme).toContain("session store remains file-based");
      expect(existsSync(join(dir, "client/README.md"))).toBe(false);
    },
  );

  it("scaffolds None without Better Auth files, dependencies, or secret placeholders", () => {
    const dir = makeTempDir("auth-none");
    scaffoldInto(dir, makeAnswers({ authentication: "none" }));

    const serverPackage = readJson(join(dir, "server/package.json"));
    const dependencies = serverPackage.dependencies as Record<string, unknown>;
    const serverIndex = readFileSync(join(dir, "server/src/index.ts"), "utf8");

    expect(existsSync(join(dir, "server/src/auth.ts"))).toBe(false);
    expect(existsSync(join(dir, "server/src/db/auth-schema.ts"))).toBe(false);
    expect(existsSync(join(dir, "client/src/lib/auth-client.ts"))).toBe(false);
    expect(dependencies["better-auth"]).toBeUndefined();
    expect(dependencies["@better-auth/drizzle-adapter"]).toBeUndefined();
    expect(serverIndex).not.toContain("/api/auth/");
    expect(readFileSync(join(dir, "server", ".env.example"), "utf8")).not.toContain(
      "BETTER_AUTH_SECRET=",
    );
    expect(readFileSync(join(dir, "server", ".env"), "utf8")).not.toContain(
      "BETTER_AUTH_SECRET=",
    );
  });

  it.each(["none", "laravel-native"] as const)(
    "scaffolds the Livewire root overlay for %s without a second auth/module layer",
    (authentication) => {
      const dir = makeTempDir(`livewire-${authentication}`);
      scaffoldInto(dir, makeLivewireAnswers(authentication));

      const packageJson = readJson(join(dir, "package.json"));
      const scripts = packageJson.scripts as Record<string, string>;
      const readme = readFileSync(join(dir, "README.md"), "utf8");
      const gitignore = readFileSync(join(dir, ".gitignore"), "utf8");

      expect(scripts.dev).toContain("composer run dev");
      expect(scripts["db:migrate"]).toContain("artisan migrate");
      expect(readme).toContain(
        authentication === "none"
          ? "Authentication | None"
          : "Authentication | Laravel native auth (Fortify)",
      );
      expect(gitignore).toContain("/server/vendor/");
      expect(existsSync(join(dir, "client"))).toBe(false);
      expect(existsSync(join(dir, "server"))).toBe(false);
      expect(readFileSync(join(dir, "README.md"), "utf8")).not.toContain("{{");
    },
  );

  it.each(["none", "laravel-native"] as const)(
    "scaffolds the integrated Inertia React root overlay for %s without a separate client or API layer",
    (authentication) => {
      const dir = makeTempDir(`inertia-react-${authentication}`);
      scaffoldInto(dir, makeInertiaReactAnswers(authentication));

      const packageJson = readJson(join(dir, "package.json"));
      const scripts = packageJson.scripts as Record<string, string>;
      const readme = readFileSync(join(dir, "README.md"), "utf8");
      const gitignore = readFileSync(join(dir, ".gitignore"), "utf8");

      expect(packageJson.name).toBe("demo-app");
      expect(scripts.dev).toContain("composer run dev");
      expect(scripts["db:migrate"]).toContain("artisan migrate");
      expect(readme).toContain("Laravel 13 + Inertia + React + TypeScript");
      expect(readme).toContain(
        authentication === "none"
          ? "Authentication | None"
          : "Authentication | Laravel native auth (Fortify)",
      );
      expect(readme).toContain("This scaffold configures no account");
      expect(readme).toContain("linking or managed providers.");
      expect(gitignore).toContain("/server/vendor/");
      expect(existsSync(join(dir, "client"))).toBe(false);
      expect(existsSync(join(dir, "server"))).toBe(false);
      expect(readme).not.toContain("{{");
    },
  );
});

describe("native platform environments", () => {
  it.each([
    {
      platform: "mobile",
      projectType: "mobile",
      variable: "EXPO_PUBLIC_API_URL",
    },
    {
      platform: "desktop",
      projectType: "desktop",
      variable: "VITE_API_URL",
    },
  ] as const)("copies the $variable example into .env", ({ platform, projectType, variable }) => {
    const dir = makeTempDir(`native-${platform}-env`);
    const answers: Answers = {
      projectName: `demo-${platform}`,
      targetDir: dir,
      projectType,
      frontend: "react",
      language: "typescript",
      fullStack: false,
      backendRuntime: null,
      backendFramework: null,
      orm: null,
      database: null,
      authentication: "none",
      extras: { tailwind: false, eslintPrettier: false, shadcn: false },
      architecture: { kind: "native-app", platform },
    };

    scaffoldInto(dir, answers);

    const example = readFileSync(join(dir, ".env.example"), "utf8");
    expect(example).toContain(`${variable}=`);
    expect(readFileSync(join(dir, ".env"), "utf8")).toBe(example);
  });
});

describe("full-stack combos", () => {
  const matrix = [
    { framework: "express", orm: "drizzle", db: "postgres" },
    { framework: "express", orm: "drizzle", db: "sqlite" },
    { framework: "express", orm: "drizzle", db: "mysql" },
    { framework: "express", orm: "prisma", db: "postgres" },
    { framework: "fastify", orm: "drizzle", db: "postgres" },
    { framework: "fastify", orm: "drizzle", db: "sqlite" },
    { framework: "fastify", orm: "drizzle", db: "mysql" },
    { framework: "fastify", orm: "prisma", db: "postgres" },
  ] as const;

  for (const { framework, orm, db } of matrix) {
    it(`scaffolds ${framework} + ${orm} + ${db}`, () => {
      const dir = makeTempDir(`${framework}-${orm}-${db}`);
      scaffoldInto(dir, makeAnswers({ backendFramework: framework, orm, database: db }));

      // Root layer: workspaces manifest, tokens rendered
      const rootPkg = readJson(join(dir, "package.json"));
      expect(rootPkg.name).toBe("demo-app");
      expect(rootPkg.workspaces).toEqual(["client", "server"]);
      expect(rootPkg.scripts).toHaveProperty("dev");
      expect(existsSync(join(dir, "docker-compose.yml"))).toBe(db !== "sqlite");
      expect(existsSync(join(dir, ".gitignore"))).toBe(true);
      if (db !== "sqlite") {
        expect(readFileSync(join(dir, "docker-compose.yml"), "utf8")).toContain("demo_app");
      }

      // Generated projects ship their own CI workflow
      expect(existsSync(join(dir, ".github", "workflows", "ci.yml"))).toBe(true);
      const generatedCi = readFileSync(join(dir, ".github", "workflows", "ci.yml"), "utf8");
      expect(generatedCi).toContain("tsc --noEmit -p client");
      expect(readFileSync(join(dir, "README.md"), "utf8")).toContain("## Troubleshooting");

      // Client layer
      const clientPkg = readJson(join(dir, "client", "package.json"));
      expect(clientPkg.name).toBe("demo-app-client");
      expect(clientPkg.dependencies).toHaveProperty("react");
      expect(clientPkg.devDependencies).toHaveProperty("@tailwindcss/vite");
      expect(clientPkg.devDependencies).toHaveProperty("tailwindcss");
      expect(existsSync(join(dir, "client", "src", "package.json"))).toBe(false);
      expect(rootPkg.devDependencies).not.toHaveProperty("@tailwindcss/vite");
      expect(readFileSync(join(dir, "client", "index.html"), "utf8")).toContain(
        "<title>demo-app</title>",
      );
      expect(existsSync(join(dir, "client", "src", "lib", "api.ts"))).toBe(true);

      // Server layer: framework entry + ORM wiring
      const serverPkg = readJson(join(dir, "server", "package.json"));
      expect(serverPkg.name).toBe("demo-app-server");
      expect(serverPkg.dependencies).toHaveProperty(framework);
      expect(serverPkg.scripts).toHaveProperty("db:push");
      expect(existsSync(join(dir, "server", "src", "routes", "users.ts"))).toBe(true);

      if (orm === "drizzle") {
        expect(existsSync(join(dir, "server", "drizzle.config.ts"))).toBe(true);
        expect(existsSync(join(dir, "server", "src", "db", "schema.ts"))).toBe(true);
        expect(existsSync(join(dir, "server", "prisma"))).toBe(false);
        const schema = readFileSync(join(dir, "server", "src", "db", "schema.ts"), "utf8");
        if (db === "sqlite") expect(schema).toContain("sqliteTable");
        else if (db === "mysql") expect(schema).toContain("mysqlTable");
        else expect(schema).toContain("pgTable");
      } else {
        expect(db).toBe("postgres");
        expect(existsSync(join(dir, "server", "prisma", "schema.prisma"))).toBe(true);
        expect(existsSync(join(dir, "server", "prisma.config.ts"))).toBe(true);
        expect(existsSync(join(dir, "server", "drizzle.config.ts"))).toBe(false);
      }

      // Env bootstrap: .env created from the (overwritten) .env.example
      const envContent = readFileSync(join(dir, "server", ".env"), "utf8");
      if (db === "sqlite") {
        expect(envContent).toContain("DATABASE_URL=file:./data/app.db");
        expect(existsSync(join(dir, "server", "data"))).toBe(true);
      } else if (db === "mysql") {
        expect(envContent).toContain(
          "DATABASE_URL=mysql://omnicraft:omnicraft@localhost:3306/demo_app",
        );
      } else {
        expect(envContent).toContain(
          "DATABASE_URL=postgres://omnicraft:omnicraft@localhost:5432/demo_app",
        );
      }

      // Extras merged into the root manifest
      if (framework === "express") {
        expect(rootPkg.devDependencies).toHaveProperty("concurrently");
        expect(rootPkg.devDependencies).toHaveProperty("eslint");
        expect(existsSync(join(dir, "eslint.config.js"))).toBe(true);
        expect(readFileSync(join(dir, "client", "src", "index.css"), "utf8")).toContain(
          '@import "tailwindcss"',
        );
        expect(readFileSync(join(dir, "client", "vite.config.ts"), "utf8")).toContain(
          "tailwindcss()",
        );
      }

      // README is tokenized
      const readme = readFileSync(join(dir, "README.md"), "utf8");
      expect(readme).toContain("# demo-app");
      expect(readme).not.toContain("{{");
    });
  }
});

describe("python + php runtimes", () => {
  it("preserves the FastAPI package __init__.py files byte-for-byte", () => {
    const dir = makeTempDir("fastapi-init-py");
    scaffoldInto(
      dir,
      makeAnswers({
        backendRuntime: "python",
        backendFramework: "fastapi",
        orm: null,
        database: "sqlite",
      }),
    );

    // A generic `_` -> `.` dotfile rename corrupted these into `._init__.py`
    // and broke pytest import modes, mypy, find_packages, and `python -m app`.
    const initFiles = [
      ["server/app/__init__.py", "server/python/fastapi/base/app/__init__.py"],
      ["server/app/routes/__init__.py", "server/python/fastapi/base/app/routes/__init__.py"],
    ] as const;
    for (const [generated, template] of initFiles) {
      expect(existsSync(join(dir, ...generated.split("/")))).toBe(true);
      expect(existsSync(join(dir, ...generated.replace("__init__.py", "._init__.py").split("/")))).toBe(
        false,
      );
      expect(readFileSync(join(dir, ...generated.split("/")))).toEqual(
        readFileSync(join(TEMPLATES_ROOT, ...template.split("/"))),
      );
    }
  });

  it("scaffolds fastapi + sqlite", () => {
    const dir = makeTempDir("fastapi-sqlite");
    scaffoldInto(
      dir,
      makeAnswers({
        backendRuntime: "python",
        backendFramework: "fastapi",
        orm: null,
        database: "sqlite",
      }),
    );

    // python root variant
    expect(
      (readJson(join(dir, "package.json")).scripts as Record<string, string>)["dev:server"],
    ).toContain("uvicorn");
    expect(readFileSync(join(dir, ".gitignore"), "utf8")).toContain("server/.venv/");
    expect(existsSync(join(dir, "docker-compose.yml"))).toBe(false);

    // server layer: fastapi base + sqlalchemy adapter, no npm manifest
    expect(existsSync(join(dir, "server", "pyproject.toml"))).toBe(true);
    expect(existsSync(join(dir, "server", "app", "main.py"))).toBe(true);
    expect(existsSync(join(dir, "server", "app", "database.py"))).toBe(true);
    expect(existsSync(join(dir, "server", "alembic.ini"))).toBe(true);
    expect(existsSync(join(dir, "server", "package.json"))).toBe(false);
    expect(readFileSync(join(dir, "server", ".env"), "utf8")).toContain(
      "DATABASE_URL=sqlite+aiosqlite:///data/app.db",
    );
    expect(readFileSync(join(dir, "server", "pyproject.toml"), "utf8")).toContain("aiosqlite");
  });

  it("scaffolds fastapi + postgres", () => {
    const dir = makeTempDir("fastapi-postgres");
    scaffoldInto(
      dir,
      makeAnswers({
        backendRuntime: "python",
        backendFramework: "fastapi",
        orm: null,
        database: "postgres",
      }),
    );
    expect(existsSync(join(dir, "docker-compose.yml"))).toBe(true);
    expect(readFileSync(join(dir, "server", ".env"), "utf8")).toContain(
      "DATABASE_URL=postgresql+asyncpg://omnicraft:omnicraft@localhost:5432/demo_app",
    );
    expect(readFileSync(join(dir, "server", "pyproject.toml"), "utf8")).toContain("asyncpg");
  });

  it("scaffolds the laravel overlay (composer base is created at scaffold time)", () => {
    const dir = makeTempDir("laravel-sqlite");
    scaffoldInto(
      dir,
      makeAnswers({
        backendRuntime: "php",
        backendFramework: "laravel",
        orm: null,
        database: "sqlite",
      }),
    );

    // overlay files, destined for the composer-created skeleton
    expect(existsSync(join(dir, "server", "routes", "api.php"))).toBe(true);
    expect(existsSync(join(dir, "server", "bootstrap", "app.php"))).toBe(true);
    expect(
      existsSync(join(dir, "server", "app", "Http", "Controllers", "UserController.php")),
    ).toBe(true);
    expect(readFileSync(join(dir, "server", ".env.example"), "utf8")).toContain(
      "DB_CONNECTION=sqlite",
    );

    // php root variant
    expect(
      (readJson(join(dir, "package.json")).scripts as Record<string, string>)["dev:server"],
    ).toContain("artisan serve");
    expect(readFileSync(join(dir, ".gitignore"), "utf8")).toContain("server/vendor/");
  });
});
describe("frontend-only", () => {
  it("composes the Supabase Auth frontend overlay with safe placeholders and no backend", () => {
    const answers = makeAnswers({
      fullStack: false,
      backendRuntime: null,
      backendFramework: null,
      orm: null,
      database: null,
      authentication: "supabase-auth",
      extras: { tailwind: false, eslintPrettier: false, shadcn: false },
      architecture: { kind: "frontend-only" },
    });
    const layers = composeLayers(answers);
    expect(layers.map(({ src }) => src)).toEqual([
      "web/react/client",
      "root/frontend-only",
      "auth/supabase-react-vite",
    ]);

    const dir = makeTempDir("supabase-auth");
    scaffoldInto(dir, answers);
    const packageJson = readJson(join(dir, "package.json"));
    const dependencies = packageJson.dependencies as Record<string, string>;
    const manifest = buildManifest(answers, "1.0.4", "npm");
    const envExample = readFileSync(join(dir, ".env.example"), "utf8");
    const readme = readFileSync(join(dir, "README.md"), "utf8");

    expect(dependencies["@supabase/supabase-js"]).toBe("2.118.0");
    expect(existsSync(join(dir, ".env"))).toBe(true);
    expect(envExample).toContain("VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-project-key");
    expect(envExample).not.toMatch(/SECRET_KEY|SERVICE_ROLE|service_role/i);
    expect(readme).toContain("project manually in the Supabase dashboard");
    expect(readFileSync(join(dir, "supabase/.gitignore"), "utf8")).toContain("/.temp/");
    expect(readFileSync(join(dir, "supabase/config.toml"), "utf8")).toContain(
      "auto_expose_new_tables = false",
    );
    expect(
      readFileSync(
        join(dir, "supabase/migrations/20261101000000_create_private_notes.sql"),
        "utf8",
      ),
    ).toContain("grant select, insert, update, delete on table public.notes to authenticated");
    expect(manifest.authentication).toBe("supabase-auth");
    expect(manifest.modules).toEqual([]);
    expect(existsSync(join(dir, "server"))).toBe(false);

    // the busy-state helper is inherited from the base React client, not
    // duplicated by the auth overlay, and every overlay action uses it
    expect(readFileSync(join(dir, "src", "lib", "run-busy-action.ts"), "utf8")).toContain(
      "export async function runBusyAction",
    );
    const app = readFileSync(join(dir, "src", "App.tsx"), "utf8");
    expect(app).toContain('from "./lib/run-busy-action"');
    expect(app.match(/await runBusyAction\(/g)?.length).toBe(4);
  });

  it("scaffolds the client at the project root without server artifacts", () => {
    const dir = makeTempDir("frontend-only");
    scaffoldInto(dir, makeAnswers({ fullStack: false }));

    const pkg = readJson(join(dir, "package.json"));
    expect(pkg.name).toBe("demo-app");
    expect(pkg.dependencies).toHaveProperty("react");
    expect(pkg.devDependencies).toHaveProperty("@tailwindcss/vite");
    expect(pkg.devDependencies).toHaveProperty("tailwindcss");
    expect(existsSync(join(dir, "src", "package.json"))).toBe(false);
    expect(existsSync(join(dir, "src", "App.tsx"))).toBe(true);
    expect(existsSync(join(dir, "docker-compose.yml"))).toBe(false);
    expect(existsSync(join(dir, "client"))).toBe(false);
    expect(existsSync(join(dir, "server"))).toBe(false);
    expect(existsSync(join(dir, ".gitignore"))).toBe(true);
    expect(existsSync(join(dir, ".github", "workflows", "ci.yml"))).toBe(true);
  });
});

describe("safety: protected paths and collisions", () => {
  it("never overwrites an existing user .env", () => {
    const dir = makeTempDir("protected-env");
    mkdirSync(join(dir, "server"), { recursive: true });
    writeFileSync(
      join(dir, "server", ".env"),
      "DATABASE_URL=postgres://user-secret@localhost/keepme",
    );
    scaffoldInto(dir, makeAnswers());
    const env = readFileSync(join(dir, "server", ".env"), "utf8");
    expect(env).toBe("DATABASE_URL=postgres://user-secret@localhost/keepme");
    // while .env.example still ships
    expect(existsSync(join(dir, "server", ".env.example"))).toBe(true);
  });

  it("never overwrites an existing .git directory", () => {
    const dir = makeTempDir("protected-git");
    mkdirSync(join(dir, ".git"), { recursive: true });
    writeFileSync(join(dir, ".git", "HEAD"), "ref: refs/heads/main");
    scaffoldInto(dir, makeAnswers({ fullStack: false }));
    expect(readFileSync(join(dir, ".git", "HEAD"), "utf8")).toBe("ref: refs/heads/main");
    expect(existsSync(join(dir, "src", "App.tsx"))).toBe(true);
  });

  it("renders no unresolved tokens in env files", () => {
    const dir = makeTempDir("env-tokens");
    scaffoldInto(dir, makeAnswers({ orm: "prisma" }));
    const env = readFileSync(join(dir, "server", ".env"), "utf8");
    expect(env).toContain("5432/demo_app");
    expect(env).not.toContain("{{");
  });
});
describe("shadcn extra layer", () => {
  it("pre-provisions alias config and the shadcn App", () => {
    const dir = makeTempDir("shadcn-layer");
    scaffoldInto(
      dir,
      makeAnswers({ extras: { tailwind: true, eslintPrettier: true, shadcn: true } }),
    );

    // alias config (no baseUrl — deprecated in TS 5.9)
    const tsconfig = readJson(join(dir, "client", "tsconfig.json")) as {
      compilerOptions: { paths: unknown; baseUrl?: unknown };
    };
    expect(tsconfig.compilerOptions.paths).toEqual({ "@/*": ["./src/*"] });
    expect(tsconfig.compilerOptions.baseUrl).toBeUndefined();

    // vite alias + types/node dep for path resolution (quote style may be
    // normalized by prettier — assert the alias path, not the quotes)
    expect(readFileSync(join(dir, "client", "vite.config.ts"), "utf8")).toMatch(/alias/i);
    expect(readFileSync(join(dir, "client", "vite.config.ts"), "utf8")).toContain("./src");
    expect(readJson(join(dir, "client", "package.json")).devDependencies).toHaveProperty(
      "@types/node",
    );

    // shadcn-based App imports via the alias; token lives in a JS string (TSX-safe)
    const app = readFileSync(join(dir, "client", "src", "App.tsx"), "utf8");
    expect(app).toContain("@/components/ui/button");
    expect(app).toContain('const APP_TITLE = "demo-app"');
    expect(app).not.toContain("{{projectName}}");
  });
});
describe("react JavaScript extras variants", () => {
  it("composes the JS vite-config variants for a JavaScript React client", () => {
    const jsLayers = composeLayers(
      makeAnswers({
        language: "javascript",
        extras: { tailwind: true, eslintPrettier: true, shadcn: false },
      }),
    ).map(({ src }) => src);
    expect(jsLayers).toContain("extras/tailwind/vite-react-js");
    expect(jsLayers).not.toContain("extras/tailwind/vite-react");

    const tsLayers = composeLayers(makeAnswers()).map(({ src }) => src);
    expect(tsLayers).toContain("extras/tailwind/vite-react");
    expect(tsLayers).not.toContain("extras/tailwind/vite-react-js");
  });

  it("scaffolds react-js + tailwind into vite.config.js with no stray TS config", () => {
    const dir = makeTempDir("react-js-tailwind");
    scaffoldInto(
      dir,
      makeAnswers({
        language: "javascript",
        extras: { tailwind: true, eslintPrettier: true, shadcn: false },
      }),
    );

    const viteConfig = readFileSync(join(dir, "client", "vite.config.js"), "utf8");
    expect(viteConfig).toContain("tailwindcss()");
    // Vite resolves vite.config.js first — shipping a .ts override would be
    // ignored (unstyled output) and leave a stray config in the project.
    expect(existsSync(join(dir, "client", "vite.config.ts"))).toBe(false);
    expect(readFileSync(join(dir, "client", "src", "index.css"), "utf8")).toContain(
      '@import "tailwindcss"',
    );
    const clientPkg = readJson(join(dir, "client", "package.json"));
    expect(clientPkg.devDependencies).toHaveProperty("@tailwindcss/vite");
    expect(clientPkg.devDependencies).toHaveProperty("tailwindcss");
  });

  it("scaffolds react-js + shadcn with App.jsx and the alias the shadcn CLI needs", () => {
    const dir = makeTempDir("react-js-shadcn");
    scaffoldInto(
      dir,
      makeAnswers({
        language: "javascript",
        extras: { tailwind: true, eslintPrettier: true, shadcn: true },
      }),
    );

    const viteConfig = readFileSync(join(dir, "client", "vite.config.js"), "utf8");
    expect(viteConfig).toContain("tailwindcss()");
    expect(viteConfig).toContain("./src");
    expect(existsSync(join(dir, "client", "vite.config.ts"))).toBe(false);

    // main.jsx imports ./App — the JSX variant must replace the base App and
    // no TSX sibling may ship alongside it.
    const app = readFileSync(join(dir, "client", "src", "App.jsx"), "utf8");
    expect(app).toContain("@/components/ui/button");
    expect(app).toContain('const APP_TITLE = "demo-app"');
    expect(app).not.toContain("{{projectName}}");
    expect(existsSync(join(dir, "client", "src", "App.tsx"))).toBe(false);

    // shadcn init detects its path alias from jsconfig/tsconfig paths.
    const jsconfig = readJson(join(dir, "client", "jsconfig.json")) as {
      compilerOptions: { paths: unknown };
    };
    expect(jsconfig.compilerOptions.paths).toEqual({ "@/*": ["./src/*"] });
    expect(readFileSync(join(dir, "client", "src", "index.css"), "utf8")).toContain(
      '@import "tailwindcss"',
    );
  });
});

describe("eslint extra lint workflow", () => {
  const eslintOnly = { tailwind: false, eslintPrettier: true, shadcn: false } as const;

  function lintWorkflow(dir: string): {
    on: Record<string, unknown>;
    jobs: Record<string, { steps: Array<Record<string, unknown>> }>;
  } {
    const raw = readFileSync(join(dir, ".github", "workflows", "lint.yml"), "utf8");
    return parse(raw);
  }

  function expectLintWorkflow(dir: string): void {
    const workflow = lintWorkflow(dir);
    // same triggers as the generated main CI
    expect(workflow.on).toEqual({ push: { branches: ["main"] }, pull_request: null });
    const steps = workflow.jobs.lint.steps;
    expect(steps.some((step) => step["uses"] === "actions/checkout@v4")).toBe(true);
    expect(steps.some((step) => step.run === "npm ci")).toBe(true);
    // the lint script lives in the root package.json for every non-integrated
    // composition (extras/eslint composes at dest "."), so the workflow runs
    // it from the repository root with no working-directory override
    const lintStep = steps.find((step) => step.run === "npm run lint");
    expect(lintStep).toBeDefined();
    expect(lintStep).not.toHaveProperty("working-directory");
    expect(readJson(join(dir, "package.json")).scripts).toHaveProperty("lint");
  }

  it("ships lint.yml beside the main CI for fullstack node compositions", () => {
    const dir = makeTempDir("lint-fullstack");
    scaffoldInto(dir, makeAnswers({ extras: { ...eslintOnly } }));

    expectLintWorkflow(dir);
    // the extra's workflow must not displace the root variant's CI
    const generatedCi = readFileSync(join(dir, ".github", "workflows", "ci.yml"), "utf8");
    expect(generatedCi).toContain("tsc --noEmit -p client");
    expect(generatedCi).not.toContain("npm run lint");
  });

  it("ships lint.yml for frontend-only compositions", () => {
    const dir = makeTempDir("lint-frontend-only");
    scaffoldInto(dir, makeAnswers({ fullStack: false, extras: { ...eslintOnly } }));

    expectLintWorkflow(dir);
  });

  it("keeps lint.yml when the Supabase auth overlay applies to a frontend-only project", () => {
    const dir = makeTempDir("lint-supabase");
    scaffoldInto(
      dir,
      makeAnswers({
        fullStack: false,
        backendRuntime: null,
        backendFramework: null,
        orm: null,
        database: null,
        authentication: "supabase-auth",
        extras: { ...eslintOnly },
        architecture: { kind: "frontend-only" },
      }),
    );

    expectLintWorkflow(dir);
  });

  it("ships lint.yml for the FastAPI and Laravel API compositions, still rooted", () => {
    const pythonDir = makeTempDir("lint-fastapi");
    scaffoldInto(
      pythonDir,
      makeAnswers({
        backendRuntime: "python",
        backendFramework: "fastapi",
        orm: null,
        database: "sqlite",
        extras: { ...eslintOnly },
      }),
    );
    expectLintWorkflow(pythonDir);

    const phpDir = makeTempDir("lint-laravel");
    scaffoldInto(
      phpDir,
      makeAnswers({
        backendRuntime: "php",
        backendFramework: "laravel",
        orm: null,
        database: "sqlite",
        extras: { ...eslintOnly },
      }),
    );
    expectLintWorkflow(phpDir);
  });

  it("ships no lint workflow on the integrated Next.js path", () => {
    const dir = makeTempDir("lint-nextjs");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "demo-app", dependencies: { next: "16.4.3" } }),
    );
    const nextAnswers = makeAnswers({
      frontend: "nextjs",
      backendRuntime: null,
      backendFramework: null,
      orm: "none",
      database: "sqlite",
      // Next.js requires the generator extras selected; composition still
      // excludes them because create-next-app already provides both.
      extras: { tailwind: true, eslintPrettier: true, shadcn: false },
      architecture: { kind: "integrated-fullstack", framework: "nextjs" },
    });
    nextAnswers.targetDir = dir;
    applyLayers(
      TEMPLATES_ROOT,
      planLayerApplication(composeLayers(nextAnswers), nextAnswers.architecture)
        .afterOfficialGenerator,
      templateVariables(nextAnswers),
      dir,
    );

    // create-next-app owns ESLint (and its lint setup) on this path — the
    // extra, its config, and its lint workflow must all stay out. The root
    // nextjs layer keeps CNA's own `lint` script; no duplicate workflow ships.
    expect(composeLayers(nextAnswers).map(({ src }) => src)).not.toContain("extras/eslint");
    expect(existsSync(join(dir, "eslint.config.js"))).toBe(false);
    expect(existsSync(join(dir, ".github", "workflows", "lint.yml"))).toBe(false);
  });
});

describe("frontend expansion (v0.4)", () => {
  it("scaffolds a vue client with the vue tailwind variant", () => {
    const dir = makeTempDir("vue-client");
    scaffoldInto(dir, makeAnswers({ frontend: "vue", fullStack: false }));
    expect(readJson(join(dir, "package.json")).dependencies).toHaveProperty("vue");
    expect(existsSync(join(dir, "src", "App.vue"))).toBe(true);
    expect(readFileSync(join(dir, "vite.config.ts"), "utf8")).toContain("@vitejs/plugin-vue");
  });

  it("scaffolds a svelte client with the svelte tailwind variant", () => {
    const dir = makeTempDir("svelte-client");
    scaffoldInto(dir, makeAnswers({ frontend: "svelte", fullStack: false }));
    expect(readJson(join(dir, "package.json")).dependencies).toHaveProperty("svelte");
    expect(existsSync(join(dir, "src", "App.svelte"))).toBe(true);
    expect(readFileSync(join(dir, "vite.config.ts"), "utf8")).toContain(
      "@sveltejs/vite-plugin-svelte",
    );
  });

  it("renders the fullstack root README with the chosen client framework and language", () => {
    const cases = [
      { frontend: "react", language: "typescript", client: "React + Vite + TypeScript" },
      { frontend: "react", language: "javascript", client: "React + Vite + JavaScript" },
      { frontend: "vue", language: "typescript", client: "Vue + Vite + TypeScript" },
      { frontend: "svelte", language: "typescript", client: "Svelte + Vite + TypeScript" },
    ] as const;
    for (const { frontend, language, client } of cases) {
      const dir = makeTempDir(`readme-${frontend}-${language}`);
      scaffoldInto(dir, makeAnswers({ frontend, language }));
      const readme = readFileSync(join(dir, "README.md"), "utf8");
      expect(readme).toContain(client);
      expect(readme).toContain(`# ${client.split(" + ")[0]} + Vite app`);
      // the row must describe THIS compose, not a hardcoded React default
      expect(readme).not.toContain("{{clientFramework}}");
      expect(readme).not.toContain("{{clientLanguage}}");
      if (frontend !== "react") expect(readme).not.toContain("React + Vite");
    }
  });

  it("renders the frontend-only README with the chosen framework (react-js)", () => {
    const dir = makeTempDir("readme-frontend-only-js");
    scaffoldInto(
      dir,
      makeAnswers({ frontend: "react", language: "javascript", fullStack: false }),
    );
    const readme = readFileSync(join(dir, "README.md"), "utf8");
    expect(readme).toContain("React app scaffolded by");
    expect(readme).not.toContain("{{clientFramework}}");
  });

  it("scaffolds the next overlay + sqlite db layer for integrated fullstack", () => {
    const dir = makeTempDir("next-overlay");

    // Simulate the create-next-app skeleton: the real flow generates the app
    // BEFORE the overlay applies — the root manifest must exist so the db
    // layer's fragment merges into it (applyLayers inline: scaffoldInto would
    // wipe the simulated skeleton).
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "demo-app", dependencies: { next: "16.4.3" } }),
    );

    const nextAnswers = makeAnswers({
      frontend: "nextjs",
      backendRuntime: null,
      backendFramework: null,
      orm: "none",
      database: "sqlite",
      extras: { tailwind: true, eslintPrettier: true, shadcn: false },
      architecture: { kind: "integrated-fullstack", framework: "nextjs" },
    });
    nextAnswers.targetDir = dir;
    const layerPlan = planLayerApplication(composeLayers(nextAnswers), nextAnswers.architecture);
    expect(layerPlan.afterOfficialGenerator.length).toBeGreaterThan(0);
    expect(layerPlan.beforeComposer).toEqual([]);
    expect(layerPlan.afterComposer).toEqual([]);
    applyLayers(
      TEMPLATES_ROOT,
      layerPlan.afterOfficialGenerator,
      templateVariables(nextAnswers),
      dir,
    );
    createEnvFiles(dir);

    // overlay: route handlers + users page (create-next-app generates the rest)
    expect(existsSync(join(dir, "app", "api", "users", "route.ts"))).toBe(true);
    expect(existsSync(join(dir, "app", "api", "users", "[id]", "route.ts"))).toBe(true);
    expect(existsSync(join(dir, "app", "users", "page.tsx"))).toBe(true);

    // db layer at app/db with the driver dep merged into the ROOT manifest
    expect(existsSync(join(dir, "app", "db", "index.ts"))).toBe(true);
    expect(existsSync(join(dir, "app", "db", "migrations", "001_create_users.sql"))).toBe(true);
    expect(readJson(join(dir, "package.json")).dependencies).toHaveProperty("better-sqlite3");

    // no vite artifacts (cna wires tailwind via turbopack)
    expect(existsSync(join(dir, "vite.config.ts"))).toBe(false);
    expect(existsSync(join(dir, "docker-compose.yml"))).toBe(false); // sqlite

    // root layer ships a complete .gitignore (it replaces cna's) that
    // ignores the SQLite data dir the db adapter writes to
    const gitignore = readFileSync(join(dir, ".gitignore"), "utf8");
    expect(gitignore).toContain("/data/");
    expect(gitignore).toContain("node_modules");

    // create-next-app ships its own eslint.config.mjs — the eslint extra is
    // gated off the integrated path so no eslint.config.js shadows it
    expect(composeLayers(nextAnswers).map(({ src }) => src)).not.toContain("extras/eslint");
    expect(existsSync(join(dir, "eslint.config.js"))).toBe(false);
  });

  it("scaffolds the next postgres variant with compose file", () => {
    const dir = makeTempDir("next-pg");
    scaffoldInto(
      dir,
      makeAnswers({
        frontend: "nextjs",
        backendRuntime: null,
        backendFramework: null,
        orm: "none",
        database: "postgres",
        extras: { tailwind: true, eslintPrettier: true, shadcn: false },
        architecture: { kind: "integrated-fullstack", framework: "nextjs" },
      }),
    );
    expect(existsSync(join(dir, "docker-compose.yml"))).toBe(true);
    expect(readFileSync(join(dir, ".env"), "utf8")).toContain(
      "DATABASE_URL=postgres://omnicraft:omnicraft@localhost:5432/demo_app",
    );
    // every fullstack-next variant ships the root .gitignore (uniform files;
    // /data/ is inert for containerized databases)
    expect(readFileSync(join(dir, ".gitignore"), "utf8")).toContain("/data/");
  });
});
describe("per-composition Node requirements", () => {
  // The engines floors are conservative intersections of the npm `engines`
  // declared by each composition's pinned dependency graph (verified via
  // `npm view <pkg>@<version> engines` against the registry in November 2026):
  //   vite@^8.3.5 and @vitejs/plugin-{react,vue}@^6: ^20.19.0 || >=22.12.0
  //   @sveltejs/vite-plugin-svelte@^7.3.1:           ^20.19 || ^22.12 || >=24
  //   eslint@^10.13.0 (eslint extra):                ^20.19.0 || ^22.13.0 || >=24
  //   better-sqlite3@^13.0.3:                        >=22
  //   @supabase/supabase-js@2.118.0:                 >=22.0.0
  //   next@16.4.3 (create-next-app@16 ships eslint ^9): >=20.9.0
  //   vite-plus@1.4.0 (pinned Laravel starters):     ^22.18 || ^24.11 || >=26
  // The root variant template is shared by every composition that selects it,
  // so its static engines field states the intersection — a range no
  // composition sharing that root could violate.

  function expectNodeFloor(dir: string, engines: string, nvmrc: string): void {
    const packageJson = readJson(join(dir, "package.json"));
    expect((packageJson.engines as Record<string, string>).node).toBe(engines);
    expect(readFileSync(join(dir, ".nvmrc"), "utf8").trim()).toBe(nvmrc);
  }

  it("scaffolds fullstack postgres with the Vite/eslint-extra intersection floor", () => {
    const dir = makeTempDir("node-floor-fullstack-pg");
    scaffoldInto(dir, makeAnswers());
    expectNodeFloor(dir, "^20.19.0 || ^22.13.0 || >=24.0.0", "20.19");
    // concurrently 9 declares engines >=18 and keeps this floor satisfiable
    // on Node 20.19 — the runtime the node20-postgres-runtime CI job installs
    // with setup-node "20". concurrently 10 declares >=22 and would force an
    // honest re-scope of that job; do not bump it back without one.
    expect(
      (readJson(join(dir, "package.json")).devDependencies as Record<string, string>).concurrently,
    ).toBe("^9.2.5");
  });

  it("scaffolds fullstack mysql with the same floor as postgres", () => {
    const dir = makeTempDir("node-floor-fullstack-mysql");
    scaffoldInto(dir, makeAnswers({ database: "mysql" }));
    expectNodeFloor(dir, "^20.19.0 || ^22.13.0 || >=24.0.0", "20.19");
  });

  it("scaffolds fullstack sqlite with better-sqlite3's >=22 floor", () => {
    const dir = makeTempDir("node-floor-fullstack-sqlite");
    scaffoldInto(dir, makeAnswers({ database: "sqlite" }));
    expectNodeFloor(dir, "^22.13.0 || >=24.0.0", "22.13");
  });

  it("merges the fullstack-next sqlite floor into the create-next-app skeleton manifest", () => {
    const dir = makeTempDir("node-floor-next-sqlite");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "demo-app", dependencies: { next: "16.4.3" } }),
    );
    const nextAnswers = makeAnswers({
      frontend: "nextjs",
      backendRuntime: null,
      backendFramework: null,
      orm: "none",
      database: "sqlite",
      architecture: { kind: "integrated-fullstack", framework: "nextjs" },
    });
    nextAnswers.targetDir = dir;
    const plan = planLayerApplication(composeLayers(nextAnswers), nextAnswers.architecture);
    applyLayers(TEMPLATES_ROOT, plan.afterOfficialGenerator, templateVariables(nextAnswers), dir);
    expectNodeFloor(dir, ">=22.0.0", "22");
  });

  it("scaffolds the fullstack-next postgres variant with next's >=20.9 floor", () => {
    const dir = makeTempDir("node-floor-next-pg");
    scaffoldInto(
      dir,
      makeAnswers({
        frontend: "nextjs",
        backendRuntime: null,
        backendFramework: null,
        orm: "none",
        database: "postgres",
        architecture: { kind: "integrated-fullstack", framework: "nextjs" },
      }),
    );
    expectNodeFloor(dir, ">=20.9.0", "20.9");
  });

  it("scaffolds frontend-only react with the conservative supabase/eslint-extra floor", () => {
    const dir = makeTempDir("node-floor-frontend-only");
    scaffoldInto(dir, makeAnswers({ fullStack: false }));
    expectNodeFloor(dir, "^22.13.0 || >=24.0.0", "22.13");
  });

  it("scaffolds fullstack python/postgres with the Vite client floor", () => {
    const dir = makeTempDir("node-floor-python-pg");
    scaffoldInto(
      dir,
      makeAnswers({
        backendRuntime: "python",
        backendFramework: "fastapi",
        orm: null,
        database: "postgres",
      }),
    );
    expectNodeFloor(dir, "^20.19.0 || ^22.13.0 || >=24.0.0", "20.19");
  });

  it("scaffolds fullstack php/sqlite with the Vite client floor", () => {
    const dir = makeTempDir("node-floor-php-sqlite");
    scaffoldInto(
      dir,
      makeAnswers({
        backendRuntime: "php",
        backendFramework: "laravel",
        orm: null,
        database: "sqlite",
      }),
    );
    expectNodeFloor(dir, "^20.19.0 || ^22.13.0 || >=24.0.0", "20.19");
  });

  it.each([
    { name: "livewire", answers: makeLivewireAnswers() },
    { name: "inertia react", answers: makeInertiaReactAnswers() },
  ] as const)(
    "scaffolds the integrated Laravel $name root with the Vite Plus floor",
    ({ name, answers }) => {
      const dir = makeTempDir(`node-floor-laravel-${name.replace(" ", "-")}`);
      scaffoldInto(dir, answers);
      expectNodeFloor(dir, "^22.18.0 || ^24.11.0 || >=26.0.0", "22.18");
    },
  );
});
describe("SKIP_ENV_VALIDATION escape hatch", () => {
  const require = createRequire(import.meta.url);
  const tsxCli = require.resolve("tsx/cli");

  /**
   * Minimal stand-in for the zod surface the generated env.ts uses
   * (object / coerce.number().default / string().min / string().default /
   * prettifyError). It lets the REAL generated env.ts run in a child process
   * without an npm install inside the scaffold target — the point under test
   * is the escape-hatch wiring, not zod itself.
   */
  const ZOD_STUB = `
function makeString(options) {
  const s = { kind: "string", min: 0, message: "", defaultValue: undefined, ...options };
  return {
    __schema: s,
    min(length, message) {
      return makeString({ ...s, min: length, message });
    },
    default(value) {
      return makeString({ ...s, defaultValue: value });
    },
  };
}
function makeNumber(options) {
  const s = { kind: "number", defaultValue: undefined, ...options };
  return {
    __schema: s,
    default(value) {
      return makeNumber({ ...s, defaultValue: value });
    },
  };
}
export const z = {
  string: () => makeString({}),
  coerce: { number: () => makeNumber({}) },
  object(shape) {
    return {
      safeParse(input) {
        const data = {};
        const issues = [];
        for (const [key, schema] of Object.entries(shape)) {
          const s = schema.__schema;
          const raw = input[key];
          if (s.kind === "number") {
            const numeric = raw === undefined || raw === "" ? NaN : Number(raw);
            if (Number.isNaN(numeric)) {
              if (s.defaultValue === undefined) issues.push({ key, message: "required" });
              else data[key] = s.defaultValue;
            } else {
              data[key] = numeric;
            }
          } else {
            const value = typeof raw === "string" ? raw : "";
            if (value.length < s.min) {
              issues.push({ key, message: s.message });
            } else if (value === "" && s.defaultValue !== undefined) {
              data[key] = s.defaultValue;
            } else {
              data[key] = value;
            }
          }
        }
        return issues.length === 0 ? { success: true, data } : { success: false, error: { issues } };
      },
    };
  },
  prettifyError(error) {
    return error.issues.map((issue) => issue.key + ": " + issue.message).join("\\n");
  },
};
export default z;
`;

  /** Installs the zod stub and a runner that imports the generated env.ts and prints it. */
  function prepareEnvRuntime(dir: string): string {
    mkdirSync(join(dir, "node_modules", "zod"), { recursive: true });
    writeFileSync(join(dir, "node_modules", "zod", "package.json"), JSON.stringify({
      name: "zod",
      version: "4.0.0-stub",
      type: "module",
      main: "index.js",
    }));
    writeFileSync(join(dir, "node_modules", "zod", "index.js"), ZOD_STUB);
    const runner = join(dir, "env-runner.mjs");
    writeFileSync(runner, 'import { env } from "./server/src/env.ts";\nconsole.log(JSON.stringify(env));\n');
    return runner;
  }

  function runEnvProcess(
    dir: string,
    runner: string,
    overrides: Record<string, string>,
  ): { code: number; stdout: string; stderr: string } {
    // The child never inherits DATABASE_URL, so "no bypass" means a genuinely
    // missing required variable.
    const childEnv: NodeJS.ProcessEnv = { ...process.env };
    delete childEnv.DATABASE_URL;
    for (const [key, value] of Object.entries(overrides)) childEnv[key] = value;
    try {
      const stdout = execFileSync(process.execPath, [tsxCli, runner], {
        cwd: dir,
        env: childEnv,
        encoding: "utf8",
      });
      return { code: 0, stdout, stderr: "" };
    } catch (error) {
      const err = error as { status?: number; stdout?: unknown; stderr?: unknown };
      return {
        code: err.status ?? -1,
        stdout: typeof err.stdout === "string" ? err.stdout : "",
        stderr: typeof err.stderr === "string" ? err.stderr : String(err.stderr ?? ""),
      };
    }
  }

  it("exports placeholder env instead of exiting when SKIP_ENV_VALIDATION is set", { timeout: 30_000 }, () => {
    for (const value of ["1", "true"]) {
      const dir = makeTempDir(`skip-env-on-${value}`);
      scaffoldInto(dir, makeAnswers());
      expect(readFileSync(join(dir, "README.md"), "utf8")).toContain("SKIP_ENV_VALIDATION=1");
      const runner = prepareEnvRuntime(dir);
      const result = runEnvProcess(dir, runner, { SKIP_ENV_VALIDATION: value });
      expect(result.code).toBe(0);
      expect(result.stderr).not.toContain("Invalid environment variables");
      expect(JSON.parse(result.stdout)).toEqual({
        PORT: 3000,
        CORS_ORIGIN: "http://localhost:5173",
        DATABASE_URL: "SKIP_ENV_VALIDATION_PLACEHOLDER",
      });
    }
  });

  it("still exits on a missing DATABASE_URL without the escape hatch", { timeout: 30_000 }, () => {
    const dir = makeTempDir("skip-env-off");
    scaffoldInto(dir, makeAnswers());
    const runner = prepareEnvRuntime(dir);
    const result = runEnvProcess(dir, runner, {});
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Invalid environment variables");
  });

  it("still parses real variables when the escape hatch is unset", { timeout: 30_000 }, () => {
    const dir = makeTempDir("skip-env-real");
    scaffoldInto(dir, makeAnswers());
    const runner = prepareEnvRuntime(dir);
    const result = runEnvProcess(dir, runner, {
      DATABASE_URL: "postgres://omnicraft:omnicraft@localhost:5432/demo_app",
    });
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).DATABASE_URL).toBe(
      "postgres://omnicraft:omnicraft@localhost:5432/demo_app",
    );
  });

  it("ships the guard in every node env validator template and the next.js mysql adapter", () => {
    const nodeRoot = join(TEMPLATES_ROOT, "server", "node");
    for (const framework of readdirSync(nodeRoot)) {
      for (const variant of readdirSync(join(nodeRoot, framework))) {
        const envTemplatePath = join(nodeRoot, framework, variant, "src", "env.ts");
        expect(existsSync(envTemplatePath), envTemplatePath).toBe(true);
        expect(readFileSync(envTemplatePath, "utf8")).toContain("SKIP_ENV_VALIDATION");
      }
    }
    expect(readFileSync(join(TEMPLATES_ROOT, "web", "nextjs", "db-mysql", "index.ts"), "utf8")).toContain(
      "SKIP_ENV_VALIDATION",
    );
  });

  it("documents the variable in the affected generated READMEs' troubleshooting sections", () => {
    for (const readme of [
      "root/fullstack/postgres/README.md",
      "root/fullstack/mysql/README.md",
      "root/fullstack/sqlite/README.md",
      "root/fullstack-next/mysql/README.md",
    ]) {
      expect(readFileSync(join(TEMPLATES_ROOT, ...readme.split("/")), "utf8")).toContain(
        "SKIP_ENV_VALIDATION=1",
      );
    }
  });
});
describe(".vscode/extensions.json recommendations", () => {
  function readRecommendations(dir: string): string[] {
    return (
      JSON.parse(readFileSync(join(dir, ".vscode", "extensions.json"), "utf8")) as {
        recommendations: string[];
      }
    ).recommendations;
  }

  it("unions fragments from the client, extras, and db layers into the target root file", () => {
    const dir = makeTempDir("vscode-fullstack");
    scaffoldInto(dir, makeAnswers({ orm: "prisma" }));

    // React ships no framework extension; tailwind/eslint extras and the
    // prisma db adapter each contribute one, merged and sorted at the root.
    expect(readRecommendations(dir)).toEqual([
      "bradlc.vscode-tailwindcss",
      "dbaeumer.vscode-eslint",
      "prisma.prisma",
    ]);
    // fragments are merged at the workspace root — no stray per-workspace copies
    expect(existsSync(join(dir, "client", ".vscode"))).toBe(false);
    expect(existsSync(join(dir, "server", ".vscode"))).toBe(false);
  });

  it("merges the framework fragment for vue and svelte frontend-only clients", () => {
    const vueDir = makeTempDir("vscode-vue");
    scaffoldInto(vueDir, makeAnswers({ frontend: "vue", fullStack: false }));
    expect(readRecommendations(vueDir)).toEqual([
      "Vue.volar",
      "bradlc.vscode-tailwindcss",
      "dbaeumer.vscode-eslint",
    ]);

    const svelteDir = makeTempDir("vscode-svelte");
    scaffoldInto(svelteDir, makeAnswers({ frontend: "svelte", fullStack: false }));
    expect(readRecommendations(svelteDir)).toEqual([
      "bradlc.vscode-tailwindcss",
      "dbaeumer.vscode-eslint",
      "svelte.svelte-vscode",
    ]);
  });

  it("produces byte-identical output for identical answers (sorted union)", () => {
    const first = makeTempDir("vscode-deterministic-1");
    const second = makeTempDir("vscode-deterministic-2");
    scaffoldInto(first, makeAnswers({ orm: "prisma" }));
    scaffoldInto(second, makeAnswers({ orm: "prisma" }));
    expect(readFileSync(join(first, ".vscode", "extensions.json"), "utf8")).toBe(
      readFileSync(join(second, ".vscode", "extensions.json"), "utf8"),
    );
  });

  it("creates no .vscode file when no fragment composes", () => {
    const dir = makeTempDir("vscode-absent");
    scaffoldInto(
      dir,
      makeAnswers({ extras: { tailwind: false, eslintPrettier: false, shadcn: false } }),
    );
    expect(existsSync(join(dir, ".vscode"))).toBe(false);
  });

  it("leaves a generator-owned .vscode/extensions.json untouched on the next.js path", () => {
    const dir = makeTempDir("vscode-nextjs");
    mkdirSync(join(dir, ".vscode"), { recursive: true });
    const cnaExtensions = `${JSON.stringify(
      { recommendations: ["ms-vscode.vscode-typescript-next"] },
      null,
      2,
    )}\n`;
    writeFileSync(join(dir, ".vscode", "extensions.json"), cnaExtensions);

    const nextAnswers = makeAnswers({
      frontend: "nextjs",
      backendRuntime: null,
      backendFramework: null,
      orm: "none",
      database: "sqlite",
      extras: { tailwind: true, eslintPrettier: true, shadcn: false },
      architecture: { kind: "integrated-fullstack", framework: "nextjs" },
    });
    nextAnswers.targetDir = dir;
    applyLayers(
      TEMPLATES_ROOT,
      planLayerApplication(composeLayers(nextAnswers), nextAnswers.architecture)
        .afterOfficialGenerator,
      templateVariables(nextAnswers),
      dir,
    );

    // no nextjs layer ships a fragment, so create-next-app's file survives
    expect(readFileSync(join(dir, ".vscode", "extensions.json"), "utf8")).toBe(cnaExtensions);
  });
});
describe("layer composition edge cases", () => {
  it("throws MissingLayerError for unknown layers", async () => {
    const dir = makeTempDir("missing-layer");
    const { MissingLayerError } = await import("./scaffold/engine.js");
    expect(() =>
      applyLayers(TEMPLATES_ROOT, [{ src: "nope/does-not-exist", dest: "." }], {}, dir),
    ).toThrow(MissingLayerError);
  });

  it("does not leak tokens into any generated file", () => {
    const dir = makeTempDir("tokens");
    scaffoldInto(dir, makeAnswers());
    for (const file of readdirSync(dir, { recursive: true, encoding: "utf8" })) {
      const path = join(dir, String(file));
      try {
        const content = readFileSync(path, "utf8");
        expect(content).not.toContain("{{projectName}}");
        expect(content).not.toContain("{{clientPackageName}}");
        expect(content).not.toContain("{{serverPackageName}}");
        expect(content).not.toContain("{{databaseName}}");
        expect(content).not.toContain("{{clientFramework}}");
        expect(content).not.toContain("{{clientLanguage}}");
      } catch {
        // non-utf8 file — skip
      }
    }
  });
});
