import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  // Generous defaults — a dev/CRUD baseline, not a hard guard.
  RATE_LIMIT_MAX: z.coerce.number().default(300),
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().default(15),
});

// CI/build-time escape hatch: when SKIP_ENV_VALIDATION is "1" or "true",
// placeholder values are exported instead of exiting, so steps that only
// import the app (typecheck, bundling, container builds) can run without
// real configuration. NEVER enable this in production — placeholders are
// intentionally unusable and real settings would go unvalidated.
const skipEnvValidation = ["1", "true"].includes(
  (process.env.SKIP_ENV_VALIDATION ?? "").toLowerCase(),
);

function parseEnv(): z.infer<typeof envSchema> {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("❌ Invalid environment variables:", z.prettifyError(parsed.error));
    process.exit(1);
  }
  return parsed.data;
}

export const env = skipEnvValidation
  ? ({
      PORT: 3000,
      CORS_ORIGIN: "http://localhost:5173",
      RATE_LIMIT_MAX: 300,
      RATE_LIMIT_WINDOW_MINUTES: 15,
    } satisfies z.infer<typeof envSchema>)
  : parseEnv();
