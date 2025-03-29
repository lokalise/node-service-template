import { NewRelicTransactionManager } from '@lokalise/fastify-extras'
import { globalLogger } from '@lokalise/node-core'
import { createContainer } from 'awilix'
import { AwilixManager } from 'awilix-manager'
import { AbstractTestContextFactory, type DIContext } from 'opinionated-machine'
import type { AppInstance } from '../src/app.js'
import {
  CommonModule,
  type Dependencies,
  type ExternalDependencies,
} from '../src/infrastructure/CommonModule.js'
import type { Config } from '../src/infrastructure/config.js'
import { getConfig } from '../src/infrastructure/config.js'
import { UserModule } from '../src/modules/users/UserModule.js'

export type TestContext = DIContext<Dependencies, ExternalDependencies>

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
      [new CommonModule(), new UserModule()],
      diContainer,
    )
  }

  resolveBaseAppConfig() {
    return getConfig()
  }
}

export const testContextFactory = new TestContextFactory()
