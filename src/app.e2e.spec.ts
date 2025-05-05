import { TEST_OPTIONS, buildClient, sendGet } from '@lokalise/backend-http-client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { randomUUID } from 'node:crypto'
import { HealthcheckRefreshJob } from '@lokalise/healthcheck-utils'
import type { AppInstance } from './app.ts'
import { getApp } from './app.ts'
import type { Config } from './infrastructure/config.ts'

describe('app', () => {
  let app: AppInstance
  beforeAll(async () => {
    app = await getApp({
      monitoringEnabled: true,
      healthchecksEnabled: true,
      periodicJobsEnabled: [HealthcheckRefreshJob.JOB_NAME],
      app: {
        metrics: {
          isEnabled: true,
        },
      },
    })
  })

  afterAll(async () => {
    await app.close()
  })

  describe('healthcheck', () => {
    it('Returns public health check information', async () => {
      const response = await app.inject().get('/').end()

      expect(response.json()).toMatchObject({
        gitCommitSha: 'sha',
        heartbeat: 'HEALTHY',
        version: '1',
      })
      expect(response.statusCode).toBe(200)
    })

    it('Returns private health check information', async () => {
      const response = await app.inject().get('/health').end()

      expect(response.json()).toMatchObject({
        gitCommitSha: 'sha',
        heartbeat: 'HEALTHY',
        checks: {
          postgres: 'HEALTHY',
          redis: 'HEALTHY',
        },
        version: '1',
      })
      expect(response.statusCode).toBe(200)
    })
  })

  describe('metrics', () => {
    it('Returns Prometheus metrics', async () => {
      const response = await sendGet(buildClient('http://127.0.0.1:9080'), '/metrics', TEST_OPTIONS)

      expect(response.result.statusCode).toBe(200)
    })

    it('Returns Prometheus healthcheck metrics', async () => {
      await app.diContainer.cradle.healthcheckRefreshJob.process(randomUUID())
      const response = await sendGet(buildClient('http://127.0.0.1:9080'), '/metrics', TEST_OPTIONS)

      expect(response.result.statusCode).toBe(200)
      expect(response.result.body).toContain('redis_availability 1')
      expect(response.result.body).toContain('redis_latency_msecs ')

      expect(response.result.body).toContain('postgres_availability 1')
      expect(response.result.body).toContain('postgres_latency_msecs ')
    })
  })

  describe('OpenAPI documentation', () => {
    it('Returns OpenAPI information (Redirect)', async () => {
      const response = await app.inject().get('/documentation').end()

      expect(response.statusCode).toBe(302)
    })

    it('Returns OpenAPI information (HTML)', async () => {
      const response = await app.inject().get('/documentation/').end()

      expect(response.statusCode).toBe(200)
    })

    it('Returns OpenAPI information (OpenAPI.json)', async () => {
      const response = await app.inject().get('/documentation/openapi.json').end()

      expect(response.statusCode).toBe(200)
    })
  })

  describe('config overrides in tests', () => {
    describe('when not overwritten', () => {
      let config: Config
      let app: AppInstance
      beforeEach(async () => {
        app = await getApp()
        config = app.diContainer.cradle.config
      })

      afterEach(async () => {
        await app.close()
      })

      it('resolves to default value', () => {
        expect(config.vendors.amplitude.isEnabled).toBe(false)
        expect(config.vendors.amplitude.serverZone).toBe('EU')
        expect(config.vendors.amplitude.flushIntervalMillis).toBe(10000)
      })
    })

    describe('when overwritten', () => {
      let config: Config
      let app: AppInstance
      beforeEach(async () => {
        app = await getApp({ vendors: { amplitude: { serverZone: 'US' } } })
        config = app.diContainer.cradle.config
      })
      afterEach(async () => {
        await app.close()
      })

      it('resolves to override value', () => {
        expect(config.vendors.amplitude.isEnabled).toBe(false)
        expect(config.vendors.amplitude.serverZone).toBe('US')
        expect(config.vendors.amplitude.flushIntervalMillis).toBe(10000)
      })
    })
  })
})
