import { getLocal } from 'mockttp'

import { MockttpHelper } from '@lokalise/universal-testing-utils'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { type TestContext, testContextFactory } from '../../test/TestContext.ts'
import { GET_PRODUCT_CONTRACT } from './FakeStoreApiClient.ts'

const mockServer = getLocal()
const mockttpHelper = new MockttpHelper(mockServer)

describe('FakeStoreApiClient', () => {
  let testContext: TestContext

  beforeAll(async () => {
    await mockServer.start(8080)
    testContext = await testContextFactory.createTestContext()
    testContext.diContainer.cradle.config.integrations.fakeStore.baseUrl = mockServer.url
  })

  beforeEach(async () => {})

  afterEach(async () => {
    await mockServer.stop()
  })

  afterAll(async () => {
    await testContext.destroy()
  })

  describe('getProduct', () => {
    it('Returns product', async () => {
      const testProduct = { id: 1, name: 'dummy' }
      await mockttpHelper.mockValidResponse(GET_PRODUCT_CONTRACT, {
        pathParams: { productId: 1 },
        responseBody: testProduct,
      })
      const { fakeStoreApiClient } = testContext.diContainer.cradle

      const product = await fakeStoreApiClient.getProduct(1)

      expect(product).toMatchObject(testProduct)
    })
  })
})
