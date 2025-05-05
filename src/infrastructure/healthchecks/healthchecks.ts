import { types } from 'node:util'
import type { Either } from '@lokalise/node-core'

import { AbstractHealthcheck, type Healthcheck } from '@lokalise/healthcheck-utils'
import { sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { Redis } from 'ioredis'
import type { CommonDependencies } from '../CommonModule.ts'

export type SupportedHealthchecks = 'redis' | 'postgres'

export class RedisHealthcheck
  extends AbstractHealthcheck<SupportedHealthchecks>
  implements Healthcheck
{
  private readonly redis: Redis

  constructor({ redis, config, healthcheckStore }: CommonDependencies) {
    super({ healthcheckStore }, config.app.metrics.isEnabled)
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

export class DbHealthcheck
  extends AbstractHealthcheck<SupportedHealthchecks>
  implements Healthcheck
{
  private readonly drizzle: PostgresJsDatabase

  constructor({ config, drizzle, healthcheckStore }: CommonDependencies) {
    super(
      {
        healthcheckStore,
      },
      config.app.metrics.isEnabled,
    )
    this.drizzle = drizzle
  }

  getId(): SupportedHealthchecks {
    return 'postgres'
  }

  async check(): Promise<Either<Error, number>> {
    let checkTimeInMsecs: number
    try {
      const startTime = Date.now()
      const response = await this.drizzle.execute(sql`SELECT 1`)
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
