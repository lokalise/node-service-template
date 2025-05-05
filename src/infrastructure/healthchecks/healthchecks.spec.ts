import { asFunction } from 'awilix'
import type { FastifyInstance } from 'fastify'
import type { Redis } from 'ioredis'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AppInstance } from '../../app.ts'
import { getApp } from '../../app.ts'

import { randomUUID } from 'node:crypto'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { dbHealthCheck, redisHealthCheck } from './healthchecksWrappers.ts'

const createRedisMock = (pingLatency: number, response = 'PONG') =>
  ({
    ping: () => new Promise((resolve) => setTimeout(resolve, pingLatency, response)),
  }) as Pick<Redis, 'ping'>

const createDrizzleMock = (shouldSucceed: boolean) =>
  ({
    execute: () => {
      if (shouldSucceed) {
        return Promise.resolve([{ 1: 1n }])
      }
      throw new Error(
        "Can't reach database server at `test-service.server.test`:`1234`\n\nPlease make sure your database server is running at `test-service.server.test`:`1234`.",
      )
    },
  }) as unknown as Pick<PostgresJsDatabase, 'execute'>

describe('healthcheck', () => {
  let app: AppInstance
  beforeEach(async () => {
    app = await getApp()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('DB healthcheck', () => {
    it('Fails on unexpected DB response', async () => {
      app.diContainer.register(
        'drizzle',
        asFunction(() => createDrizzleMock(false)),
      )

      await app.diContainer.cradle.healthcheckRefreshJob.process(randomUUID())
      const result = await dbHealthCheck(app as unknown as FastifyInstance)
      expect(result.result).toBeUndefined()
      expect(result.error).toBeDefined()
    })

    it('Does not fail on successful DB ping', async () => {
      app.diContainer.register(
        'drizzle',
        asFunction(() => createDrizzleMock(true)),
      )

      await app.diContainer.cradle.healthcheckRefreshJob.process(randomUUID())
      const result = await dbHealthCheck(app as unknown as FastifyInstance)
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

      await app.diContainer.cradle.healthcheckRefreshJob.process(randomUUID())
      const result = await redisHealthCheck(app as unknown as FastifyInstance)
      expect(result).toMatchObject({
        error: new Error('Redis healthcheck not positive in store'),
      })
    })

    it('Fails on timeout', async () => {
      const { redis } = app.diContainer.cradle
      redis.disconnect()

      expect.assertions(1)

      await app.diContainer.cradle.healthcheckRefreshJob.process(randomUUID())
      const promise = redisHealthCheck(app as unknown as FastifyInstance)

      await expect(promise).resolves.toMatchObject({
        error: new Error('Redis healthcheck not positive in store'),
      })
    })

    it('Does not fail on successful Redis ping', async () => {
      app.diContainer.register(
        'redis',
        asFunction(() => createRedisMock(0)),
      )

      await app.diContainer.cradle.healthcheckRefreshJob.process(randomUUID())
      const result = await redisHealthCheck(app as unknown as FastifyInstance)
      expect(result).toMatchObject({
        result: true,
      })
    })
  })
})
