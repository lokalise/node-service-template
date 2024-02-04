import type { Cradle } from '@fastify/awilix'
import { NewRelicTransactionManager } from '@lokalise/fastify-extras'
import { globalLogger } from '@lokalise/node-core'
import type { AwilixContainer } from 'awilix'
import { asFunction, createContainer } from 'awilix'
import { AwilixManager } from 'awilix-manager'
import type { FastifyInstance } from 'fastify'
import { merge } from 'ts-deepmerge'

import type { DIOptions } from '../src/infrastructure/commonDiConfig'
import type { Config } from '../src/infrastructure/config'
import { getConfig } from '../src/infrastructure/config'
import type { DependencyOverrides } from '../src/infrastructure/diConfig'
import { SINGLETON_CONFIG, registerDependencies } from '../src/infrastructure/diConfig'

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

  const fakeApp: Partial<FastifyInstance> = {
    newrelicTransactionManager: new NewRelicTransactionManager(false),
  }

  const dependencies = configOverrides
    ? {
        ...dependencyOverrides,
        config: asFunction(() => {
          return merge(getConfig(), configOverrides)
        }, SINGLETON_CONFIG),
      }
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
      app: fakeApp as FastifyInstance,
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
