import { setTimeout } from 'node:timers/promises'
import type { CommonLogger } from '@lokalise/node-core'
import { gracefulOtelShutdown } from '@lokalise/opentelemetry-fastify-bootstrap'

export const OTEL_SHUTDOWN_TIMEOUT_MS = 5000

// fastify-graceful-shutdown replaces a timeout of 0 with this default
const GRACEFUL_SHUTDOWN_DEFAULT_TIMEOUT_MS = 10000

/**
 * Caps the OpenTelemetry wait at half the graceful shutdown budget, so draining and container
 * disposal keep the other half before the graceful shutdown timer ends the process.
 */
export function getOtelShutdownTimeoutMs(gracefulShutdownTimeoutMs: number): number {
  const budgetMs = gracefulShutdownTimeoutMs || GRACEFUL_SHUTDOWN_DEFAULT_TIMEOUT_MS
  return Math.min(OTEL_SHUTDOWN_TIMEOUT_MS, budgetMs / 2)
}

/**
 * Stops waiting for the OpenTelemetry SDK after `timeoutMs`. `sdk.shutdown()` has no timeout of
 * its own and can hang, and a hung shutdown otherwise runs out the graceful shutdown timer, which
 * ends the process with exit code 1.
 *
 * TODO: remove once lokalise/shared-ts-libs#1325 ships and use `gracefulOtelShutdown({ timeoutMs })`.
 */
export async function shutdownOtelWithTimeout(
  logger: CommonLogger,
  timeoutMs: number = OTEL_SHUTDOWN_TIMEOUT_MS,
  shutdown: () => Promise<void> = gracefulOtelShutdown,
): Promise<void> {
  const timer = new AbortController()
  const timedOut = Symbol('timedOut')

  try {
    const result = await Promise.race([
      shutdown(),
      setTimeout(timeoutMs, timedOut, { signal: timer.signal }),
    ])
    if (result === timedOut) {
      logger.warn({ timeoutMs }, '[OTEL] SDK shutdown timed out, spans still buffered are lost')
    }
  } finally {
    timer.abort()
  }
}
