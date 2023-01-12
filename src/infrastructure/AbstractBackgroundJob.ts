import { randomUUID } from 'crypto'

import type { NewRelicTransactionManager } from '@lokalise/fastify-extras'
import type { FastifyLoggerInstance } from 'fastify'
import type Redis from 'ioredis'
import { Mutex } from 'redis-semaphore'
import type { LockOptions } from 'redis-semaphore'

import type { Dependencies } from './diConfig'
import type { ErrorReporter } from './errors/errorReporter'
import { globalLogger, resolveGlobalErrorLogObject } from './errors/globalErrorHandler'

const DEFAULT_LOCK_NAME = 'exclusive'

export type BackgroundJobConfiguration = {
  jobId: string
}

export type LockConfiguration = {
  lockName?: string
  refreshInterval?: number
  lockTimeout: number
}

export abstract class AbstractBackgroundJob {
  public readonly jobId: string
  protected readonly redis: Redis
  protected readonly newRelicBackgroundTransactionManager: NewRelicTransactionManager
  protected readonly logger: FastifyLoggerInstance
  protected readonly errorReporter: ErrorReporter

  protected constructor(
    options: BackgroundJobConfiguration,
    { redis, logger, newRelicBackgroundTransactionManager, errorReporter }: Dependencies,
  ) {
    this.jobId = options.jobId
    this.logger = logger
    this.redis = redis
    this.newRelicBackgroundTransactionManager = newRelicBackgroundTransactionManager
    this.errorReporter = errorReporter
  }

  protected abstract processInternal(executionUuid: string): Promise<void>

  async process() {
    const uuid = randomUUID()

    try {
      this.newRelicBackgroundTransactionManager.start(this.jobId)
      this.logger.info(`Started processing ${this.jobId} (${uuid})`)

      await this.processInternal(uuid)
    } catch (err) {
      const logObject = resolveGlobalErrorLogObject(err, uuid)
      globalLogger.error(logObject)

      if (err instanceof Error) {
        this.errorReporter.report({
          error: err,
          context: {
            uuid,
          },
        })
      }
    } finally {
      this.logger.info(`Finished processing ${this.jobId} (${uuid})`)
      this.newRelicBackgroundTransactionManager.stop(this.jobId)
    }
  }

  protected getJobMutex(key: string, options: LockOptions) {
    return new Mutex(this.redis, this.getJobLockName(key), options)
  }

  protected async updateMutex(
    mutex: Mutex,
    newLockTimeout: number,
    key: string = DEFAULT_LOCK_NAME,
  ) {
    const newMutex = new Mutex(this.redis, this.getJobLockName(key), {
      externallyAcquiredIdentifier: mutex.identifier,
      lockTimeout: newLockTimeout,
    })

    const lock = await newMutex.tryAcquire()
    if (!lock) {
      return
    }

    return newMutex
  }

  protected async tryAcquireExclusiveLock(lockConfiguration: LockConfiguration) {
    const mutex = this.getJobMutex(lockConfiguration.lockName ?? DEFAULT_LOCK_NAME, {
      acquireAttemptsLimit: 1,
      refreshInterval: lockConfiguration.refreshInterval,
      lockTimeout: lockConfiguration.lockTimeout,
    })

    const lock = await mutex.tryAcquire()
    // If someone else already has this lock, skip
    if (!lock) {
      return
    }

    return mutex
  }

  protected getJobLockName(key: string) {
    return `${this.jobId}:locks:${key}`
  }
}
