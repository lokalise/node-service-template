import { AbstractBackgroundJob } from '../../../infrastructure/AbstractBackgroundJob'
import type { Dependencies } from '../../../infrastructure/diConfig'

const LOCK_TIMEOUT_IN_MSECS = 60 * 1000
const LOCK_REFRESH_IN_MSECS = 10 * 1000

export class DeleteOldUsersJob extends AbstractBackgroundJob {
  constructor(dependencies: Dependencies) {
    super(
      {
        jobId: 'DeleteOldUsersJob',
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
