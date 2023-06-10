import { types } from 'node:util'

import type { HealthCheck } from '@lokalise/fastify-extras'
import type { Either } from '@lokalise/node-core'
import { executeAsyncAndHandleGlobalErrors } from '@lokalise/node-core'
import type { FastifyInstance } from 'fastify'

export const wrapHealthCheck = (app: FastifyInstance, healthCheck: HealthCheck) => {
  return async () => {
    const response = await healthCheck(app)
    if (response.error) {
      throw response.error
    }
  }
}

export const redisHealthCheck: HealthCheck = async (app): Promise<Either<Error, true>> => {
  const redis = app.diContainer.cradle.redis

  try {
    const result = await redis.ping()
    if (result !== 'PONG') {
      return { error: new Error('Redis did not respond with PONG') }
    }
  } catch (err) {
    return { error: new Error('Redis did not respond with PONG') }
  }

  return { result: true }
}
export const dbHealthCheck: HealthCheck = async (app): Promise<Either<Error, true>> => {
  const prisma = app.diContainer.cradle.prisma
  try {
    const response = await prisma.$queryRaw`SELECT 1`
    if (!response) {
      return {
        error: new Error('DB healthcheck got an unexpected response'),
      }
    }
  } catch (error) {
    if (types.isNativeError(error)) {
      return {
        error: new Error(`An error occurred during DB healthcheck: ${error.message}`),
      }
    }
    return {
      error: new Error('An unexpected error occurred during DB healthcheck'),
    }
  }
  return { result: true }
}

export function registerHealthChecks(app: FastifyInstance) {
  app.addHealthCheck('heartbeat', () => true)
  app.addHealthCheck('redis', wrapHealthCheck(app, redisHealthCheck))
  app.addHealthCheck('mysql', wrapHealthCheck(app, dbHealthCheck))
}

export async function runAllHealthchecks(app: FastifyInstance) {
  return executeAsyncAndHandleGlobalErrors(
    () =>
      Promise.all([
        wrapHealthCheck(app, dbHealthCheck)(),
        wrapHealthCheck(app, redisHealthCheck)(),
      ]),
    false,
  )
}
