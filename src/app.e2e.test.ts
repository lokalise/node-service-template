import { buildClient, sendGet } from '@lokalise/node-core'
import type { FastifyInstance } from 'fastify'

import { getApp } from './app'

describe('app', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    app = await getApp()
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
})
