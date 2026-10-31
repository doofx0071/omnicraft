import { describe, expect, it } from "vitest";
import { buildManifest } from "./manifest.js";
import type { Answers } from "./types.js";

function answers(authentication: Answers["authentication"]): Answers {
  if (authentication === "supabase-auth") {
    return {
      projectName: "demo-app",
      targetDir: "/tmp/demo-app",
      projectType: "web",
      frontend: "react",
      language: "typescript",
      fullStack: false,
      backendRuntime: null,
      backendFramework: null,
      orm: null,
      database: null,
      authentication,
      extras: { tailwind: false, eslintPrettier: false, shadcn: false },
      architecture: { kind: "frontend-only" },
    };
  }
  if (authentication === "laravel-native") {
    return {
      projectName: "demo-app",
      targetDir: "/tmp/demo-app",
      projectType: "web",
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
    };
  }
  return {
    projectName: "demo-app",
    targetDir: "/tmp/demo-app",
    projectType: "web",
    frontend: "react",
    language: "typescript",
    fullStack: true,
    backendRuntime: "node",
    backendFramework: "express",
    orm: "drizzle",
    database: "postgres",
    authentication,
    extras: { tailwind: false, eslintPrettier: false, shadcn: false },
    architecture: { kind: "separate-frontend-api" },
  };
}

function inertiaAnswers(authentication: "none" | "laravel-native"): Answers {
  return {
    projectName: "demo-app",
    targetDir: "/tmp/demo-app",
    projectType: "web",
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
  };
}

function laravelApiAnswers(authentication: "none" | "laravel-native"): Answers {
  return {
    projectName: "demo-app",
    targetDir: "/tmp/demo-app",
    projectType: "web",
    frontend: "react",
    language: "typescript",
    fullStack: true,
    backendRuntime: "php",
    backendFramework: "laravel",
    orm: null,
    database: "sqlite",
    authentication,
    extras: { tailwind: false, eslintPrettier: false, shadcn: false },
    architecture: { kind: "separate-frontend-api" },
  };
}

describe("project authentication manifest data", () => {
  it.each(["none", "better-auth", "supabase-auth", "laravel-native"] as const)(
    "stores %s separately from add-module history",
    (authentication) => {
      const manifest = buildManifest(answers(authentication), "1.0.2", "npm");

      expect(manifest.authentication).toBe(authentication);
      expect(manifest.modules).toEqual([]);
      if (authentication === "laravel-native") {
        expect(manifest.stack.frontend).toBe("livewire");
        expect(manifest.stack.architecture).toEqual({
          kind: "integrated-laravel",
          framework: "laravel",
          mode: "livewire",
        });
      }
    },
  );

  it.each(["none", "laravel-native"] as const)(
    "keeps Inertia React %s authentication separate from manifest.modules",
    (authentication) => {
      const manifest = buildManifest(inertiaAnswers(authentication), "1.0.3", "npm");

      expect(manifest.authentication).toBe(authentication);
      expect(manifest.modules).toEqual([]);
      expect(manifest.stack.frontend).toBe("inertia-react");
      expect(manifest.stack.architecture).toEqual({
        kind: "integrated-laravel",
        framework: "laravel",
        mode: "inertia-react",
      });
    },
  );

  it.each(["none", "laravel-native"] as const)(
    "keeps Laravel API %s authentication separate from manifest.modules",
    (authentication) => {
      const manifest = buildManifest(laravelApiAnswers(authentication), "1.0.4", "npm");

      expect(manifest.authentication).toBe(authentication);
      expect(manifest.modules).toEqual([]);
      expect(manifest.stack.frontend).toBe("react");
      expect(manifest.stack.backendRuntime).toBe("php");
      expect(manifest.stack.backendFramework).toBe("laravel");
      expect(manifest.stack.database).toBe("sqlite");
      expect(manifest.stack.architecture).toEqual({ kind: "separate-frontend-api" });
    },
  );
});
