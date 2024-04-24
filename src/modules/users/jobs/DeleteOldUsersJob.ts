import { SimpleIntervalJob } from 'toad-scheduler'

import { AbstractBackgroundJob } from '../../../infrastructure/AbstractBackgroundJob'
import type { IntervalJobConfig } from '../../../infrastructure/config'
import { createTask } from '../../../infrastructure/jobs/jobUtils'
import type { UsersInjectableDependencies } from '../diConfig'

const LOCK_TIMEOUT_IN_MSECS = 60 * 1000
const LOCK_REFRESH_IN_MSECS = 10 * 1000

export class DeleteOldUsersJob extends AbstractBackgroundJob {
  public static JOB_NAME = 'DeleteOldUsersJob'
  private readonly config: IntervalJobConfig
  constructor(dependencies: UsersInjectableDependencies) {
    super(
      {
        jobId: DeleteOldUsersJob.JOB_NAME,
      },
      dependencies,
    )

    this.config = dependencies.config.jobs.deleteOldUsersJob
  }

  public register() {
    const task = createTask(this.logger, this)
    this.scheduler.addSimpleIntervalJob(
      new SimpleIntervalJob({ seconds: this.config.periodInSeconds }, task, {
        id: this.jobId,
        preventOverrun: true,
      }),
    )
  }

  protected async processInternal(executionUuid: string): Promise<void> {
    // We only want a single instance of this job running in entire cluster, let's see if someone else is already processing it
    const lock = await this.tryAcquireExclusiveLock({
      lockTimeout: LOCK_TIMEOUT_IN_MSECS,
      refreshInterval: LOCK_REFRESH_IN_MSECS,
    })

    // Job is already running, skip
    if (!lock) {
      this.logger.debug(`Job already running in another node, skipping (${executionUuid})`)
      return
    }

    try {
      // Process job logic here
      await this.deleteOldUsers()
    } finally {
      await lock.release()
    }
  }

  private async deleteOldUsers() {
    // dummy processing logic
    return Promise.resolve()
  }
}
