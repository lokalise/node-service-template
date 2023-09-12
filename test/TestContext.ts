import type { Cradle } from '@fastify/awilix'
import { NewRelicTransactionManager } from '@lokalise/fastify-extras'
import { globalLogger } from '@lokalise/node-core'
import type { AwilixContainer } from 'awilix'
import { asFunction, createContainer } from 'awilix'
import type { FastifyInstance } from 'fastify'
import merge from 'ts-deepmerge'

import { getConfig, type ConfigOverrides } from '../src/infrastructure/config'
import type { DependencyOverrides } from '../src/infrastructure/diConfig'
import { registerDependencies } from '../src/infrastructure/diConfig'

export type TestContext = {
  diContainer: AwilixContainer<Cradle>
}

export function createTestContext(
  dependencyOverrides: DependencyOverrides = {},
  configOVerrides: ConfigOverrides = {},
): TestContext {
  const diContainer = createContainer({
    injectionMode: 'PROXY',
  })

  const fakeApp: Partial<FastifyInstance> = {
    newrelicTransactionManager: new NewRelicTransactionManager(false),
  }

  const dependencies = {
    ...dependencyOverrides,
    config: asFunction(() => {
      return merge(getConfig(), configOVerrides)
    }),
  }

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
