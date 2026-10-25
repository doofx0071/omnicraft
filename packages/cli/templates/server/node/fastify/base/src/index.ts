import 'dotenv/config'
import cors from '@fastify/cors'
import Fastify from 'fastify'
import { env } from './env.js'
import { apiRoutes } from './routes/index.js'

const app = Fastify({ logger: true })

await app.register(cors, { origin: env.CORS_ORIGIN })
await app.register(apiRoutes, { prefix: '/api' })

await app.listen({ port: env.PORT, host: '0.0.0.0' })

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.close().finally(() => process.exit(0))
  })
}
