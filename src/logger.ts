import { trace } from '@opentelemetry/api';

/**
 * A JSON log line. If there is an active span, adds trace_id and span_id:
 * so all logs of a slow trace from Jaeger can be found by trace_id.
 */
export function logLine(level: string, message: string, fields: Record<string, unknown> = {}): string {
  const ctx = trace.getActiveSpan()?.spanContext();
  return JSON.stringify({
    time: new Date().toISOString(),
    level,
    message,
    ...(ctx ? { trace_id: ctx.traceId, span_id: ctx.spanId } : {}),
    ...fields,
  });
}

export function log(level: string, message: string, fields: Record<string, unknown> = {}): void {
  console.log(logLine(level, message, fields));
}
