import {
  AbstractBackgroundJobProcessorNew,
  type BackgroundJobProcessorConfigNew,
  type SupportedQueueIds,
} from '@lokalise/background-jobs-common'
import { CommonBullmqFactoryNew } from '@lokalise/background-jobs-common'
import type { BullmqSupportedQueues, Dependencies } from '../CommonModule.ts'
import { SERVICE_NAME } from '../config.ts'

type AbstractEnqueuedJobProcessorConfig<QueueId extends SupportedQueueIds<BullmqSupportedQueues>> =
  Omit<BackgroundJobProcessorConfigNew<BullmqSupportedQueues, QueueId>, 'isTest' | 'redisConfig'>

export abstract class AbstractEnqueuedJobProcessor<
  QueueId extends SupportedQueueIds<BullmqSupportedQueues>,
> extends AbstractBackgroundJobProcessorNew<BullmqSupportedQueues, QueueId> {
  protected constructor(
    dependencies: Dependencies,
    config: AbstractEnqueuedJobProcessorConfig<QueueId>,
  ) {
    super(
      {
        logger: dependencies.logger,
        errorReporter: dependencies.errorReporter,
        workerFactory: new CommonBullmqFactoryNew(),
        transactionObservabilityManager: dependencies.transactionObservabilityManager,
        queueManager: dependencies.bullmqQueueManager,
      },
      {
        queueId: config.queueId,
        ownerName: SERVICE_NAME,
        workerOptions: config.workerOptions,
      },
    )
  }
}
