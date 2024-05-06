import type { BaseJobPayload } from '@lokalise/background-jobs-common'
import type { RequestContext } from '@lokalise/fastify-extras'
import type { Job } from 'bullmq'

import { SERVICE_NAME } from '../../../infrastructure/config.js'
import { AbstractEnqueuedJobProcessor } from '../../../infrastructure/jobs/AbstractEnqueuedJobProcessor.js'
import type { Dependencies } from '../../../infrastructure/parentDiConfig.js'
import type { UserService } from '../services/UserService.js'

export type UserImportJobPayload = {
  payload: {
    name: string
    age: number
    email: string
  }
} & BaseJobPayload

export class UserImportJob extends AbstractEnqueuedJobProcessor<UserImportJobPayload> {
  public static QUEUE_ID = 'UserImportJob'
  private readonly userService: UserService

  constructor(dependencies: Dependencies) {
    super(dependencies, {
      queueId: UserImportJob.QUEUE_ID,
      ownerName: SERVICE_NAME,
      workerOptions: {
        concurrency: 10,
      },
    })

    this.userService = dependencies.userService
  }

  protected async process(
    job: Job<UserImportJobPayload>,
    requestContext: RequestContext,
  ): Promise<void> {
    const user = await this.userService.createUser(job.data.payload)

    requestContext.logger.info(
      {
        userId: user.id,
      },
      `Created new user`,
    )
  }
}
