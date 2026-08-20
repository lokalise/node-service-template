import { ApiContractMockttpHelper } from '@lokalise/universal-testing-utils'
import { getLocal } from 'mockttp'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { type TestContext, testContextFactory } from '../../test/TestContext.ts'
import { GET_PRODUCT_CONTRACT } from './FakeStoreApiClient.ts'

const mockServer = getLocal()
const mockttpHelper = new ApiContractMockttpHelper(mockServer)

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
      await mockttpHelper.mockResponse(GET_PRODUCT_CONTRACT, {
        pathParams: { productId: 1 },
        responseStatus: 200,
        responseJson: testProduct,
      })
      const { fakeStoreApiClient } = testContext.diContainer.cradle

      const product = await fakeStoreApiClient.getProduct(1)

      expect(product).toMatchObject(testProduct)
    })
  })
})
