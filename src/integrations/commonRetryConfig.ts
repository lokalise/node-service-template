import { createDefaultRetryResolver, type RetryConfig } from '@lokalise/backend-http-client'

export const commonRetryConfig: RetryConfig = {
  retryOnTimeout: false,
  maxAttempts: 5,
  delayResolver: createDefaultRetryResolver({
    baseDelay: 200,
  }),
}
