import { context } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { TracerProvider } from '@opentelemetry/sdk-trace';
import { beforeAll, describe, expect, it } from 'vitest';
import { logLine } from '../src/logger';

beforeAll(() => {
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
});

describe('logLine', () => {
  it('without an active span has no trace_id', () => {
    const parsed = JSON.parse(logLine('info', 'hello', { a: 1 }));
    expect(parsed).toMatchObject({ level: 'info', message: 'hello', a: 1 });
    expect(parsed.trace_id).toBeUndefined();
  });

  it('inside an active span adds trace_id and span_id of that span', () => {
    const tracer = new TracerProvider().getTracer('test');

    tracer.startActiveSpan('s', (span) => {
      const { traceId, spanId } = span.spanContext();
      const parsed = JSON.parse(logLine('info', 'in span'));
      span.end();

      expect(parsed.trace_id).toBe(traceId);
      expect(parsed.span_id).toBe(spanId);
    });
  });
});
