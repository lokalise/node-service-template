import { types } from 'node:util'
import type { Either } from '@lokalise/node-core'
import { Gauge } from 'prom-client'

import type { PrismaClient } from '@prisma/client'
import type Redis from 'ioredis'
import { FifoMap } from 'toad-cache'
import type { CommonDependencies } from '../commonDiConfig.js'

export type SupportedHealthchecks = 'redis' | 'postgres'

export type HealthcheckEntry = {
  isSuccessful?: boolean
  errorMessage?: string
  checkTimestamp: Date
  latency?: number
}

const STALENESS_THRESHOLD = 30000 // 30 seconds
export const healthcheckStore = new FifoMap<HealthcheckEntry>(5, 20000)

function isLessThanMSecsAgo(givenDate: Date, deltaInMsecs: number) {
  return Date.now() - givenDate.getTime() < deltaInMsecs
}

/**
 * Returns true if check is passing, false if not
 */
export function getHealthcheckResult(healthcheck: SupportedHealthchecks): boolean {
  const healthcheckEntry = healthcheckStore.get(healthcheck)
  // If we don't have any results yet, we assume service is healthy
  if (!healthcheckEntry) {
    const emptyEntry: HealthcheckEntry = {
      checkTimestamp: new Date(),
    }
    healthcheckStore.set(healthcheck, emptyEntry)
    return true
  }

  if (healthcheckEntry.isSuccessful) {
    return true
  }

  if (healthcheckEntry.isSuccessful === false) {
    return false
  }

  // If we still don't have healthcheck results, check how old the undefined state is
  // If it is very stale, assume check is broken and report unhealthy service
  return isLessThanMSecsAgo(healthcheckEntry.checkTimestamp, STALENESS_THRESHOLD)
}

export function getHealthcheckLatency(healthcheck: SupportedHealthchecks): number | undefined {
  const healthcheckEntry = healthcheckStore.get(healthcheck)
  if (!healthcheckEntry) {
    return undefined
  }

  return healthcheckEntry.latency
}

export function resetHealthcheckStores() {
  healthcheckStore.clear()
}

export type Healthcheck = {
  areMetricsEnabled: boolean

  instantiateMetrics: () => void
  execute: () => Promise<void>
  check: () => Promise<Either<Error, number>>
  storeResult: (result: Either<Error, number>) => void
}

export abstract class AbstractHealthcheck implements Healthcheck {
  readonly areMetricsEnabled: boolean

  // returns execution time in msecs if successful
  abstract check(): Promise<Either<Error, number>>

  abstract getId(): SupportedHealthchecks

  constructor(areMetricsEnabled: boolean) {
    this.areMetricsEnabled = areMetricsEnabled

    if (areMetricsEnabled) {
      this.instantiateMetrics()
    }
  }

  instantiateMetrics(): void {
    if (!this.areMetricsEnabled) {
      return
    }
    const id = this.getId()
    new Gauge({
      name: `${id}_availability`,
      help: `Whether ${id} was available at the time`,
      collect() {
        const checkResult = getHealthcheckResult(id)
        this.set(checkResult !== false ? 1 : 0)
      },
    })
    new Gauge({
      name: `${id}_latency_msecs`,
      help: `How long the healthcheck for ${id} took`,
      collect() {
        const checkLength = getHealthcheckLatency(id)
        this.set(checkLength ?? 0)
      },
    })
  }

  async execute(): Promise<void> {
    const result = await this.check()
    this.storeResult(result)
  }
  storeResult(result: Either<Error, number>): void {
    const id = this.getId()
    healthcheckStore.set(id, {
      latency: result.error ? undefined : result.result,
      checkTimestamp: new Date(),
      isSuccessful: !result.error,
      errorMessage: result.error ? result.error.message : undefined,
    })
  }
}

export class RedisHealthcheck extends AbstractHealthcheck implements Healthcheck {
  private readonly redis: Redis

  constructor({ redis, config }: CommonDependencies) {
    super(config.app.metrics.isEnabled)
    this.redis = redis
  }

  getId(): SupportedHealthchecks {
    return 'redis'
  }

  async check(): Promise<Either<Error, number>> {
    let checkTimeInMsecs: number
    try {
      const startTime = Date.now()
      const result = await this.redis.ping()
      checkTimeInMsecs = Date.now() - startTime
      if (result !== 'PONG') {
        return { error: new Error('Redis did not respond with PONG') }
      }
    } catch (_err) {
      return { error: new Error('Redis did not respond with PONG') }
    }

    return { result: checkTimeInMsecs }
  }
}

export class DbHealthcheck extends AbstractHealthcheck implements Healthcheck {
  private readonly prisma: PrismaClient

  constructor({ config, prisma }: CommonDependencies) {
    super(config.app.metrics.isEnabled)
    this.prisma = prisma
  }

  getId(): SupportedHealthchecks {
    return 'postgres'
  }

  async check(): Promise<Either<Error, number>> {
    let checkTimeInMsecs: number
    try {
      const startTime = Date.now()
      const response = await this.prisma.$queryRaw`SELECT 1`
      checkTimeInMsecs = Date.now() - startTime
      if (!response) {
        return {
          error: new Error('DB healthcheck got an unexpected response'),
        }
      }
    } catch (error) {
      if (types.isNativeError(error)) {
        return {
          error: new Error(`An error occurred during DB healthcheck: ${error.message}`),
        }
      }
      return {
        error: new Error('An unexpected error occurred during DB healthcheck'),
      }
    }
    return { result: checkTimeInMsecs }
  }
}
