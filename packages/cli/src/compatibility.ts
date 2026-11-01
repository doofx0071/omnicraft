import type { ParsedArgs } from "./args.js";
import type {
  Answers,
  AuthenticationSetup,
  BackendFramework,
  Database,
  Frontend,
  Language,
  Orm,
  ProjectArchitecture,
  ProjectType,
} from "./types.js";
import {
  AUTHENTICATION_CATALOG,
  AVAILABLE,
  CAPABILITY_REGISTRY,
  type AuthenticationRequirements,
} from "./capabilities.js";

export const RUNTIME_BACKENDS = AVAILABLE.backend;
export const RUNTIME_DATABASES = AVAILABLE.db;
export const NODE_FRAMEWORK_ORMS = CAPABILITY_REGISTRY.ormsByNodeBackend;

export const MODULE_COMPATIBILITY = {
  auth: AUTHENTICATION_CATALOG["better-auth"].requirements,
} as const;

export interface AuthenticationContext {
  frontend: string;
  language?: string | null;
  architecture: { kind: string };
  backendRuntime: string | null;
  backendFramework: string | null;
  orm: string | null;
  database: string | null;
}

export function authenticationCompatibilityReason(
  setup: AuthenticationSetup,
  context: AuthenticationContext,
): string | null {
  const definition = AUTHENTICATION_CATALOG[setup];
  if (definition.category === "none") return null;

  const supported: AuthenticationRequirements | null = definition.requirements;
  if (!supported) {
    throw new Error(`Authentication setup "${setup}" is missing its stack requirements.`);
  }
  const supportedFrontends: readonly Frontend[] = Array.isArray(supported.frontend)
    ? (supported.frontend as readonly Frontend[])
    : [supported.frontend as Frontend];
  if (!supportedFrontends.includes(context.frontend as Frontend)) {
    return setup === "supabase-auth"
      ? "Supabase Auth currently requires the React/Vite frontend."
      : setup === "better-auth"
        ? `Better Auth currently requires the React frontend; ${context.frontend} is not covered yet.`
        : "Laravel native authentication currently requires integrated Livewire/Inertia React or the React/Vite Laravel API.";
  }
  const acceptedLanguages: readonly (Language | null)[] = Array.isArray(supported.language)
    ? supported.language
    : [supported.language as Language | null];
  const languageAccepted =
    supported.language === null ||
    context.language === undefined ||
    (context.language === null
      ? context.frontend === "livewire" && acceptedLanguages.includes(null)
      : acceptedLanguages.includes(context.language as Language));
  if (!languageAccepted) {
    if (setup === "supabase-auth") {
      return "Supabase Auth currently requires the TypeScript React/Vite frontend.";
    }
    return setup === "better-auth"
      ? `Better Auth creation currently requires TypeScript; ${context.language} is not covered yet.`
      : `Laravel native authentication does not support language "${context.language}".`;
  }
  if (
    context.backendRuntime !== supported.backendRuntime ||
    context.backendFramework !== supported.backendFramework ||
    context.orm !== supported.orm
  ) {
    return setup === "supabase-auth"
      ? "Supabase Auth currently requires a frontend-only project with no backend, ORM, or database layer."
      : setup === "better-auth"
        ? "Better Auth currently requires Node.js + Express + Drizzle; its route patches target Express."
        : "Laravel native authentication currently requires PHP + Laravel with Eloquent and no separate ORM.";
  }
  const supportedArchitectures = (
    Array.isArray(supported.architecture) ? supported.architecture : [supported.architecture]
  ) as readonly ProjectArchitecture["kind"][];
  if (!supportedArchitectures.includes(context.architecture.kind as ProjectArchitecture["kind"])) {
    if (setup === "supabase-auth") {
      return "Supabase Auth currently requires the frontend-only architecture.";
    }
    return setup === "better-auth"
      ? `architecture "${context.architecture.kind}" is not covered yet`
      : "Laravel native authentication currently requires integrated Livewire/Inertia React or the React/Vite Laravel API architecture.";
  }
  const supportedDatabases =
    supported.databasesByArchitecture?.[context.architecture.kind as ProjectArchitecture["kind"]] ??
    supported.databases;
  if (
    !(supportedDatabases as readonly (Database | null)[]).includes(
      context.database as Database | null,
    )
  ) {
    if (setup === "supabase-auth") {
      return "Supabase Auth uses the Supabase Data API and does not select a local database.";
    }
    return setup === "better-auth"
      ? `Better Auth currently supports SQLite, PostgreSQL, and MySQL; ${context.database ?? "no database"} is not covered yet.`
      : context.architecture.kind === "integrated-laravel"
        ? `Integrated Laravel native authentication currently covers SQLite only; ${context.database ?? "no database"} is not covered yet.`
        : `Laravel 12 API native authentication currently covers SQLite, PostgreSQL, and MySQL; ${context.database ?? "no database"} is not covered yet.`;
  }
  return null;
}

export function compatibleAuthenticationSetups(
  context: AuthenticationContext,
): AuthenticationSetup[] {
  return AVAILABLE.authentication.filter(
    (setup) => authenticationCompatibilityReason(setup, context) === null,
  );
}

const NEXTJS_GENERATOR_EXTRAS = ["tailwind", "eslint"] as const;

function matchesNextjsGeneratorExtras(extras: readonly string[] | undefined): boolean {
  if (extras === undefined) return true;
  const selected = new Set(extras);
  return (
    selected.size === NEXTJS_GENERATOR_EXTRAS.length &&
    NEXTJS_GENERATOR_EXTRAS.every((extra) => selected.has(extra))
  );
}

export function nodeOrmsForFramework(framework: BackendFramework | null): readonly Orm[] {
  if (framework === "express" || framework === "fastify" || framework === "hono") {
    return NODE_FRAMEWORK_ORMS[framework];
  }
  return [];
}

export function supportsLanguage(
  projectType: ProjectType,
  frontend: Frontend,
  language: Language,
): boolean {
  return (
    frontend !== "livewire" &&
    (frontend === "inertia-react"
      ? language === "typescript"
      : language === "typescript" || (projectType === "web" && frontend === "react"))
  );
}

export function supportsShadcn(
  projectType: ProjectType,
  frontend: Frontend,
  architecture: Answers["architecture"],
): boolean {
  return (
    projectType === "web" &&
    frontend === "react" &&
    architecture.kind !== "integrated-fullstack" &&
    architecture.kind !== "integrated-laravel" &&
    architecture.kind !== "native-app"
  );
}

/** Rejects cross-option flag combinations before prompts or scaffold writes. */
export function validateFlagCompatibility(args: ParsedArgs): void {
  const platform = args.platform?.trim().toLowerCase();
  const frontend = args.frontend?.trim().toLowerCase();
  const auth = args.auth?.trim().toLowerCase();
  const runtime =
    args.runtime?.trim().toLowerCase() ??
    (frontend === "livewire" || frontend === "inertia-react" || auth === "laravel-native"
      ? "php"
      : "node");
  const backend = args.backend?.trim().toLowerCase();
  const orm = args.orm?.trim().toLowerCase();
  const extras = args.extras ?? [];
  if (auth === "supabase-auth") {
    const conflicts =
      (platform !== undefined && platform !== "web") ||
      args.fullStack === true ||
      (args.lang !== undefined && args.lang.trim().toLowerCase() !== "typescript") ||
      (frontend !== undefined && frontend !== "react") ||
      args.runtime !== undefined ||
      args.backend !== undefined ||
      args.db !== undefined ||
      args.orm !== undefined;
    if (conflicts) {
      throw new Error(
        "--auth supabase-auth requires a TypeScript React/Vite frontend-only project with no backend, ORM, or database flags.",
      );
    }
  }
  const isNative = platform === "mobile" || platform === "desktop";
  if (args.lang?.trim().toLowerCase() === "javascript" && isNative) {
    throw new Error("Native Expo and Tauri scaffolds use TypeScript; omit --lang javascript.");
  }
  const hasWebStackFlags =
    args.lang?.trim().toLowerCase() === "javascript" ||
    args.frontend !== undefined ||
    args.fullStack !== undefined ||
    args.runtime !== undefined ||
    args.backend !== undefined ||
    args.db !== undefined ||
    args.orm !== undefined ||
    extras.length > 0;

  if (isNative && hasWebStackFlags) {
    throw new Error(
      "Mobile and desktop scaffolds use their official TypeScript generators; omit web stack flags.",
    );
  }

  if (
    args.fullStack === false &&
    (args.runtime ||
      args.backend ||
      args.db ||
      args.orm ||
      frontend === "livewire" ||
      frontend === "inertia-react" ||
      auth === "laravel-native")
  ) {
    throw new Error(
      "--runtime, --backend, --db, and --orm require a full-stack project; remove --no-full-stack.",
    );
  }

  if (
    frontend === "nextjs" &&
    (args.runtime || args.backend || args.orm || args.fullStack === false)
  ) {
    throw new Error(
      "Next.js is integrated full-stack and uses raw SQL; --runtime, --backend, --orm, and --no-full-stack do not apply.",
    );
  }

  if (frontend === "nextjs" && !matchesNextjsGeneratorExtras(args.extras)) {
    throw new Error(
      "Next.js always includes Tailwind and ESLint from create-next-app; use --extras tailwind,eslint or omit --extras.",
    );
  }

  if (args.lang?.trim().toLowerCase() === "javascript" && frontend && frontend !== "react") {
    throw new Error(
      "JavaScript is only available for the React/Vite web frontend; choose --lang typescript for this frontend.",
    );
  }

  if (extras.includes("shadcn") && frontend && frontend !== "react") {
    throw new Error(
      "shadcn/ui is only available for React/Vite web projects; choose --frontend react or omit shadcn.",
    );
  }

  if (runtime === "node" && backend === "hono" && orm === "prisma") {
    throw new Error("Prisma is not available for Hono; choose Drizzle or raw SQL with --orm none.");
  }

  if (
    auth === "laravel-native" &&
    frontend !== undefined &&
    !["react", "livewire", "inertia-react"].includes(frontend)
  ) {
    throw new Error(
      "Laravel native authentication currently supports React/Vite + Laravel API + SQLite, or integrated Livewire/Inertia React + SQLite.",
    );
  }

  if (auth === "laravel-native" && frontend === "react") {
    const conflicts =
      (platform !== undefined && platform !== "web") ||
      args.fullStack === false ||
      (args.runtime !== undefined && runtime !== "php") ||
      (args.backend !== undefined && backend !== "laravel") ||
      (args.lang !== undefined && args.lang.trim().toLowerCase() !== "typescript") ||
      args.orm !== undefined ||
      (args.db !== undefined &&
        !(
          AUTHENTICATION_CATALOG["laravel-native"].requirements.databases as readonly string[]
        ).includes(args.db.trim().toLowerCase()));
    if (conflicts) {
      throw new Error(
        "Laravel native authentication for React requires the separate PHP + Laravel API, TypeScript, and Eloquent with SQLite, PostgreSQL, or MySQL; omit incompatible flags.",
      );
    }
  }

  const selectsLaravelIntegrated =
    frontend === "livewire" ||
    frontend === "inertia-react" ||
    (auth === "laravel-native" && frontend === undefined);
  if (selectsLaravelIntegrated) {
    const inertiaReact = frontend === "inertia-react";
    const conflicts =
      (platform !== undefined && platform !== "web") ||
      args.fullStack === false ||
      (args.runtime !== undefined && runtime !== "php") ||
      (args.backend !== undefined && backend !== "laravel") ||
      (frontend !== undefined && frontend !== "livewire" && frontend !== "inertia-react") ||
      (args.lang !== undefined &&
        (inertiaReact ? args.lang.trim().toLowerCase() !== "typescript" : true)) ||
      args.orm !== undefined ||
      (args.db !== undefined && args.db.trim().toLowerCase() !== "sqlite") ||
      extras.length > 0;
    if (conflicts) {
      throw new Error(
        inertiaReact
          ? "Laravel Inertia React currently requires PHP + Laravel + SQLite + TypeScript and does not accept a separate API, ORM, or extras; omit incompatible flags."
          : "Laravel Livewire currently requires PHP + Laravel + SQLite and does not use a separate frontend, language, ORM, or extras; omit those flags.",
      );
    }
    if (auth === "better-auth") {
      throw new Error(
        `Better Auth is not available for Laravel ${inertiaReact ? "Inertia React" : "Livewire"}; use --auth none or laravel-native.`,
      );
    }
  }

  if (auth === "better-auth") {
    const supported = MODULE_COMPATIBILITY.auth;
    const conflicts =
      (platform !== undefined && platform !== "web") ||
      args.fullStack === false ||
      (args.lang !== undefined && args.lang.trim().toLowerCase() !== supported.language) ||
      (frontend !== undefined && frontend !== supported.frontend) ||
      (args.runtime !== undefined && runtime !== supported.backendRuntime) ||
      (backend !== undefined && backend !== supported.backendFramework) ||
      (orm !== undefined && orm !== supported.orm) ||
      (args.db !== undefined &&
        !(supported.databases as readonly string[]).includes(args.db.trim().toLowerCase()));
    if (conflicts) {
      throw new Error(
        "--auth better-auth requires TypeScript with a full-stack React/Vite Express API using Drizzle and SQLite, PostgreSQL, or MySQL.",
      );
    }
  }
}

/**
 * Prompt filtering mirrors the same combinations accepted by flags and
 * composition, keeping a preselected flag from making the wizard offer a
 * choice that cannot be used.
 */
export function isProjectTypeAllowedByFlags(projectType: ProjectType, args: ParsedArgs): boolean {
  if (projectType === "web") return true;
  const webOnlyFlags =
    args.lang?.trim().toLowerCase() === "javascript" ||
    args.frontend !== undefined ||
    args.fullStack !== undefined ||
    args.runtime !== undefined ||
    args.backend !== undefined ||
    args.db !== undefined ||
    args.orm !== undefined ||
    (args.extras?.length ?? 0) > 0 ||
    args.auth?.trim().toLowerCase() === "better-auth" ||
    args.auth?.trim().toLowerCase() === "laravel-native" ||
    args.auth?.trim().toLowerCase() === "supabase-auth";
  return !webOnlyFlags;
}

export function isFrontendAllowedByFlags(frontend: Frontend, args: ParsedArgs): boolean {
  if (
    args.auth?.trim().toLowerCase() === "better-auth" &&
    frontend !== MODULE_COMPATIBILITY.auth.frontend
  )
    return false;
  if (args.auth?.trim().toLowerCase() === "supabase-auth" && frontend !== "react") return false;
  if (args.auth?.trim().toLowerCase() === "laravel-native") {
    const explicitlySelectedFrontend = args.frontend?.trim().toLowerCase();
    if (explicitlySelectedFrontend !== undefined) return frontend === explicitlySelectedFrontend;
    if (frontend !== "livewire") return false;
  }
  if (args.lang?.trim().toLowerCase() === "javascript" && frontend !== "react") return false;
  if (args.extras?.includes("shadcn") && frontend !== "react") return false;
  if (frontend === "livewire") {
    if (
      (args.platform !== undefined && args.platform.trim().toLowerCase() !== "web") ||
      args.fullStack === false ||
      (args.runtime !== undefined && args.runtime.trim().toLowerCase() !== "php") ||
      (args.backend !== undefined && args.backend.trim().toLowerCase() !== "laravel") ||
      args.lang !== undefined ||
      args.orm !== undefined ||
      (args.db !== undefined && args.db.trim().toLowerCase() !== "sqlite") ||
      (args.extras?.length ?? 0) > 0 ||
      args.auth?.trim().toLowerCase() === "better-auth"
    )
      return false;
  }
  if (frontend === "inertia-react") {
    if (
      (args.platform !== undefined && args.platform.trim().toLowerCase() !== "web") ||
      args.fullStack === false ||
      (args.runtime !== undefined && args.runtime.trim().toLowerCase() !== "php") ||
      (args.backend !== undefined && args.backend.trim().toLowerCase() !== "laravel") ||
      (args.lang !== undefined && args.lang.trim().toLowerCase() !== "typescript") ||
      args.orm !== undefined ||
      (args.db !== undefined && args.db.trim().toLowerCase() !== "sqlite") ||
      (args.extras?.length ?? 0) > 0 ||
      args.auth?.trim().toLowerCase() === "better-auth"
    )
      return false;
  }
  if (frontend === "nextjs" && !matchesNextjsGeneratorExtras(args.extras)) return false;
  if (
    (args.runtime || args.backend || args.orm || args.fullStack === false) &&
    frontend === "nextjs"
  )
    return false;
  return true;
}

export function isRuntimeAllowedByFlags(
  runtime: "node" | "python" | "php",
  args: ParsedArgs,
): boolean {
  if (
    args.auth?.trim().toLowerCase() === "better-auth" &&
    runtime !== MODULE_COMPATIBILITY.auth.backendRuntime
  )
    return false;
  if (
    (args.frontend?.trim().toLowerCase() === "livewire" ||
      args.frontend?.trim().toLowerCase() === "inertia-react" ||
      args.auth?.trim().toLowerCase() === "laravel-native") &&
    runtime !== "php"
  )
    return false;
  if (args.runtime && args.runtime.trim().toLowerCase() !== runtime) return false;
  const inferredLaravelIntegrated =
    args.frontend?.trim().toLowerCase() === "livewire" ||
    args.frontend?.trim().toLowerCase() === "inertia-react" ||
    args.auth?.trim().toLowerCase() === "laravel-native";
  if (!args.runtime && !inferredLaravelIntegrated && (args.orm || args.backend))
    return runtime === "node";
  if (
    args.db &&
    !(RUNTIME_DATABASES[runtime] as readonly string[]).includes(args.db.trim().toLowerCase())
  )
    return false;
  return true;
}

export function hasFullStackFlags(args: ParsedArgs): boolean {
  return Boolean(
    args.runtime ||
    args.backend ||
    args.db ||
    args.orm ||
    args.frontend?.trim().toLowerCase() === "livewire" ||
    args.frontend?.trim().toLowerCase() === "inertia-react" ||
    args.auth?.trim().toLowerCase() === "better-auth" ||
    args.auth?.trim().toLowerCase() === "laravel-native",
  );
}

/** Throws when an Answers object could silently compose the wrong template. */
export function validateAnswerCompatibility(answers: Answers): void {
  const authContext: AuthenticationContext = {
    ...answers,
    frontend: answers.frontend,
    ...(answers.architecture.kind === "integrated-laravel" &&
    answers.architecture.mode === "livewire"
      ? { language: null }
      : {}),
  };
  const authenticationError = authenticationCompatibilityReason(
    answers.authentication,
    authContext,
  );
  if (authenticationError) throw new Error(authenticationError);

  const integrated = answers.architecture.kind === "integrated-fullstack";
  const integratedLaravel = answers.architecture.kind === "integrated-laravel";
  const native = answers.architecture.kind === "native-app";

  if (native) {
    if (
      answers.architecture.kind !== "native-app" ||
      answers.projectType !== answers.architecture.platform ||
      answers.language !== "typescript"
    ) {
      throw new Error(
        "Native Expo and Tauri scaffolds require their matching platform and TypeScript.",
      );
    }
    if (
      answers.fullStack ||
      answers.backendRuntime ||
      answers.backendFramework ||
      answers.orm ||
      answers.database ||
      answers.extras.tailwind ||
      answers.extras.eslintPrettier ||
      answers.extras.shadcn
    ) {
      throw new Error(
        "Native Expo and Tauri scaffolds do not accept web backend, database, or extra layers.",
      );
    }
    return;
  }

  if (answers.projectType !== "web") {
    throw new Error("Mobile and desktop projects must use the native-app architecture.");
  }
  if (answers.frontend === "inertia-react" && !integratedLaravel) {
    throw new Error("Laravel Inertia React must use the integrated Laravel architecture.");
  }
  if (integratedLaravel) {
    if (answers.architecture.kind !== "integrated-laravel") {
      throw new Error("Integrated Laravel mode must identify its selected UI architecture.");
    }
    const livewire = answers.architecture.mode === "livewire";
    const inertiaReact = answers.architecture.mode === "inertia-react";
    if (
      !answers.fullStack ||
      (!(livewire && answers.frontend === "livewire") &&
        !(inertiaReact && answers.frontend === "inertia-react")) ||
      (livewire && answers.language !== null) ||
      (inertiaReact && answers.language !== "typescript") ||
      answers.backendRuntime !== "php" ||
      answers.backendFramework !== "laravel" ||
      answers.orm !== null ||
      answers.database !== "sqlite" ||
      answers.extras.tailwind ||
      answers.extras.eslintPrettier ||
      answers.extras.shadcn
    ) {
      throw new Error(
        livewire
          ? "Integrated Laravel Livewire currently requires PHP + Laravel + SQLite, with no separate frontend, ORM, or extras."
          : "Integrated Laravel Inertia React currently requires PHP + Laravel + SQLite + TypeScript, with no separate API, ORM, or extras.",
      );
    }
    return;
  }
  if (
    answers.language === null ||
    !supportsLanguage(answers.projectType, answers.frontend, answers.language)
  ) {
    throw new Error("JavaScript is only available for the React/Vite web frontend.");
  }
  if (
    answers.extras.shadcn &&
    !supportsShadcn(answers.projectType, answers.frontend, answers.architecture)
  ) {
    throw new Error("shadcn/ui is only available for React/Vite web projects.");
  }

  if (answers.frontend === "nextjs") {
    if (
      !integrated ||
      !answers.fullStack ||
      answers.backendRuntime !== null ||
      answers.backendFramework !== null ||
      answers.orm !== "none" ||
      answers.database === null ||
      !(RUNTIME_DATABASES.node as readonly string[]).includes(answers.database) ||
      !answers.extras.tailwind ||
      !answers.extras.eslintPrettier
    ) {
      throw new Error(
        "Next.js must use the integrated full-stack architecture with raw SQL, a supported database, and no separate backend.",
      );
    }
    return;
  }

  if (integrated) {
    throw new Error("Only Next.js can use the integrated full-stack architecture.");
  }

  if (answers.fullStack) {
    if (
      answers.architecture.kind !== "separate-frontend-api" ||
      answers.backendRuntime === null ||
      answers.backendFramework === null ||
      answers.database === null
    ) {
      throw new Error("A separate full-stack project requires a compatible backend and database.");
    }
    const frameworks = RUNTIME_BACKENDS[answers.backendRuntime];
    if (!(frameworks as readonly string[]).includes(answers.backendFramework)) {
      throw new Error(
        `${answers.backendFramework} is not available for the ${answers.backendRuntime} runtime.`,
      );
    }
    if (answers.backendRuntime === "node") {
      const allowedOrms = nodeOrmsForFramework(answers.backendFramework);
      if (answers.orm === null || !allowedOrms.includes(answers.orm)) {
        throw new Error(
          `${answers.orm ?? "No ORM"} is not available for ${answers.backendFramework}.`,
        );
      }
    } else if (answers.orm !== null) {
      throw new Error(
        `${answers.backendRuntime} backends use their built-in data access layer, not a Node ORM.`,
      );
    }
    if (
      !(RUNTIME_DATABASES[answers.backendRuntime] as readonly string[]).includes(answers.database)
    ) {
      throw new Error(
        `${answers.database} is not available for the ${answers.backendRuntime} runtime.`,
      );
    }
  } else if (
    answers.architecture.kind !== "frontend-only" ||
    answers.backendRuntime !== null ||
    answers.backendFramework !== null ||
    answers.orm !== null ||
    answers.database !== null
  ) {
    throw new Error("Frontend-only projects cannot include backend or database selections.");
  }
}
