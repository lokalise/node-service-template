import type { RetryConfig } from '@lokalise/backend-http-client'

export const commonRetryConfig: RetryConfig = {
  retryOnTimeout: false,
  maxRetries: 4,
  delay: (retryNumber) => 200 * 2 ** (retryNumber - 1),
}
