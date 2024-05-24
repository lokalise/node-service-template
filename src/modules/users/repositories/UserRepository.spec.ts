import type { Cradle } from '@fastify/awilix'
import type { AwilixContainer } from 'awilix'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DB_MODEL, cleanTables } from '../../../../test/DbCleaner.js'
import type { TestContext } from '../../../../test/TestContext.js'
import { createTestContext, destroyTestContext } from '../../../../test/TestContext.js'
import { TEST_USER_1 } from '../../../../test/fixtures/testUsers.js'

describe('UserRepository', () => {
  let testContext: TestContext
  let diContainer: AwilixContainer<Cradle>
  beforeEach(async () => {
    testContext = await createTestContext()
    diContainer = testContext.diContainer
    await cleanTables(diContainer.cradle.prisma, [DB_MODEL.User])
  })
  afterEach(async () => {
    await destroyTestContext(testContext)
  })

  describe('getUser', () => {
    it('Returns NOT_FOUND for non-existing user', async () => {
      const { userRepository } = diContainer.cradle

      const result = await userRepository.getUser('dummy')

      expect(result).toBeNull()
    })

    it('Returns value for existing user', async () => {
      const { userRepository } = diContainer.cradle
      const user = await userRepository.createUser({
        ...TEST_USER_1,
      })

      const result = await userRepository.getUser(user.id)

      expect(result).toMatchObject(user)
    })
  })

  describe('createUser', () => {
    it('creates user', async () => {
      const { userRepository } = diContainer.cradle

      const user = await userRepository.createUser({
        ...TEST_USER_1,
      })

      expect(user).toMatchObject({
        name: TEST_USER_1.name,
        email: TEST_USER_1.email,
      })
    })
  })
})
