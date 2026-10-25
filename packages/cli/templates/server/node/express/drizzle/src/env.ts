import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required — copy .env.example to .env'),
})

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('❌ Invalid environment variables:', z.prettifyError(parsed.error))
  process.exit(1)
}

export const env = parsed.data
