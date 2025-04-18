import type { Cradle } from '@fastify/awilix'
import { generateUuid7 } from '@lokalise/id-utils'
import type { AwilixContainer } from 'awilix'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { DB_MODEL, cleanTables } from '../../../../test/DbCleaner.ts'
import { type TestContext, testContextFactory } from '../../../../test/TestContext.ts'
import { TEST_USER_1 } from '../../../../test/fixtures/testUsers.ts'
import type { UserRepository } from './UserRepository.ts'

describe('UserRepository', () => {
  let testContext: TestContext
  let diContainer: AwilixContainer<Cradle>
  let userRepository: UserRepository

  beforeAll(async () => {
    testContext = await testContextFactory.createTestContext()
    diContainer = testContext.diContainer
    userRepository = diContainer.cradle.userRepository
  })

  beforeEach(async () => {
    await cleanTables(diContainer.cradle.drizzle, [DB_MODEL.User])
  })

  afterAll(async () => {
    await testContext.destroy()
  })

  describe('getUser', () => {
    it('Returns null for non-existing user', async () => {
      const result = await userRepository.getUser(generateUuid7())

      expect(result).toBeNull()
    })

    it('Returns value for existing user', async () => {
      const user = await userRepository.createUser({
        ...TEST_USER_1,
        id: generateUuid7(),
      })

      const result = await userRepository.getUser(user.id)

      expect(result).toMatchObject(user)
    })
  })

  describe('createUser', () => {
    it('creates user', async () => {
      const user = await userRepository.createUser({
        ...TEST_USER_1,
      })

      expect(user).toMatchObject({
        name: TEST_USER_1.name,
        email: TEST_USER_1.email,
      })
    })
  })

  describe('deleteUser', () => {
    it('deletes user', async () => {
      const user = await userRepository.createUser({
        ...TEST_USER_1,
      })

      const deletedUser = await userRepository.deleteUser(user.id)

      expect(deletedUser).toMatchObject({
        name: TEST_USER_1.name,
        email: TEST_USER_1.email,
      })

      expect(await userRepository.getUser(user.id)).toBeNull()
    })

    it('returns null for non-existing user to delete', async () => {
      const deletionResult = await userRepository.deleteUser(generateUuid7())

      expect(deletionResult).toBeNull()
    })
  })

  describe('updateUser', () => {
    it('updates user', async () => {
      const user = await userRepository.createUser({
        ...TEST_USER_1,
      })

      const updatedUser = await userRepository.updateUser(user.id, {
        name: 'Hello world!',
      })

      expect(updatedUser).toMatchObject({
        name: 'Hello world!',
        email: TEST_USER_1.email,
      })
    })

    it('returns null for non-existing user to update', async () => {
      const updatedUser = await userRepository.updateUser(generateUuid7(), {
        name: 'Hello world!',
      })

      expect(updatedUser).toBeNull()
    })
  })
})
