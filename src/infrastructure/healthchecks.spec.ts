import type { PrismaClient } from '@prisma/client'
import { asFunction } from 'awilix'
import type { FastifyInstance } from 'fastify'
import type Redis from 'ioredis'

import { getApp } from '../app'

import { dbHealthCheck, redisHealthCheck } from './healthchecks'

const createRedisMock = (pingLatency: number, response = 'PONG') =>
  ({
    ping: () => new Promise((resolve) => setTimeout(resolve, pingLatency, response)),
  } as Pick<Redis, 'ping'>)

const createPrismaMock = (shouldSucceed: boolean) =>
  ({
    $queryRaw: () => {
      if (shouldSucceed) {
        return Promise.resolve([{ 1: 1n }])
      }
      throw new Error(
        "Can't reach database server at `test-service.server.test`:`1234`\n\nPlease make sure your database server is running at `test-service.server.test`:`1234`.",
      )
    },
  } as Pick<PrismaClient, '$queryRaw'>)

describe('healthcheck', () => {
  let app: FastifyInstance
  beforeEach(async () => {
    app = await getApp()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('DB healthcheck', () => {
    it('Fails on unexpected DB response', async () => {
      app.diContainer.register(
        'prisma',
        asFunction(() => createPrismaMock(false)),
      )

      const result = await dbHealthCheck(app)
      expect(result.result).toBeUndefined()
      expect(result.error).toBeDefined()
    })

    it('Does not fail on successful DB ping', async () => {
      app.diContainer.register(
        'prisma',
        asFunction(() => createPrismaMock(true)),
      )

      const result = await dbHealthCheck(app)
      expect(result.result).toBeDefined()
      expect(result.error).toBeUndefined()
    })
  })

  describe('Redis healthcheck', () => {
    it('Fails on unexpected Redis response', async () => {
      void app.diContainer.register(
        'redis',
        asFunction(() => createRedisMock(0, '')),
      )

      const result = await redisHealthCheck(app)
      expect(result).toMatchObject({
        error: new Error('Redis did not respond with PONG'),
      })
    })

    it('Fails on timeout', async () => {
      const { redis } = app.diContainer.cradle
      redis.disconnect()

      expect.assertions(1)
      const promise = redisHealthCheck(app)

      await expect(promise).resolves.toMatchObject({
        error: new Error('Redis did not respond with PONG'),
      })
    })

    it('Does not fail on successful Redis ping', async () => {
      app.diContainer.register(
        'redis',
        asFunction(() => createRedisMock(0)),
      )

      const result = await redisHealthCheck(app)
      expect(result).toMatchObject({
        result: true,
      })
    })
  })
})
