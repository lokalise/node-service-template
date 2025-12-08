import { randomUUID } from 'node:crypto'

import type { ErrorReporter, TransactionObservabilityManager } from '@lokalise/node-core'
import { resolveGlobalErrorLogObject } from '@lokalise/node-core'
import type { FastifyBaseLogger } from 'fastify'
import type { Redis } from 'ioredis'
import { stdSerializers } from 'pino'
import type { LockOptions } from 'redis-semaphore'
import { Mutex } from 'redis-semaphore'
import type { ToadScheduler } from 'toad-scheduler'
import { AsyncTask, SimpleIntervalJob } from 'toad-scheduler'
import type { CommonDependencies } from '../CommonModule.ts'

const DEFAULT_LOCK_NAME = 'exclusive'
const DEFAULT_JOB_INTERVAL = 60000

export type BackgroundJobConfiguration = {
  /**
   * Job unique name
   */
  jobId: string
  /**
   * The interval in milliseconds at which the job should run.
   */
  intervalInMs?: number
  /**
   * Allows to run the job exclusively in a single instance of the application.
   * The first consumer that acquires the lock will be the only one to run the job until it stops refreshing the lock.
   */
  singleConsumerMode?: {
    enabled: boolean
    /**
     * By default, the lock TTL is 2 * intervalInMs, to prevent the lock from expiring before the next execution.
     */
    lockTimeout?: number

    /**
     * Lock will be reset to this value after success, so that other node could potentially acquire the lock after it expires, but in order to prevent immediate acquire
     */
    lockTimeoutAfterSuccess?: number
  }
  /**
   * If true, the job will log when it starts and finishes.
   */
  shouldLogExecution?: boolean
}

export type LockConfiguration = {
  lockName?: string
  identifier?: string
  refreshInterval?: number
  lockTimeout?: number
  acquiredExternally?: true
}

export function createTask(logger: FastifyBaseLogger, job: AbstractPeriodicJob) {
  const executorId = randomUUID()

  logger.info({
    msg: 'Periodic job registered',
    jobId: job.options.jobId,
    executorId,
  })

  return new AsyncTask(
    job.options.jobId,
    () => {
      return job.process(executorId)
    },
    (error) => {
      logger.error(
        stdSerializers.err({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
      )
    },
  )
}

export abstract class AbstractPeriodicJob {
  public readonly options: Required<BackgroundJobConfiguration>
  protected readonly redis: Redis
  protected readonly transactionObservabilityManager: TransactionObservabilityManager
  protected readonly logger: FastifyBaseLogger
  protected readonly errorReporter: ErrorReporter
  protected readonly scheduler: ToadScheduler
  private singleConsumerLock?: Mutex

  protected constructor(
    options: BackgroundJobConfiguration,
    {
      redis,
      logger,
      transactionObservabilityManager,
      errorReporter,
      scheduler,
    }: CommonDependencies,
  ) {
    this.options = {
      intervalInMs: DEFAULT_JOB_INTERVAL,
      shouldLogExecution: false,
      ...options,
      singleConsumerMode: {
        enabled: true,
        lockTimeout: (options.intervalInMs ?? DEFAULT_JOB_INTERVAL) * 2,
        ...options.singleConsumerMode,
      },
    }
    this.logger = logger
    this.redis = redis
    this.transactionObservabilityManager = transactionObservabilityManager
    this.errorReporter = errorReporter
    this.scheduler = scheduler
  }

  public register() {
    const task = createTask(this.logger, this)

    this.scheduler.addSimpleIntervalJob(
      new SimpleIntervalJob(
        {
          milliseconds: this.options.intervalInMs,
          runImmediately: true,
        },
        task,
        {
          id: this.options.jobId,
          preventOverrun: true,
        },
      ),
    )
  }

  public async dispose() {
    this.scheduler.stop()
    await this.singleConsumerLock?.release()
  }

  protected abstract processInternal(executionUuid: string): Promise<unknown>

  public async process(executionUuid: string) {
    const logger = this.resolveExecutionLogger(executionUuid)

    if (this.options.singleConsumerMode.enabled) {
      // acquire or update lock
      this.singleConsumerLock = await this.tryAcquireExclusiveLock({
        lockTimeout: this.options.singleConsumerMode.lockTimeout,
        identifier: executionUuid,
      })

      if (!this.singleConsumerLock) {
        logger.debug('Periodic job skipped: unable to acquire single consumer lock')
        return
      }
    }

    try {
      this.transactionObservabilityManager.start(this.options.jobId, executionUuid)
      if (this.options.shouldLogExecution) logger.info('Periodic job started')

      await this.processInternal(executionUuid)
    } catch (err) {
      logger.error({
        ...resolveGlobalErrorLogObject(err, executionUuid),
        msg: 'Error during periodic job execution',
      })

      if (err instanceof Error) {
        this.errorReporter.report({
          error: err,
          context: {
            executorId: executionUuid,
          },
        })
      }
    } finally {
      // stop auto-refreshing the lock to let it expire
      if (this.singleConsumerLock) {
        await this.updateMutex(
          this.singleConsumerLock,
          this.options.singleConsumerMode.lockTimeoutAfterSuccess ?? this.options.intervalInMs,
        )
        this.singleConsumerLock.stopRefresh()
      }

      if (this.options.shouldLogExecution) logger.info('Periodic job finished')
      this.transactionObservabilityManager.stop(executionUuid)
    }
  }

  protected getJobMutex(key: string, options: LockOptions) {
    return new Mutex(this.redis, this.getJobLockName(key), options)
  }

  protected async tryAcquireExclusiveLock(lockConfiguration?: LockConfiguration) {
    const mutexOptions = {
      acquireAttemptsLimit: 1,
      refreshInterval: lockConfiguration?.refreshInterval,
      acquiredExternally: lockConfiguration?.acquiredExternally,
      identifier: lockConfiguration?.identifier,
      lockTimeout: lockConfiguration?.lockTimeout ?? this.options.singleConsumerMode.lockTimeout,
    }

    let lock = this.getJobMutex(lockConfiguration?.lockName ?? DEFAULT_LOCK_NAME, mutexOptions)
    let acquired = await lock.tryAcquire()

    // If lock has been acquired previously by this instance, try to refresh
    if (!acquired && lockConfiguration?.identifier) {
      lock = this.getJobMutex(lockConfiguration?.lockName ?? DEFAULT_LOCK_NAME, {
        ...mutexOptions,
        acquiredExternally: true,
      })
      acquired = await lock.tryAcquire()
    }

    // If someone else already has this lock, skip
    if (!acquired) {
      return
    }

    return lock
  }

  protected async updateMutex(
    mutex: Mutex,
    newLockTimeout: number,
    key: string = DEFAULT_LOCK_NAME,
  ) {
    const newMutex = new Mutex(this.redis, this.getJobLockName(key), {
      acquiredExternally: true,
      identifier: mutex.identifier,
      lockTimeout: newLockTimeout,
    })

    const lock = await newMutex.tryAcquire()
    if (!lock) {
      return
    }

    return newMutex
  }

  protected getJobLockName(key: string) {
    return `${this.options.jobId}:locks:${key}`
  }

  protected resolveExecutionLogger(uuid: string): FastifyBaseLogger {
    return this.logger.child({
      executorId: uuid,
      jobId: this.options.jobId,
    })
  }
}
