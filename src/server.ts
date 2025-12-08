// this needs to be the very first operation when starting the service
await import('./otel.ts')

const server = await import('./serverInternal.ts')

await server.startServer()
