import { describe, expect, it } from "vitest";
import { hasStackFlags, resolveAnswers, validateStackFlags } from "./prefill.js";
import { hasFullStackFlags } from "./compatibility.js";
import { parseArgs } from "./args.js";

describe("validateStackFlags", () => {
  it("accepts available choices", () => {
    expect(() =>
      validateStackFlags(parseArgs(["--backend", "fastify", "--orm=prisma"])),
    ).not.toThrow();
    expect(() => validateStackFlags(parseArgs(["--frontend", "react"]))).not.toThrow();
    expect(() => validateStackFlags(parseArgs(["--db", "sqlite"]))).not.toThrow();
  });

  it("accepts Better Auth only for its supported Express and Drizzle stack", () => {
    for (const database of ["sqlite", "postgres", "mysql"]) {
      expect(() =>
        validateStackFlags(parseArgs(["--auth", "better-auth", "--db", database])),
      ).not.toThrow();
    }
    expect(() =>
      validateStackFlags(parseArgs(["--auth", "better-auth", "--backend", "fastify"])),
    ).toThrow(/--auth better-auth requires TypeScript with a full-stack React\/Vite Express API/);
    expect(() =>
      validateStackFlags(parseArgs(["--auth", "better-auth", "--runtime", "python"])),
    ).toThrow(/--auth better-auth requires TypeScript with a full-stack React\/Vite Express API/);
    expect(() =>
      validateStackFlags(parseArgs(["--auth", "better-auth", "--no-full-stack"])),
    ).toThrow(/--auth better-auth requires TypeScript with a full-stack React\/Vite Express API/);
    expect(() =>
      validateStackFlags(parseArgs(["--auth", "better-auth", "--lang", "javascript"])),
    ).toThrow(/--auth better-auth requires TypeScript/);
  });

  it("rejects unavailable choices with the available list", () => {
    expect(() => validateStackFlags(parseArgs(["--backend", "nestjs"]))).toThrow(
      /Available: express, fastify, hono/,
    );
    expect(() => validateStackFlags(parseArgs(["--db", "mongodb"]))).toThrow(
      /Available: postgres, sqlite, mysql/,
    );
    expect(() => validateStackFlags(parseArgs(["--extras", "tailwind,prettier"]))).toThrow(
      /Available: tailwind, eslint/,
    );
  });

  it("rejects prisma with a non-postgres database", () => {
    expect(() => validateStackFlags(parseArgs(["--db", "sqlite", "--orm", "prisma"]))).toThrow(
      /--orm prisma currently supports --db postgres only/,
    );
    expect(() => validateStackFlags(parseArgs(["--db", "mysql", "--orm", "prisma"]))).toThrow(
      /--orm prisma currently supports --db postgres only/,
    );
    expect(() =>
      validateStackFlags(parseArgs(["--db", "sqlite", "--orm", "drizzle"])),
    ).not.toThrow();
  });

  it("validates runtime-specific backends and databases", () => {
    expect(() =>
      validateStackFlags(parseArgs(["--runtime", "python", "--db", "sqlite"])),
    ).not.toThrow();
    expect(() =>
      validateStackFlags(parseArgs(["--runtime", "php", "--backend", "laravel"])),
    ).not.toThrow();
    expect(() =>
      validateStackFlags(parseArgs(["--runtime", "python", "--backend", "express"])),
    ).toThrow(/Available: fastapi/);
    expect(() => validateStackFlags(parseArgs(["--runtime", "python", "--db", "mysql"]))).toThrow(
      /Available: postgres, sqlite/,
    );
    expect(() =>
      validateStackFlags(parseArgs(["--runtime", "php", "--db", "mysql"])),
    ).not.toThrow();
  });

  it("rejects --orm for non-node runtimes", () => {
    expect(() =>
      validateStackFlags(parseArgs(["--runtime", "python", "--orm", "drizzle"])),
    ).toThrow(/--orm applies to Node\.js backends only/);
    expect(() => validateStackFlags(parseArgs(["--runtime", "php", "--orm", "drizzle"]))).toThrow(
      /--orm applies to Node\.js backends only/,
    );
  });

  it("validates and resolves the language flag", () => {
    expect(() => validateStackFlags(parseArgs(["--lang", "javascript"]))).not.toThrow();
    expect(() => validateStackFlags(parseArgs(["--lang", "py"]))).toThrow(
      /Available: typescript, javascript/,
    );
    const js = resolveAnswers(
      parseArgs(["--yes", "--lang", "javascript", "--no-full-stack"]),
      "demo",
      "/tmp/demo",
    );
    expect(js.language).toBe("javascript");
  });

  it.each([
    [["--frontend", "vue", "--lang", "javascript"], /JavaScript is only available/],
    [["--frontend", "nextjs", "--lang", "javascript"], /JavaScript is only available/],
    [
      ["--platform", "mobile", "--lang", "javascript"],
      /Native Expo and Tauri scaffolds use TypeScript/,
    ],
    [["--frontend", "nextjs", "--orm", "drizzle"], /Next\.js is integrated full-stack/],
    [["--frontend", "nextjs", "--runtime", "node"], /Next\.js is integrated full-stack/],
    [["--frontend", "nextjs", "--backend", "express"], /Next\.js is integrated full-stack/],
    [["--frontend", "nextjs", "--no-full-stack"], /Next\.js is integrated full-stack/],
    [["--frontend", "nextjs", "--extras", "none"], /Next\.js always includes Tailwind and ESLint/],
    [
      ["--frontend", "nextjs", "--extras", "tailwind"],
      /Next\.js always includes Tailwind and ESLint/,
    ],
    [["--backend", "hono", "--orm", "prisma"], /Prisma is not available for Hono/],
    [["--frontend", "vue", "--extras", "shadcn"], /shadcn\/ui is only available/],
  ])("rejects incompatible flags: %j", (argv, message) => {
    expect(() => validateStackFlags(parseArgs(argv))).toThrow(message);
  });

  it("accepts the native TypeScript selection", () => {
    expect(() =>
      validateStackFlags(parseArgs(["--platform", "mobile", "--lang", "typescript"])),
    ).not.toThrow();
    expect(() =>
      validateStackFlags(parseArgs(["--platform", "mobile", "--extras", "none"])),
    ).not.toThrow();
  });

  it("accepts the integrated Laravel Livewire SQLite path with either auth choice", () => {
    expect(() => validateStackFlags(parseArgs(["--frontend", "livewire"]))).not.toThrow();
    expect(() =>
      validateStackFlags(parseArgs(["--frontend", "livewire", "--auth", "laravel-native"])),
    ).not.toThrow();
  });

  it("accepts only integrated Laravel Inertia React with TypeScript, SQLite, and its two auth choices", () => {
    expect(() => validateStackFlags(parseArgs(["--frontend", "inertia-react"]))).not.toThrow();
    expect(() =>
      validateStackFlags(
        parseArgs([
          "--frontend",
          "inertia-react",
          "--auth",
          "laravel-native",
          "--lang",
          "typescript",
        ]),
      ),
    ).not.toThrow();
    expect(() =>
      validateStackFlags(parseArgs(["--frontend", "inertia-react", "--auth", "none"])),
    ).not.toThrow();
  });

  it("accepts React/Vite Laravel-native auth only with its SQLite TypeScript API tuple", () => {
    expect(() =>
      validateStackFlags(parseArgs(["--frontend", "react", "--auth", "laravel-native"])),
    ).not.toThrow();
    expect(() =>
      validateStackFlags(
        parseArgs([
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
        ]),
      ),
    ).not.toThrow();
  });

  it.each([
    [["--frontend", "livewire", "--runtime", "node"], /requires PHP \+ Laravel \+ SQLite/],
    [
      ["--frontend", "livewire", "--backend", "laravel", "--db", "postgres"],
      /requires PHP \+ Laravel \+ SQLite/,
    ],
    [
      ["--frontend", "livewire", "--lang", "typescript"],
      /does not use a separate frontend, language/,
    ],
    [["--frontend", "livewire", "--orm", "none"], /--orm applies to Node.js backends only/],
    [["--frontend", "livewire", "--no-full-stack"], /require a full-stack project/],
    [["--frontend", "livewire", "--auth", "better-auth"], /Better Auth is not available/],
    [["--auth", "laravel-native", "--runtime", "node"], /requires PHP \+ Laravel \+ SQLite/],
  ])("rejects unsupported Livewire flags before scaffold composition: %j", (argv, message) => {
    expect(() => validateStackFlags(parseArgs(argv))).toThrow(message);
  });

  it.each([
    [
      ["--frontend", "react", "--auth", "laravel-native", "--lang", "javascript"],
      /Laravel native authentication for React requires the separate PHP \+ Laravel API/,
    ],
    [
      ["--frontend", "react", "--auth", "laravel-native", "--backend", "express"],
      /Invalid --backend value/,
    ],
    [
      ["--frontend", "react", "--auth", "laravel-native", "--runtime", "node"],
      /Laravel native authentication for React requires the separate PHP \+ Laravel API/,
    ],
    [
      ["--frontend", "react", "--auth", "laravel-native", "--no-full-stack"],
      /require a full-stack project/,
    ],
    [
      ["--frontend", "react", "--auth", "laravel-native", "--orm", "none"],
      /--orm applies to Node.js backends only/,
    ],
    [["--frontend", "vue", "--auth", "laravel-native"], /supports React\/Vite \+ Laravel API/],
  ])(
    "rejects unsupported React/Vite Laravel-native flags before composition: %j",
    (argv, message) => {
      expect(() => validateStackFlags(parseArgs(argv))).toThrow(message);
    },
  );

  it.each([
    [
      ["--frontend", "inertia-react", "--runtime", "node"],
      /Inertia React currently requires PHP \+ Laravel \+ SQLite/,
    ],
    [
      ["--frontend", "inertia-react", "--backend", "laravel", "--db", "postgres"],
      /Inertia React currently requires PHP \+ Laravel \+ SQLite/,
    ],
    [["--frontend", "inertia-react", "--lang", "javascript"], /JavaScript is only available/],
    [["--frontend", "inertia-react", "--orm", "none"], /--orm applies to Node\.js backends only/],
    [["--frontend", "inertia-react", "--no-full-stack"], /require a full-stack project/],
    [
      ["--frontend", "inertia-react", "--auth", "better-auth"],
      /Better Auth is not available for Laravel Inertia React/,
    ],
    [["--frontend", "inertia-react", "--extras", "tailwind"], /Inertia React currently requires/],
    [
      ["--frontend", "inertia-react", "--db", "mysql"],
      /Inertia React currently requires PHP \+ Laravel \+ SQLite/,
    ],
  ])(
    "rejects incompatible Inertia React flags before scaffold composition: %j",
    (argv, message) => {
      expect(() => validateStackFlags(parseArgs(argv))).toThrow(message);
    },
  );

  it("validates the runtime itself", () => {
    expect(() => validateStackFlags(parseArgs(["--runtime", "ruby"]))).toThrow(
      /Available: node, python, php/,
    );
  });

  it("accepts --orm none with any database", () => {
    expect(() => validateStackFlags(parseArgs(["--orm", "none", "--db", "sqlite"]))).not.toThrow();
    expect(() => validateStackFlags(parseArgs(["--orm=none", "--db=mysql"]))).not.toThrow();
    const answers = resolveAnswers(
      parseArgs(["--yes", "--orm", "none", "--db", "sqlite"]),
      "demo",
      "/tmp/demo",
    );
    expect(answers.orm).toBe("none");
    expect(answers.database).toBe("sqlite");
  });
});

it("rejects Supabase Auth outside its React/Vite TypeScript frontend-only path", () => {
  expect(() => validateStackFlags(parseArgs(["--auth", "supabase-auth"]))).not.toThrow();
  for (const argv of [
    ["--auth", "supabase-auth", "--full-stack"],
    ["--auth", "supabase-auth", "--backend", "express"],
    ["--auth", "supabase-auth", "--db", "sqlite"],
    ["--auth", "supabase-auth", "--runtime", "php"],
    ["--auth", "supabase-auth", "--frontend", "vue"],
    ["--auth", "supabase-auth", "--lang", "javascript"],
    ["--auth", "supabase-auth", "--platform", "mobile"],
  ]) {
    expect(() => validateStackFlags(parseArgs(argv))).toThrow(/--auth supabase-auth requires/);
  }
});

describe("resolveAnswers", () => {
  const base = { projectName: "demo", targetDir: "/tmp/demo" };

  it("resolves Supabase Auth to the exact frontend-only default", () => {
    const answers = resolveAnswers(
      parseArgs(["--yes", "--auth", "supabase-auth", "--extras", "none"]),
      base.projectName,
      base.targetDir,
    );
    expect(answers).toMatchObject({
      frontend: "react",
      language: "typescript",
      fullStack: false,
      backendRuntime: null,
      backendFramework: null,
      orm: null,
      database: null,
      authentication: "supabase-auth",
      architecture: { kind: "frontend-only" },
      extras: { tailwind: false, eslintPrettier: false, shadcn: false },
    });
  });

  it("uses interactive-flow defaults under --yes", () => {
    const answers = resolveAnswers(parseArgs(["--yes"]), base.projectName, base.targetDir);
    expect(answers.fullStack).toBe(true);
    expect(answers.frontend).toBe("react");
    expect(answers.backendFramework).toBe("express");
    expect(answers.orm).toBe("drizzle");
    expect(answers.database).toBe("postgres");
    expect(answers.authentication).toBe("none");
    expect(answers.extras).toEqual({ tailwind: true, eslintPrettier: true, shadcn: false });
  });

  it("resolves the explicit Better Auth flag to the same supported default stack", () => {
    const answers = resolveAnswers(
      parseArgs(["--yes", "--auth", "better-auth"]),
      base.projectName,
      base.targetDir,
    );
    expect(answers.authentication).toBe("better-auth");
    expect(answers.frontend).toBe("react");
    expect(answers.backendRuntime).toBe("node");
    expect(answers.backendFramework).toBe("express");
    expect(answers.orm).toBe("drizzle");
    expect(answers.database).toBe("postgres");
  });

  it("keeps explicit None equivalent to the default without forcing a backend", () => {
    const answers = resolveAnswers(
      parseArgs(["--yes", "--auth", "none", "--no-full-stack"]),
      base.projectName,
      base.targetDir,
    );
    expect(answers.authentication).toBe("none");
    expect(answers.architecture).toEqual({ kind: "frontend-only" });
    expect(answers.backendFramework).toBeNull();
    expect(hasFullStackFlags(parseArgs(["--auth", "none"]))).toBe(false);
    expect(hasFullStackFlags(parseArgs(["--auth", "better-auth"]))).toBe(true);
    expect(hasFullStackFlags(parseArgs(["--auth", "supabase-auth"]))).toBe(false);
    expect(hasFullStackFlags(parseArgs(["--frontend", "livewire"]))).toBe(true);
    expect(hasFullStackFlags(parseArgs(["--frontend", "inertia-react"]))).toBe(true);
    expect(hasFullStackFlags(parseArgs(["--auth", "laravel-native"]))).toBe(true);
  });

  it("applies flag overrides", () => {
    const answers = resolveAnswers(
      parseArgs(["--yes", "--backend=fastify", "--orm=prisma", "--extras", "tailwind"]),
      base.projectName,
      base.targetDir,
    );
    expect(answers.backendFramework).toBe("fastify");
    expect(answers.orm).toBe("prisma");
    expect(answers.extras).toEqual({ tailwind: true, eslintPrettier: false, shadcn: false });
  });

  it("resolves the database flag", () => {
    const sqlite = resolveAnswers(
      parseArgs(["--yes", "--db", "sqlite"]),
      base.projectName,
      base.targetDir,
    );
    expect(sqlite.database).toBe("sqlite");
    expect(sqlite.orm).toBe("drizzle");
    const mysql = resolveAnswers(
      parseArgs(["--yes", "--db=mysql"]),
      base.projectName,
      base.targetDir,
    );
    expect(mysql.database).toBe("mysql");
  });

  it("resolves python and php runtimes", () => {
    const py = resolveAnswers(
      parseArgs(["--yes", "--runtime", "python", "--db", "sqlite"]),
      base.projectName,
      base.targetDir,
    );
    expect(py.backendRuntime).toBe("python");
    expect(py.backendFramework).toBe("fastapi");
    expect(py.orm).toBeNull();
    expect(py.database).toBe("sqlite");

    const php = resolveAnswers(
      parseArgs(["--yes", "--runtime", "php"]),
      base.projectName,
      base.targetDir,
    );
    expect(php.backendRuntime).toBe("php");
    expect(php.backendFramework).toBe("laravel");
    expect(php.orm).toBeNull();
    expect(php.database).toBe("postgres");
  });

  it("resolves Next.js as integrated raw SQL without a separate backend", () => {
    expect(() =>
      validateStackFlags(parseArgs(["--frontend", "nextjs", "--extras", "tailwind,eslint"])),
    ).not.toThrow();
    const next = resolveAnswers(
      parseArgs(["--yes", "--frontend", "nextjs", "--db", "sqlite"]),
      base.projectName,
      base.targetDir,
    );
    expect(next.architecture).toEqual({ kind: "integrated-fullstack", framework: "nextjs" });
    expect(next.backendRuntime).toBeNull();
    expect(next.backendFramework).toBeNull();
    expect(next.orm).toBe("none");
    expect(next.database).toBe("sqlite");
  });

  it("resolves Livewire as integrated Laravel with SQLite and no separate language or ORM", () => {
    const answers = resolveAnswers(
      parseArgs(["--yes", "--frontend", "livewire"]),
      base.projectName,
      base.targetDir,
    );

    expect(answers).toMatchObject({
      frontend: "livewire",
      language: null,
      fullStack: true,
      backendRuntime: "php",
      backendFramework: "laravel",
      orm: null,
      database: "sqlite",
      authentication: "none",
      extras: { tailwind: false, eslintPrettier: false, shadcn: false },
      architecture: { kind: "integrated-laravel", framework: "laravel", mode: "livewire" },
    });
  });

  it.each(["none", "laravel-native"] as const)(
    "resolves Inertia React with %s as integrated Laravel, TypeScript, and SQLite",
    (authentication) => {
      const answers = resolveAnswers(
        parseArgs(["--yes", "--frontend", "inertia-react", "--auth", authentication]),
        base.projectName,
        base.targetDir,
      );

      expect(answers).toMatchObject({
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
    },
  );

  it("infers the Livewire architecture from the Laravel-native auth flag", () => {
    const answers = resolveAnswers(
      parseArgs(["--yes", "--auth", "laravel-native"]),
      base.projectName,
      base.targetDir,
    );

    expect(answers.frontend).toBe("livewire");
    expect(answers.backendRuntime).toBe("php");
    expect(answers.backendFramework).toBe("laravel");
    expect(answers.database).toBe("sqlite");
    expect(answers.authentication).toBe("laravel-native");
    expect(answers.architecture.kind).toBe("integrated-laravel");
  });

  it("resolves React/Vite Laravel-native auth to Laravel 12 API + TypeScript + SQLite", () => {
    const answers = resolveAnswers(
      parseArgs(["--yes", "--frontend", "react", "--auth", "laravel-native"]),
      base.projectName,
      base.targetDir,
    );

    expect(answers).toMatchObject({
      frontend: "react",
      language: "typescript",
      fullStack: true,
      backendRuntime: "php",
      backendFramework: "laravel",
      orm: null,
      database: "sqlite",
      authentication: "laravel-native",
      architecture: { kind: "separate-frontend-api" },
    });
  });

  it("keeps the existing PHP Laravel API path separate and unchanged", () => {
    const answers = resolveAnswers(
      parseArgs(["--yes", "--runtime", "php"]),
      base.projectName,
      base.targetDir,
    );
    expect(answers.frontend).toBe("react");
    expect(answers.language).toBe("typescript");
    expect(answers.architecture.kind).toBe("separate-frontend-api");
    expect(answers.backendRuntime).toBe("php");
    expect(answers.backendFramework).toBe("laravel");
  });

  it("frontend-only clears backend fields", () => {
    const answers = resolveAnswers(
      parseArgs(["--yes", "--no-full-stack"]),
      base.projectName,
      base.targetDir,
    );
    expect(answers.fullStack).toBe(false);
    expect(answers.backendFramework).toBeNull();
    expect(answers.orm).toBeNull();
    expect(answers.database).toBeNull();
    expect(answers.backendRuntime).toBeNull();
  });
});

describe("hasStackFlags", () => {
  it("detects any stack flag", () => {
    expect(hasStackFlags(parseArgs(["--yes"]))).toBe(false);
    expect(hasStackFlags(parseArgs(["--no-full-stack"]))).toBe(true);
    expect(hasStackFlags(parseArgs(["--orm", "drizzle"]))).toBe(true);
    expect(hasStackFlags(parseArgs(["--extras", "none"]))).toBe(true);
  });
});
