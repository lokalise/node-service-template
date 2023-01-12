import { AbstractBackgroundJob } from '../../../infrastructure/AbstractBackgroundJob'
import type { Dependencies } from '../../../infrastructure/diConfig'

const LOCK_TIMEOUT_IN_MSECS = 60 * 1000
const LOCK_REFRESH_IN_MSECS = 10 * 1000
const LOCK_ON_SUCCESS_IN_MSECS = 60 * 1000 * 60

export class SendEmailsJob extends AbstractBackgroundJob {
  constructor(dependencies: Dependencies) {
    super(
      {
        jobId: 'SendEmailsJob',
      },
      dependencies,
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

  private async sendEmails() {
    // dummy processing logic
    return Promise.resolve()
  }
}
