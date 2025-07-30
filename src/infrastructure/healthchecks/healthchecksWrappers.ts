import type { HealthChecker } from '@lokalise/fastify-extras'
import type { Either } from '@lokalise/node-core'
import type { FastifyInstance } from 'fastify'

export const redisHealthCheck: HealthChecker = (
  app: FastifyInstance,
): Promise<Either<Error, true>> => {
  return app.diContainer.cradle.healthcheckStore.getAsyncHealthCheckResult('redis')
}

export const dbHealthCheck: HealthChecker = (
  app: FastifyInstance,
): Promise<Either<Error, true>> => {
  return app.diContainer.cradle.healthcheckStore.getAsyncHealthCheckResult('postgres')
}
