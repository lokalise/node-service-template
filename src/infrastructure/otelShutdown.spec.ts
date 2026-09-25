import type { CommonLogger } from '@lokalise/node-core'
import { describe, expect, it, vi } from 'vitest'
import { getOtelShutdownTimeoutMs, shutdownOtelWithTimeout } from './otelShutdown.ts'

function createLogger() {
  return { warn: vi.fn() } as unknown as CommonLogger & { warn: ReturnType<typeof vi.fn> }
}

describe('shutdownOtelWithTimeout', () => {
  it('resolves once the SDK shutdown completes', async () => {
    const logger = createLogger()
    const shutdown = vi.fn().mockResolvedValue(undefined)

    await shutdownOtelWithTimeout(logger, 1000, shutdown)

    expect(shutdown).toHaveBeenCalledOnce()
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('stops waiting for a hung SDK shutdown after the timeout', async () => {
    const logger = createLogger()
    const shutdown = () => new Promise<void>(() => {})

    await shutdownOtelWithTimeout(logger, 10, shutdown)

    expect(logger.warn).toHaveBeenCalledWith(
      { timeoutMs: 10 },
      '[OTEL] SDK shutdown timed out, spans still buffered are lost',
    )
  })
})

describe('getOtelShutdownTimeoutMs', () => {
  it('caps the wait at half the graceful shutdown budget', () => {
    expect(getOtelShutdownTimeoutMs(6000)).toBe(3000)
  })

  it('keeps the default wait for a large budget', () => {
    expect(getOtelShutdownTimeoutMs(30000)).toBe(5000)
  })

  it('treats a budget of 0 as the plugin default of 10s', () => {
    expect(getOtelShutdownTimeoutMs(0)).toBe(5000)
  })
})
