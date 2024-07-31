import type { CommonDependencies } from '../commonDiConfig.js'
import { AbstractPeriodicJob } from '../jobs/AbstractPeriodicJob.js'
import type { HealthcheckClass, SupportedHealthchecks } from './healthchecks.js'

export class HealthcheckRefreshJob extends AbstractPeriodicJob {
  public static JOB_NAME = 'HealthcheckRefreshJob'
  private readonly healthCheckers: Record<SupportedHealthchecks, HealthcheckClass>

  constructor(dependencies: CommonDependencies) {
    super(
      {
        jobId: HealthcheckRefreshJob.JOB_NAME,
        intervalInMs: 10000,
        singleConsumerMode: {
          enabled: true,
        },
      },
      dependencies,
    )

    this.healthCheckers = {
      redis: dependencies.redisHealthcheck,
      postgresql: dependencies.dbHealthcheck,
    }
  }

  protected processInternal(_executionUuid: string): Promise<unknown> {
    return Promise.all([
      this.healthCheckers.postgresql.execute(),
      this.healthCheckers.redis.execute(),
    ])
  }
}
