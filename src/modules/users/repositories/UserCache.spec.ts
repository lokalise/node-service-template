import type { Cradle } from '@fastify/awilix'
import type { AwilixContainer } from 'awilix'

import { cleanRedis } from '../../../../test/RedisCleaner'
import { createTestContext, destroyTestContext } from '../../../../test/TestContext'
import type { TestContext } from '../../../../test/TestContext'
import { HOUR_IN_SECONDS } from '../../../infrastructure/redis/AbstractRedisEntityCache'

describe('UserCache', () => {
  let testContext: TestContext
  let diContainer: AwilixContainer<Cradle>
  beforeEach(async () => {
    testContext = createTestContext()
    diContainer = testContext.diContainer
    await cleanRedis(diContainer.cradle.redis)
  })
  afterEach(async () => {
    await destroyTestContext(testContext)
  })

  describe('get', () => {
    it('Returns undefined for non-existing user', async () => {
      const { userCache } = diContainer.cradle

      const result = await userCache.get('dummy')

      expect(result).toBeUndefined()
    })

    it('Returns null for null user', async () => {
      const { userCache } = diContainer.cradle
      await userCache.set('dummy', null, HOUR_IN_SECONDS * 2)

      const result = await userCache.get('dummy')

      expect(result).toBeNull()
    })

    it('Returns value for existing user', async () => {
      const { userCache } = diContainer.cradle
      const user = {
        id: 1,
        email: 'test@test.lt',
        name: null,
      }
      await userCache.set('dummy', user, HOUR_IN_SECONDS * 2)

      const result = await userCache.get('dummy')

      expect(result).toEqual(user)
    })
  })

  describe('del', () => {
    it('Returns undefined for deleted user', async () => {
      const { userCache } = diContainer.cradle
      const user = {
        id: 1,
        email: 'test@test.lt',
        name: null,
      }
      await userCache.set('dummy', user, HOUR_IN_SECONDS * 2)
      const delResult = await userCache.del('dummy')

      const result = await userCache.get('dummy')

      expect(delResult).toBe(true)
      expect(result).toBeUndefined()
    })

    it('Returns false for deleting non-existing user', async () => {
      const { userCache } = diContainer.cradle

      const delResult = await userCache.del('dummy')

      expect(delResult).toBe(false)
    })
  })

  describe('delMultiple', () => {
    it('Deletes multiple users', async () => {
      const { userCache } = diContainer.cradle
      const user = {
        id: 1,
        email: 'test@test.lt',
        name: null,
      }
      await userCache.set('dummy', user, HOUR_IN_SECONDS * 2)
      await userCache.set('dummy2', user, HOUR_IN_SECONDS * 2)
      await userCache.set('dummy3', user, HOUR_IN_SECONDS * 2)

      const delResult = await userCache.delMultiple(['dummy', 'dummy3'])

      const result1 = await userCache.exists('dummy')
      const result2 = await userCache.exists('dummy2')
      const result3 = await userCache.exists('dummy3')
      expect(delResult).toBe(2)
      expect(result1).toBe(false)
      expect(result2).toBe(true)
      expect(result3).toBe(false)
    })
  })
})
