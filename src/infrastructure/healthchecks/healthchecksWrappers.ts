import type { HealthChecker } from '@lokalise/fastify-extras'
import type { Either } from '@lokalise/node-core'
import type { FastifyInstance } from 'fastify'

export const redisHealthCheck: HealthChecker = (
  app: FastifyInstance,
): Promise<Either<Error, true>> => {
  const checkResult = app.diContainer.cradle.healthcheckStore.getHealthcheckResult('redis')

  if (checkResult === false) {
    return Promise.resolve({
      error: new Error('Redis healthcheck not positive in store'),
    })
  }
  return Promise.resolve({ result: true })
}

export const dbHealthCheck: HealthChecker = (
  app: FastifyInstance,
): Promise<Either<Error, true>> => {
  const checkResult = app.diContainer.cradle.healthcheckStore.getHealthcheckResult('postgres')

  if (checkResult === false) {
    return Promise.resolve({
      error: new Error('DB healthcheck not positive in store'),
    })
  }
  return Promise.resolve({ result: true })
}
