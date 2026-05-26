import { describe, expect, it } from 'vitest'
import { commonRetryConfig } from './commonRetryConfig.ts'

describe('commonRetryConfig', () => {
  it('computes exponential delay with a 200ms base', () => {
    // 200 * 2^(n-1): 200, 400, 800, 1600 for retries 1..4
    expect(commonRetryConfig.delay?.(1)).toBe(200)
    expect(commonRetryConfig.delay?.(2)).toBe(400)
    expect(commonRetryConfig.delay?.(3)).toBe(800)
    expect(commonRetryConfig.delay?.(4)).toBe(1600)
  })

  it('caps retries at 4 (5 total attempts) and disables timeout retries', () => {
    expect(commonRetryConfig.maxRetries).toBe(4)
    expect(commonRetryConfig.retryOnTimeout).toBe(false)
  })
})
