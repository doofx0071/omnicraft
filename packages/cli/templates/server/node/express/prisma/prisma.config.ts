import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

// Prisma ORM v7 keeps CLI-side configuration here instead of package.json.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
})
