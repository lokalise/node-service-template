import { gracefulOtelShutdown, initOpenTelemetry } from '@lokalise/opentelemetry-fastify-bootstrap'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { type AppInstance, getApp } from '../app.ts'

// Mutate env BEFORE the test body so getConfig() (called lazily inside getApp)
// observes OTEL_ENABLED=true. The bootstrap also refuses to initialize when
// NODE_ENV === 'test', so we swap that too.
const originalNodeEnv = process.env.NODE_ENV
const originalOtelEnabled = process.env.OTEL_ENABLED
const originalOtelExporterUrl = process.env.OTEL_EXPORTER_URL
const originalOtelConsoleSpansEnabled = process.env.OTEL_CONSOLE_SPANS_ENABLED

process.env.NODE_ENV = 'development'
process.env.OTEL_ENABLED = 'true'
process.env.OTEL_CONSOLE_SPANS_ENABLED = 'true'
// gRPC exporter URL is never reached: the in-memory exporter below captures
// everything we assert on, and the OTLP exporter only sees connection refused
// on shutdown (logged but harmless).
process.env.OTEL_EXPORTER_URL = 'grpc://localhost:4317'

const inMemoryExporter = new InMemorySpanExporter()

describe('OpenTelemetry bootstrap', () => {
  let app: AppInstance

  beforeAll(async () => {
    initOpenTelemetry({
      skippedPaths: [],
      consoleSpans: process.env.OTEL_CONSOLE_SPANS_ENABLED?.toLowerCase() === 'true',
      spanProcessors: [new SimpleSpanProcessor(inMemoryExporter)],
    })

    app = await getApp({
      healthchecksEnabled: true,
    })
  })

  afterAll(async () => {
    await app?.close()
    await gracefulOtelShutdown()
    process.env.NODE_ENV = originalNodeEnv
    process.env.OTEL_ENABLED = originalOtelEnabled
    process.env.OTEL_EXPORTER_URL = originalOtelExporterUrl
    process.env.OTEL_CONSOLE_SPANS_ENABLED = originalOtelConsoleSpansEnabled
  })

  it('emits @fastify/otel spans for HTTP requests through the real app', async () => {
    inMemoryExporter.reset()

    const response = await app.inject({ method: 'GET', url: '/live' })
    expect(response.statusCode).toBe(200)

    // @fastify/otel ends the request span from an onResponse hook scheduled
    // after inject() resolves; yield a few macrotasks before reading.
    await new Promise((resolve) => setTimeout(resolve, 50))

    const spans = inMemoryExporter.getFinishedSpans()
    expect(spans.length).toBeGreaterThan(0)

    // @fastify/otel emits several spans per request (one per hook plus the
    // top-level "request" span); we assert on the top-level one because it
    // carries the response status code.
    const requestSpan = spans.find(
      (span) => span.instrumentationScope.name === '@fastify/otel' && span.name === 'request',
    )
    expect(requestSpan).toBeDefined()
    expect(requestSpan?.attributes).toMatchObject({
      'http.request.method': 'GET',
      'http.route': '/live',
      'http.response.status_code': 200,
    })
  })
})
