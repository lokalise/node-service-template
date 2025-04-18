import { buildGetRoute } from '@lokalise/api-contracts'
import { buildClient, sendByGetRoute } from '@lokalise/backend-http-client'
import type { Client } from 'undici'
import z from 'zod'
import type { CommonDependencies } from '../infrastructure/CommonModule.ts'
import { commonRetryConfig } from './commonRetryConfig.ts'

const GET_PRODUCT_RESPONSE_SCHEMA = z.object({
  id: z.number(),
  name: z.string(),
})

const GET_PRODUCT_PATH_PARAMS_SCHEMA = z.object({
  productId: z.number(),
})

export const GET_PRODUCT_CONTRACT = buildGetRoute({
  successResponseBodySchema: GET_PRODUCT_RESPONSE_SCHEMA,
  requestPathParamsSchema: GET_PRODUCT_PATH_PARAMS_SCHEMA,
  description: 'Fake API',
  responseSchemasByStatusCode: {
    200: GET_PRODUCT_RESPONSE_SCHEMA,
  },
  pathResolver: (pathParams) => `/products/${pathParams.productId}`,
})

export class FakeStoreApiClient {
  private readonly client: Client

  constructor({ config }: CommonDependencies) {
    this.client = buildClient(config.integrations.fakeStore.baseUrl)
  }

  async getProduct(productId: number) {
    const response = await sendByGetRoute(
      this.client,
      GET_PRODUCT_CONTRACT,
      {
        pathParams: { productId },
      },
      {
        requestLabel: 'GET product from FakeStoreAPI',
        retryConfig: commonRetryConfig,
      },
    )

    return response.result.body
  }
}
