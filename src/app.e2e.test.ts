import { buildClient, sendGet } from '@lokalise/node-core'
import type { FastifyInstance } from 'fastify'

import { createTestContext } from '../test/TestContext'

import { getApp } from './app'
import type { Config } from './infrastructure/config'

describe('app', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    app = await getApp({
      monitoringEnabled: true,
    })
  })

  afterAll(async () => {
    await app.close()
  })

  describe('healthcheck', () => {
    it('Returns health check information', async () => {
      const response = await app.inject().get('/').end()

      expect(response.json()).toMatchObject({
        healthChecks: {
          heartbeat: 'HEALTHY',
          redis: 'HEALTHY',
          mysql: 'HEALTHY',
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
          mysql: 'HEALTHY',
          redis: 'HEALTHY',
        },
        version: '1',
      })
      expect(response.statusCode).toBe(200)
    })
  })

  describe('metrics', () => {
    it('Returns Prometheus metrics', async () => {
      const response = await sendGet(buildClient('http://127.0.0.1:9080'), '/metrics')

      expect(response.result.statusCode).toBe(200)
    })

    it('Returns Prometheus healthcheck metrics', async () => {
      const response = await sendGet(buildClient('http://127.0.0.1:9080'), '/metrics')

      expect(response.result.statusCode).toBe(200)
      expect(response.result.body).toContain('redis_availability 1')
      expect(response.result.body).toContain('redis_latency_msecs ')

      expect(response.result.body).toContain('mysql_availability 1')
      expect(response.result.body).toContain('mysql_latency_msecs ')
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

      beforeEach(() => {
        const testContext = createTestContext({}, {})
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

      beforeEach(() => {
        const testContext = createTestContext({}, { vendors: { amplitude: { serverZone: 'US' } } })
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
