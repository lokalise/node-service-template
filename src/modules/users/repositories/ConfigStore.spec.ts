import type { Cradle } from '@fastify/awilix'
import type { AwilixContainer } from 'awilix'

import { cleanRedis } from '../../../../test/RedisCleaner'
import { createTestContext, destroyTestContext } from '../../../../test/TestContext'
import type { TestContext } from '../../../../test/TestContext'
import { HOUR_IN_SECONDS } from '../../../infrastructure/redis/AbstractRedisEntityCache'

describe('ConfigStore', () => {
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

  describe('set', () => {
    it('Throws an error for a function', async () => {
      const { configStore } = diContainer.cradle

      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      await expect(() => configStore.set('dummy', ((x: unknown) => x) as any, 77)).rejects.toThrow(
        /Unsupported config store value/,
      )
    })
  })

  describe('get', () => {
    it('Returns undefined for non-existing config value', async () => {
      const { configStore } = diContainer.cradle

      const result = await configStore.get('dummy')

      expect(result).toBeUndefined()
    })

    it('Returns null for null config value', async () => {
      const { configStore } = diContainer.cradle
      await configStore.set('dummy', null, HOUR_IN_SECONDS * 2)

      const result = await configStore.get('dummy')

      expect(result).toBeNull()
    })

    it('Returns value for existing numeric config value', async () => {
      const { configStore } = diContainer.cradle
      const chunkSize = 5000
      await configStore.set('chunkSize', chunkSize, HOUR_IN_SECONDS * 2)

      const result = await configStore.getInteger('chunkSize')

      expect(result).toBe(5000)
    })

    it('Returns value for existing string config value', async () => {
      const { configStore } = diContainer.cradle
      const title = 'dummy'
      await configStore.set('title', title, HOUR_IN_SECONDS * 2)

      const result = await configStore.get('title')

      expect(result).toEqual(title)
    })

    it('Returns value for existing date config value', async () => {
      const { configStore } = diContainer.cradle
      await configStore.set('date', new Date('2012-01-01'), HOUR_IN_SECONDS * 2)

      const result = await configStore.get('date')

      expect(result).toBe('2012-01-01T00:00:00.000Z')
    })

    it('Returns value for existing bigint value', async () => {
      const { configStore } = diContainer.cradle
      const value = 123422222222222222222222222222222222222n
      await configStore.set('date', value, HOUR_IN_SECONDS * 2)

      const result = await configStore.get('date')

      expect(result).toBe('123422222222222222222222222222222222222')
    })

    it('Returns value for existing boolean config value', async () => {
      const { configStore } = diContainer.cradle
      const isEnabled = true
      const isDisabled = false
      await configStore.set('isEnabled', isEnabled, HOUR_IN_SECONDS * 2)
      await configStore.set('isDisabled', isDisabled, HOUR_IN_SECONDS * 2)

      const resultEnabled = await configStore.getBoolean('isEnabled')
      const resultDisabled = await configStore.getBoolean('isDisabled')

      expect(resultEnabled).toBe(true)
      expect(resultDisabled).toBe(false)
    })

    it('Returns value for existing object config value', async () => {
      const { configStore } = diContainer.cradle
      const config = {
        key1: 'a',
        key2: 13,
        key3: true,
        key4: {
          id: 1,
        },
      }
      await configStore.set('config', config, HOUR_IN_SECONDS * 2)

      const result = await configStore.getObject('config')

      expect(result).toEqual(config)
    })
  })

  describe('del', () => {
    it('Returns undefined for deleted config value', async () => {
      const { configStore } = diContainer.cradle
      const url = 'www.lokalise.com'
      await configStore.set('dummy', url, HOUR_IN_SECONDS * 2)
      await configStore.del('dummy')

      const result = await configStore.get('dummy')

      expect(result).toBeUndefined()
    })
  })

  describe('delMultiple', () => {
    it('Deletes multiple config values', async () => {
      const { configStore } = diContainer.cradle
      const url = 'www.lokalise.com'
      await configStore.set('dummy', url, HOUR_IN_SECONDS * 2)
      await configStore.set('dummy2', url, HOUR_IN_SECONDS * 2)
      await configStore.set('dummy3', url, HOUR_IN_SECONDS * 2)

      await configStore.delMultiple(['dummy', 'dummy3'])

      const result1 = await configStore.exists('dummy')
      const result2 = await configStore.exists('dummy2')
      const result3 = await configStore.exists('dummy3')
      expect(result1).toBe(false)
      expect(result2).toBe(true)
      expect(result3).toBe(false)
    })
  })
})
