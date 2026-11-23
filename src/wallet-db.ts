import { withSpan } from './spans';

export const TAIL_PROBABILITY = 0.02; // 2% of requests fall into the "tail"

export interface DbOptions {
  random: () => number;
  sleep: (ms: number) => Promise<void>;
}

/** Simulated DB query: 98% fast (5–15 ms) and 2% slow (500–900 ms). */
export async function simulateDbQuery({ random, sleep }: DbOptions): Promise<{ slow: boolean }> {
  const slow = random() < TAIL_PROBABILITY;
  // In the trace of a slow request this span takes almost all the time.
  await withSpan('db.query', { 'db.system': 'simulated', 'tail.slow': slow }, () =>
    sleep(slow ? 500 + random() * 400 : 5 + random() * 10),
  );
  return { slow };
}
