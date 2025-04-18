import { BASE_JOB_PAYLOAD_SCHEMA } from '@lokalise/background-jobs-common'
import type { RequestContext } from '@lokalise/fastify-extras'
import type { Job } from 'bullmq'

import z from 'zod'
import type { Dependencies } from '../../../infrastructure/CommonModule.ts'
import { SERVICE_NAME } from '../../../infrastructure/config.ts'
import { AbstractEnqueuedJobProcessor } from '../../../infrastructure/jobs/AbstractEnqueuedJobProcessor.ts'
import type { UserService } from '../services/UserService.ts'

export const USER_IMPORT_JOB_PAYLOAD = BASE_JOB_PAYLOAD_SCHEMA.extend({
  name: z.string(),
  age: z.number(),
  email: z.string(),
})
type UserImportJobPayload = z.infer<typeof USER_IMPORT_JOB_PAYLOAD>

export class UserImportJob extends AbstractEnqueuedJobProcessor<'UserImportJob'> {
  public static readonly QUEUE_ID = 'UserImportJob'
  private readonly userService: UserService

  constructor(dependencies: Dependencies) {
    super(dependencies, {
      queueId: UserImportJob.QUEUE_ID,
      ownerName: SERVICE_NAME,
      workerOptions: { concurrency: 10 },
    })

    this.userService = dependencies.userService
  }

  protected async process(
    job: Job<UserImportJobPayload>,
    requestContext: RequestContext,
  ): Promise<void> {
    const user = await this.userService.createUser(job.data)

    requestContext.logger.info(
      {
        userId: user.id,
      },
      'Created new user',
    )
  }
}
