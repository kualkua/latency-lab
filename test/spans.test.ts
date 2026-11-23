import { SpanStatusCode, trace } from '@opentelemetry/api';
import { InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { withSpan } from '../src/spans';

const exporter = new InMemorySpanExporter();
const provider = new TracerProvider({ spanProcessors: [new SimpleSpanProcessor({ exporter })] });

// Span export is asynchronous, so flush the queue before reading.
async function finishedSpans() {
  await provider.forceFlush();
  return exporter.getFinishedSpans();
}

beforeAll(() => {
  trace.setGlobalTracerProvider(provider);
});

beforeEach(() => exporter.reset());

describe('withSpan', () => {
  it('creates a span with a name and attributes and returns the result', async () => {
    const result = await withSpan('demo', { a: 1 }, async () => 42);

    const [span] = await finishedSpans();
    expect(result).toBe(42);
    expect(span.name).toBe('demo');
    expect(span.attributes.a).toBe(1);
  });

  it('on error marks the span as ERROR, rethrows the error and ends the span', async () => {
    await expect(
      withSpan('boom', {}, async () => {
        throw new Error('fail');
      }),
    ).rejects.toThrow('fail');

    const [span] = await finishedSpans();
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.events.some((e) => e.name === 'exception')).toBe(true);
  });
});

describe('spans in routes', () => {
  it('/tail on the slow path records a db.query span with tail.slow=true', async () => {
    const app = createApp({ sleep: async () => {}, random: () => 0.01 });
    await request(app).get('/tail').expect(200);

    const span = (await finishedSpans()).find((s) => s.name === 'db.query');
    expect(span?.attributes['tail.slow']).toBe(true);
  });

  it('/fast records a cache.lookup span', async () => {
    const app = createApp({ sleep: async () => {} });
    await request(app).get('/fast').expect(200);

    expect((await finishedSpans()).map((s) => s.name)).toContain('cache.lookup');
  });
});
