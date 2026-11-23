import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp, MAX_BLOCK_MS } from '../src/app';

const noSleep = async () => {};

async function metricsText(app: ReturnType<typeof createApp>) {
  const res = await request(app).get('/metrics');
  return res.text;
}

describe('latency metrics', () => {
  it('after a request /metrics has a histogram with buckets, sum and count', async () => {
    const app = createApp({ sleep: noSleep, random: () => 0.5 });
    await request(app).get('/fast').expect(200);

    const text = await metricsText(app);
    expect(text).toContain('# TYPE http_request_duration_seconds histogram');
    expect(text).toMatch(/http_request_duration_seconds_bucket\{[^}]*le="0\.1"[^}]*\} 1/);
    expect(text).toMatch(/http_request_duration_seconds_bucket\{[^}]*le="\+Inf"[^}]*\} 1/);
    expect(text).toMatch(/http_request_duration_seconds_count\{[^}]*route="\/fast"[^}]*\} 1/);
    expect(text).toContain('http_request_duration_seconds_sum');
  });

  it('buckets are cumulative: a fast request falls into its own bucket and all above it', async () => {
    const app = createApp({ sleep: noSleep });
    await request(app).get('/fast').expect(200); // real time is a few ms

    const text = await metricsText(app);
    const bucket = (le: string) => {
      const m = text.match(
        new RegExp(`http_request_duration_seconds_bucket\\{le="${le.replace('+', '\\+')}"[^}]*route="/fast"[^}]*\\} (\\d+)`),
      );
      return Number(m?.[1]);
    };
    expect(bucket('2.5')).toBe(1);
    expect(bucket('+Inf')).toBe(1);
    expect(bucket('2.5')).toBeGreaterThanOrEqual(bucket('0.5'));
    expect(bucket('0.5')).toBeGreaterThanOrEqual(bucket('0.005'));
  });

  it('unknown URLs are grouped into route="unmatched" (protection against cardinality explosion)', async () => {
    const app = createApp();
    await request(app).get('/user/12345').expect(404);
    await request(app).get('/user/67890').expect(404);

    const text = await metricsText(app);
    expect(text).toMatch(/http_request_duration_seconds_count\{[^}]*route="unmatched"[^}]*\} 2/);
    expect(text).not.toContain('12345');
  });

  it('exports the event loop lag metric', async () => {
    const app = createApp();
    const text = await metricsText(app);
    expect(text).toContain('nodejs_eventloop_lag_p99_seconds');
  });
});

describe('/tail', () => {
  it('2% of the time takes the slow path of 500–900 ms', async () => {
    const sleep = vi.fn(async () => {});
    // random() < 0.02 → hit the tail
    const app = createApp({ sleep, random: () => 0.01 });
    const res = await request(app).get('/tail').expect(200);

    expect(res.body.slow).toBe(true);
    const ms = sleep.mock.calls[0][0] as number;
    expect(ms).toBeGreaterThanOrEqual(500);
    expect(ms).toBeLessThanOrEqual(900);
  });

  it('otherwise takes the fast path of 5–15 ms', async () => {
    const sleep = vi.fn(async () => {});
    const app = createApp({ sleep, random: () => 0.9 });
    const res = await request(app).get('/tail').expect(200);

    expect(res.body.slow).toBe(false);
    const ms = sleep.mock.calls[0][0] as number;
    expect(ms).toBeGreaterThanOrEqual(5);
    expect(ms).toBeLessThanOrEqual(15);
  });
});

describe('/blocking', () => {
  it('blocks the thread for the requested time', async () => {
    const busyWait = vi.fn();
    const app = createApp({ busyWait });
    const res = await request(app).get('/blocking?ms=150').expect(200);

    expect(busyWait).toHaveBeenCalledWith(150);
    expect(res.body.blockedMs).toBe(150);
  });

  it('caps the blocking time and ignores garbage input', async () => {
    const busyWait = vi.fn();
    const app = createApp({ busyWait });

    await request(app).get('/blocking?ms=999999').expect(200);
    expect(busyWait).toHaveBeenLastCalledWith(MAX_BLOCK_MS);

    await request(app).get('/blocking?ms=abc').expect(200);
    expect(busyWait).toHaveBeenLastCalledWith(200);
  });
});
