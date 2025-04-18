import { SimpleIntervalJob } from 'toad-scheduler'

import type { IntervalJobConfig } from '../../../infrastructure/config.ts'
import {
  AbstractPeriodicJob,
  createTask,
} from '../../../infrastructure/jobs/AbstractPeriodicJob.ts'
import type { UsersInjectableDependencies } from '../UserModule.ts'

const LOCK_TIMEOUT_IN_MSECS = 60 * 1000
const LOCK_REFRESH_IN_MSECS = 10 * 1000
const FILE_PROCESSING_BATCH_SIZE = 20

export class ProcessLogFilesJob extends AbstractPeriodicJob {
  public static JOB_NAME = 'ProcessLogFilesJob'
  private readonly config: IntervalJobConfig
  constructor(dependencies: UsersInjectableDependencies) {
    super(
      {
        jobId: ProcessLogFilesJob.JOB_NAME,
      },
      dependencies,
    )

    this.config = dependencies.config.jobs.processLogFilesJob
  }

  public override register() {
    const task = createTask(this.logger, this)
    this.scheduler.addSimpleIntervalJob(
      new SimpleIntervalJob({ seconds: this.config.periodInSeconds }, task, {
        id: this.options.jobId,
        preventOverrun: true,
      }),
    )
  }

  protected async processInternal(executionUuid: string): Promise<void> {
    let counter = 0

    while (counter < FILE_PROCESSING_BATCH_SIZE) {
      counter++
      const fileToProcess = await this.getUnprocessedLogFile()

      if (!fileToProcess) {
        this.logger.debug(`Nothing to process, skipping (${executionUuid})`)
        return
      }

      // We only want one job at a time processing specific file
      const lock = await this.tryAcquireExclusiveLock({
        lockName: `log:${fileToProcess}`,
        refreshInterval: LOCK_REFRESH_IN_MSECS,
        lockTimeout: LOCK_TIMEOUT_IN_MSECS,
      })

      // This file is already being processed, skip
      if (!lock) {
        continue
      }

      try {
        await this.processFile(fileToProcess)
      } finally {
        lock.stopRefresh()
        // We do not release lock on the file - if it was successful, noone needs to process it again. If it wasn't successful,
        // we don't want it to clog the pipeline in case problem was due to the file itself. Let's wait till the lock is released automatically.
      }
    }
  }

  private processFile(_file: string) {
    // dummy processing logic
    return Promise.resolve()
  }

  private getUnprocessedLogFile() {
    // dummy sample data
    return Promise.resolve('someData')
  }
}
