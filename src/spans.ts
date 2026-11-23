import { SpanStatusCode, trace } from '@opentelemetry/api';

/**
 * Wraps an asynchronous piece of code in a span: "this section took N ms".
 * If tracing is disabled, the API is a no-op and there is almost no overhead.
 */
export async function withSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: () => Promise<T>,
): Promise<T> {
  return trace.getTracer('latency-lab').startActiveSpan(name, { attributes }, async (span) => {
    try {
      return await fn();
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}
