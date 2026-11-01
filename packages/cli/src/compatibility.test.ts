import { describe, expect, it } from "vitest";
import { AVAILABLE } from "./capabilities.js";
import {
  authenticationCompatibilityReason,
  compatibleAuthenticationSetups,
  isFrontendAllowedByFlags,
  isRuntimeAllowedByFlags,
} from "./compatibility.js";
import { parseArgs } from "./args.js";
import { validateStackFlags, resolveAnswers } from "./prefill.js";
import { composeLayers } from "./scaffold/compose.js";

const supportedExpressDrizzle = {
  frontend: "react",
  language: "typescript",
  architecture: { kind: "separate-frontend-api" },
  backendRuntime: "node",
  backendFramework: "express",
  orm: "drizzle",
  database: "postgres",
};

describe("creation-time authentication compatibility", () => {
  it("exposes the existing setup choices without treating native auth as an add module", () => {
    expect(AVAILABLE.authentication).toEqual([
      "none",
      "better-auth",
      "supabase-auth",
      "laravel-native",
    ]);
  });

  it.each(["sqlite", "postgres", "mysql"])(
    "offers Better Auth for the supported %s database",
    (database) => {
      const context = { ...supportedExpressDrizzle, database };
      expect(compatibleAuthenticationSetups(context)).toEqual(["none", "better-auth"]);
      expect(authenticationCompatibilityReason("better-auth", context)).toBeNull();
    },
  );

  it.each([
    ["frontend", { frontend: "vue" }],
    ["language", { language: "javascript" }],
    ["runtime", { backendRuntime: "python" }],
    ["framework", { backendFramework: "fastify" }],
    ["orm", { orm: "none" }],
    ["database", { database: "mongodb" }],
    ["architecture", { architecture: { kind: "frontend-only" } }],
  ])("omits Better Auth when the selected %s is unsupported", (_dimension, overrides) => {
    const context = { ...supportedExpressDrizzle, ...overrides };
    expect(compatibleAuthenticationSetups(context)).toEqual(["none"]);
    expect(authenticationCompatibilityReason("better-auth", context)).toBeTruthy();
  });

  it("keeps None compatible with a frontend-only project", () => {
    const context = {
      ...supportedExpressDrizzle,
      architecture: { kind: "frontend-only" },
      backendRuntime: null,
      backendFramework: null,
      orm: null,
      database: null,
    };
    expect(compatibleAuthenticationSetups(context)).toEqual(["none", "supabase-auth"]);
    expect(authenticationCompatibilityReason("none", context)).toBeNull();
  });

  it("offers Supabase Auth only for React/Vite TypeScript frontend-only projects", () => {
    const context = {
      frontend: "react",
      language: "typescript",
      architecture: { kind: "frontend-only" },
      backendRuntime: null,
      backendFramework: null,
      orm: null,
      database: null,
    };
    expect(compatibleAuthenticationSetups(context)).toEqual(["none", "supabase-auth"]);
    expect(authenticationCompatibilityReason("supabase-auth", context)).toBeNull();
    expect(
      authenticationCompatibilityReason("supabase-auth", { ...context, language: "javascript" }),
    ).toMatch(/requires the TypeScript/);
    expect(
      authenticationCompatibilityReason("supabase-auth", { ...context, language: null }),
    ).toMatch(/requires the TypeScript/);
    expect(
      authenticationCompatibilityReason("supabase-auth", {
        ...context,
        architecture: { kind: "separate-frontend-api" },
      }),
    ).toMatch(/frontend-only/);
    expect(
      authenticationCompatibilityReason("supabase-auth", { ...context, backendRuntime: "node" }),
    ).toMatch(/no backend/);
  });

  it("offers only None and Laravel native auth for integrated Livewire on SQLite", () => {
    const context = {
      frontend: "livewire",
      language: null,
      architecture: { kind: "integrated-laravel" },
      backendRuntime: "php",
      backendFramework: "laravel",
      orm: null,
      database: "sqlite",
    };
    expect(compatibleAuthenticationSetups(context)).toEqual(["none", "laravel-native"]);
    expect(authenticationCompatibilityReason("laravel-native", context)).toBeNull();
  });

  it("offers only None and Laravel native auth for integrated Inertia React on SQLite", () => {
    const context = {
      frontend: "inertia-react",
      language: "typescript",
      architecture: { kind: "integrated-laravel" },
      backendRuntime: "php",
      backendFramework: "laravel",
      orm: null,
      database: "sqlite",
    };
    expect(compatibleAuthenticationSetups(context)).toEqual(["none", "laravel-native"]);
    expect(authenticationCompatibilityReason("laravel-native", context)).toBeNull();
  });

  it.each(["sqlite", "postgres", "mysql"])(
    "offers Laravel native auth for React/Vite TypeScript + Laravel API + %s",
    (database) => {
      const context = {
        frontend: "react",
        language: "typescript",
        architecture: { kind: "separate-frontend-api" },
        backendRuntime: "php",
        backendFramework: "laravel",
        orm: null,
        database,
      };
      expect(compatibleAuthenticationSetups(context)).toEqual(["none", "laravel-native"]);
      expect(authenticationCompatibilityReason("laravel-native", context)).toBeNull();
      expect(
        authenticationCompatibilityReason("laravel-native", {
          ...context,
          language: "javascript",
        }),
      ).toMatch(/does not support language/);
      expect(
        authenticationCompatibilityReason("laravel-native", { ...context, language: null }),
      ).toMatch(/does not support language/);
      expect(
        authenticationCompatibilityReason("laravel-native", {
          ...context,
          architecture: { kind: "frontend-only" },
        }),
      ).toMatch(/React\/Vite Laravel API architecture/);
      const args = parseArgs([
        "--yes",
        "--frontend",
        "react",
        "--runtime",
        "php",
        "--backend",
        "laravel",
        "--db",
        database,
        "--auth",
        "laravel-native",
      ]);
      expect(() => validateStackFlags(args)).not.toThrow();
      const answers = resolveAnswers(args, `sanctum-${database}`, ".");
      expect(answers.database).toBe(database);
      expect(composeLayers(answers)).toContainEqual({
        src: `root/fullstack-php/${database}-sanctum-spa-auth`,
        dest: ".",
      });
    },
  );

  it.each(["postgres", "mysql"])(
    "keeps integrated Livewire and Inertia auth SQLite-only for %s",
    (database) => {
      for (const [frontend, language] of [
        ["livewire", undefined],
        ["inertia-react", "typescript"],
      ] as const) {
        const context = {
          frontend,
          language: language ?? null,
          architecture: { kind: "integrated-laravel" },
          backendRuntime: "php",
          backendFramework: "laravel",
          orm: null,
          database,
        };
        expect(compatibleAuthenticationSetups(context)).toEqual(["none"]);
        expect(authenticationCompatibilityReason("laravel-native", context)).toMatch(
          /integrated Laravel native authentication currently covers SQLite only/i,
        );
        const args = parseArgs([
          "--yes",
          "--frontend",
          frontend,
          ...(language ? ["--lang", language] : []),
          "--runtime",
          "php",
          "--backend",
          "laravel",
          "--db",
          database,
          "--auth",
          "laravel-native",
        ]);
        expect(() => validateStackFlags(args)).toThrow(/SQLite/);
      }
    },
  );

  it.each([
    [
      { database: "postgres" },
      /integrated Laravel native authentication currently covers SQLite only/i,
    ],
    [{ backendRuntime: "node" }, /PHP \+ Laravel/],
    [{ frontend: "vue" }, /integrated Livewire\/Inertia React or the React\/Vite Laravel API/],
    [
      { architecture: { kind: "frontend-only" } },
      /integrated Livewire\/Inertia React or the React\/Vite Laravel API/,
    ],
  ])("omits Laravel native auth for incompatible context %j", (overrides, reason) => {
    const context = {
      frontend: "livewire",
      language: null,
      architecture: { kind: "integrated-laravel" },
      backendRuntime: "php",
      backendFramework: "laravel",
      orm: null,
      database: "sqlite",
      ...overrides,
    };
    expect(compatibleAuthenticationSetups(context)).toEqual(["none"]);
    expect(authenticationCompatibilityReason("laravel-native", context)).toMatch(reason);
  });

  it("filters prompt choices and runtime from Laravel-native flags", () => {
    const args = parseArgs(["--auth", "laravel-native"]);
    expect(isFrontendAllowedByFlags("livewire", args)).toBe(true);
    expect(isFrontendAllowedByFlags("inertia-react", args)).toBe(false);
    expect(isFrontendAllowedByFlags("react", args)).toBe(false);
    expect(isRuntimeAllowedByFlags("php", args)).toBe(true);
    expect(isRuntimeAllowedByFlags("node", args)).toBe(false);
  });

  it("allows explicit Inertia React with Laravel-native auth while preserving auth-only Livewire inference", () => {
    const args = parseArgs(["--frontend", "inertia-react", "--auth", "laravel-native"]);
    expect(isFrontendAllowedByFlags("inertia-react", args)).toBe(true);
    expect(isRuntimeAllowedByFlags("php", args)).toBe(true);
    expect(isRuntimeAllowedByFlags("node", args)).toBe(false);
  });

  it("allows explicit React/Vite with Laravel-native API auth while keeping it opt-in", () => {
    const args = parseArgs(["--frontend", "react", "--auth", "laravel-native"]);
    expect(isFrontendAllowedByFlags("react", args)).toBe(true);
    expect(isFrontendAllowedByFlags("livewire", args)).toBe(false);
    expect(isRuntimeAllowedByFlags("php", args)).toBe(true);
    expect(isRuntimeAllowedByFlags("node", args)).toBe(false);
  });
});
