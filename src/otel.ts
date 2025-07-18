import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter as OTLPTraceExporterGrpc } from '@opentelemetry/exporter-trace-otlp-grpc'
import { NodeSDK } from '@opentelemetry/sdk-node'

// This needs to be imported and run before any other code in your app

const isOpenTelemetryEnabled = process.env.OPEN_TELEMETRY_ENABLED?.toLowerCase() !== 'false'
let sdk: NodeSDK | undefined

if (isOpenTelemetryEnabled) {
  // Optional diagnostics
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO)

  // If you need to test OTel locally, use this exporter
  // const consoleSpanExporter = new ConsoleSpanExporter()

  const traceExporter = new OTLPTraceExporterGrpc({
    url: process.env.OPEN_TELEMETRY_EXPORTER_URL || 'grpc://localhost:4317',
  })

  // const skippedPaths = ['/health', '/metrics', '/']

  // Setup SDK
  sdk = new NodeSDK({
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations(
        // ToDo Restore this when https://github.com/open-telemetry/opentelemetry-js-contrib/issues/2944 is implemented
        /*
        {
        '@opentelemetry/instrumentation-fastify': {
          ignoreIncomingRequestHook: (req) => {
            if (!req.url) return false
            // Ignore path and query string, if needed
            const path = req.url.split('?')[0]
            return skippedPaths.includes(path!)
          },
        },
      }
         */
      ),
    ],
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
