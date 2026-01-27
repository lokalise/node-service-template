// this needs to be the very first operation when starting the service

if (process.env.OTEL_ENABLED !== 'false') {
  const { initOpenTelemetry } = await import('@lokalise/opentelemetry-fastify-bootstrap')
  initOpenTelemetry({
    skippedPaths: ['/health', '/ready', '/live', '/metrics', '/'],
  })
}

const server = await import('./serverInternal.ts')

await server.startServer()
