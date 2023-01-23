import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

import { testDbHealth, testRedisHealth } from '../infrastructure/healthchecks'

function plugin(fastify: FastifyInstance, opts: unknown, done: () => void) {
  const { prisma, redis } = fastify.diContainer.cradle

  fastify.addHealthCheck('heartbeat', () => true)
  fastify.addHealthCheck('redis', async () => testRedisHealth(redis))
  fastify.addHealthCheck('mysql', async () => testDbHealth(prisma))

  done()
}

export const healthcheckPlugin = fp(plugin, {
  fastify: '4.x',
  name: 'healthcheck-plugin',
})
