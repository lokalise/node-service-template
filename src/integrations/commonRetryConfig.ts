import { constants as httpConstants } from 'node:http2'

import type { RetryConfig } from 'undici-retry'

export const commonRetryConfig: RetryConfig = {
  statusCodesToRetry: [
    httpConstants.HTTP_STATUS_REQUEST_TIMEOUT,
    httpConstants.HTTP_STATUS_LOCKED, // 423 Resource is blocked
    httpConstants.HTTP_STATUS_TOO_MANY_REQUESTS,
    httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR,
    httpConstants.HTTP_STATUS_SERVICE_UNAVAILABLE,
    httpConstants.HTTP_STATUS_GATEWAY_TIMEOUT,
  ],
  retryOnTimeout: false,
  maxAttempts: 5,
  delayBetweenAttemptsInMsecs: 200,
}
