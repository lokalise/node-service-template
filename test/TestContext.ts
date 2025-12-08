import { NewRelicTransactionManager } from '@lokalise/fastify-extras'
import { globalLogger } from '@lokalise/node-core'
import { createContainer } from 'awilix'
import { AwilixManager } from 'awilix-manager'
import { AbstractTestContextFactory, type DIContext } from 'opinionated-machine'
import type { AppInstance } from '../src/app.ts'
import type { Dependencies, ExternalDependencies } from '../src/infrastructure/CommonModule.ts'
import type { Config } from '../src/infrastructure/config.ts'
import { getConfig } from '../src/infrastructure/config.ts'
import { ALL_MODULES } from '../src/modules.ts'

export type TestContext = DIContext<Dependencies, Config, ExternalDependencies>

class TestContextFactory extends AbstractTestContextFactory<
  Dependencies,
  ExternalDependencies,
  Config
> {
  constructor() {
    const diContainer = createContainer({
      injectionMode: 'PROXY',
    })

    const awilixManager = new AwilixManager({
      diContainer,
      asyncDispose: true,
      asyncInit: true,
      eagerInject: true,
    })

    const fakeApp: Partial<AppInstance> = {
      newrelicTransactionManager: NewRelicTransactionManager.createDisabled(),
      awilixManager,
    }

    super(
      {
        app: fakeApp as AppInstance,
        logger: globalLogger,
      },
      ALL_MODULES,
      diContainer,
    )
  }

  resolveBaseAppConfig() {
    return getConfig()
  }
}

export const testContextFactory = new TestContextFactory()
