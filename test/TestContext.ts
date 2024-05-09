import type { Cradle } from '@fastify/awilix'
import { NewRelicTransactionManager } from '@lokalise/fastify-extras'
import { globalLogger } from '@lokalise/node-core'
import type { AwilixContainer } from 'awilix'
import { asFunction, createContainer } from 'awilix'
import { AwilixManager } from 'awilix-manager'
import { merge } from 'ts-deepmerge'

import type { AppInstance } from '../src/app.js'
import type { Config } from '../src/infrastructure/config.js'
import { getConfig } from '../src/infrastructure/config.js'
import type { DIOptions } from '../src/infrastructure/diConfigUtils.js'
import type { DependencyOverrides } from '../src/infrastructure/parentDiConfig.js'
import { SINGLETON_CONFIG, registerDependencies } from '../src/infrastructure/parentDiConfig.js'

type NestedPartial<T> = {
  [P in keyof T]?: NestedPartial<T[P]>
}

export type ConfigOverrides = NestedPartial<Config>

export type TestContext = {
  diContainer: AwilixContainer<Cradle>
}

export async function createTestContext(
  dependencyOverrides: DependencyOverrides = {},
  options: DIOptions = {},
  configOverrides?: ConfigOverrides,
) {
  const diContainer = createContainer({
    injectionMode: 'PROXY',
  })

  const fakeApp: Partial<AppInstance> = {
    newrelicTransactionManager: new NewRelicTransactionManager(false),
  }

  const dependencies = configOverrides
    ? ({
        ...dependencyOverrides,
        config: asFunction(() => {
          return merge(getConfig(), configOverrides)
        }, SINGLETON_CONFIG),
      } as DependencyOverrides)
    : dependencyOverrides

  const awilixManager = new AwilixManager({
    diContainer,
    asyncDispose: true,
    asyncInit: true,
    eagerInject: true,
  })

  await awilixManager.executeInit()

  registerDependencies(
    diContainer,
    {
      app: fakeApp as AppInstance,
      logger: globalLogger,
    },
    dependencies,
    {
      queuesEnabled: !!options.queuesEnabled,
      jobsEnabled: !!options.jobsEnabled,
    },
  )

  return {
    diContainer,
    awilixManager,
  }
}

export async function destroyTestContext(testContext: TestContext) {
  await testContext.diContainer.dispose()
}
