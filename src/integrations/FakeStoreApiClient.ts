import { buildClient, sendGet } from '@lokalise/backend-http-client'
import type { Client } from 'undici'
import z from 'zod'

import type { CommonDependencies } from '../infrastructure/commonDiConfig.js'

const GET_PRODUCT_RESPONSE_SCHEMA = z.object({
  id: z.number(),
  name: z.string(),
})

export class FakeStoreApiClient {
  private readonly client: Client

  constructor({ config }: CommonDependencies) {
    this.client = buildClient(config.integrations.fakeStore.baseUrl)
  }

  async getProduct(productId: number) {
    const response = await sendGet(this.client, `/products/${productId}`, {
      requestLabel: 'GET product from FakeStoreAPI',
      responseSchema: GET_PRODUCT_RESPONSE_SCHEMA,
      retryConfig: {
        statusCodesToRetry: [500, 502, 503],
        retryOnTimeout: false,
        maxAttempts: 5,
        delayBetweenAttemptsInMsecs: 200,
      },
    })

    return response.result.body
  }
}
