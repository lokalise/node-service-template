import {
  AbstractBackgroundJobProcessorNew,
  type BackgroundJobProcessorConfigNew,
  CommonBullmqFactoryNew,
  type SupportedQueueIds,
} from '@lokalise/background-jobs-common'
import type { PublicDependencies } from 'opinionated-machine'
import type { BullmqSupportedQueues } from '../CommonModule.ts'
import { SERVICE_NAME } from '../config.ts'

type AbstractEnqueuedJobProcessorConfig<QueueId extends SupportedQueueIds<BullmqSupportedQueues>> =
  Omit<BackgroundJobProcessorConfigNew<BullmqSupportedQueues, QueueId>, 'isTest' | 'redisConfig'>

export abstract class AbstractEnqueuedJobProcessor<
  QueueId extends SupportedQueueIds<BullmqSupportedQueues>,
> extends AbstractBackgroundJobProcessorNew<BullmqSupportedQueues, QueueId> {
  protected constructor(
    dependencies: PublicDependencies,
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
