import { describe, expect, it } from "vitest";
import { AUTHENTICATION_CATALOG, AVAILABLE, CAPABILITY_REGISTRY } from "./capabilities.js";
import { MODULES } from "./add.js";

function selectedValues<T extends readonly { value: string; available: boolean }[]>(
  options: T,
): string[] {
  return options.filter((option) => option.available).map((option) => option.value);
}

describe("capability registry", () => {
  it("derives all prompt and flag values from registry entries marked available", () => {
    expect(AVAILABLE.projectType).toEqual(selectedValues(CAPABILITY_REGISTRY.projectType));
    expect(AVAILABLE.frontend).toEqual(selectedValues(CAPABILITY_REGISTRY.frontend));
    expect(AVAILABLE.lang).toEqual(selectedValues(CAPABILITY_REGISTRY.language));
    expect(AVAILABLE.runtime).toEqual(selectedValues(CAPABILITY_REGISTRY.runtime));
    expect(AVAILABLE.backend.node).toEqual(selectedValues(CAPABILITY_REGISTRY.backend.node));
    expect(AVAILABLE.backend.python).toEqual(selectedValues(CAPABILITY_REGISTRY.backend.python));
    expect(AVAILABLE.backend.php).toEqual(selectedValues(CAPABILITY_REGISTRY.backend.php));
    expect(AVAILABLE.db.node).toEqual(selectedValues(CAPABILITY_REGISTRY.database.node));
    expect(AVAILABLE.db.python).toEqual(selectedValues(CAPABILITY_REGISTRY.database.python));
    expect(AVAILABLE.db.php).toEqual(selectedValues(CAPABILITY_REGISTRY.database.php));
    expect(AVAILABLE.orm.node).toEqual(selectedValues(CAPABILITY_REGISTRY.orm));
    expect(AVAILABLE.extras).toEqual(selectedValues(CAPABILITY_REGISTRY.extras));
    expect(AVAILABLE.authentication).toEqual(selectedValues(CAPABILITY_REGISTRY.authentication));
  });

  it("models None, Better Auth, Supabase Auth, and Laravel-native auth by setup category", () => {
    expect(AUTHENTICATION_CATALOG.none).toMatchObject({
      value: "none",
      category: "none",
      requirements: null,
    });
    expect(AUTHENTICATION_CATALOG["better-auth"]).toMatchObject({
      value: "better-auth",
      category: "application-library",
      requirements: {
        frontend: "react",
        language: "typescript",
        backendRuntime: "node",
        backendFramework: "express",
        orm: "drizzle",
        architecture: "separate-frontend-api",
        databases: ["postgres", "sqlite", "mysql"],
      },
    });
    expect(AUTHENTICATION_CATALOG["supabase-auth"]).toMatchObject({
      value: "supabase-auth",
      category: "managed-provider",
      requirements: {
        frontend: "react",
        language: "typescript",
        backendRuntime: null,
        backendFramework: null,
        orm: null,
        architecture: "frontend-only",
        databases: [null],
      },
    });
    expect(AUTHENTICATION_CATALOG["laravel-native"]).toMatchObject({
      value: "laravel-native",
      category: "framework-native",
      requirements: {
        frontend: ["livewire", "inertia-react", "react"],
        language: ["typescript", null],
        backendRuntime: "php",
        backendFramework: "laravel",
        orm: null,
        architecture: ["integrated-laravel", "separate-frontend-api"],
        databases: ["sqlite"],
      },
    });
    expect(CAPABILITY_REGISTRY.authentication.map(({ value }) => value)).toEqual([
      "none",
      "better-auth",
      "supabase-auth",
      "laravel-native",
    ]);
    expect(AVAILABLE.frontend).toContain("livewire");
    expect(AVAILABLE.frontend).toContain("inertia-react");
  });

  it("builds the module menu from the registry module ids", () => {
    expect(MODULES.map((module) => module.id)).toEqual(AVAILABLE.modules);
  });
});
