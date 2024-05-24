import { UNKNOWN_RESPONSE_SCHEMA, buildClient, sendGet } from '@lokalise/backend-http-client'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestContext } from '../test/TestContext.js'

import type { AppInstance } from './app.js'
import { getApp } from './app.js'
import type { Config } from './infrastructure/config.js'

describe('app', () => {
  let app: AppInstance
  beforeAll(async () => {
    app = await getApp({
      monitoringEnabled: true,
    })

    afterAll(async () => {
      await app.close()
    })
  })

  describe('healthcheck', () => {
    it('Returns health check information', async () => {
      const response = await app.inject().get('/').end()

      expect(response.json()).toMatchObject({
        healthChecks: {
          heartbeat: 'HEALTHY',
          redis: 'HEALTHY',
          postgres: 'HEALTHY',
        },
      })
      expect(response.statusCode).toBe(200)
    })

    it('Returns public health check information', async () => {
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
      const response = await sendGet(buildClient('http://127.0.0.1:9080'), '/metrics', {
        responseSchema: UNKNOWN_RESPONSE_SCHEMA,
        requestLabel: 'test',
      })

      expect(response.result.statusCode).toBe(200)
    })

    it('Returns Prometheus healthcheck metrics', async () => {
      const response = await sendGet(buildClient('http://127.0.0.1:9080'), '/metrics', {
        responseSchema: UNKNOWN_RESPONSE_SCHEMA,
        requestLabel: 'test',
      })

      expect(response.result.statusCode).toBe(200)
      expect(response.result.body).toContain('redis_availability 1')
      expect(response.result.body).toContain('redis_latency_msecs ')

      expect(response.result.body).toContain('postgres_availability 1')
      expect(response.result.body).toContain('postgres_latency_msecs ')
    })
  })

  describe('OpenAPI documentation', () => {
    it('Returns OpenAPI information (JSON)', async () => {
      const response = await app.inject().get('/documentation/json').end()

      expect(response.statusCode).toBe(200)
    })

    it('Returns OpenAPI information (HTML)', async () => {
      const response = await app.inject().get('/documentation/static/index.html').end()

      expect(response.statusCode).toBe(200)
    })
  })

  describe('config overrides in tests', () => {
    describe('when not overwritten', () => {
      let config: Config

      beforeEach(async () => {
        const testContext = await createTestContext({}, {})
        config = testContext.diContainer.cradle.config
      })

      it('resolves to default value', () => {
        expect(config.vendors.amplitude.isEnabled).toBe(false)
        expect(config.vendors.amplitude.serverZone).toBe('EU')
        expect(config.vendors.amplitude.flushIntervalMillis).toBe(10000)
      })
    })

    describe('when overwritten', () => {
      let config: Config

      beforeEach(async () => {
        const testContext = await createTestContext(
          {},
          {},
          { vendors: { amplitude: { serverZone: 'US' } } },
        )
        config = testContext.diContainer.cradle.config
      })

      it('resolves to override value', () => {
        expect(config.vendors.amplitude.isEnabled).toBe(false)
        expect(config.vendors.amplitude.serverZone).toBe('US')
        expect(config.vendors.amplitude.flushIntervalMillis).toBe(10000)
      })
    })
  })
})
