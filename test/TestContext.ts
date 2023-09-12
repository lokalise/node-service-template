import type { Cradle } from '@fastify/awilix'
import { NewRelicTransactionManager } from '@lokalise/fastify-extras'
import { globalLogger } from '@lokalise/node-core'
import type { AwilixContainer } from 'awilix'
import { asFunction, createContainer } from 'awilix'
import type { FastifyInstance } from 'fastify'
import merge from 'ts-deepmerge'

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

export function createTestContext(
  dependencyOverrides: DependencyOverrides = {},
  configOverrides?: ConfigOverrides,
): TestContext {
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

  registerDependencies(
    diContainer,
    {
      app: fakeApp as FastifyInstance,
      logger: globalLogger,
    },
    dependencies,
  )

  return {
    diContainer,
  }
}

export async function destroyTestContext(testContext: TestContext) {
  await testContext.diContainer.dispose()
}
