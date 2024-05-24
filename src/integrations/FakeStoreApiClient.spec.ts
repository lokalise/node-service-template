import { getLocal } from 'mockttp'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestContext } from '../../test/TestContext.js'
import { createTestContext, destroyTestContext } from '../../test/TestContext.js'

const JSON_HEADERS = {
  'content-type': 'application/json',
}
const BASE_URL = 'http://localhost:8080/'
const mockServer = getLocal()

describe('FakeStoreApiClient', () => {
  let testContext: TestContext

  beforeAll(async () => {
    testContext = await createTestContext()
    testContext.diContainer.cradle.config.integrations.fakeStore.baseUrl = BASE_URL
  })

  beforeEach(async () => {
    await mockServer.start(8080)
  })

  afterEach(async () => {
    await mockServer.stop()
  })

  afterAll(async () => {
    await destroyTestContext(testContext)
  })

  describe('getProduct', () => {
    it('Returns product', async () => {
      const testProduct = { id: 1, name: 'dummy' }
      await mockServer
        .forGet('/products/1')
        .thenReply(200, JSON.stringify(testProduct), JSON_HEADERS)
      const { fakeStoreApiClient } = testContext.diContainer.cradle

      const product = await fakeStoreApiClient.getProduct(1)

      expect(product).toMatchObject(testProduct)
    })
  })
})
