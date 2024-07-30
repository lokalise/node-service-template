import type { CommonDependencies } from '../commonDiConfig.js'
import { AbstractPeriodicJob } from '../jobs/AbstractPeriodicJob.jsx'
import {
  DbHealthcheck,
  type HealthcheckClass,
  RedisHealthcheck,
  type SupportedHealthchecks,
} from './healthchecks.js'

export class HealthcheckRefreshJob extends AbstractPeriodicJob {
  private readonly healthCheckers: Record<SupportedHealthchecks, HealthcheckClass>

  constructor(dependencies: CommonDependencies) {
    super(
      {
        jobId: HealthcheckRefreshJob.name,
        intervalInMs: 10000,
        singleConsumerMode: {
          enabled: true,
        },
      },
      dependencies,
    )

    this.healthCheckers = {
      redis: new RedisHealthcheck(dependencies),
      postgresql: new DbHealthcheck(dependencies),
    }
  }

  protected processInternal(_executionUuid: string): Promise<unknown> {
    return Promise.all([
      this.healthCheckers.postgresql.execute(),
      this.healthCheckers.redis.execute(),
    ])
  }
}
