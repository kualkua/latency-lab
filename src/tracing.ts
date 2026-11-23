import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ExpressInstrumentation, ExpressLayerType } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NodeSDK } from '@opentelemetry/sdk-node';

/**
 * Enables tracing only if OTEL_EXPORTER_OTLP_ENDPOINT is set
 * (in docker-compose it points to the OpenTelemetry Collector).
 * Without the variable the app works as before, and trace API calls are no-ops.
 */
export function startTracing(): NodeSDK | undefined {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return undefined;
  }

  const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'latency-lab',
    // The address comes from OTEL_EXPORTER_OTLP_ENDPOINT; the /v1/traces path is added automatically.
    traceExporter: new OTLPTraceExporter(),
    // http: a span per incoming request; express: a span per route handler.
    // Spans from service middleware are disabled: they are noise that does not help find the cause.
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation({ ignoreLayersType: [ExpressLayerType.MIDDLEWARE] }),
    ],
  });
  sdk.start();

  // On container shutdown, flush the accumulated spans.
  process.on('SIGTERM', () => {
    sdk.shutdown().finally(() => process.exit(0));
  });
  return sdk;
}
