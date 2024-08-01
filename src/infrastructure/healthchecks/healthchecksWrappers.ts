import type { HealthChecker } from '@lokalise/fastify-extras'
import type { Either } from '@lokalise/node-core'
import type { FastifyInstance } from 'fastify'

import type { AppInstance } from '../../app.js'

export const wrapHealthCheck = (app: AppInstance, healthCheck: HealthChecker) => {
  return async () => {
    const response = await healthCheck(app as unknown as FastifyInstance)
    if (response.error) {
      throw response.error
    }
  }
}

export const redisHealthCheck: HealthChecker = (
  app: FastifyInstance,
): Promise<Either<Error, true>> => {
  const checkResult = app.diContainer.cradle.healthcheckStore.getHealthcheckResult('redis')

  if (checkResult === false) {
    return Promise.resolve({
      error: new Error('Redis did not respond with PONG'),
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
      error: new Error('DB healthcheck got an unexpected response'),
    })
  }
  return Promise.resolve({ result: true })
}

export function registerHealthChecks(app: AppInstance) {
  app.addHealthCheck('heartbeat', () => true)
  app.addHealthCheck('redis', wrapHealthCheck(app, redisHealthCheck))
  app.addHealthCheck('postgres', wrapHealthCheck(app, dbHealthCheck))
}
