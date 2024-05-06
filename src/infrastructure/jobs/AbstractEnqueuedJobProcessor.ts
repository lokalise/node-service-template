import type { BackgroundJobProcessorConfig, BaseJobPayload } from '@lokalise/background-jobs-common'
import {
  AbstractBackgroundJobProcessor,
  CommonBullmqFactory,
} from '@lokalise/background-jobs-common'
import type { RequestContext } from '@lokalise/fastify-extras'
import type { Job } from 'bullmq'

import { isTest, SERVICE_NAME } from '../config.js'
import type { Dependencies } from '../parentDiConfig.js'

export type BackgroundJobConfig = Omit<BackgroundJobProcessorConfig, 'isTest'>

export abstract class AbstractEnqueuedJobProcessor<
  JobPayload extends object & BaseJobPayload,
  JobReturn = void,
> extends AbstractBackgroundJobProcessor<JobPayload, JobReturn> {
  protected constructor(dependencies: Dependencies, config: BackgroundJobConfig) {
    super(
      {
        logger: dependencies.logger,
        redis: dependencies.redis,
        errorReporter: dependencies.errorReporter,
        bullmqFactory: new CommonBullmqFactory(),
        transactionObservabilityManager: dependencies.transactionObservabilityManager,
      },
      {
        isTest: isTest(),
        ownerName: SERVICE_NAME,
        queueId: config.queueId,
        queueOptions: config.queueOptions,
        workerOptions: config.workerOptions,
      },
    )
  }

  protected onFailed(_job: Job, _error: Error, _requestContext: RequestContext): Promise<void> {
    return Promise.resolve(undefined)
  }
}
