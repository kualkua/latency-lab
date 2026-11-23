import { context, propagation, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { TracerProvider } from '@opentelemetry/sdk-trace';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { withSpan } from '../src/spans';
import { createHttpWallet } from '../src/wallet-client';

// NodeSDK does these three lines in the app; in the test we enable them manually.
beforeAll(() => {
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  trace.setGlobalTracerProvider(new TracerProvider());
});

describe('context propagation', () => {
  it('the HTTP client sends traceparent with the trace_id of the current trace', async () => {
    const fetchMock = vi.fn(async () => Response.json({ slow: false }));
    const wallet = createHttpWallet('http://wallet', fetchMock as unknown as typeof fetch);

    let activeTraceId = '';
    await withSpan('outer', {}, async () => {
      activeTraceId = trace.getActiveSpan()!.spanContext().traceId;
      await wallet.getBalance();
    });

    const init = fetchMock.mock.calls[0][1] as unknown as RequestInit;
    const traceparent = (init.headers as Record<string, string>).traceparent;
    // format: 00-<trace_id 32 hex>-<span_id 16 hex>-<flags>
    expect(traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/);
    expect(traceparent.split('-')[1]).toBe(activeTraceId);
  });

  it('without an active span the traceparent header is not added', async () => {
    const fetchMock = vi.fn(async () => Response.json({ slow: false }));
    await createHttpWallet('http://wallet', fetchMock as unknown as typeof fetch).getBalance();

    const init = fetchMock.mock.calls[0][1] as unknown as RequestInit;
    expect((init.headers as Record<string, string>).traceparent).toBeUndefined();
  });
});
