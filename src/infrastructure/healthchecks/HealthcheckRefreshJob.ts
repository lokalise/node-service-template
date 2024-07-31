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
      },
      dependencies,
    )

    this.healthCheckers = dependencies.healthchecks
  }

  protected processInternal(_executionUuid: string): Promise<unknown> {
    return Promise.all([
      this.healthCheckers.postgres.execute(),
      this.healthCheckers.redis.execute(),
    ])
  }
}
