import type { FastifyInstance } from 'fastify'
import { healthRoutes } from './health.js'
import { usersRoutes } from './users.js'

export async function apiRoutes(app: FastifyInstance) {
  await app.register(healthRoutes)
  await app.register(usersRoutes, { prefix: '/users' })
}
