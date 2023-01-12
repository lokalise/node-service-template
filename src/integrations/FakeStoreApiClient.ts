import { sendGet } from '@lokalise/node-core'

import type { Dependencies } from '../infrastructure/diConfig'
import type { FreeformRecord } from '../schemas/commonTypes'

export class FakeStoreApiClient {
  private fakeStoreApiBaseUrl: string

  constructor({ config }: Dependencies) {
    this.fakeStoreApiBaseUrl = config.integrations.fakeStore.baseUrl
  }

  async getProduct(productId: number): Promise<FreeformRecord> {
    const response = await sendGet<FreeformRecord>(
      this.fakeStoreApiBaseUrl,
      `products/${productId}`,
    )
    return response.body
  }
}
