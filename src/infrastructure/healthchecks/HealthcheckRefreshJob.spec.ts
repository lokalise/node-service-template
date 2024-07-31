import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { cleanRedis } from '../../../test/RedisCleaner.js'
import { type AppInstance, getApp } from '../../app.js'
import { HealthcheckRefreshJob } from './HealthcheckRefreshJob.js'
import { getHealthcheckResult, resetHealthcheckStores } from './healthchecks.js'
import { dbHealthCheck, redisHealthCheck } from './healthchecksWrappers.js'

describe('HealthcheckRefreshJob', () => {
  let app: AppInstance
  let job: HealthcheckRefreshJob
  beforeAll(async () => {
    app = await getApp({
      jobsEnabled: [HealthcheckRefreshJob.JOB_NAME],
    })
    job = app.diContainer.cradle.healthcheckRefreshJob
  })
  beforeEach(async () => {
    resetHealthcheckStores()
    await cleanRedis(app.diContainer.cradle.redis)
  })

  afterAll(async () => {
    await app.close()
  })

  it('updates successful redis healthcheck', async () => {
    await job.process(randomUUID())
    const healthcheckSuccess = await redisHealthCheck(app as unknown as FastifyInstance)
    const healthcheckResult = getHealthcheckResult('redis')

    expect(healthcheckSuccess.result).toBe(true)
    expect(healthcheckResult).toBe(true)
  })

  it('updates successful db healthcheck', async () => {
    await job.process(randomUUID())
    const healthcheckSuccess = await dbHealthCheck(app as unknown as FastifyInstance)
    const healthcheckResult = getHealthcheckResult('postgres')

    expect(healthcheckSuccess.result).toBe(true)
    expect(healthcheckResult).toBe(true)
  })
})
