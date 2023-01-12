import { InternalError } from '@lokalise/node-core'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import type { Redis } from 'ioredis'

import { runWithTimeout, TIMEOUT } from '../utils/timeoutUtils'

const HEALTHCHECK_ERROR_CODE = 'HEALTHCHECK_ERROR'
const REDIS_HEALTHCHECK_TIMEOUT = 10 * 1000

export async function testRedisHealth(redis: Redis) {
  const result = await runWithTimeout(redis.ping(), REDIS_HEALTHCHECK_TIMEOUT)

  if (result === TIMEOUT) {
    throw new Error('Redis connection timed out')
  }

  if (result !== 'PONG') {
    throw new InternalError({
      message: 'Redis did not respond with PONG',
      errorCode: HEALTHCHECK_ERROR_CODE,
    })
  }
}

export async function testDbHealth(prisma: PrismaClient) {
  const response = await prisma.$queryRaw`SELECT 1`
  if (!response) {
    throw new InternalError({
      message: 'Prisma did not respond correctly',
      errorCode: HEALTHCHECK_ERROR_CODE,
    })
  }
}

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
