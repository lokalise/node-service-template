import type { Cradle } from '@fastify/awilix'
import type { AwilixContainer } from 'awilix'

import { cleanRedis } from '../../../../test/RedisCleaner'
import { createTestContext, destroyTestContext } from '../../../../test/TestContext'
import type { TestContext } from '../../../../test/TestContext'
import { HOUR_IN_SECONDS } from '../../../infrastructure/redis/AbstractRedisEntityCache'

describe('UrlCache', () => {
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
    it('Returns undefined for non-existing url', async () => {
      const { urlCache } = diContainer.cradle

      const result = await urlCache.get('dummy')

      expect(result).toBeUndefined()
    })

    it('Returns null for null url', async () => {
      const { urlCache } = diContainer.cradle
      await urlCache.set('dummy', null, HOUR_IN_SECONDS * 2)

      const result = await urlCache.get('dummy')

      expect(result).toBeNull()
    })

    it('Returns value for existing url', async () => {
      const { urlCache } = diContainer.cradle
      const url = 'www.lokalise.com'
      await urlCache.set('dummy', url, HOUR_IN_SECONDS * 2)

      const result = await urlCache.get('dummy')

      expect(result).toEqual(url)
    })
  })

  describe('del', () => {
    it('Returns undefined for deleted url', async () => {
      const { urlCache } = diContainer.cradle
      const url = 'www.lokalise.com'
      await urlCache.set('dummy', url, HOUR_IN_SECONDS * 2)
      await urlCache.del('dummy')

      const result = await urlCache.get('dummy')

      expect(result).toBeUndefined()
    })
  })

  describe('delMultiple', () => {
    it('Deletes multiple urls', async () => {
      const { urlCache } = diContainer.cradle
      const url = 'www.lokalise.com'
      await urlCache.set('dummy', url, HOUR_IN_SECONDS * 2)
      await urlCache.set('dummy2', url, HOUR_IN_SECONDS * 2)
      await urlCache.set('dummy3', url, HOUR_IN_SECONDS * 2)

      await urlCache.delMultiple(['dummy', 'dummy3'])

      const result1 = await urlCache.exists('dummy')
      const result2 = await urlCache.exists('dummy2')
      const result3 = await urlCache.exists('dummy3')
      expect(result1).toBe(false)
      expect(result2).toBe(true)
      expect(result3).toBe(false)
    })
  })
})
