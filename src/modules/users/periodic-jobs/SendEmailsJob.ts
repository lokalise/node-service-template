import { CronJob } from 'toad-scheduler'

import type { CronJobConfig } from '../../../infrastructure/config.ts'
import {
  AbstractPeriodicJob,
  createTask,
} from '../../../infrastructure/jobs/AbstractPeriodicJob.ts'
import type { UsersInjectableDependencies } from '../UserModule.ts'

const LOCK_TIMEOUT_IN_MSECS = 60 * 1000
const LOCK_REFRESH_IN_MSECS = 10 * 1000
const LOCK_ON_SUCCESS_IN_MSECS = 60 * 1000 * 60

export class SendEmailsJob extends AbstractPeriodicJob {
  public static JOB_NAME = 'SendEmailsJob'
  private readonly config: CronJobConfig
  constructor(dependencies: UsersInjectableDependencies) {
    super(
      {
        jobId: SendEmailsJob.JOB_NAME,
      },
      dependencies,
    )

    this.config = dependencies.config.jobs.sendEmailsJob
  }

  public override register() {
    const task = createTask(this.logger, this)
    this.scheduler.addCronJob(
      new CronJob({ cronExpression: this.config.cronExpression }, task, {
        id: this.options.jobId,
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

    // Process job logic here
    await this.sendEmails()

    // If successful, we don't want to process this job again for a longer period of time, let's put a new lock
    await this.updateMutex(lock, LOCK_ON_SUCCESS_IN_MSECS)
  }

  private sendEmails() {
    // dummy processing logic
    return Promise.resolve()
  }
}
