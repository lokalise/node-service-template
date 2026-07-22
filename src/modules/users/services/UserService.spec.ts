import { randomUUIDv7 } from 'node:crypto'
import type { Cradle } from '@fastify/awilix'
import { EntityNotFoundError } from '@lokalise/node-core'
import type { AwilixContainer } from 'awilix'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { cleanTables, DB_MODEL } from '../../../../test/DbCleaner.ts'
import { TEST_USER_1 } from '../../../../test/fixtures/testUsers.ts'
import { cleanRedis } from '../../../../test/RedisCleaner.ts'
import { createRequestContext } from '../../../../test/requestUtils.ts'
import { type TestContext, testContextFactory } from '../../../../test/TestContext.ts'
import type { UserService } from './UserService.ts'

describe('UserService', () => {
  let testContext: TestContext
  let diContainer: AwilixContainer<Cradle>
  let userService: UserService
  const requestContext = createRequestContext()

  beforeAll(async () => {
    testContext = await testContextFactory.createTestContext()
    diContainer = testContext.diContainer
    userService = diContainer.cradle.userService
  })

  beforeEach(async () => {
    await cleanTables(diContainer.cradle.drizzle, [DB_MODEL.User])
    await cleanRedis(diContainer.cradle.redis)
  })

  afterAll(async () => {
    await testContext.destroy()
  })

  describe('getUser', () => {
    it('throws for non-existing user', async () => {
      await expect(userService.getUser(requestContext, randomUUIDv7())).rejects.toThrow(
        EntityNotFoundError,
      )
    })
  })

  describe('getUsers', () => {
    it('returns users for given ids', async () => {
      const user1 = await userService.createUser({ ...TEST_USER_1 })
      const user2 = await userService.createUser({ name: 'Jane', email: 'jane@test.com' })
      await userService.createUser({ name: 'Bob', email: 'bob@test.com' })

      const result = await userService.getUsers(requestContext, [user1.id, user2.id])

      expect(result).toHaveLength(2)
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: user1.id, email: TEST_USER_1.email }),
          expect.objectContaining({ id: user2.id, email: 'jane@test.com' }),
        ]),
      )
    })

    it('returns empty array when no users match', async () => {
      const result = await userService.getUsers(requestContext, [randomUUIDv7()])

      expect(result).toEqual([])
    })
  })

  describe('findUserById', () => {
    it('returns user when it exists', async () => {
      const user = await userService.createUser({ ...TEST_USER_1 })

      const result = await userService.findUserById(requestContext, user.id)

      expect(result).toMatchObject({
        id: user.id,
        name: TEST_USER_1.name,
        email: TEST_USER_1.email,
      })
    })

    it('returns null for non-existing user', async () => {
      const result = await userService.findUserById(requestContext, randomUUIDv7())

      expect(result).toBeNull()
    })
  })
})
