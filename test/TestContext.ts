import type { Cradle } from '@fastify/awilix'
import { NewRelicTransactionManager } from '@lokalise/fastify-extras'
import type { AwilixContainer } from 'awilix'
import { createContainer } from 'awilix'
import type { FastifyInstance } from 'fastify'

import type { DependencyOverrides } from '../src/infrastructure/diConfig'
import { registerDependencies } from '../src/infrastructure/diConfig'

export type TestContext = {
  diContainer: AwilixContainer<Cradle>
}

export function createTestContext(dependencyOverrides: DependencyOverrides = {}): TestContext {
  const diContainer = createContainer({
    injectionMode: 'PROXY',
  })
  const fakeApp: Partial<FastifyInstance> = {
    newrelicTransactionManager: new NewRelicTransactionManager(false),
  }
  registerDependencies(
    diContainer,
    {
      app: fakeApp as FastifyInstance,
    },
    dependencyOverrides,
  )

  return {
    diContainer,
  }
}

export async function destroyTestContext(testContext: TestContext) {
  await testContext.diContainer.dispose()
}
