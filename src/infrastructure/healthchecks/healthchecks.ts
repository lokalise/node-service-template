import { types } from 'node:util'
import type { Either } from '@lokalise/node-core'
import { Gauge } from 'prom-client'

import type { PrismaClient } from '@prisma/client'
import type Redis from 'ioredis'
import { FifoMap } from 'toad-cache'
import type { CommonDependencies } from '../commonDiConfig.js'

export type SupportedHealthchecks = 'redis' | 'postgresql'

export const healthcheckResultStore = new FifoMap<boolean>(5, 20)
export const healthcheckLatencyStore = new FifoMap<number | undefined>(5, 20)

export function getHealthcheckResult(healthcheck: SupportedHealthchecks): boolean {
  // if we don't yet have results, we consider that to be a success, in order to avoid arbitrary restarts
  return healthcheckResultStore.get(healthcheck) !== false
}

export function getHealthcheckLatency(healthcheck: SupportedHealthchecks): number | undefined {
  return healthcheckLatencyStore.get(healthcheck)
}

export function resetHealthcheckStores() {
  healthcheckResultStore.clear()
  healthcheckLatencyStore.clear()
}

export type HealthcheckClass = {
  id: SupportedHealthchecks
  areMetricsEnabled: boolean

  instantiateMetrics: () => void
  execute: () => Promise<void>
  check: () => Promise<Either<Error, number>>
  storeResult: (result: Either<Error, number>) => void
}

export abstract class AbstractHealthcheck implements HealthcheckClass {
  readonly areMetricsEnabled: boolean
  abstract id: SupportedHealthchecks

  // returns execution time in msecs if successful
  abstract check(): Promise<Either<Error, number>>

  constructor(areMetricsEnabled: boolean) {
    this.areMetricsEnabled = areMetricsEnabled
  }

  instantiateMetrics(): void {
    if (this.areMetricsEnabled) {
      const id = this.id
      new Gauge({
        name: `${this.id}_availability`,
        help: `Whether ${this.id} was available at the time`,
        collect() {
          const checkResult = healthcheckResultStore.get(id)
          this.set(checkResult !== false ? 1 : 0)
        },
      })
      new Gauge({
        name: `${this.id}_latency_msecs`,
        help: `How long the healthcheck for ${this.id} took`,
        collect() {
          const checkLength = healthcheckLatencyStore.get(id)
          this.set(checkLength ?? 0)
        },
      })
    }
  }

  async execute(): Promise<void> {
    const result = await this.check()
    this.storeResult(result)
  }
  storeResult(result: Either<Error, number>): void {
    healthcheckResultStore.set(this.id, !result.error)

    if (result.error) {
      healthcheckLatencyStore.set(this.id, undefined)
    } else {
      healthcheckLatencyStore.set(this.id, result.result!)
    }
  }
}

export class RedisHealthcheck extends AbstractHealthcheck implements HealthcheckClass {
  id = 'redis' as const

  private readonly redis: Redis

  constructor({ redis, config }: CommonDependencies) {
    super(config.app.metrics.isEnabled)
    this.redis = redis
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

export class DbHealthcheck extends AbstractHealthcheck implements HealthcheckClass {
  id = 'postgresql' as const
  private readonly prisma: PrismaClient

  constructor({ config, prisma }: CommonDependencies) {
    super(config.app.metrics.isEnabled)
    this.prisma = prisma
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
