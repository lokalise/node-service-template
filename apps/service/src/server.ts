import { initOpenTelemetry } from '@lokalise/opentelemetry-fastify-bootstrap'
import { startServer } from './serverInternal.ts'

// this needs to be the very first operation when starting the service
if (process.env.OTEL_ENABLED !== 'false') {
  initOpenTelemetry({
    skippedPaths: ['/health', '/ready', '/live', '/metrics', '/'],
    // Local-only debugging aid. Forced off in production so span payloads
    // never leak to stdout in deployed environments.
    consoleSpans:
      process.env.NODE_ENV !== 'production' &&
      process.env.OTEL_CONSOLE_SPANS_ENABLED?.toLowerCase() === 'true',
  })
}

await startServer()
