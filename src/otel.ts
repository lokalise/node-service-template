import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter as OTLPTraceExporterGrpc } from '@opentelemetry/exporter-trace-otlp-grpc'
import { NodeSDK } from '@opentelemetry/sdk-node'

const isOpenTelemetryEnabled = process.env.OPEN_TELEMETRY_ENABLED?.toLowerCase() !== 'false'
let sdk: NodeSDK | undefined

if (isOpenTelemetryEnabled) {
  // Optional diagnostics
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO)

  // If you need to test OTel locally, use `new ConsoleSpanExporter()` traceExporter from "@opentelemetry/sdk-trace-node"
  const traceExporter = new OTLPTraceExporterGrpc({
    url: process.env.OPEN_TELEMETRY_EXPORTER_URL || 'grpc://localhost:4317',
  })

  // Setup SDK
  sdk = new NodeSDK({
    traceExporter,
    instrumentations: [getNodeAutoInstrumentations()],
  })

  sdk.start()
  diag.info('OpenTelemetry SDK initialized')
}

export async function gracefulOtelShutdown() {
  try {
    if (!sdk) {
      return
    }
    await sdk.shutdown()
    diag.info('OpenTelemetry SDK shutdown completed')
  } catch (error) {
    diag.error('Error during OpenTelemetry SDK shutdown:', error)
  }
}
