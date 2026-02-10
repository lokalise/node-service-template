import { initOpenTelemetry } from '@lokalise/opentelemetry-fastify-bootstrap'
import { startServer } from './serverInternal.ts'

// this needs to be the very first operation when starting the service
if (process.env.OTEL_ENABLED !== 'false') {
  initOpenTelemetry({
    skippedPaths: ['/health', '/ready', '/live', '/metrics', '/'],
  })
}

await startServer()
