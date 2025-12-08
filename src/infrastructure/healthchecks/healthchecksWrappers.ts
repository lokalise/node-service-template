import type { HealthCheckerSync } from '@lokalise/fastify-extras'
import type { FastifyInstance } from 'fastify'

export const redisHealthCheck: HealthCheckerSync = (app: FastifyInstance): Error | null => {
  const healthCheck = app.diContainer.cradle.healthcheckStore.getHealthcheckResult('redis')
  if (healthCheck.result) {
    return null
  }
  return new Error(`Error occurred during redis healthcheck: ${healthCheck.error}`)
}

export const dbHealthCheck: HealthCheckerSync = (app: FastifyInstance): Error | null => {
  const healthCheck = app.diContainer.cradle.healthcheckStore.getHealthcheckResult('postgres')
  if (healthCheck.result) {
    return null
  }
  return new Error(`Error occurred during db healthcheck: ${healthCheck.error}`)
}
