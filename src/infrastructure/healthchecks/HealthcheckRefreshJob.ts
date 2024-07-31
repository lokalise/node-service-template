import { PromisePool } from '@supercharge/promise-pool'
import type { CommonDependencies } from '../commonDiConfig.js'
import { AbstractPeriodicJob } from '../jobs/AbstractPeriodicJob.js'
import type { Healthcheck, SupportedHealthchecks } from './healthchecks.js'

export class HealthcheckRefreshJob extends AbstractPeriodicJob {
  public static JOB_NAME = 'HealthcheckRefreshJob'
  private readonly healthCheckers: Record<SupportedHealthchecks, Healthcheck>

  constructor(dependencies: CommonDependencies) {
    super(
      {
        jobId: HealthcheckRefreshJob.JOB_NAME,
        intervalInMs: 10000,
        singleConsumerMode: {
          enabled: false,
        },
      },
      dependencies,
    )

    this.healthCheckers = dependencies.healthchecks
  }

  protected async processInternal(_executionUuid: string): Promise<void> {
    await PromisePool.withConcurrency(2)
      .for(Object.values(this.healthCheckers))
      .process(async (healthcheck) => {
        await healthcheck.execute()
      })
  }
}
