import type { Cradle } from '@fastify/awilix'
import type { AwilixContainer } from 'awilix'

import { cleanTables, DB_MODEL } from '../../../../test/DbCleaner'
import type { TestContext } from '../../../../test/TestContext'
import { createTestContext, destroyTestContext } from '../../../../test/TestContext'
import { TEST_USER_1 } from '../../../../test/fixtures/testUsers'

describe('UserRepository', () => {
  let testContext: TestContext
  let diContainer: AwilixContainer<Cradle>
  beforeEach(async () => {
    testContext = createTestContext()
    diContainer = testContext.diContainer
    await cleanTables(diContainer.cradle.prisma, [DB_MODEL.User])
  })
  afterEach(async () => {
    await destroyTestContext(testContext)
  })

  describe('getUser', () => {
    it('Returns NOT_FOUND for non-existing user', async () => {
      const { userRepository } = diContainer.cradle

      const result = await userRepository.getUser(0)

      expect(result).toMatchObject({
        error: 'NOT_FOUND',
      })
    })

    it('Returns value for existing user', async () => {
      const { userRepository } = diContainer.cradle
      const user = await userRepository.createUser({
        ...TEST_USER_1,
      })

      const result = await userRepository.getUser(user.id)

      expect(result).toMatchObject({
        result: user,
      })
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
