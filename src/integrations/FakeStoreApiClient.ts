import { defineApiContract } from '@lokalise/api-contracts'
import { buildClient, sendByApiContract } from '@lokalise/backend-http-client'
import type { Client } from 'undici'
import z from 'zod/v4'
import type { CommonDependencies } from '../infrastructure/CommonModule.ts'
import { commonRetryConfig } from './commonRetryConfig.ts'

const GET_PRODUCT_RESPONSE_SCHEMA = z.object({
  id: z.number(),
  name: z.string(),
})

const GET_PRODUCT_PATH_PARAMS_SCHEMA = z.object({
  productId: z.number(),
})

export const GET_PRODUCT_CONTRACT = defineApiContract({
  method: 'get',
  summary: 'Fake API',
  requestPathParamsSchema: GET_PRODUCT_PATH_PARAMS_SCHEMA,
  pathResolver: (pathParams) => `/products/${pathParams.productId}`,
  responsesByStatusCode: {
    200: GET_PRODUCT_RESPONSE_SCHEMA,
  },
})

export class FakeStoreApiClient {
  private readonly client: Client

  constructor({ config }: CommonDependencies) {
    this.client = buildClient(config.integrations.fakeStore.baseUrl)
  }

  async getProduct(productId: number) {
    const response = await sendByApiContract(this.client, GET_PRODUCT_CONTRACT, {
      pathParams: { productId },
      retry: commonRetryConfig,
    })

    if (response.error) {
      throw response.error
    }

    return response.result.body
  }
}
