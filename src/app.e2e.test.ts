import { buildClient, sendGet } from '@lokalise/node-core'
import type { FastifyInstance } from 'fastify'

import { getApp } from './app'
import { TestContext, createTestContext } from 'test/TestContext'
import { Config } from './infrastructure/config'

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
      const response = await app.inject().get('/health').end()

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
      const response = await app.inject().get('/').end()

      expect(response.json()).toMatchObject({
        gitCommitSha: 'sha',
        heartbeat: 'HEALTHY',
        status: 'OK',
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
      let testContext: TestContext
      let config: Config
      beforeEach(() => {
        testContext = createTestContext({}, {})
        config = testContext.diContainer.cradle.config
      })
      it('resolves to default value', () => {
        expect(config.iAmHereForTestingConfigOverrideInTests.firstValue).toBe(true)
        expect(config.iAmHereForTestingConfigOverrideInTests.secondValue).toBe(true)
      })
    })

    describe('when overwritten', () => {
      let testContext: TestContext
      let config: Config
      beforeEach(() => {
        testContext = createTestContext(
          {},
          { iAmHereForTestingConfigOverrideInTests: { firstValue: false } },
        )
        config = testContext.diContainer.cradle.config
      })
      it('resolves to override value', () => {
        expect(config.iAmHereForTestingConfigOverrideInTests.firstValue).toBe(false)
        expect(config.iAmHereForTestingConfigOverrideInTests.secondValue).toBe(true)
      })
    })
  })
})
