import type { BackgroundJobProcessorConfig, BaseJobPayload } from '@lokalise/background-jobs-common'
import {
  AbstractBackgroundJobProcessor,
  CommonBullmqFactory,
} from '@lokalise/background-jobs-common'

import { SERVICE_NAME, isTest } from '../config.js'
import type { Dependencies } from '../parentDiConfig.js'

export type BackgroundJobConfig = Omit<BackgroundJobProcessorConfig, 'isTest' | 'redisConfig'>

export abstract class AbstractEnqueuedJobProcessor<
  JobPayload extends object & BaseJobPayload,
  JobReturn = void,
> extends AbstractBackgroundJobProcessor<JobPayload, JobReturn> {
  protected constructor(dependencies: Dependencies, config: BackgroundJobConfig) {
    super(
      {
        logger: dependencies.logger,
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
        /**
         * autorun allows to decide when to start a worker. While we normally want it to always be running,
         * in case of CLI commands it is advisable to not start it so that within the script we can add new jobs to
         * the queue, but they (and existing jobs) will not be processed by the app instance created within the command.
         * Processing will only be done by the live instance of the application, which is always running.
         */
        workerAutoRunEnabled: !dependencies.config.app.cliMode,
        redisConfig: dependencies.config.redis,
      },
    )
  }
}
