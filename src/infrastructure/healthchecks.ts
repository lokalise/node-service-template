import { InternalError } from '@lokalise/node-core'
import type { PrismaClient } from '@prisma/client'
import type { Redis } from 'ioredis'

import { runWithTimeout, TIMEOUT } from '../utils/timeoutUtils'

import type { Dependencies } from './diConfig'
import { executeAsyncAndHandleGlobalErrors } from './errors/globalErrorHandler'

const HEALTHCHECK_ERROR_CODE = 'HEALTHCHECK_ERROR'
const REDIS_HEALTHCHECK_TIMEOUT = 10 * 1000

export async function testRedisHealth(redis: Redis) {
  const result = await runWithTimeout(redis.ping(), REDIS_HEALTHCHECK_TIMEOUT)

  if (result === TIMEOUT) {
    throw new Error('Redis connection timed out')
  }

  if (result !== 'PONG') {
    throw new InternalError({
      message: 'Redis did not respond with PONG',
      errorCode: HEALTHCHECK_ERROR_CODE,
    })
  }
}

export async function testDbHealth(prisma: PrismaClient) {
  const response = await prisma.$queryRaw`SELECT 1`
  if (!response) {
    throw new InternalError({
      message: 'Database did not respond correctly',
      errorCode: HEALTHCHECK_ERROR_CODE,
    })
  }
}

export async function runAllHealthchecks(dependencies: Dependencies) {
  return executeAsyncAndHandleGlobalErrors(
    () => Promise.all([testDbHealth(dependencies.prisma), testRedisHealth(dependencies.redis)]),
    false,
  )
}
